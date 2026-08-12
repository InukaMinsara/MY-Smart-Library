import React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import QRCode from "react-qr-code";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function HolographicCard({ profile }: { profile: any }) {
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

  if (!profile) return null;

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateY: mouseX, rotateX: mouseY }}
      className="perspective-1000 w-full max-w-md mx-auto"
    >
      <div className="relative group rounded-2xl overflow-hidden glass-extreme border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-black/60 aspect-[1.6/1]">
        {/* Holographic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/30 via-purple-500/20 to-pink-500/30 opacity-40 mix-blend-color-dodge pointer-events-none group-hover:opacity-70 transition-opacity duration-500" />
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 translate-x-[-150%] skew-x-[-30deg] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-shimmer pointer-events-none" />

        <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              <div>
                <div className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-md">Smart Library</div>
                <div className="text-primary/80 text-[10px] tracking-widest uppercase">Global Access Card</div>
              </div>
            </div>
            {profile.type === "member" && (
              <div className="bg-white p-1.5 rounded-md shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                <QRCode value={profile.member_number || profile.id} size={48} className="h-12 w-12" />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white/20 shadow-lg">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-white font-bold">
                  {profile.full_name?.slice(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{profile.type === "member" ? "Member Name" : "Staff Name"}</div>
                <div className="text-xl font-bold text-white tracking-tight drop-shadow-md truncate max-w-[180px]">
                  {profile.full_name}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                {profile.type === "member" ? "Member ID" : "Role"}
              </div>
              <div className="text-sm font-mono font-medium text-white tracking-wider">
                {profile.type === "member" ? profile.member_number : profile.job_title}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
