"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide your email address.");
      return;
    }

    try {
      setMessage("");
      setError("");
      setLoading(true);
      await resetPassword(email);
      setMessage("Verification links dispatched. Check your email inbox to proceed.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to trigger recovery email. Confirm your address is correct.");
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
        <Link href="/login" className="text-xs uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          Sign In
        </Link>
      </header>

      {/* Main Form Body */}
      <main className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm border border-border bg-card p-8 rounded-none relative shadow-md">
          <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-zinc-700" />
          <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-zinc-700" />

          <div className="mb-6">
            <span className="text-[10px] font-mono tracking-[0.15em] text-indigo-400 uppercase block mb-1">RECOVERY VALVE</span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Reset Password</h2>
          </div>

          {error && (
            <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-400 text-xs rounded-none mb-6 font-mono leading-relaxed">
              ERROR: {error}
            </div>
          )}

          {message && (
            <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs rounded-none mb-6 font-mono leading-relaxed">
              SUCCESS: {message}
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

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs uppercase font-mono tracking-wider transition-colors disabled:opacity-45 rounded-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Reset Link"}
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
