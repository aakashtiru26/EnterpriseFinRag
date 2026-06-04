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
  User as UserIcon,
  Sparkles
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
  const [inferenceMode, setInferenceMode] = useState("gemini");
  
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
    
    const savedInferenceMode = localStorage.getItem("inference_mode");
    if (savedInferenceMode) {
      setInferenceMode(savedInferenceMode);
    } else if (savedDemo === "true") {
      setInferenceMode("demo");
    } else {
      setInferenceMode("gemini");
    }
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
    localStorage.setItem("inference_mode", inferenceMode);
 
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

      const queryParams = new URLSearchParams({ ollama_url: ollamaUrl });
      const res = await fetch(`${API_BASE}/api/health?${queryParams.toString()}`, { headers });
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
    <div className="space-y-8 max-w-3xl text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground mb-2">Settings Console</h1>
        <p className="text-xs text-muted-foreground">Configure LLM pipeline connections, sandbox values, and secure profile parameters.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings (Firebase) */}
        <form onSubmit={handleSaveProfile} className="border border-border bg-card/45 backdrop-blur-xl p-6 space-y-6 rounded-2xl">
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
              <label className="text-[10px] tracking-wider text-muted-foreground uppercase block font-semibold">EMAIL ADDRESS</label>
              <input 
                type="text" 
                value={currentUser?.email || ""}
                disabled
                className="w-full bg-background/40 border border-border/40 outline-none text-muted-foreground text-xs px-3.5 py-2.5 rounded-xl cursor-not-allowed"
              />
            </div>
 
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-wider text-muted-foreground uppercase block font-semibold">FULL NAME</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Aakash Tiru"
                className="w-full bg-background/40 border border-border/40 outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[9px] text-muted-foreground">Registered: {currentUser?.metadata.creationTime}</span>
            <div className="flex gap-2 items-center">
              {profileSuccess && (
                <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profile Updated
                </span>
              )}
              <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white hover:opacity-90 text-xs uppercase tracking-wider transition-all rounded-xl flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <Save className="w-3.5 h-3.5" /> Save Profile
              </button>
            </div>
          </div>
        </form>

        {/* AI Inference Engine Selection & Configuration */}
        <div className="border border-border bg-card/45 backdrop-blur-xl p-6 space-y-6 rounded-2xl">
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border/30 pb-3 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-indigo-500" /> AI Inference Engine
          </h3>

          {/* Selector Tabs */}
          <div className="grid grid-cols-3 gap-3 p-1 bg-background/50 rounded-xl border border-border/30">
            {[
              { id: "gemini", label: "Cloud Gemini", desc: "Server-side cloud API" },
              { id: "ollama", label: "Local Ollama", desc: "User-defined custom URL" },
              { id: "demo", label: "Demo Sandbox", desc: "Offline rule-based mock" }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setInferenceMode(option.id);
                  if (option.id === "demo") setDemoMode(true);
                  else setDemoMode(false);
                }}
                className={`px-3 py-3 rounded-lg text-left transition-all cursor-pointer ${
                  inferenceMode === option.id
                    ? "bg-indigo-600/10 border border-indigo-500/40 text-indigo-400 font-semibold"
                    : "border border-transparent hover:bg-foreground/5 text-muted-foreground"
                }`}
              >
                <div className="text-xs font-semibold">{option.label}</div>
                <div className="text-[9px] opacity-70 font-sans mt-0.5">{option.desc}</div>
              </button>
            ))}
          </div>

          {/* Mode Explanations & Parameter Configurations */}
          {inferenceMode === "gemini" && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-muted-foreground leading-relaxed font-sans">
                <p className="font-semibold text-foreground font-mono uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Mode: Cloud Gemini Active
                </p>
                Requests are sent directly to the server's backend Google Gemini API. This provides advanced reasoning and high-context analysis without requiring local hardware resources or terminal tunnels. Ensure the server has a valid <code className="font-mono text-indigo-400">GEMINI_API_KEY</code> configured.
              </div>
            </div>
          )}

          {inferenceMode === "ollama" && (
            <div className="space-y-6 pt-2">
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-muted-foreground leading-relaxed font-sans">
                <p className="font-semibold text-foreground font-mono uppercase text-[10px] tracking-wider mb-1">
                  Mode: Local Ollama Connection
                </p>
                Connects to a running instance of Ollama on your local machine or a private tunnel. 
                <strong className="text-foreground block mt-1.5">How to set up:</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-1 text-muted-foreground">
                  <li>Start Ollama on your host: <code className="font-mono text-zinc-400 bg-background/50 px-1 py-0.5">ollama run llama3.2</code></li>
                  <li>If accessing via a cloud-deployed server (like Hugging Face), expose your local port via a public tunnel: <code className="font-mono text-zinc-400 bg-background/50 px-1 py-0.5">ngrok http 11434</code> or localtunnel.</li>
                  <li>Copy and paste your public tunnel URL (e.g. <code className="font-mono text-zinc-400 bg-background/50 px-1 py-0.5">https://xxx.ngrok-free.app</code>) into the input below.</li>
                </ol>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Ollama URL */}
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase block font-semibold">Ollama API Base URL</label>
                  <input 
                    type="text" 
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-background border border-border outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-xl"
                  />
                </div>

                {/* Model Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] tracking-wider text-muted-foreground uppercase block font-semibold">LLM Model Name</label>
                  {discoveredModels.length > 0 ? (
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-indigo-500/40"
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
                      className="w-full bg-background border border-border outline-none text-foreground text-xs px-3.5 py-2.5 focus:border-indigo-500/40 rounded-xl"
                    />
                  )}
                </div>
              </div>

              {/* Diagnostics testing section */}
              <div className="p-4 rounded-xl bg-background/40 border border-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                      <span>Ollama online ({discoveredModels.length} models)</span>
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
                    className="px-3.5 py-2 bg-card border border-border hover:bg-background text-xs font-semibold text-foreground transition-all cursor-pointer rounded-lg uppercase"
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {inferenceMode === "demo" && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-muted-foreground leading-relaxed font-sans">
                <p className="font-semibold text-amber-500 font-mono uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Mode: Demo Sandbox Active
                </p>
                Runs RAG queries offline without invoking actual LLM inference. Answers are synthesized using rule-based algorithms to extract and directly format citations and keywords from your documents. This is useful for debugging FAISS library embeddings and system flow.
              </div>
            </div>
          )}
        </div>

        {/* Save Settings */}
        <div className="flex justify-end gap-3 items-center">
          {saveSuccess && (
            <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Config saved!
            </span>
          )}
          <button 
            onClick={handleSaveConfig}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer rounded-xl"
          >
            <Save className="w-4.5 h-4.5" /> Save Configurations
          </button>
        </div>
      </div>
    </div>
  );
}
