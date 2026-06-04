"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { API_BASE } from "@/lib/config";
import { 
  LayoutDashboard, 
  UploadCloud, 
  Files, 
  MessageSquare, 
  Search, 
  Settings, 
  Activity, 
  Menu,
  X,
  FileText,
  Cpu,
  LogOut,
  Sun,
  Moon,
  Sparkles
} from "lucide-react";
import ThreeDVectorSpace from "@/components/ThreeDVectorSpace";

interface HealthData {
  status: string;
  ollama: {
    status: string;
    models: string[];
    url: string;
  };
  gemini?: {
    status: string;
  };
  stats: {
    total_documents: number;
    indexed_documents: number;
    processing_documents: number;
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, logout, getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendHealth, setBackendHealth] = useState<"online" | "offline" | "checking">("checking");
  const [ollamaHealth, setOllamaHealth] = useState<"online" | "offline" | "checking">("checking");
  const [geminiHealth, setGeminiHealth] = useState<"online" | "offline" | "checking">("checking");
  const [docStats, setDocStats] = useState({ total: 0, indexed: 0 });
  const [topSearchQuery, setTopSearchQuery] = useState("");

  // Route Protection
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loading, router]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Upload Documents", href: "/upload", icon: UploadCloud },
    { name: "Document Library", href: "/documents", icon: Files },
    { name: "RAG Chat", href: "/chat", icon: MessageSquare },
    { name: "Semantic Search", href: "/search", icon: Search },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const checkHealth = async () => {
    try {
      const token = await getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const savedUrl = localStorage.getItem("ollama_url");
      const url = savedUrl 
        ? `${API_BASE}/api/health?ollama_url=${encodeURIComponent(savedUrl)}` 
        : `${API_BASE}/api/health`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data: HealthData = await res.json();
        setBackendHealth("online");
        setOllamaHealth(data.ollama.status === "online" ? "online" : "offline");
        setGeminiHealth(data.gemini?.status === "online" ? "online" : "offline");
        setDocStats({
          total: data.stats.total_documents,
          indexed: data.stats.indexed_documents
        });
      } else {
        setBackendHealth("offline");
        setOllamaHealth("offline");
        setGeminiHealth("offline");
      }
    } catch (e) {
      setBackendHealth("offline");
      setOllamaHealth("offline");
      setGeminiHealth("offline");
    }
  };

  useEffect(() => {
    if (currentUser) {
      checkHealth();
      // Poll health status every 12 seconds
      const interval = setInterval(checkHealth, 12000);
      return () => clearInterval(interval);
    }
  }, [pathname, currentUser]); // Refresh stats when pathname changes or user logs in

  const handleTopSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topSearchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(topSearchQuery.trim())}`);
      setTopSearchQuery("");
    }
  };

  // If loading or unauthenticated, block workspace view and show clean spinner
  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
        <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">FIDELITYRAG</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground relative">
      {/* Global fixed 3D Background */}
      <ThreeDVectorSpace fullScreen={true} />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/30 bg-card/45 backdrop-blur-xl relative z-30">
        {/* Brand - text only layout inspired by handhold */}
        <div className="h-16 border-b border-border/30 px-6 flex items-center">
          <span className="font-mono text-sm tracking-[0.2em] font-bold text-foreground uppercase shrink-0">
            FIDELITYRAG
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-indigo-600/10 text-indigo-500 border-l-2 border-indigo-500 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Icon className={`w-4.5 h-4.5 transition-colors ${isActive ? "text-indigo-500" : "text-muted-foreground group-hover:text-foreground"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* System Health Status / Stats */}
        <div className="p-4 border-t border-border/30 bg-transparent space-y-4">
          {/* Document Counter */}
          <div className="rounded-xl bg-background/30 p-3 border border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Library files</span>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">{docStats.indexed}/{docStats.total}</span>
          </div>

          <div className="space-y-2.5">
            {/* API Health */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                <span>Backend API</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${backendHealth === "online" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : backendHealth === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"}`} />
                <span className={backendHealth === "online" ? "text-emerald-500" : backendHealth === "checking" ? "text-amber-500" : "text-red-500"}>
                  {backendHealth === "online" ? "Online" : backendHealth === "checking" ? "Checking" : "Offline"}
                </span>
              </div>
            </div>

            {/* AI Engine Status */}
            {geminiHealth === "online" ? (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cloud Gemini</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="text-emerald-500">Online</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Local Ollama</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={`w-2 h-2 rounded-full ${ollamaHealth === "online" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : ollamaHealth === "checking" ? "bg-amber-500 animate-pulse" : "bg-red-500"}`} />
                  <span className={ollamaHealth === "online" ? "text-emerald-500" : ollamaHealth === "checking" ? "text-amber-500" : "text-red-500"}>
                    {ollamaHealth === "online" ? "Online" : ollamaHealth === "checking" ? "Checking" : "Offline"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Logout */}
          <button 
            onClick={() => logout()}
            className="w-full py-2 bg-background hover:bg-red-500/10 text-muted-foreground hover:text-red-500 border border-border rounded-lg text-xs uppercase font-mono tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="w-64 bg-card/75 backdrop-blur-xl border-r border-border/30 flex flex-col relative z-50 h-full">
            <div className="h-16 border-b border-border/30 px-6 flex items-center justify-between">
              <span className="font-mono text-sm tracking-[0.2em] font-bold text-foreground uppercase">
                FIDELITYRAG
              </span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-600/10 text-indigo-500 border-l-2 border-indigo-500 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-border/30 bg-transparent space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">API Gateway</span>
                <span className={backendHealth === "online" ? "text-emerald-500 font-medium" : "text-red-500 font-medium"}>
                  {backendHealth.toUpperCase()}
                </span>
              </div>
              <button 
                onClick={() => logout()}
                className="w-full py-2 bg-background text-muted-foreground hover:text-foreground rounded-lg text-xs uppercase font-mono tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border/30 px-6 flex items-center justify-between bg-background/35 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Quick Search */}
            <form onSubmit={handleTopSearchSubmit} className="hidden sm:flex items-center gap-2 bg-background/40 border border-border/40 rounded-xl px-3 py-1.5 w-72 focus-within:border-indigo-500/40 transition-colors backdrop-blur-md">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input 
                type="text" 
                placeholder="Search index metadata/content..."
                value={topSearchQuery}
                onChange={(e) => setTopSearchQuery(e.target.value)}
                className="bg-transparent border-0 outline-0 p-0 text-xs w-full placeholder-zinc-500 focus:ring-0 focus:outline-none text-foreground"
              />
            </form>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/chat"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> New Session
            </Link>
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-border/40 bg-background/40 backdrop-blur-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-border" />

            {/* Profile - Personalized */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-500">
                {currentUser.displayName ? currentUser.displayName.substring(0, 2).toUpperCase() : "US"}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground">{currentUser.displayName || "Active User"}</span>
                <span className="text-[9px] text-muted-foreground truncate max-w-[150px]" title={currentUser.email || ""}>
                  {currentUser.email}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
