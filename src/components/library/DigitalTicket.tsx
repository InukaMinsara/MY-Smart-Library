import React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { format } from "date-fns";
import { Book, Calendar, User } from "lucide-react";
import QRCode from "react-qr-code";

export function DigitalTicket({ loan }: { loan: any }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPos = (clientX - left - width / 2) / 20;
    const yPos = (clientY - top - height / 2) / 20;
    x.set(xPos);
    y.set(-yPos);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  if (!loan) return null;

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateY: mouseX, rotateX: mouseY }}
      className="perspective-1000 w-full max-w-sm mx-auto"
    >
      <div className="relative group rounded-3xl overflow-hidden glass-extreme border border-white/10 shadow-2xl bg-black/40">
        {/* Holographic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-accent/30 opacity-50 mix-blend-overlay pointer-events-none group-hover:opacity-80 transition-opacity duration-500" />
        
        {/* Animated Scanning Line */}
        <motion.div 
          animate={{ top: ["-10%", "110%", "-10%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-[2px] bg-primary/50 shadow-[0_0_20px_rgba(var(--primary),1)] z-10 opacity-30 pointer-events-none"
        />

        <div className="p-6 relative z-10 flex flex-col gap-6">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">E-Ticket ID</div>
              <div className="text-xl font-mono tracking-tight text-white">{loan.loan_number}</div>
            </div>
            <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
              <Book className="text-primary h-6 w-6" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase flex items-center gap-1 mb-1"><Book className="w-3 h-3"/> Title</div>
              <div className="text-sm font-medium text-white truncate">{loan.book_copies?.books?.title}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase flex items-center gap-1 mb-1"><Calendar className="w-3 h-3"/> Issued</div>
                <div className="text-sm font-medium text-white">{format(new Date(loan.issued_at), "MMM dd, yyyy")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase flex items-center gap-1 mb-1 text-red-400"><Calendar className="w-3 h-3"/> Due</div>
                <div className="text-sm font-bold text-red-400">{format(new Date(loan.due_at), "MMM dd, yyyy")}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase flex items-center gap-1 mb-1"><User className="w-3 h-3"/> Member</div>
              <div className="text-sm font-medium text-white truncate">{loan.members?.full_name}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="bg-white p-2 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.2)]">
               <QRCode value={loan.loan_number || "unknown"} size={64} className="h-16 w-16" />
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1">Status</div>
              <div className="text-sm font-bold text-green-400 uppercase tracking-widest animate-pulse">ACTIVE LOAN</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
