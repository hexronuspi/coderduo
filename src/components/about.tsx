"use client";

import { useState, useEffect, useRef } from "react";
import { BrainCircuit, BookOpen, Lightbulb, CheckCircle } from "lucide-react";

// --- SOTA BACKGROUND DESIGN (Corrected & Optimized) ---
// This component renders a high-performance, interactive particle system with physics.
const InteractiveBackground = ({ mousePosition }: { mousePosition: { x: number; y: number } }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number>();
  // Use a ref to pass the latest mouse position to the animation loop without re-triggering the effect.
  // This is the key to fixing the stale closure problem.
  const mousePositionRef = useRef(mousePosition);

  useEffect(() => {
    mousePositionRef.current = mousePosition;
  }, [mousePosition]);

  // This effect runs only once on mount to set up the entire animation.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Configurable Parameters ---
    const PARTICLE_COUNT = 150;
    const CONNECTION_RADIUS = 100;
    const MOUSE_REPEL_RADIUS = 120;
    const PARTICLE_BASE_COLOR = '120, 50, 220'; // An indigo/purple hue

    let { width, height } = canvas.getBoundingClientRect();

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    // By defining classes inside useEffect, they have closure access to width, height, and ctx,
    // which simplifies their methods and avoids passing many arguments every frame.
    
    // --- The Particle Class ---
    class Particle {
      x: number; y: number;
      vx: number; vy: number;
      baseRadius: number; radius: number;
      radiusVelocity: number;
      springK: number; damperC: number; mass: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.baseRadius = 1 + Math.random() * 1.5;
        this.radius = this.baseRadius;
        this.radiusVelocity = 0;
        this.springK = 0.03;
        this.damperC = 0.2;
        this.mass = this.baseRadius * 2;
      }
      
      update() {
        const { x: mouseX, y: mouseY } = mousePositionRef.current;
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let targetRadius = this.baseRadius;

        if (dist < MOUSE_REPEL_RADIUS) {
          const force = (MOUSE_REPEL_RADIUS - dist) / MOUSE_REPEL_RADIUS;
          this.vx += (dx / dist) * force * 0.5;
          this.vy += (dy / dist) * force * 0.5;
          targetRadius = this.baseRadius + force * 5;
        }

        const springForce = -(this.radius - targetRadius) * this.springK;
        const dampingForce = -this.radiusVelocity * this.damperC;
        const acceleration = (springForce + dampingForce) / this.mass;
        this.radiusVelocity += acceleration;
        this.radius += this.radiusVelocity;
        if (this.radius < 0.1) this.radius = 0.1;

        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
        
        this.vx *= 0.99;
        this.vy *= 0.99;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_BASE_COLOR}, 0.8)`;
        ctx.fill();
        ctx.closePath();
      }
    }

    // --- PERFORMANCE OPTIMIZATION: Spatial Grid ---
    class SpatialGrid {
      cellSize: number;
      grid: Map<string, Particle[]>;
      
      constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.grid = new Map();
      }

      _getKey(x: number, y: number) { return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`; }
      
      clear() { this.grid.clear(); }
      
      insert(particle: Particle) {
        const key = this._getKey(particle.x, particle.y);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key)!.push(particle);
      }

      queryNeighbors(particle: Particle) {
        const neighbors: Particle[] = [];
        const cellX = Math.floor(particle.x / this.cellSize);
        const cellY = Math.floor(particle.y / this.cellSize);
        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            const key = `${cellX + x},${cellY + y}`;
            if (this.grid.has(key)) {
              neighbors.push(...this.grid.get(key)!);
            }
          }
        }
        return neighbors;
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }
    const spatialGrid = new SpatialGrid(CONNECTION_RADIUS);
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      spatialGrid.clear();
      for (const p of particles) {
        p.update();
        spatialGrid.insert(p);
      }
      
      for (const p1 of particles) {
        const neighbors = spatialGrid.queryNeighbors(p1);
        for (const p2 of neighbors) {
          if (p1 === p2) continue;
          
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < CONNECTION_RADIUS) {
            const opacity = 1 - (dist / CONNECTION_RADIUS);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${PARTICLE_BASE_COLOR}, ${opacity * 0.4})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.closePath();
          }
        }
      }
      
      ctx.shadowColor = `rgba(${PARTICLE_BASE_COLOR}, 0.8)`;
      ctx.shadowBlur = 8;
      for (const p of particles) p.draw();
      ctx.shadowBlur = 0;

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      setupCanvas();
      // No need to recreate particles on resize, they'll just adapt to the new bounds.
    }

    setupCanvas();
    animate();
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array ensures this effect runs only ONCE.

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 w-full h-full" />;
};


