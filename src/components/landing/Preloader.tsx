import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Preloader() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if we already loaded this session to avoid annoying the user on refresh
    const hasLoaded = sessionStorage.getItem("preloader_shown");
    if (hasLoaded) {
      setIsLoading(false);
      return;
    }

    const duration = 2500; // 2.5 seconds total loading
    const interval = 30; // Update every 30ms
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(Math.round((currentStep / steps) * 100), 100);
      
      // Add easing to the progress counter (starts fast, slows down at end)
      const easeOutQuart = 1 - Math.pow(1 - newProgress / 100, 4);
      setProgress(Math.round(easeOutQuart * 100));

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setIsLoading(false);
          sessionStorage.setItem("preloader_shown", "true");
        }, 400);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="preloader"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, y: "-100vh" }}
        transition={{ duration: 1, ease: [0.7, 0, 0.3, 1] }}
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background"
      >
        <div className="absolute inset-0 noise-overlay opacity-20" />
        
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8 overflow-hidden"
          >
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-6xl text-gradient uppercase">
              Smart Library
            </h1>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="h-[1px] w-64 bg-gradient-to-r from-transparent via-primary to-transparent mb-8"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-6xl font-light tabular-nums tracking-tighter text-foreground"
          >
            {progress.toString().padStart(3, "0")}%
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
