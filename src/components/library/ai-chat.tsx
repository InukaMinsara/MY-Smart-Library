import { useState } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { processChat } from "@/lib/ai.functions";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Send messages (excluding IDs for the AI provider, just role and content)
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const responseText = await processChat({ data: apiMessages });
      
      setMessages([...newMessages, { id: (Date.now() + 1).toString(), role: "assistant", content: responseText }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { id: (Date.now() + 1).toString(), role: "assistant", content: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl transition-all duration-300 z-50",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100 hover:scale-110"
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      <div
        className={cn(
          "fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] max-h-[calc(100vh-48px)] bg-background border shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 origin-bottom-right",
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 pointer-events-none translate-y-8"
        )}
      >
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <div>
              <h3 className="font-semibold text-sm">Library Assistant</h3>
              <p className="text-[10px] opacity-80">Powered by Mistral AI</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary-foreground/20 rounded-full" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4 bg-muted/10">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Hello! I'm your library assistant.</p>
                <p>Ask me anything about the library!</p>
              </div>
            )}
            
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  m.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    "px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap",
                    m.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-muted text-foreground rounded-tl-sm shadow-sm"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-muted text-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="px-4 py-2 rounded-2xl text-sm bg-muted text-foreground rounded-tl-sm shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce delay-150" />
                  <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce delay-300" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-full bg-muted/50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary/50"
            />
            <Button type="submit" size="icon" className="rounded-full shrink-0 shadow-md" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