export function About() {
  const [mousePosition, setMousePosition] = useState({ x: -9999, y: -9999 });
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      observer.observe(aboutSection);
    }

    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const features = [
    {
      icon: BrainCircuit,
      title: "AI-Powered Assistance",
      description: "Our AI coding helper provides smart suggestions and personalized feedback to improve your code.",
      color: "blue",
      stats: "Easy and Medium LC",
      gradient: "from-blue-500 via-blue-600 to-purple-600",
      bgGradient: "from-blue-50 via-blue-100 to-purple-50",
      iconBg: "bg-gradient-to-br from-blue-500 to-purple-600",
      borderGradient: "from-blue-200 to-purple-200",
      details: [
        "Smart error detection with explanations",
        "Performance optimization recommendations",
      ]
    },
    {
      icon: BookOpen,
      title: "Diverse Question Bank",
      description: "Practice with both manually curated and AI-generated questions filtered by topic and difficulty.",
      color: "emerald",
      stats: "Classic Set",
      gradient: "from-emerald-500 via-green-600 to-teal-600",
      bgGradient: "from-emerald-50 via-green-100 to-teal-50",
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      borderGradient: "from-emerald-200 to-teal-200",
      details: [
        "Algorithm & data structure challenges",
        "Dynamic difficulty progression"
      ]
    },
    {
      icon: Lightbulb,
      title: "Guided Hint-Based Solving",
      description: "Get progressive hints that guide you toward solutions without giving away the answer.",
      color: "orange",
      stats: "Adaptive learning",
      gradient: "from-orange-500 via-red-500 to-pink-600",
      bgGradient: "from-orange-50 via-red-100 to-pink-50",
      iconBg: "bg-gradient-to-br from-orange-500 to-pink-600",
      borderGradient: "from-orange-200 to-pink-200",
      details: [
        "Contextual hint system",
        "Step-by-step solution guidance",
      ]
    }
  ];

  return (
    <section 
      id="about" 
      className="py-20 md:py-32 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePosition({ x: -9999, y: -9999 })} // Hide interaction when mouse leaves
    >
      {/* --- RENDER THE SOTA BACKGROUND --- */}
      <InteractiveBackground mousePosition={mousePosition} />

      <div className="container mx-auto px-4 ">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center mb-20">          
          <h2 
            className={`text-5xl md:text-7xl font-black mb-8 bg-gradient-to-r from-slate-900 via-blue-700 to-purple-700 bg-clip-text text-transparent leading-tight transition-all duration-1000 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            About Coder Duo
          </h2>
          
          <p 
            className={`text-xl md:text-2xl text-slate-600 leading-relaxed font-medium transition-all duration-1000 delay-200 ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            We help developers ace their technical interviews with our comprehensive coding practice platform.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 200 + 600}ms` }}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Glow Effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-all duration-500 transform group-hover:scale-105`} />
              
              {/* Main Card */}
              <div className={`relative bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-200 shadow-xl overflow-hidden transition-all duration-500 transform group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:scale-[1.02] ${
                hoveredCard === index ? 'border-opacity-0' : ''
              }`}>
                
                {/* Animated Border */}
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.borderGradient} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} 
                     style={{ padding: '2px' }}>
                  <div className="bg-white rounded-3xl w-full h-full" />
                </div>
                
                {/* Content */}
                <div className="relative p-8 space-y-6">
                  {/* Icon with Premium Animation */}
                  <div className="relative">
                    <div className={`w-16 h-16 ${feature.iconBg} rounded-2xl flex items-center justify-center shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Stats Badge */}
                  <div className={`absolute top-6 right-6 px-4 py-2 bg-gradient-to-r ${feature.bgGradient} rounded-full text-sm font-bold text-slate-700 shadow-lg transform transition-all duration-300 ${
                    hoveredCard === index ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-95'
                  }`}>
                    {feature.stats}
                  </div>

                  {/* Title and Description */}
                  <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Expandable Details */}
                  <div className={`transition-all duration-500 overflow-hidden ${
                    hoveredCard === index ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="border-t border-slate-200 pt-6 space-y-3">
                      {feature.details.map((detail, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center space-x-3 text-sm text-slate-600 transition-all duration-300 ${
                            hoveredCard === index ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                          }`}
                          style={{ transitionDelay: `${idx * 100}ms` }}
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  );
}