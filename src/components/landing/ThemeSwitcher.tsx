import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Check initial preference
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme) {
      setTheme(savedTheme as "dark" | "light");
      if (savedTheme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } else if (prefersDark) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    if (isTransitioning) return;
    
    const newTheme = theme === "dark" ? "light" : "dark";
    setClickPos({ x: e.clientX, y: e.clientY });
    setIsTransitioning(true);
    
    // Animate the transition overlay first
    setTimeout(() => {
      setTheme(newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", newTheme);
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 800); // Wait for transition to complete
    }, 100);
  };

  return (
    <>
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ 
              clipPath: `circle(0px at ${clickPos.x}px ${clickPos.y}px)`,
              backgroundColor: theme === "dark" ? "#ffffff" : "#111111" // Target color
            }}
            animate={{ 
              clipPath: `circle(3000px at ${clickPos.x}px ${clickPos.y}px)` 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.7, 0, 0.3, 1] }}
            className="fixed inset-0 z-[9998] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <button
        onClick={toggleTheme}
        className="interactive relative z-[9999] flex h-12 w-12 items-center justify-center rounded-full glass-extreme hover:scale-110 transition-transform duration-300"
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait">
          {theme === "dark" ? (
            <motion.div
              key="sun"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={{ duration: 0.3 }}
            >
              <Sun className="h-5 w-5 text-yellow-400" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ scale: 0, rotate: 90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -90 }}
              transition={{ duration: 0.3 }}
            >
              <Moon className="h-5 w-5 text-indigo-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}
