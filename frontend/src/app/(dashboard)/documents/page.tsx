"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "@/lib/config";
import { 
  Files, 
  Search, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  MessageSquare
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  size_bytes: number;
  status: string;
  num_chunks: number;
  created_at: string;
  error?: string;
}

export default function DocumentLibrary() {
  const { getToken, currentUser } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!currentUser) return;
    
    try {
      const token = await getToken();
      const headers = {
        "Authorization": `Bearer ${token}`
      };
      
      const res = await fetch(`${API_BASE}/api/documents`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Sort by upload date desc
        const sorted = data.sort((a: Document, b: Document) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setDocuments(sorted);
      }
    } catch (e) {
      console.error("Error loading documents in library:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [currentUser]);

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}" and its vector index?`)) {
      return;
    }
    
    setActionInProgress(docId);
    try {
      const token = await getToken();
      const headers = {
        "Authorization": `Bearer ${token}`
      };

      const res = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
      } else {
        alert("Failed to delete document from backend.");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Error contacting API gateway.");
    } finally {
      setActionInProgress(null);
    }
  };

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

  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 text-foreground">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2">Document Library</h1>
          <p className="text-xs text-muted-foreground">View and manage uploaded files residing in your isolated FAISS index database.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button 
            onClick={fetchDocuments}
            className="p-2.5 border border-border/40 bg-background/30 hover:bg-card/40 text-muted-foreground hover:text-foreground transition-all rounded-xl cursor-pointer backdrop-blur-sm"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link 
            href="/upload"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs uppercase tracking-wider text-white transition-all rounded-xl flex items-center justify-center font-bold"
          >
            Upload File
          </Link>
        </div>
      </div>

      {/* Search Filter and Counters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-card/45 backdrop-blur-md border border-border/40 rounded-xl px-3 py-2 w-full sm:w-80 focus-within:border-indigo-500/40 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input 
            type="text" 
            placeholder="Filter by file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-0 outline-0 p-0 text-xs w-full placeholder-zinc-500 focus:ring-0 focus:outline-none text-foreground"
          />
        </div>
        <div className="text-xs text-muted-foreground flex gap-4 self-end sm:self-center font-mono">
          <span>Active files: <strong className="text-foreground">{documents.length}</strong></span>
          <span>Indexed: <strong className="text-foreground">{documents.filter(d => d.status === "indexed").length}</strong></span>
        </div>
      </div>

      {/* Documents Table */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-12 bg-background rounded animate-pulse" />
          <div className="h-12 bg-background rounded animate-pulse" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/30 bg-card/45 backdrop-blur-xl rounded-2xl text-center shadow-sm">
          <div className="w-10 h-10 border border-border/30 bg-background/30 flex items-center justify-center text-muted-foreground mb-4 rounded-xl backdrop-blur-sm shadow-sm">
            <Files className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-sm text-foreground mb-1 uppercase font-mono tracking-wider">No Documents Matches</h3>
          <p className="text-xs text-muted-foreground max-w-xs mb-6 leading-relaxed">
            {searchQuery 
              ? `We couldn't find any file matching "${searchQuery}" inside your database.`
              : "Your document library is empty. Upload quarterly PDFs or report texts to index them."
            }
          </p>
          {!searchQuery && (
            <Link 
              href="/upload"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-mono uppercase tracking-wider text-white transition-all rounded-xl font-bold"
            >
              Upload First File
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-border/30 bg-card/45 backdrop-blur-xl overflow-hidden rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/20 text-muted-foreground font-semibold bg-background/25 backdrop-blur-md">
                  <th className="p-4 uppercase tracking-wider">File Name</th>
                  <th className="p-4 uppercase tracking-wider">Upload Date</th>
                  <th className="p-4 uppercase tracking-wider">Size</th>
                  <th className="p-4 uppercase tracking-wider">Chunks</th>
                  <th className="p-4 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-right uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="text-foreground hover:bg-background/25 transition-colors">
                    <td className="p-4 font-medium max-w-[240px] truncate text-foreground animate-colors" title={doc.filename}>
                      {doc.filename}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground">
                      {new Date(doc.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="p-4 font-mono text-muted-foreground">{formatSize(doc.size_bytes)}</td>
                    <td className="p-4 font-mono text-muted-foreground">{doc.num_chunks}</td>
                    <td className="p-4">{getStatusBadge(doc.status)}</td>
                    <td className="p-4 text-right space-x-1">
                      {doc.status === "indexed" && (
                        <>
                          <Link
                            href={`/chat?doc=${doc.id}`}
                            className="inline-flex p-1.5 rounded hover:bg-indigo-500/10 text-indigo-500 hover:text-indigo-650 transition-colors"
                            title="Chat with file"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/search?doc=${doc.id}`}
                            className="inline-flex p-1.5 rounded hover:bg-emerald-500/10 text-emerald-550 hover:text-emerald-700 transition-colors"
                            title="Search semantic chunks"
                          >
                            <Search className="w-4 h-4" />
                          </Link>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        disabled={actionInProgress === doc.id}
                        className={`inline-flex p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer ${actionInProgress === doc.id ? "opacity-50 pointer-events-none" : ""}`}
                        title="Delete index"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
