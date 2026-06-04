"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "@/lib/config";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Info
} from "lucide-react";

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "queued" | "processing" | "indexed" | "failed";
  progress: number;
  error?: string;
  backendId?: string;
}

export default function UploadPage() {
  const { getToken } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor files that are "processing" or "queued" by polling the backend
  useEffect(() => {
    const activeFiles = files.filter(f => f.status === "processing" || f.status === "queued");
    if (activeFiles.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        const headers = {
          "Authorization": `Bearer ${token}`
        };

        const res = await fetch(`${API_BASE}/api/documents`, { headers });
        if (!res.ok) return;
        
        const backendDocs = await res.json();
        
        setFiles(prevFiles => {
          return prevFiles.map(file => {
            if (file.status === "processing" || file.status === "queued") {
              const matchedBackendDoc = backendDocs.find((d: any) => d.id === file.backendId);
              if (matchedBackendDoc) {
                let status: UploadingFile["status"] = file.status;
                if (matchedBackendDoc.status === "indexed") status = "indexed";
                if (matchedBackendDoc.status === "processing") status = "processing";
                if (matchedBackendDoc.status === "failed") status = "failed";
                
                return {
                  ...file,
                  status,
                  error: matchedBackendDoc.error || undefined,
                  progress: status === "indexed" ? 100 : status === "processing" ? 75 : file.progress
                };
              }
            }
            return file;
          });
        });
      } catch (err) {
        console.error("Polling error: ", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [files, getToken]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const supportedTypes = [".pdf", ".txt", ".csv", ".json", ".md"];
    const addedFiles: UploadingFile[] = [];

    newFiles.forEach(file => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const isSupported = supportedTypes.includes(ext);
      
      const fileId = Math.random().toString(36).substring(7);
      const newUpload: UploadingFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        status: isSupported ? "uploading" : "failed",
        progress: 10,
        error: isSupported ? undefined : "Unsupported format. Ingest PDF, TXT, CSV, JSON or MD."
      };
      
      addedFiles.push(newUpload);
      
      if (isSupported) {
        uploadFileToBackend(file, fileId);
      }
    });

    setFiles(prev => [...addedFiles, ...prev]);
  };

  const uploadFileToBackend = async (file: File, fileId: string) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 30 } : f));
      
      const token = await getToken();
      
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }

      const docData = await res.json();
      
      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        status: "queued", 
        progress: 50,
        backendId: docData.id
      } : f));
      
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        status: "failed", 
        error: err.message || "Connection to backend API failed" 
      } : f));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8 font-mono text-foreground">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground mb-2">Upload Enterprise Documents</h1>
        <p className="text-xs text-muted-foreground">Ingest quarterly statement sheets or balance disclosures into your isolated FAISS index database.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Upload Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drag & Drop Box */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-2xl p-6 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              dragActive 
                ? "border-indigo-500 bg-indigo-500/5" 
                : "border-border/30 bg-card/20 backdrop-blur-md hover:border-primary hover:bg-card/45"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              accept=".pdf,.txt,.csv,.json,.md"
            />
            <div className="w-12 h-12 border border-border/30 bg-card/40 flex items-center justify-center text-muted-foreground mb-4 rounded-xl">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground mb-1 uppercase font-mono tracking-wider">Drag & Drop Files</h3>
            <p className="text-[10px] text-muted-foreground max-w-xs mb-4 leading-relaxed">
              Accepts PDF, TXT, CSV, JSON, and Markdown formats. Processing runs locally.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-2.5 py-0.5 border border-border/30 rounded-full text-[9px] text-muted-foreground font-mono bg-card/30 backdrop-blur-sm">PDF</span>
              <span className="px-2.5 py-0.5 border border-border/30 rounded-full text-[9px] text-muted-foreground font-mono bg-card/30 backdrop-blur-sm">TXT</span>
              <span className="px-2.5 py-0.5 border border-border/30 rounded-full text-[9px] text-muted-foreground font-mono bg-card/30 backdrop-blur-sm">CSV</span>
              <span className="px-2.5 py-0.5 border border-border/30 rounded-full text-[9px] text-muted-foreground font-mono bg-card/30 backdrop-blur-sm">MD</span>
              <span className="px-2.5 py-0.5 border border-border/30 rounded-full text-[9px] text-muted-foreground font-mono bg-card/30 backdrop-blur-sm">JSON</span>
            </div>
          </div>

          {/* Upload Queue list */}
          {files.length > 0 && (
            <div className="rounded-2xl bg-card/45 backdrop-blur-xl border border-border/30 p-6 space-y-4">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">Ingestion Logger</h3>
              <div className="divide-y divide-border max-h-[350px] overflow-y-auto pr-2">
                {files.map(file => (
                  <div key={file.id} className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 border border-border/30 bg-background/50 text-muted-foreground shrink-0 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="text-xs font-semibold text-foreground truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <span className="text-[9px] font-mono text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                        </div>
                        
                        {/* Progress Bar / Info */}
                        {file.status === "uploading" && (
                          <div className="space-y-1">
                            <div className="w-full bg-background h-1 rounded-full overflow-hidden">
                              <div className="bg-indigo-650 h-full transition-all duration-300" style={{ width: `${file.progress}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">Uploading payload to host API...</span>
                          </div>
                        )}
                        {file.status === "queued" && (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                            <span>In queued pipeline. Ingesting...</span>
                          </div>
                        )}
                        {file.status === "processing" && (
                          <div className="space-y-1">
                            <div className="w-full bg-background h-1 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full animate-pulse" style={{ width: "75%" }} />
                            </div>
                            <span className="text-[9px] text-amber-550 font-mono">Parsing PDF pages & calculating embeddings...</span>
                          </div>
                        )}
                        {file.status === "indexed" && (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-500">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Indexed. Isolated vector chunks loaded to FAISS local database.</span>
                          </div>
                        )}
                        {file.status === "failed" && (
                          <span className="text-[9px] text-red-500 font-mono block">
                            FAILED: {file.error || "Index calculation failure"}
                          </span>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-background shrink-0 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Guidance Side panel */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-card/45 backdrop-blur-xl border border-border/30 p-6 space-y-4">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" /> Isolated Sandbox Ingestion
            </h3>
            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Local Processing</h4>
                <p className="font-sans">Documents are parsed and indexed locally on your backend host. No raw document contents or vectors are ever sent to Firebase.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Metadata Sync</h4>
                <p className="font-sans">Only document list entries (filename, file size, status, chunk counts) are synchronized to Cloud Firestore to build your personalized user library console.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Strict Isolation</h4>
                <p className="font-sans">API operations require JWT authentication. Storage is segmented into separate user directories on the local server filesystem.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
