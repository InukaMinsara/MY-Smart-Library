import { useRef } from "react";
import { motion, useInView, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { BookOpen, Users, ShieldAlert, Cpu } from "lucide-react";

const features = [
  {
    title: "Quantum Architecture",
    description: "Built on a high-performance Nitro engine allowing instant server functions and zero-latency data fetching.",
    icon: <Cpu className="h-8 w-8 text-primary" />,
    className: "md:col-span-2 md:row-span-2 bg-gradient-to-br from-card to-background",
  },
  {
    title: "AI Analysis",
    description: "Intelligent chatbot that analyzes library trends and answers queries instantly.",
    icon: <Cpu className="h-8 w-8 text-accent" />,
    className: "md:col-span-1 md:row-span-1 bg-card/40",
  },
  {
    title: "Member Ecosystem",
    description: "Advanced membership profiles with persistent caching.",
    icon: <Users className="h-8 w-8 text-secondary" />,
    className: "md:col-span-1 md:row-span-1 bg-card/60",
  },
  {
    title: "Secure Vault",
    description: "Enterprise-grade RBAC protecting sensitive library assets.",
    icon: <ShieldAlert className="h-8 w-8 text-destructive" />,
    className: "md:col-span-2 md:row-span-1 bg-gradient-to-r from-card to-card/20",
  }
];

function BentoCard({ feature, index }: { feature: any, index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  
  // 3D Tilt physics
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 20 });

  // Spotlight effect
  const spotX = useMotionValue(0);
  const spotY = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(400px circle at ${spotX}px ${spotY}px, var(--color-primary) 0%, transparent 80%)`;

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    
    // Tilt calculations
    const xPos = (clientX - left) / width - 0.5;
    const yPos = (clientY - top) / height - 0.5;
    x.set(xPos * 10);
    y.set(yPos * 10);

    // Spotlight calculations
    spotX.set(clientX - left);
    spotY.set(clientY - top);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay: index * 0.1 }}
      className={`interactive relative group perspective-1000 ${feature.className}`}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: mouseY,
          rotateY: mouseX,
        }}
        className="h-full w-full rounded-3xl glass-extreme p-8 overflow-hidden transition-all duration-300 transform-gpu"
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-10 mix-blend-screen"
          style={{ background }}
        />
        
        <div className="relative z-10 flex flex-col h-full gap-6">
          <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mb-auto group-hover:scale-110 transition-transform duration-500">
            {feature.icon}
          </div>
          
          <div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FeaturesBento() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-20%" });

  return (
    <section id="features" className="py-32 relative z-10 bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div 
          ref={containerRef}
          className="mb-20 text-center md:text-left"
        >
          <motion.h2 
            style={{
              transform: isInView ? "none" : "translateY(50px)",
              opacity: isInView ? 1 : 0,
              transition: "all 0.9s cubic-bezier(0.17, 0.55, 0.55, 1) 0.2s"
            }}
            className="text-4xl md:text-6xl font-bold tracking-tighter"
          >
            Digital Architecture <br/>
            <span className="text-muted-foreground">Redefined.</span>
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 auto-rows-[300px]">
          {features.map((feature, i) => (
            <BentoCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
