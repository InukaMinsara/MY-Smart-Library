import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { MagneticButton } from "./MagneticButton";
import { Library } from "lucide-react";

export function Navigation() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 50) {
      setIsScrolled(true);
    } else {
      setIsScrolled(false);
    }
  });

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, delay: 2.5, ease: [0.7, 0, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-[9000] flex justify-center px-4 transition-all duration-500 ${
        isScrolled ? "py-4" : "py-8"
      }`}
    >
      <div
        className={`flex w-full max-w-6xl items-center justify-between rounded-full transition-all duration-500 px-6 py-3 ${
          isScrolled
            ? "glass-extreme shadow-xl"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="interactive flex items-center gap-2 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Library className="h-5 w-5" />
            <div className="absolute inset-0 rounded-full glow-primary opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="hidden font-bold tracking-tight sm:block text-lg">
            SMART<span className="text-primary">LIBRARY</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {["Features", "Experience", "Technology"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="interactive text-sm font-medium text-muted-foreground transition-colors hover:text-foreground relative group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <MagneticButton>
            <Link
              to="/dashboard"
              className="interactive inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground shadow-[0_0_20px_rgba(var(--color-primary),0.4)] transition-all hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(var(--color-primary),0.6)] hover:scale-105"
            >
              Enter System
            </Link>
          </MagneticButton>
        </div>
      </div>
    </motion.header>
  );
}
