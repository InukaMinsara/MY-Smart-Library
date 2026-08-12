import React from "react";
import { Book3D } from "./Book3D";

interface VirtualBookshelfProps {
  loans: any[];
}

export function VirtualBookshelf({ loans }: VirtualBookshelfProps) {
  if (!loans || loans.length === 0) return null;

  return (
    <div className="relative w-full overflow-x-auto py-12 px-8 perspective-1000">
      {/* 3D Shelf Container */}
      <div className="relative flex gap-8 min-w-max items-end transform-style-3d rotate-x-[10deg] pb-4 px-4 transition-transform duration-500 hover:rotate-x-[5deg]">
        
        {loans.map((loan) => (
          <Book3D 
            key={loan.id} 
            title={loan.book_copies?.books?.title} 
            coverUrl={loan.book_copies?.books?.cover_url}
          />
        ))}

        {/* The glowing neon shelf base */}
        <div className="absolute bottom-0 left-[-20px] right-[-20px] h-[30px] bg-gradient-to-b from-primary/40 to-black/80 border-t border-primary/50 rounded-sm transform translate-z-[-10px] shadow-[0_0_50px_rgba(var(--primary),0.2)]">
           {/* Shelf front edge */}
           <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/80 shadow-[0_0_10px_rgba(var(--primary),1)]" />
        </div>
        
        {/* Back wall of the shelf */}
        <div className="absolute bottom-[30px] left-[-20px] right-[-20px] h-[150px] bg-black/40 border-b border-primary/20 transform translate-z-[-50px] blur-sm pointer-events-none" />
      </div>
    </div>
  );
}
