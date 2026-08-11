import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { MagneticButton } from "./MagneticButton";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function FooterCTA() {
  const containerRef = useRef(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [-200, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.5, 1]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Dynamic Lighting */}
      <motion.div 
        style={{ y, opacity }}
        className="absolute inset-0 pointer-events-none"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/20 blur-[150px] mix-blend-screen" />
      </motion.div>

      <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-6">
            READY TO <span className="text-gradient">UPGRADE?</span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto">
            Join the next generation of library management. Secure, lightning-fast, and beautiful.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <MagneticButton>
            <Link 
              to="/dashboard"
              className="interactive group relative inline-flex h-20 items-center justify-center gap-6 rounded-full bg-foreground px-12 text-2xl font-bold text-background transition-transform hover:scale-105 shadow-[0_0_40px_rgba(var(--color-foreground),0.3)]"
            >
              <span>Initialize System</span>
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-foreground transition-transform group-hover:rotate-45">
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>
          </MagneticButton>
        </motion.div>
      </div>
      
      {/* Actual Footer bar */}
      <div className="absolute bottom-0 w-full py-8 border-t border-white/10 glass-extreme flex flex-col md:flex-row items-center justify-between px-8 text-sm text-muted-foreground">
        <div>© 2035 Smart Library Systems. All rights reserved.</div>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a href="#" className="interactive hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="#" className="interactive hover:text-foreground transition-colors">Terms of Service</a>
        </div>
      </div>
    </section>
  );
}
