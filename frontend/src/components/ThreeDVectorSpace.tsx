"use client";

import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";

interface Node3D {
  x: number;
  y: number;
  z: number;
  xProj: number;
  yProj: number;
  size: number;
  color: string;
  glow: boolean;
  alpha: number;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  targetNodeIndex: number;
  progress: number; // 0 to 1
  speed: number;
  color: string;
}

export default function ThreeDVectorSpace({ 
  height = 450,
  fullScreen = false
}: { 
  height?: number; 
  fullScreen?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  
  // 3D parameters
  const [nodes, setNodes] = useState<Node3D[]>([]);
  const particlesRef = useRef<Particle3D[]>([]);
  const rotationRef = useRef({ yaw: 0.4, pitch: 0.3, yawSpeed: 0.003, pitchSpeed: 0.002 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragRotationRef = useRef({ yaw: 0, pitch: 0 });

  // Color options
  const colors = [
    "rgba(99, 102, 241, ",  // Indigo
    "rgba(52, 211, 153, ",  // Emerald
    "rgba(168, 85, 247, ",  // Purple
  ];

  // Initialize nodes in a 3D spherical structure (normalized radius = 1)
  useEffect(() => {
    const tempNodes: Node3D[] = [];
    const nodeCount = fullScreen ? 65 : 45;
    
    // Distribute nodes evenly on a sphere using Fibonacci lattice
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(1 - (2 * i) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;
      
      // Normalized sphere coords (radius = 1)
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      const colorIndex = i % 3;
      const size = Math.random() * 3 + 2.2;

      tempNodes.push({
        x,
        y,
        z,
        xProj: 0,
        yProj: 0,
        size,
        color: colors[colorIndex],
        glow: Math.random() > 0.6,
        alpha: Math.random() * 0.4 + 0.6,
      });
    }

    // Add a central "Query Hub" node
    tempNodes.push({
      x: 0,
      y: 0,
      z: 0,
      xProj: 0,
      yProj: 0,
      size: 8,
      color: "rgba(255, 255, 255, ",
      glow: true,
      alpha: 1.0,
    });

    setNodes(tempNodes);
  }, [fullScreen]);

  // Launch particles representing retrieval query cycles
  useEffect(() => {
    if (nodes.length === 0) return;

    const interval = setInterval(() => {
      // Pick random source node
      const sourceIndex = Math.floor(Math.random() * (nodes.length - 1));
      const sourceNode = nodes[sourceIndex];
      
      particlesRef.current.push({
        x: sourceNode.x,
        y: sourceNode.y,
        z: sourceNode.z,
        targetNodeIndex: nodes.length - 1, // Aim at central node
        progress: 0,
        speed: Math.random() * 0.015 + 0.01,
        color: sourceNode.color,
      });

      // Maintain a maximum of 15 particles
      if (particlesRef.current.length > 15) {
        particlesRef.current.shift();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [nodes]);

  // Main rendering loop
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear with very slight transparency for subtle trail effect
      ctx.fillStyle = theme === "light" ? "#ffffff" : "#030303";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      
      // Calculate responsive radius based on current canvas size
      const currentWidth = canvas.width / window.devicePixelRatio;
      const dynamicRadius = fullScreen
        ? Math.min(250, currentWidth * 0.35)
        : Math.min(140, currentWidth * 0.38);

      const time = Date.now() * 0.001;
      
      // Auto-rotation (when not dragging) - organic wobbling rotation
      if (!isDraggingRef.current) {
        const waveSpeedX = Math.sin(time * 0.4) * 0.0008;
        const waveSpeedY = Math.cos(time * 0.25) * 0.0006;
        
        rotationRef.current.yaw += rotationRef.current.yawSpeed + waveSpeedX;
        rotationRef.current.pitch += rotationRef.current.pitchSpeed + waveSpeedY;
        
        // Decay any residual speeds back to base
        rotationRef.current.yawSpeed = rotationRef.current.yawSpeed * 0.97 + 0.004 * 0.03;
        rotationRef.current.pitchSpeed = rotationRef.current.pitchSpeed * 0.97 + 0.003 * 0.03;
      }

      const cosYaw = Math.cos(rotationRef.current.yaw);
      const sinYaw = Math.sin(rotationRef.current.yaw);
      const cosPitch = Math.cos(rotationRef.current.pitch);
      const sinPitch = Math.sin(rotationRef.current.pitch);

      // 1. Project nodes into 3D space with responsive scaling
      const projected = nodes.map((node) => {
        const scaledX = node.x * dynamicRadius;
        const scaledY = node.y * dynamicRadius;
        const scaledZ = node.z * dynamicRadius;

        // Rotate around Y axis (yaw)
        let x1 = scaledX * cosYaw - scaledZ * sinYaw;
        let z1 = scaledX * sinYaw + scaledZ * cosYaw;
        
        // Rotate around X axis (pitch)
        let y2 = scaledY * cosPitch - z1 * sinPitch;
        let z2 = scaledY * sinPitch + z1 * cosPitch;

        // Perspective projection
        const fov = fullScreen ? 550 : 400;
        const scale = fov / (fov + z2);
        
        return {
          xProj: cx + x1 * scale,
          yProj: cy + y2 * scale,
          zDepth: z2,
          scale,
          original: node,
        };
      });

      // 2. Project and update active particles with curves and trails
      const activeParticles = particlesRef.current.map((p, idx) => {
        // Move towards target (central hub)
        p.progress += p.speed;
        if (p.progress > 1.0) {
          p.progress = 0; // Loop or get removed
        }
        
        const targetNode = nodes[p.targetNodeIndex];
        
        // Linear interpolation
        let currentX = p.x * (1 - p.progress) + targetNode.x * p.progress;
        let currentY = p.y * (1 - p.progress) + targetNode.y * p.progress;
        let currentZ = p.z * (1 - p.progress) + targetNode.z * p.progress;

        // Unique arced path for premium aesthetic
        const arcPower = Math.sin(p.progress * Math.PI) * 0.15;
        const angleOffset = idx * 0.85;
        currentX += Math.cos(angleOffset) * arcPower;
        currentY += Math.sin(angleOffset) * arcPower;

        const scaledX = currentX * dynamicRadius;
        const scaledY = currentY * dynamicRadius;
        const scaledZ = currentZ * dynamicRadius;

        // Rotate
        let x1 = scaledX * cosYaw - scaledZ * sinYaw;
        let z1 = scaledX * sinYaw + scaledZ * cosYaw;
        let y2 = scaledY * cosPitch - z1 * sinPitch;
        let z2 = scaledY * sinPitch + z1 * cosPitch;

        const fov = fullScreen ? 550 : 400;
        const scale = fov / (fov + z2);

        return {
          xProj: cx + x1 * scale,
          yProj: cy + y2 * scale,
          zDepth: z2,
          scale,
          color: p.color,
        };
      });

      // Filter out completed particles
      particlesRef.current = particlesRef.current.filter(p => p.progress < 0.98);

      // Sort projected nodes by depth (z-buffering back to front)
      projected.sort((a, b) => b.zDepth - a.zDepth);

      // 3. Draw connection grid lines (FAISS index segments)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        const nodeA = projected[i];
        
        // Skip drawing connections from central hub
        if (nodeA.original === nodes[nodes.length - 1]) continue;

        // Draw connections to central hub for active/glowing nodes
        if (nodeA.original.glow) {
          const hub = projected[projected.length - 1];
          const hubAlpha = (Math.sin(time * 3 + i) * 0.05 + 0.06) * nodeA.original.alpha;
          const lineColor = theme === "light" ? "99, 102, 241" : "129, 140, 248";
          ctx.strokeStyle = `rgba(${lineColor}, ${hubAlpha})`;
          ctx.beginPath();
          ctx.moveTo(nodeA.xProj, nodeA.yProj);
          ctx.lineTo(hub.xProj, hub.yProj);
          ctx.stroke();
        }

        for (let j = i + 1; j < projected.length; j++) {
          const nodeB = projected[j];
          if (nodeB.original === nodes[nodes.length - 1]) continue;

          // Calculate normalized 3D Euclidean distance
          const dx = nodeA.original.x - nodeB.original.x;
          const dy = nodeA.original.y - nodeB.original.y;
          const dz = nodeA.original.z - nodeB.original.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Draw connection if nodes are physically close in normalized sphere
          if (dist < 0.65) {
            const shimmer = Math.sin(time * 2 + i) * 0.03 + 0.09;
            const alpha = (1 - dist / 0.65) * shimmer * nodeA.original.alpha;
            const lineColor = theme === "light" ? "12, 12, 14" : "255, 255, 255";
            ctx.strokeStyle = `rgba(${lineColor}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodeA.xProj, nodeA.yProj);
            ctx.lineTo(nodeB.xProj, nodeB.yProj);
            ctx.stroke();
          }
        }
      }

      // 4. Draw node points
      projected.forEach((p) => {
        // Dynamic pulsate central hub & shimmers for glowing nodes
        const isHub = p.original.x === 0 && p.original.y === 0 && p.original.z === 0;
        const pulse = isHub
          ? Math.sin(time * 3) * 1.5
          : p.original.glow
            ? Math.sin(time * 5 + p.original.x * 10) * 0.5
            : 0;

        const size = Math.max(0.5, (p.original.size + pulse) * p.scale);
        
        // Determine color opacity based on depth
        const depthAlpha = Math.max(0.15, (dynamicRadius - p.zDepth) / (dynamicRadius * 2));
        const finalAlpha = p.original.alpha * depthAlpha;
        
        ctx.beginPath();
        ctx.arc(p.xProj, p.yProj, Math.max(0.5, size), 0, Math.PI * 2);
        
        let nodeColor = p.original.color;
        if (nodeColor === "rgba(255, 255, 255, " && theme === "light") {
          nodeColor = "rgba(12, 12, 14, ";
        }

        if (p.original.glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = nodeColor.replace(", ", ", 1.0)");
          ctx.fillStyle = nodeColor.replace(", ", `, ${finalAlpha})`);
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = nodeColor.replace(", ", `, ${finalAlpha * 0.8})`);
        }
        ctx.fill();

        // Draw node border ring for premium look
        if (p.original.glow && size > 2.5) {
          const ringColor = theme === "light" ? "12, 12, 14" : "255, 255, 255";
          ctx.strokeStyle = `rgba(${ringColor}, ${finalAlpha * 0.4})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(p.xProj, p.yProj, size + 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0; // Reset shadow

      // 5. Draw flowing retrieval particles
      activeParticles.forEach((part) => {
        ctx.beginPath();
        ctx.arc(part.xProj, part.yProj, 2.5 * part.scale, 0, Math.PI * 2);
        ctx.fillStyle = part.color.replace(", ", ", 0.95)");
        ctx.shadowBlur = 15;
        ctx.shadowColor = part.color.replace(", ", ", 1.0)");
        ctx.fill();
        
        // Draw trailing path
        ctx.beginPath();
        ctx.arc(part.xProj, part.yProj, 5 * part.scale, 0, Math.PI * 2);
        ctx.fillStyle = part.color.replace(", ", ", 0.15)");
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Loop
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, theme]);

  // Handle Canvas Resizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      if (fullScreen) {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        canvas.style.width = "100vw";
        canvas.style.height = "100vh";
      } else {
        const rect = canvas.parentElement?.getBoundingClientRect();
        canvas.width = (rect?.width || 500) * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = "100%";
        canvas.style.height = `${height}px`;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [height, fullScreen]);

  // Mouse Interaction Handlers for 3D Drag rotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragRotationRef.current = { 
      yaw: rotationRef.current.yaw, 
      pitch: rotationRef.current.pitch 
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const sensitivity = 0.005;
    
    rotationRef.current.yaw = dragRotationRef.current.yaw + dx * sensitivity;
    rotationRef.current.pitch = dragRotationRef.current.pitch + dy * sensitivity;
    
    // Store drag speed to keep velocity on release
    rotationRef.current.yawSpeed = dx * sensitivity * 0.1;
    rotationRef.current.pitchSpeed = dy * sensitivity * 0.1;
  };

  // Touch Handlers for Mobile responsiveness and interaction
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragRotationRef.current = { 
        yaw: rotationRef.current.yaw, 
        pitch: rotationRef.current.pitch 
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    
    const sensitivity = 0.008; // slightly higher sensitivity on touch screens
    
    rotationRef.current.yaw = dragRotationRef.current.yaw + dx * sensitivity;
    rotationRef.current.pitch = dragRotationRef.current.pitch + dy * sensitivity;
    
    rotationRef.current.yawSpeed = dx * sensitivity * 0.1;
    rotationRef.current.pitchSpeed = dy * sensitivity * 0.1;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 w-screen h-screen -z-50 overflow-hidden bg-background pointer-events-none">
        {/* Dynamic light backdrop filter behind canvas */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vh] rounded-full filter blur-[120px] pointer-events-none -z-10 transition-colors ${theme === "light" ? "bg-indigo-500/4" : "bg-indigo-500/6"}`} />
        <div className={`absolute top-1/4 left-1/3 w-[30vw] h-[30vh] rounded-full filter blur-[100px] pointer-events-none -z-10 transition-colors ${theme === "light" ? "bg-emerald-500/3" : "bg-emerald-500/5"}`} />

        <canvas
          ref={canvasRef}
          className="block w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden flex items-center justify-center rounded-2xl border transition-colors ${theme === "light" ? "border-border bg-card" : "border-white/5 bg-[#030303]"}`}>
      {/* Dynamic light backdrop filter behind canvas */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full filter blur-[80px] pointer-events-none -z-10 transition-colors ${theme === "light" ? "bg-indigo-500/3" : "bg-indigo-500/5"}`} />
      <div className={`absolute top-1/4 left-1/3 w-40 h-40 rounded-full filter blur-[50px] pointer-events-none -z-10 transition-colors ${theme === "light" ? "bg-emerald-500/3" : "bg-emerald-500/5"}`} />

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        className="block cursor-grab active:cursor-grabbing max-w-full z-10"
      />
      
      {/* Micro Info HUD text */}
      <div className="absolute bottom-4 left-5 z-20 font-mono text-[8px] text-zinc-500 flex items-center gap-2 pointer-events-none">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
        <span>FAISS MAP: VECTORS ISOLATED [DRAG ROTATE]</span>
      </div>
    </div>
  );
}
