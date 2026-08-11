import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { MagneticButton } from "./MagneticButton";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      {/* Deep Atmospheric Background */}
      <div className="absolute inset-0 z-0 bg-background">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full bg-accent/20 blur-[120px] mix-blend-screen animate-blob" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[10%] left-[40%] w-[600px] h-[600px] rounded-full bg-secondary/20 blur-[150px] mix-blend-screen animate-blob" style={{ animationDelay: '4s' }} />
      </div>

      {/* Floating 3D Glass Cards (Parallax) */}
      <div className="absolute inset-0 z-10 pointer-events-none perspective-1000">
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-[20%] left-[10%] hidden lg:block"
        >
          <div className="w-64 h-80 glass-extreme rounded-2xl rotate-[-15deg] rotateX-[10deg] rotateY-[20deg] shadow-2xl p-6 flex flex-col gap-4 glow-primary">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="h-4 w-3/4 rounded-full bg-foreground/20" />
            <div className="h-4 w-1/2 rounded-full bg-foreground/20" />
            <div className="mt-auto h-32 w-full rounded-xl bg-gradient-to-tr from-primary/20 to-accent/20" />
          </div>
        </motion.div>

        <motion.div 
          style={{ y: y2 }}
          className="absolute top-[30%] right-[10%] hidden lg:block"
        >
          <div className="w-72 h-96 glass-extreme rounded-3xl rotate-[12deg] rotateX-[-15deg] rotateY-[-20deg] shadow-2xl p-8 backdrop-blur-2xl border-white/20">
            <div className="h-48 w-full rounded-2xl bg-foreground/5 mb-6" />
            <div className="space-y-3">
              <div className="h-3 w-full rounded-full bg-foreground/20" />
              <div className="h-3 w-5/6 rounded-full bg-foreground/20" />
              <div className="h-3 w-4/6 rounded-full bg-foreground/20" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <motion.div 
        style={{ opacity, scale }}
        className="relative z-20 container mx-auto px-4 flex flex-col items-center text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-extreme mb-8"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span className="text-sm font-medium tracking-wide">SYSTEM V2.0 ONLINE</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 3, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl sm:text-8xl md:text-9xl font-extrabold tracking-tighter leading-[0.9] mb-6"
        >
          <span className="block">BEYOND</span>
          <span className="block text-gradient">MANAGEMENT</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 3.2 }}
          className="max-w-2xl text-lg sm:text-2xl text-muted-foreground font-light tracking-wide mb-12"
        >
          Experience the world's most advanced cinematic library management system. 
          Built for the future of digital and physical archives.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 3.4 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <MagneticButton>
            <Link 
              to="/dashboard"
              className="interactive group relative inline-flex h-16 items-center justify-center gap-4 rounded-full bg-foreground px-10 text-lg font-medium text-background transition-transform hover:scale-105"
            >
              <span>Initialize System</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </MagneticButton>

          <MagneticButton>
            <a 
              href="#features"
              className="interactive inline-flex h-16 items-center justify-center rounded-full glass-extreme px-10 text-lg font-medium text-foreground transition-transform hover:scale-105 hover:bg-white/10"
            >
              Explore Architecture
            </a>
          </MagneticButton>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Scroll</span>
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-[1px] h-12 bg-gradient-to-b from-primary to-transparent"
        />
      </motion.div>
    </section>
  );
}
