import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Sparkles, BrainCircuit } from "lucide-react";
import { Book3D } from "./Book3D";
import { Badge } from "@/components/ui/badge";

export function AICarousel() {
  const { data: books, isLoading } = useQuery({
    queryKey: ["ai-recommendations"],
    queryFn: async () => {
      // For now, just grab a few random books to serve as recommendations
      const { data } = await supabase.from("books").select("*").limit(8);
      return data ?? [];
    },
  });

  if (isLoading || !books || books.length === 0) return null;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden glass-extreme border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)] mb-8 p-1">
      {/* AI Glow background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 mix-blend-screen pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

      <div className="p-6 pb-2 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">AI Nexus Recommendations</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-accent" /> Curated based on your reading patterns
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5 font-mono text-[10px] tracking-widest uppercase animate-pulse hidden sm:flex">
          Processing Core Active
        </Badge>
      </div>

      <div className="relative w-full overflow-hidden mt-4 pb-8 z-10">
        <motion.div 
          className="flex gap-8 px-6 min-w-max cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: -1000, right: 0 }}
          whileTap={{ scale: 0.98 }}
        >
          {books.map((book) => (
            <div key={book.id} className="relative group flex flex-col items-center gap-4">
              <Book3D title={book.title} coverUrl={book.cover_url} className="w-28 h-40" />
              <div className="text-center w-28 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-xs font-semibold truncate text-white">{book.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{book.author}</div>
              </div>
              {/* Highlight connection line */}
              <div className="absolute -bottom-8 left-1/2 w-[1px] h-4 bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
