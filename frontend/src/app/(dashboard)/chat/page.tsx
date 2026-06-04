"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "@/lib/config";
import { db } from "../../../lib/firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  Bot, 
  Send, 
  Files, 
  Trash2, 
  Loader2, 
  AlertCircle,
  FileText,
  HelpCircle,
  Cpu,
  History,
  Plus,
  Menu,
  X
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  status: string;
  num_chunks: number;
}

interface Citation {
  id: string;
  source: string;
  page: number;
  content: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: "ollama" | "demo" | "demo_fallback" | "no_context";
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  doc_ids: string[];
  created_at: string;
  updated_at: string;
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialDocParam = searchParams.get("doc");

  const { currentUser, getToken } = useAuth();
  
  // Document selection state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  
  // Chat History sessions state (Firestore)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const savedUrlRef = useRef<string>("http://localhost:11434"); // Standard references for state stability
  const modelNameRef = useRef<string>("llama3");

  // Settings
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [modelName, setModelName] = useState("llama3");
  const [demoMode, setDemoMode] = useState(false);
  const [usingGemini, setUsingGemini] = useState(false);
  const [geminiModelName, setGeminiModelName] = useState("gemini-3.5-flash");
  const [inferenceMode, setInferenceMode] = useState("gemini");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load configuration overlays
  useEffect(() => {
    const savedUrl = localStorage.getItem("ollama_url");
    const savedModel = localStorage.getItem("ollama_model");
    const savedDemo = localStorage.getItem("demo_mode");
    if (savedUrl) setOllamaUrl(savedUrl);
    if (savedModel) setModelName(savedModel);
    if (savedDemo) setDemoMode(savedDemo === "true");
  }, []);

  // Fetch documents and load user-specific chat sessions from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const initWorkspace = async () => {
      try {
        const token = await getToken();
        const headers = {
          "Authorization": `Bearer ${token}`
        };

        // 1. Fetch system health check
        const savedUrl = localStorage.getItem("ollama_url");
        const url = savedUrl 
          ? `${API_BASE}/api/health?ollama_url=${encodeURIComponent(savedUrl)}` 
          : `${API_BASE}/api/health`;
        const healthRes = await fetch(url, { headers });
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setOllamaUrl(healthData.ollama.url || savedUrl || "http://localhost:11434");
          
          if (healthData.ollama.models.length > 0) {
            const currentSavedModel = localStorage.getItem("ollama_model");
            if (currentSavedModel && healthData.ollama.models.includes(currentSavedModel)) {
              setModelName(currentSavedModel);
            } else {
              setModelName(healthData.ollama.models[0]);
            }
          }
          const isGemini = healthData.gemini?.status === "online";
          setUsingGemini(isGemini);
          if (healthData.gemini?.model) {
            setGeminiModelName(healthData.gemini.model);
          }
          
          const savedInferenceMode = localStorage.getItem("inference_mode");
          if (savedInferenceMode) {
            setInferenceMode(savedInferenceMode);
            if (savedInferenceMode === "demo") setDemoMode(true);
            else setDemoMode(false);
          } else if (isGemini) {
            setInferenceMode("gemini");
            setDemoMode(false);
          } else {
            const isManualDemo = localStorage.getItem("demo_mode") === "true";
            if (isManualDemo) {
              setInferenceMode("demo");
              setDemoMode(true);
            } else if (healthData.ollama.status === "online") {
              setInferenceMode("ollama");
              setDemoMode(false);
            } else {
              setInferenceMode("demo");
              setDemoMode(true);
            }
          }
        }
        
        // 2. Fetch user documents
        const docsRes = await fetch(`${API_BASE}/api/documents`, { headers });
        if (docsRes.ok) {
          const docsData: Document[] = await docsRes.json();
          const indexed = docsData.filter(d => d.status === "indexed");
          setDocuments(indexed);
          
          if (initialDocParam) {
            const match = indexed.find(d => d.id === initialDocParam);
            if (match) {
              setSelectedDocIds([match.id]);
            }
          }
        }

