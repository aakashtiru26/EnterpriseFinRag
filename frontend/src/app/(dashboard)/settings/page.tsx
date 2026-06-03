"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { updateProfile } from "firebase/auth";
import { 
  Settings, 
  Cpu, 
  Database, 
  Save, 
  Activity, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  User as UserIcon
} from "lucide-react";

import { API_BASE } from "@/lib/config";

export default function SettingsPage() {
  const { currentUser, getToken } = useAuth();
  
  // Profile settings state
  const [displayName, setDisplayName] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // RAG system settings state
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [modelName, setModelName] = useState("llama3");
  const [demoMode, setDemoMode] = useState(false);
  
  const [diagnosticStatus, setDiagnosticStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load configurations on mount
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || "");
    }
    
    const savedUrl = localStorage.getItem("ollama_url");
    const savedModel = localStorage.getItem("ollama_model");
    const savedDemo = localStorage.getItem("demo_mode");

    if (savedUrl) setOllamaUrl(savedUrl);
    if (savedModel) setModelName(savedModel);
    if (savedDemo) setDemoMode(savedDemo === "true");
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!displayName.trim()) {
      setProfileError("Full Name cannot be empty.");
      return;
    }

    try {
      setProfileError("");
      setProfileSuccess(false);
      await updateProfile(currentUser, { displayName });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || "Failed to update profile name.");
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("ollama_url", ollamaUrl);
    localStorage.setItem("ollama_model", modelName);
    localStorage.setItem("demo_mode", String(demoMode));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const runDiagnostics = async () => {
    setDiagnosticStatus("testing");
    setDiscoveredModels([]);
    
    try {
      const token = await getToken();
      const headers = {
        "Authorization": `Bearer ${token}`
      };

      const res = await fetch(`${API_BASE}/api/health`, { headers });
      if (res.ok) {
        const data = await res.json();
        
        if (data.ollama.status === "online") {
          setDiagnosticStatus("success");
          setDiscoveredModels(data.ollama.models);
          if (data.ollama.models.length > 0 && !data.ollama.models.includes(modelName)) {
            setModelName(data.ollama.models[0]);
          }
        } else {
          setDiagnosticStatus("failed");
        }
      } else {
        setDiagnosticStatus("failed");
      }
    } catch (e) {
      setDiagnosticStatus("failed");
    }
  };

  return (
    <div className="space-y-8 max-w-3xl font-mono text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground mb-2">Settings Console</h1>
        <p className="text-xs text-muted-foreground">Configure LLM pipeline connections, sandbox values, and secure profile parameters.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings (Firebase) */}
        <form onSubmit={handleSaveProfile} className="border border-border bg-card p-6 space-y-6">
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3 uppercase tracking-wider">
            <UserIcon className="w-4 h-4 text-indigo-500" /> Analyst Profile
          </h3>

          {profileError && (
            <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-500 text-xs rounded-none">
              ERROR: {profileError}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase block">EMAIL ADDRESS</label>
              <input 
                type="text" 
                value={currentUser?.email || ""}
                disabled
                className="w-full bg-background border border-border outline-none text-muted-foreground text-xs px-3.5 py-2.5 rounded-none cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase block">FULL NAME</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Aakash Tiru"
                className="w-full bg-background border border-border outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[9px] text-muted-foreground">Registered: {currentUser?.metadata.creationTime}</span>
            <div className="flex gap-2 items-center">
              {profileSuccess && (
                <span className="text-[10px] text-emerald-500 font-semibold font-mono flex items-center gap-1.5 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profile Updated
                </span>
              )}
              <button 
                type="submit"
                className="px-4 py-2 bg-foreground text-background hover:opacity-90 text-xs font-mono uppercase tracking-wider transition-all rounded-none flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <Save className="w-3.5 h-3.5" /> Save Profile
              </button>
            </div>
          </div>
        </form>

        {/* Ollama Configurations */}
        <form onSubmit={handleSaveConfig} className="border border-border bg-card p-6 space-y-6">
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-indigo-500" /> LLM Generation Engine
          </h3>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Ollama URL */}
            <div className="space-y-2">
              <label className="text-[10px] tracking-wider text-muted-foreground uppercase block">Ollama API Base URL</label>
              <input 
                type="text" 
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full bg-background border border-border outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-none"
              />
            </div>

            {/* Model Name */}
            <div className="space-y-2">
              <label className="text-[10px] tracking-wider text-muted-foreground uppercase block">LLM Model Name</label>
              {discoveredModels.length > 0 ? (
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-background border border-border rounded-none px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-indigo-500/40"
                >
                  {discoveredModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="llama3"
                  className="w-full bg-background border border-border outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-none"
                />
              )}
            </div>
          </div>

          {/* Diagnostics testing section */}
          <div className="p-4 rounded-none bg-background border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">Diagnostics Check</h4>
              <p className="text-[9px] text-muted-foreground font-sans leading-relaxed">Test if backend can handshake with local Ollama engine APIs.</p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {diagnosticStatus === "testing" && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono">
                  <Activity className="w-3.5 h-3.5 animate-pulse text-indigo-500" />
                  <span>Connecting...</span>
                </div>
              )}
              {diagnosticStatus === "success" && (
                <div className="flex items-center gap-1.5 text-[9px] text-emerald-500 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ollama online ({discoveredModels.length} models discovered)</span>
                </div>
              )}
              {diagnosticStatus === "failed" && (
                <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-mono">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Ollama unreachable</span>
                </div>
              )}

              <button
                type="button"
                onClick={runDiagnostics}
                className="px-3.5 py-2 bg-card border border-border hover:bg-background text-xs font-semibold text-foreground transition-all cursor-pointer rounded-none uppercase"
              >
                Test Connection
              </button>
            </div>
          </div>
        </form>

        {/* Local Demo/Fallback Mode */}
        <div className="border border-border bg-card p-6 space-y-6">
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3 uppercase tracking-wider">
            <Database className="w-4 h-4 text-indigo-500" /> System Sandbox
          </h3>

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-semibold text-foreground">Enforce Sandbox Demo Mode</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-xl font-sans">
                Bypasses local Ollama generation. Responses are formulated inside a rule-based synthesis engine highlighting exact matched sentences and keywords directly from FAISS vector citations. Highly recommended if you are evaluating on a machine without Ollama.
              </p>
            </div>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setDemoMode(!demoMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${demoMode ? 'bg-indigo-600' : 'bg-background border-border'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${demoMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          
          {demoMode && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 leading-normal flex items-start gap-2 rounded-none">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Demo Mode Enabled:</strong> The chat engine will generate structured mock answers directly from extracted document snippets. You do not need Ollama running to test chat features.
              </span>
            </div>
          )}
        </div>

        {/* Save Settings */}
        <div className="flex justify-end gap-3 items-center">
          {saveSuccess && (
            <span className="text-xs text-emerald-500 font-semibold font-mono flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Config saved!
            </span>
          )}
          <button 
            onClick={handleSaveConfig}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer rounded-none"
          >
            <Save className="w-4.5 h-4.5" /> Save Configurations
          </button>
        </div>
      </div>
    </div>
  );
}
