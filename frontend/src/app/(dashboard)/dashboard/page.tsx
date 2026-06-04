"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "@/lib/config";
import ThreeDVectorSpace from "@/components/ThreeDVectorSpace";
import { 
  ArrowRight, 
  UploadCloud, 
  Files, 
  MessageSquare, 
  Cpu, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Zap,
  BookOpen,
  ArrowUpRight
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  size_bytes: number;
  status: string;
  num_chunks: number;
  created_at: string;
}

interface HealthData {
  status: string;
  ollama: {
    status: string;
    models: string[];
    url: string;
  };
  stats: {
    total_documents: number;
    indexed_documents: number;
    processing_documents: number;
  };
}

export default function DashboardPage() {
  const { currentUser, getToken } = useAuth();
  
  const [stats, setStats] = useState({
    total: 0,
    indexed: 0,
    processing: 0,
    chunks: 0,
    ollamaStatus: "checking",
    ollamaModel: "None active",
  });
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!currentUser) return;
    
    try {
      const token = await getToken();
      const headers = {
        "Authorization": `Bearer ${token}`
      };

      // Fetch health stats (user isolated)
      const savedUrl = localStorage.getItem("ollama_url");
      const url = savedUrl 
        ? `${API_BASE}/api/health?ollama_url=${encodeURIComponent(savedUrl)}` 
        : `${API_BASE}/api/health`;
      const healthRes = await fetch(url, { headers });
      let activeModel = "None";
      let totalChunks = 0;
      
      if (healthRes.ok) {
        const healthData: HealthData = await healthRes.json();
        
        if (healthData.ollama.status === "online" && healthData.ollama.models.length > 0) {
          activeModel = healthData.ollama.models[0];
        } else if (healthData.ollama.status === "online") {
          activeModel = "Ollama active (no models)";
        }
        
        setStats(prev => ({
          ...prev,
          total: healthData.stats.total_documents,
          indexed: healthData.stats.indexed_documents,
          processing: healthData.stats.processing_documents,
          ollamaStatus: healthData.ollama.status,
          ollamaModel: activeModel,
        }));
      }

      // Fetch documents list for recent documents table (user isolated)
      const docsRes = await fetch(`${API_BASE}/api/documents`, { headers });
      if (docsRes.ok) {
        const docsData: Document[] = await docsRes.json();
        // Sort by upload date desc and limit to 4
        const sorted = docsData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentDocs(sorted.slice(0, 4));
        
        // Sum chunks
        totalChunks = docsData.reduce((acc, curr) => acc + (curr.num_chunks || 0), 0);
        setStats(prev => ({ ...prev, chunks: totalChunks }));
      }
    } catch (e) {
      console.error("Error fetching dashboard statistics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll data
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "indexed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Indexed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs border border-amber-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-550 text-xs border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 text-foreground">
      {/* Welcome Hero Panel - Handhold inspired typography */}
      <section className="relative overflow-hidden border border-border/30 bg-card/45 backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-sm">
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none -z-10" />
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-border bg-background text-[9px] font-mono tracking-[0.2em] text-indigo-500 uppercase mb-4">
            SECURE CONSOLE OPERATIONAL
          </div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-3">
            Welcome back, {currentUser?.displayName || "Analyst"}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-sans">
            Segmented workspace isolated for `{currentUser?.email}`. Upload PDF statements and annual filings to generate a user-isolated local vector store. Chat queries and semantic checks can run dynamically via Cloud Gemini, Local Ollama, or Sandbox Demo.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link 
              href="/upload" 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-mono uppercase tracking-wider text-white transition-colors"
            >
              Upload Document
            </Link>
            <Link 
              href="/chat" 
              className="px-4 py-2 border border-border/40 bg-background/30 hover:bg-card/40 backdrop-blur-sm text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-all rounded-xl"
            >
              Start Session
            </Link>
          </div>
        </div>
      </section>

      {/* Analytics Overview Grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="border border-border/30 bg-card/45 backdrop-blur-xl p-5 hover:border-indigo-500/40 hover:bg-card/60 transition-all rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Indexed Files</span>
            <div className="p-1.5 border border-indigo-500/20 text-indigo-500 bg-indigo-500/5 rounded">
              <Files className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-12 bg-background rounded animate-pulse" />
          ) : (
            <div>
              <div className="text-2xl font-bold text-foreground font-mono">{stats.indexed}</div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1">{stats.total} total files uploaded</p>
            </div>
          )}
        </div>

        {/* Metric 2 */}
        <div className="border border-border/30 bg-card/45 backdrop-blur-xl p-5 hover:border-indigo-500/40 hover:bg-card/60 transition-all rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Vector Chunks</span>
            <div className="p-1.5 border border-emerald-500/20 text-emerald-550 bg-emerald-500/5 rounded">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-background rounded animate-pulse" />
          ) : (
            <div>
              <div className="text-2xl font-bold text-foreground font-mono">{stats.chunks}</div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1">1,000 chars per chunk</p>
            </div>
          )}
        </div>

        {/* Metric 3 */}
        <div className="border border-border/30 bg-card/45 backdrop-blur-xl p-5 hover:border-indigo-500/40 hover:bg-card/60 transition-all rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Ollama Model</span>
            <div className="p-1.5 border border-purple-500/20 text-purple-550 bg-purple-500/5 rounded">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-24 bg-background rounded animate-pulse" />
          ) : (
            <div>
              <div className="text-sm font-bold text-foreground truncate max-w-full font-mono">{stats.ollamaModel}</div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1">
                Status: <span className={stats.ollamaStatus === "online" ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>{stats.ollamaStatus}</span>
              </p>
            </div>
          )}
        </div>

        {/* Metric 4 */}
        <div className="border border-border/30 bg-card/45 backdrop-blur-xl p-5 hover:border-indigo-500/40 hover:bg-card/60 transition-all rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Search Latency</span>
            <div className="p-1.5 border border-amber-500/20 text-amber-500 bg-amber-500/5 rounded">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground font-mono">12 ms</div>
            <p className="text-[9px] font-mono text-muted-foreground mt-1">FAISS CPU Local Speed</p>
          </div>
        </div>
      </section>

      {/* Main Grid: How it Works & Recent Files */}
      <section className="grid lg:grid-cols-3 gap-6">
        {/* Step-by-Step Stepper */}
        <div className="lg:col-span-1 border border-border/30 bg-card/45 backdrop-blur-xl p-6 space-y-6 flex flex-col justify-between rounded-2xl shadow-sm">
          <div className="space-y-6">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">Pipeline Stepper</h3>
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {/* Step 1 */}
              <div className="flex gap-4 relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-indigo-500/10 border border-indigo-500/35 flex items-center justify-center text-xs font-mono font-bold text-indigo-500 shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Segment Ingestion</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-sans leading-relaxed">Ingest statements (PDF, TXT, CSV, JSON, MD). The backend parses files page-by-page to structure text chunks.</p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex gap-4 relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-indigo-500/10 border border-indigo-500/35 flex items-center justify-center text-xs font-mono font-bold text-indigo-500 shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Vector Isolation</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-sans leading-relaxed">Generate 384-dimensional embeddings on CPU. Vector indices are stored in private user-isolated directories.</p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex gap-4 relative z-10">
                <div className="w-6.5 h-6.5 rounded-full bg-indigo-500/10 border border-indigo-500/35 flex items-center justify-center text-xs font-mono font-bold text-indigo-500 shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Hybrid RAG Chats</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 font-sans leading-relaxed">Converse via Cloud Gemini, local Ollama endpoints, or Sandbox Demo. Yields inline verifiable citations.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Embedding mini 3D vector space */}
          <div className="pt-2">
            <ThreeDVectorSpace height={130} />
          </div>
        </div>

        {/* Recent Files Panel */}
        <div className="lg:col-span-2 border border-border/30 bg-card/45 backdrop-blur-xl p-6 flex flex-col justify-between rounded-2xl shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">Recent Uploads</h3>
              <Link 
                href="/documents" 
                className="text-xs font-mono uppercase tracking-wider text-indigo-500 hover:text-indigo-650 flex items-center gap-1 transition-colors"
              >
                View Library <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-10 bg-background rounded animate-pulse" />
                <div className="h-10 bg-background rounded animate-pulse" />
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/30 bg-background/20 rounded-xl">
                <Files className="w-8 h-8 text-zinc-400 mb-2" />
                <span className="text-xs text-muted-foreground font-semibold">No files indexed for this user</span>
                <Link href="/upload" className="text-xs font-mono text-indigo-500 hover:underline mt-2.5">Upload a report</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold pb-2">
                      <th className="pb-3 uppercase tracking-wider">File Name</th>
                      <th className="pb-3 uppercase tracking-wider">Size</th>
                      <th className="pb-3 uppercase tracking-wider">Chunks</th>
                      <th className="pb-3 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {recentDocs.map((doc) => (
                      <tr key={doc.id} className="text-foreground hover:bg-background/20 rounded-xl transition-colors">
                        <td className="py-3.5 pr-4 font-medium max-w-[180px] truncate text-foreground animate-colors" title={doc.filename}>
                          {doc.filename}
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-muted-foreground">{formatSize(doc.size_bytes)}</td>
                        <td className="py-3.5 pr-4 font-mono text-muted-foreground">{doc.num_chunks}</td>
                        <td className="py-3.5">{getStatusBadge(doc.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-border mt-6 pt-4 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
            <span>Isolated User Workspace Monitor</span>
            <button 
              onClick={fetchDashboardData}
              className="text-indigo-500 hover:text-indigo-650 font-semibold cursor-pointer"
            >
              Refresh Console
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
