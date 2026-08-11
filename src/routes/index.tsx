import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import Lenis from "lenis";
import { Preloader } from "@/components/landing/Preloader";
import { CustomCursor } from "@/components/landing/CustomCursor";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { FooterCTA } from "@/components/landing/FooterCTA";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    // Initialize smooth scrolling for the landing page
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Force hide default scrollbar
    document.documentElement.style.scrollbarWidth = "none";
    document.body.style.overflow = "auto";
    
    return () => {
      lenis.destroy();
      document.documentElement.style.scrollbarWidth = "auto";
    };
  }, []);

  return (
    <div className="bg-background min-h-screen text-foreground selection:bg-primary/30 relative">
      <Preloader />
      <Navigation />
      
      <main>
        <HeroSection />
        <FeaturesBento />
        <FooterCTA />
      </main>
    </div>
  );
}