        // 3. Fetch past sessions from Firestore
        await fetchSessions();

      } catch (err) {
        console.error("Initialization error:", err);
        setDemoMode(true);
      } finally {
        setDocsLoading(false);
      }
    };

    initWorkspace();
  }, [currentUser, initialDocParam]);

  const fetchSessions = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "users", currentUser.uid, "chats"),
        orderBy("updated_at", "desc")
      );
      const snapshot = await getDocs(q);
      const sessionList: ChatSession[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        sessionList.push({
          id: docSnap.id,
          title: data.title || "Untitled Session",
          messages: data.messages || [],
          doc_ids: data.doc_ids || [],
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      });
      setSessions(sessionList);
    } catch (e) {
      console.error("Error loading chat history from Firestore:", e);
    }
  };

  const handleDocToggle = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId) 
        : [...prev, docId]
    );
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveCitation(null);
  };

  const selectSession = async (sessionId: string) => {
    const matched = sessions.find(s => s.id === sessionId);
    if (matched) {
      setActiveSessionId(sessionId);
      setMessages(matched.messages);
      setSelectedDocIds(matched.doc_ids || []);
      setActiveCitation(null);
    }
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "chats", sessionId));
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewSession();
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const handleSend = async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const queryText = customQuery || inputValue;
    if (!queryText.trim() || !currentUser) return;

    if (!customQuery) {
      setInputValue("");
    }

    const userMsg: Message = { role: "user", content: queryText };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setLoading(true);
    setActiveCitation(null);

    try {
      const token = await getToken();
      
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const payload = {
        query: queryText,
        doc_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        history: chatHistory,
        ollama_url: ollamaUrl,
        model_name: modelName,
        demo_mode: inferenceMode === "demo",
        inference_mode: inferenceMode
      };

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("RAG server returned error status");
      }

      const data = await res.json();
      
      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        mode: data.mode
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Save or update session in Firestore (user isolated)
      if (!activeSessionId) {
        // Create new session
        const title = queryText.substring(0, 40) + (queryText.length > 40 ? "..." : "");
        const docRef = await addDoc(collection(db, "users", currentUser.uid, "chats"), {
          title,
          messages: finalMessages,
          doc_ids: selectedDocIds,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setActiveSessionId(docRef.id);
        fetchSessions();
      } else {
        // Update existing session
        const chatDocRef = doc(db, "users", currentUser.uid, "chats", activeSessionId);
        await updateDoc(chatDocRef, {
          messages: finalMessages,
          doc_ids: selectedDocIds,
          updated_at: new Date().toISOString()
        });
        // Update local session list title/updated time
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: finalMessages,
          doc_ids: selectedDocIds,
          updated_at: new Date().toISOString()
        } : s));
      }

    } catch (err: any) {
      const errorMsg: Message = {
        role: "assistant",
        content: `Error: Failed to process query. Details: ${err.message}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const prePopulatedQueries = [
    "Summarize NVIDIA's revenue growth details",
    "What are the main risk factors mentioned?",
    "Analyze the operating income margins and ratios",
    "Summarize recent balance sheet changes"
  ];

  const renderMessageContent = (msg: Message) => {
    if (msg.role === "user") {
      return <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-mono">{msg.content}</p>;
    }

    const content = msg.content;
    const regex = /\[Source (\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      const sourceNum = match[1];
      const citationId = `Source ${sourceNum}`;
      const citationObj = msg.citations?.find(c => c.id === citationId);

      if (citationObj) {
        parts.push(
          <button
            key={matchIndex}
            onClick={() => setActiveCitation(citationObj)}
            className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500/20 text-[9px] font-bold font-mono inline-block mx-0.5 transition-all cursor-pointer"
          >
            {citationId}
          </button>
        );
      } else {
        parts.push(match[0]);
      }
      
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return (
      <div className="space-y-4">
        <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-mono">
          {parts.length > 0 ? parts : content}
        </div>
        
        {msg.citations && msg.citations.length > 0 && (
          <div className="pt-3 border-t border-border flex flex-wrap gap-2">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest block w-full mb-1">Sources Cited:</span>
            {msg.citations.map((citation) => (
              <button
                key={citation.id}
                onClick={() => setActiveCitation(citation)}
                className={`px-2 py-0.5 rounded-none text-[9px] font-mono text-muted-foreground border hover:text-foreground transition-all cursor-pointer ${
                  activeCitation?.id === citation.id
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                    : "bg-background border-border hover:border-primary"
                }`}
              >
                {citation.id}: {citation.source} (p. {citation.page})
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-8.5rem)] relative font-mono text-foreground">
      {/* Mobile Sidebar Drawer Backdrop */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar: Documents Checklist + Session History */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card/45 backdrop-blur-xl p-4 flex flex-col justify-between border-r border-border/30 transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto lg:w-auto lg:col-span-1 lg:border-r-0 lg:border lg:border-border/30 lg:rounded-2xl h-full ${
        showMobileSidebar ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
          {/* Mobile Sidebar Close Header */}
          <div className="flex justify-between items-center lg:hidden border-b border-border pb-3 mb-2 shrink-0">
            <span className="font-mono text-xs tracking-wider font-bold text-foreground">WORKSPACE TARGETS</span>
            <button 
              type="button"
              onClick={() => setShowMobileSidebar(false)}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer animate-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Focus Targets */}
          <div className="space-y-2.5 shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Files className="w-3.5 h-3.5 text-indigo-500" /> Focus Target
              </h3>
            </div>
            
            {docsLoading ? (
              <div className="h-9 bg-background rounded animate-pulse" />
            ) : documents.length === 0 ? (
              <div className="border border-dashed border-border p-3 text-center bg-background">
                <span className="text-[10px] text-muted-foreground block mb-1">No indexed files</span>
                <Link href="/upload" className="text-[10px] text-indigo-550 hover:underline uppercase" onClick={() => setShowMobileSidebar(false)}>Upload PDF</Link>
              </div>
            ) : (
              <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
                {documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div 
                      key={doc.id} 
                      onClick={() => handleDocToggle(doc.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 border cursor-pointer transition-colors rounded-xl ${
                        isSelected
                          ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 font-medium"
                          : "bg-background/30 border-border/40 hover:border-indigo-500/40 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded border-zinc-700 text-indigo-650 focus:ring-0 focus:ring-offset-0 bg-background w-3 h-3"
                      />
                      <span className="text-[10px] truncate max-w-full text-foreground" title={doc.filename}>{doc.filename}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Section 2: Session History */}
          <div className="flex-1 flex flex-col overflow-hidden space-y-2.5">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-500" /> Past Sessions
              </h3>
              <button
                onClick={startNewSession}
                className="p-1 rounded bg-background hover:bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="New chat session"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sessions.length === 0 ? (
                <div className="text-[10px] text-muted-foreground py-4 text-center">No past sessions found.</div>
              ) : (
                sessions.map(s => {
                  const isActive = activeSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        selectSession(s.id);
                        setShowMobileSidebar(false);
                      }}
                      className={`group flex items-center justify-between p-2.5 cursor-pointer border text-left transition-colors rounded-xl ${
                        isActive
                          ? "bg-background/60 border-border/40 text-foreground font-semibold"
                          : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-background/20"
                      }`}
                    >
                      <span className="text-[10px] truncate flex-1 pr-2" title={s.title}>
                        {s.title}
                      </span>
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 p-0.5 rounded transition-opacity shrink-0 cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* AI Mode Status */}
        <div className="pt-4 border-t border-border/30 mt-4 shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cpu className="w-4 h-4" />
            <span>AI Mode</span>
          </div>
          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-medium ${
            inferenceMode === "demo" 
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
              : inferenceMode === "gemini"
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
          }`}>
            {inferenceMode === "demo" 
              ? "SANDBOX DEMO" 
              : inferenceMode === "gemini" 
              ? `GEMINI (${geminiModelName.toUpperCase()})` 
              : `OLLAMA (${modelName})`}
          </span>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <div className="lg:col-span-3 flex flex-col border border-border/30 h-full overflow-hidden bg-card/45 backdrop-blur-xl rounded-2xl">
        {/* Chat Header */}
        <div className="h-14 border-b border-border/30 px-6 flex items-center justify-between shrink-0 bg-transparent">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden p-1.5 rounded bg-background border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer mr-1"
              title="Open workspace targets"
            >
              <Menu className="w-4 h-4" />
            </button>
            <Bot className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block">Conversational Feed</span>
              <span className="text-[10px] text-muted-foreground block truncate max-w-[120px] sm:max-w-xs">
                {selectedDocIds.length > 0 ? `Targeting ${selectedDocIds.length} reports` : "Searching full text corpus"}
              </span>
            </div>
          </div>
          <button 
            onClick={startNewSession}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-background border border-border hover:bg-card text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New Session</span>
          </button>
        </div>

        {/* Conversational Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-transparent">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center max-w-xl mx-auto text-center space-y-6">
              <div className="w-12 h-12 border border-border/40 bg-card/40 flex items-center justify-center text-indigo-500 rounded-2xl backdrop-blur-md shadow-sm">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-2 uppercase font-mono tracking-wider">Private RAG Matrix Online</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-sm font-sans">
                  Select indexed reports from the target menu, write your custom financial query, and hit enter. Calculations run local.
                </p>
              </div>

              {/* Suggestions prompt grid */}
              <div className="grid sm:grid-cols-2 gap-3 w-full">
                {prePopulatedQueries.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputValue(query)}
                    disabled={documents.length === 0}
                    className="p-3 text-left rounded-xl bg-card/45 border border-border/40 hover:bg-background/40 text-muted-foreground hover:text-foreground transition-all text-[10px] disabled:opacity-50 disabled:pointer-events-none uppercase font-mono tracking-wider backdrop-blur-sm shadow-sm"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index}
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl border border-border/40 bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                
                <div className={`p-4 max-w-[85%] border shadow-sm ${
                  msg.role === "user" 
                    ? "bg-indigo-600/10 border-indigo-500/30 text-foreground rounded-2xl rounded-tr-none" 
                    : "bg-card/45 border-border/30 text-foreground rounded-2xl rounded-tl-none backdrop-blur-md"
                }`}>
                  {renderMessageContent(msg)}
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-xl border border-border/40 bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none bg-card/45 border border-border/30 max-w-[85%] flex items-center gap-2 backdrop-blur-md shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Retrieving similarity nodes & generating...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border/30 bg-transparent shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your indexed files..."
              disabled={loading || documents.length === 0}
              className="w-full bg-background/40 border border-border/40 rounded-xl pl-4 pr-12 py-3 text-xs text-foreground focus:outline-none focus:border-indigo-500/40 focus:ring-0 disabled:opacity-50 font-mono backdrop-blur-md"
            />
            <button 
              type="submit"
              disabled={loading || !inputValue.trim() || documents.length === 0}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          {documents.length === 0 && (
            <span className="text-[9px] font-mono text-amber-500 font-medium mt-1.5 flex items-center gap-1 uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" /> Please upload documents in the library to start conversations.
            </span>
          )}
        </div>
      </div>

      {/* Citation Popout Overlay Side drawer */}
      {activeCitation && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-card/75 border-l border-border/30 shadow-2xl p-6 z-50 flex flex-col justify-between backdrop-blur-xl rounded-l-2xl">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" /> Verification Node
              </h3>
              <button 
                onClick={() => setActiveCitation(null)}
                className="text-muted-foreground hover:text-foreground px-2.5 py-1 rounded bg-background text-[9px] uppercase tracking-wider cursor-pointer border border-border"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source Document</span>
                <span className="text-xs font-semibold text-foreground truncate block">{activeCitation.source}</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Page Number</span>
                  <span className="text-xs font-mono font-bold text-indigo-500">Page {activeCitation.page}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5 font-mono">Reference</span>
                  <span className="text-xs font-mono font-bold text-foreground">{activeCitation.id}</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-1">Raw Vector Passage</span>
                <div className="p-3 bg-background border border-border text-xs leading-relaxed text-foreground font-mono whitespace-pre-wrap max-h-[380px] overflow-y-auto">
                  {activeCitation.content}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4 text-[9px] text-muted-foreground leading-normal font-sans">
            This raw context chunk was loaded from FAISS vector store database index by similarity search scores.
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">Loading conversational workspace...</span>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
