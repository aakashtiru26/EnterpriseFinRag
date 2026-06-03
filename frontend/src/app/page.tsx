"use client";

import Link from "next/link";
import { ArrowRight, Shield, Search, MessageSquare, Cpu, Database } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThreeDVectorSpace from "../components/ThreeDVectorSpace";

export default function LandingPage() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#030303] text-zinc-400 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-900 sticky top-0 z-50 bg-[#030303] px-6">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-mono text-sm tracking-[0.2em] font-bold text-white uppercase">
              FIDELITYRAG
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pipeline" className="hover:text-white transition-colors">Architecture</a>
            <a href="#isolation" className="hover:text-white transition-colors">Privacy</a>
          </nav>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <Link 
                href="/dashboard" 
                className="px-4 py-2 border border-zinc-800 hover:border-zinc-500 text-xs font-mono uppercase tracking-wider text-white transition-colors bg-[#030303]"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-xs uppercase font-mono tracking-wider text-zinc-500 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  href="/signup" 
                  className="px-4 py-2 bg-zinc-100 hover:bg-white text-[#030303] text-xs font-mono uppercase tracking-wider transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        
        {/* Hero Section */}
        <section className="relative pt-16 pb-20 md:pt-28 md:pb-24 border-b border-zinc-900 bg-[#050507]">
          {/* Subtle grid line accents */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0c0e_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 -z-10" />
          
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column: Headline and Content */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="inline-block px-3 py-1 border border-zinc-850 text-[9px] font-mono tracking-[0.2em] text-indigo-400 uppercase bg-[#030303]">
                    SECURE CONSOLE v2.0
                  </span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white leading-[1.1]">
                  Synthesize Financial <br />
                  <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400">
                    Document Intelligence.
                  </span>
                </h1>
                
                <p className="text-zinc-400 text-sm md:text-base max-w-xl leading-relaxed font-sans">
                  A private, multi-user local RAG console. Ingest financial prospectuses, annual sheets, and quarterly statements. Generate semantic FAISS vector stores locally and converse in an isolated private sandbox.
                </p>
                
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link 
                    href={currentUser ? "/dashboard" : "/signup"}
                    className="px-8 py-4 bg-zinc-100 hover:bg-white text-[#030303] font-bold text-xs uppercase font-mono tracking-wider transition-colors text-center cursor-pointer"
                  >
                    Create Account
                  </Link>
                  <Link 
                    href="/login" 
                    className="px-8 py-4 border border-zinc-800 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-xs uppercase font-mono tracking-wider transition-colors text-center bg-[#030303]"
                  >
                    Sign In to Console
                  </Link>
                </div>
              </div>

              {/* Right Column: 3D Graphics Canvas */}
              <div className="lg:col-span-5 w-full flex items-center justify-center">
                <div className="w-full max-w-lg aspect-square p-2 bg-[#09090d] border border-zinc-900 relative">
                  <ThreeDVectorSpace height={380} />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 border-b border-zinc-900 bg-[#030303]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-xl mb-16">
              <span className="text-[9px] font-mono tracking-[0.25em] text-indigo-400 uppercase block mb-2">SYSTEM PARAMETERS</span>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Built for Auditable Risk Analysis</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-0.5 bg-zinc-900 border border-zinc-950">
              {/* Feature 1 */}
              <div className="bg-[#030303] p-8 space-y-6">
                <div className="text-indigo-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-white">Multi-User Auth Isolation</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed font-sans">
                    Firebase Authenticated logins provide compartmentalized user access. Extracted text datasets and FAISS vector indices remain isolated in user-specific sandbox folders.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#030303] p-8 space-y-6">
                <div className="text-emerald-400">
                  <Search className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-white">Interactive Similarity Checks</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed font-sans">
                    Test vector matrices directly using similarity scoring tools. Identify exact paragraph weights, calculations, and disclosures in the library console.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#030303] p-8 space-y-6">
                <div className="text-purple-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-white">Source-Verifiable Chat</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed font-sans">
                    Generate multi-document syntheses using private Ollama models. Chat queries return inline citations mapping back to exact source files and page coordinates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture */}
        <section id="pipeline" className="py-24 border-b border-zinc-900 bg-[#050507]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-7">
                <span className="text-[9px] font-mono tracking-[0.25em] text-indigo-400 uppercase block mb-2">
                  HYBRID CONSOLE
                </span>
                <h2 className="text-3xl font-light tracking-tight text-white mb-6 leading-tight">
                  Local-first processing pipeline.
                </h2>
                <div className="space-y-6 text-xs leading-relaxed text-zinc-400">
                  <div className="flex gap-4 p-4 border border-zinc-900 bg-[#030305] hover:bg-[#07070a] transition-colors">
                    <span className="text-indigo-400 font-mono shrink-0 font-bold">[01]</span>
                    <div>
                      <strong className="text-zinc-200 block mb-0.5">Metadata Cloud Sync</strong>
                      <p className="text-zinc-500 font-sans">Document registry tables, customized settings, and session histories are securely synchronized in Cloud Firestore.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border border-zinc-900 bg-[#030305] hover:bg-[#07070a] transition-colors">
                    <span className="text-indigo-400 font-mono shrink-0 font-bold">[02]</span>
                    <div>
                      <strong className="text-zinc-200 block mb-0.5">Local Vectors</strong>
                      <p className="text-zinc-500 font-sans">Your documents are never parsed or stored in the cloud. Raw file streams and FAISS index databases stay strictly local on your backend host server.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border border-zinc-900 bg-[#030305] hover:bg-[#07070a] transition-colors">
                    <span className="text-indigo-400 font-mono shrink-0 font-bold">[03]</span>
                    <div>
                      <strong className="text-zinc-200 block mb-0.5">Local Ollama LLM</strong>
                      <p className="text-zinc-500 font-sans">Inference runs entirely offline via Ollama. If your model goes offline, the console falls back to local text context extractions.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right box metrics */}
              <div className="lg:col-span-5 bg-[#09090d] border border-zinc-900 p-8 space-y-6 relative shadow-xl">
                <h3 className="font-semibold text-xs font-mono uppercase tracking-wider text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" /> Pipeline Stats
                </h3>
                <div className="space-y-4 text-xs font-mono">
                  <div className="flex justify-between py-2.5 border-b border-zinc-900">
                    <span className="text-zinc-500">Vector Dimension</span>
                    <span className="text-zinc-300">384 (MiniLM-L6)</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-zinc-900">
                    <span className="text-zinc-500">Retrieval Metric</span>
                    <span className="text-zinc-300">L2 Cosine Similarity</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-b border-zinc-900">
                    <span className="text-zinc-500">Metadata Isolation</span>
                    <span className="text-zinc-300">JWT owner_uid Filter</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-zinc-500">Host Hardware Target</span>
                    <span className="text-zinc-300">Apple Silicon / CPU local</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Isolation Policy */}
        <section id="isolation" className="py-24 bg-[#030303]">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <span className="text-[9px] font-mono tracking-[0.25em] text-indigo-400 uppercase block mb-4">PRIVACY PROTOCOL</span>
            <blockquote className="text-xl md:text-2xl font-light text-white italic mb-8 leading-relaxed font-sans">
              "We designed FidelityRAG under strict security assumptions. Your company's financial balance sheets, earnings disclosures, and text segments are never uploaded to foreign cloud APIs. Calculations stay local."
            </blockquote>
            <div className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">
              FIDELITYRAG ENGINEERING LEAD &bull; SECURITY FIRST
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 bg-[#030303]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-[10px] font-mono text-zinc-600 gap-4">
          <div>
            &copy; 2026 FIDELITYRAG INC. ALL RIGHTS RESERVED. MULTI-USER SYSTEM.
          </div>
          <div className="flex gap-6 uppercase tracking-wider">
            <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
