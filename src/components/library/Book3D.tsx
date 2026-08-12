import React, { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Book3DProps {
  coverUrl?: string | null;
  title?: string;
  onClick?: () => void;
  className?: string;
}

export function Book3D({ coverUrl, title, onClick, className = "" }: Book3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [15, -15]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-15, 15]);
  
  // Glare effect
  const glareX = useTransform(mouseX, [-0.5, 0.5], [100, 0]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], [100, 0]);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPos = (clientX - left) / width - 0.5;
    const yPos = (clientY - top) / height - 0.5;
    x.set(xPos);
    y.set(yPos);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={{ rotateX, rotateY, zIndex: isHovered ? 50 : 1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative cursor-pointer perspective-1000 group preserve-3d w-32 h-48 flex-shrink-0 transition-transform duration-300 ${isHovered ? 'scale-110 -translate-y-4' : ''} ${className}`}
    >
      {/* Front Cover */}
      <div className="absolute inset-0 bg-background rounded-r-md rounded-l-sm shadow-2xl overflow-hidden border border-white/10 preserve-3d transform translate-z-[10px]">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/20 flex items-center justify-center p-2 text-center text-xs font-bold">
            {title || "Unknown Book"}
          </div>
        )}
        
        {/* Realistic Glare Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`
          }}
        />
        
        {/* Book spine indent shadow on front cover */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Book Spine */}
      <div className="absolute left-0 top-0 bottom-0 w-[20px] bg-[#1a1a1a] border-y border-l border-white/10 origin-left transform -rotate-y-90 shadow-inner flex items-center justify-center overflow-hidden">
        <span className="text-[8px] text-white/50 whitespace-nowrap transform -rotate-90 origin-center absolute w-32 text-center">
          {title || "Book Spine"}
        </span>
      </div>

      {/* Book Pages (Right Side) */}
      <div className="absolute right-0 top-1 bottom-1 w-[20px] bg-white origin-right transform rotate-y-90 rounded-r-sm shadow-inner flex flex-col justify-evenly px-0.5">
        {/* Page lines */}
        {Array.from({length: 15}).map((_, i) => (
          <div key={i} className="w-full h-[1px] bg-black/10" />
        ))}
      </div>

      {/* Book Pages (Top Side) */}
      <div className="absolute top-0 left-[2px] right-[2px] h-[20px] bg-[#f0f0f0] origin-top transform rotate-x-90 flex flex-row justify-evenly py-0.5">
        {Array.from({length: 20}).map((_, i) => (
           <div key={i} className="h-full w-[1px] bg-black/10" />
        ))}
      </div>
      
      {/* Book Pages (Bottom Side) */}
      <div className="absolute bottom-0 left-[2px] right-[2px] h-[20px] bg-[#e0e0e0] origin-bottom transform -rotate-x-90 shadow-xl" />

      {/* Drop Shadow on the shelf */}
      <div className="absolute -bottom-2 left-2 right-[-10px] h-4 bg-black/60 blur-md transform translate-z-[-10px]" />
    </motion.div>
  );
}
