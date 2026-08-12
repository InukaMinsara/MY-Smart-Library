import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export function LiveTicker() {
  const { data: messages } = useQuery({
    queryKey: ["live-ticker"],
    queryFn: async () => {
      // Fetch recent 5 loans
      const { data: loans } = await supabase.from("loans")
        .select("id, status, book_copies(books(title)), members(full_name)")
        .order("issued_at", { ascending: false })
        .limit(5);

      const items = [
        "SYSTEM: Deep learning recommendation core is online.",
        "ALERT: Holographic projector in Section 4 requires maintenance.",
        "EVENT: Author meet-and-greet in the Virtual Atrium tomorrow.",
      ];

      if (loans) {
        loans.forEach(l => {
          const title = l.book_copies?.books?.title;
          const name = l.members?.full_name?.split(' ')[0] || "A member";
          if (l.status === 'active') {
             items.push(`UPDATE: ${name} just borrowed "${title}".`);
          } else if (l.status === 'returned') {
             items.push(`UPDATE: "${title}" was just returned to the shelf.`);
          }
        });
      }
      
      return items;
    },
    refetchInterval: 30000 // Refetch every 30s
  });

  if (!messages || messages.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-black/80 backdrop-blur-md border-t border-primary/20 z-50 flex items-center overflow-hidden">
      <div className="flex-shrink-0 bg-primary text-black font-mono text-[10px] font-bold h-full flex items-center px-4 gap-2 z-10 shadow-[5px_0_15px_rgba(0,0,0,0.8)]">
        <Activity className="w-3 h-3 animate-pulse" />
        LIVE FEED
      </div>
      <div className="flex-1 relative flex items-center h-full overflow-hidden mask-edges">
        <motion.div
          className="flex whitespace-nowrap gap-12 absolute left-0"
          animate={{ x: ["100%", "-100%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {messages.map((msg, i) => (
            <div key={i} className="text-xs font-mono text-primary/80 uppercase tracking-wider">
              {msg}
            </div>
          ))}
          {/* Duplicate for seamless scrolling visually, though framer-motion handles it via looping */}
          {messages.map((msg, i) => (
            <div key={i + 'dup'} className="text-xs font-mono text-primary/80 uppercase tracking-wider">
              {msg}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
