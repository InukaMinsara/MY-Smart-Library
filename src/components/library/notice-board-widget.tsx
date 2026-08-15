import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, Info, BellRing, AlertCircle, Loader2 } from "lucide-react";

export function NoticeBoardWidget() {
  const { data: notices, isLoading } = useQuery({
    queryKey: ["active-notices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices" as any)
        .select("*")
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Notices fetch error:", error);
        return [];
      }
      return data || [];
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "event": return <Calendar className="h-5 w-5 text-blue-500" />;
      case "holiday": return <BellRing className="h-5 w-5 text-green-500" />;
      case "alert": return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "event": return "bg-blue-500/10 border-blue-500/20";
      case "holiday": return "bg-green-500/10 border-green-500/20";
      case "alert": return "bg-destructive/10 border-destructive/20";
      default: return "bg-primary/10 border-primary/20";
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <CardTitle className="text-lg flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" /> Notice Board
        </CardTitle>
        <CardDescription>Latest announcements and upcoming events.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !notices || notices.length === 0 ? (
          <div className="text-center py-8 px-4 text-muted-foreground">
            No active notices right now. Check back later!
          </div>
        ) : (
          <div className="divide-y">
            {notices.map((notice: any) => (
              <div key={notice.id} className={`p-4 hover:bg-muted/30 transition-colors flex gap-4 ${getColor(notice.type)}`}>
                <div className="mt-0.5 shrink-0">
                  {getIcon(notice.type)}
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notice.content}</p>
                  <div className="text-xs text-muted-foreground mt-2 font-medium">
                    Posted on {new Date(notice.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
