"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, currentUser } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      router.push("/dashboard");
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all credentials.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-background">
        <Link href="/" className="font-mono text-sm tracking-[0.2em] font-bold text-foreground hover:opacity-80 transition-opacity">
          FIDELITYRAG
        </Link>
        <Link href="/signup" className="text-xs uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          Create Account
        </Link>
      </header>

      {/* Main Form Body */}
      <main className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm border border-border bg-card p-8 rounded-none relative shadow-md">
          {/* Subtle design grid accents */}
          <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-zinc-700" />
          <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-zinc-700" />

          <div className="mb-6">
            <span className="text-[10px] font-mono tracking-[0.15em] text-indigo-400 uppercase block mb-1">SECURE CONSOLE</span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Console Sign In</h2>
          </div>

          {error && (
            <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-400 text-xs rounded-none mb-6 font-mono leading-relaxed">
              ERROR: {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase block">EMAIL ADDRESS</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full glass-input outline-none text-xs px-3.5 py-3 rounded-none transition-colors"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase block">PASSWORD</label>
                <Link href="/reset-password" className="text-[9px] font-mono text-muted-foreground hover:text-foreground uppercase transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full glass-input outline-none text-xs px-3.5 py-3 pr-10 rounded-none transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs uppercase font-mono tracking-wider transition-colors disabled:opacity-45 rounded-none flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6 text-center text-[10px] font-mono text-muted-foreground">
        FIDELITYRAG &bull; LOCAL PRIVACY RAG MATRIX
      </footer>
    </div>
  );
}
