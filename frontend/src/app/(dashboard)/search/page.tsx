"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "@/lib/config";
import { 
  Search, 
  Files, 
  Sliders, 
  HelpCircle,
  FileText,
  Loader2,
  Database
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  status: string;
}

interface SearchResult {
  content: string;
  score: number;
  metadata: {
    source: string;
    page: number;
    chunk_index?: number;
    doc_id?: string;
  };
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams.get("q") || "";
  const docParam = searchParams.get("doc") || "";

  const { getToken, currentUser } = useAuth();

  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [kResults, setKResults] = useState(5);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);



  // Load documents
  useEffect(() => {
    const fetchDocs = async () => {
      if (!currentUser) return;
      try {
        const token = await getToken();
        const headers = {
          "Authorization": `Bearer ${token}`
        };
        const res = await fetch(`${API_BASE}/api/documents`, { headers });
        if (res.ok) {
          const docsData: Document[] = await res.json();
          setDocuments(docsData.filter(d => d.status === "indexed"));
          if (docParam) {
            setSelectedDocIds([docParam]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDocsLoading(false);
      }
    };

    fetchDocs();
  }, [docParam, currentUser]);

  // Trigger search if query param changes
  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      triggerSearch(queryParam);
    }
  }, [queryParam, selectedDocIds.length]);

  const triggerSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const token = await getToken();
      const payload = {
        query: searchQuery,
        doc_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        k: kResults
      };

      const res = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.error("Semantic search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query)}&doc=${selectedDocIds.join(",")}`);
    triggerSearch(query);
  };

  const handleDocToggle = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const formatScore = (score: number) => {
    let percentage = score;
    if (percentage > 1) percentage = 1;
    if (percentage < 0) percentage = 0;
    return `${(percentage * 100).toFixed(1)}% match`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
    if (score >= 0.5) return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
    return "bg-zinc-500/10 text-muted-foreground border border-zinc-500/20";
  };

  return (
    <div className="space-y-8 font-mono text-foreground">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground mb-2">Semantic Similarity Search</h1>
        <p className="text-xs text-muted-foreground">Perform direct vector queries against the local FAISS index to inspect raw document context chunks.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-4xl">
        <div className="relative flex-1 flex items-center">
          <Search className="w-5 h-5 text-muted-foreground absolute left-4 shrink-0" />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Query semantic themes, tables, or financial disclosures..."
            className="w-full bg-card border border-border rounded-none pl-12 pr-4 py-3.5 text-xs text-foreground focus:outline-none focus:border-indigo-500/40 focus:ring-0"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-none transition-all disabled:opacity-40"
        >
          Search
        </button>
      </form>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-8">
        {/* Search Controls Side panel */}
        <aside className="lg:col-span-1 space-y-6 order-2 lg:order-1">
          {/* Target Documents checklist */}
          <div className="border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Files className="w-4 h-4 text-indigo-500" /> Filter Target
            </h3>
            {docsLoading ? (
              <div className="h-10 bg-background rounded animate-pulse" />
            ) : documents.length === 0 ? (
              <span className="text-[10px] text-muted-foreground block">No indexed files found.</span>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <label 
                    key={doc.id} 
                    className="flex items-center gap-2 px-2 py-1.5 rounded-none bg-background hover:bg-card cursor-pointer text-[10px] text-muted-foreground hover:text-foreground border border-border"
                  >
                    <input 
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => handleDocToggle(doc.id)}
                      className="rounded border-zinc-700 text-indigo-650 focus:ring-0 focus:ring-offset-0 bg-background w-3 h-3"
                    />
                    <span className="truncate flex-1" title={doc.filename}>{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Knobs & Parameters */}
          <div className="border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-500" /> Parameters
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>Retrieve (k)</span>
                  <span className="text-foreground font-bold">{kResults}</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="12"
                  value={kResults}
                  onChange={(e) => setKResults(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 bg-background rounded-full h-1"
                />
              </div>
              <div className="bg-background p-3 border border-border space-y-2 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Metric</span>
                  <span className="text-foreground">L2 Cosine</span>
                </div>
                <div className="flex justify-between">
                  <span>Embeddings</span>
                  <span className="text-foreground">MiniLM-L6</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Results Area */}
        <div className="lg:col-span-3 space-y-6 order-1 lg:order-2">

          {/* Results Area */}
          {loading ? (
            <div className="py-20 flex flex-col justify-center items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-muted-foreground font-mono">Querying distances in local vector store...</span>
            </div>
          ) : results.length === 0 ? (
            searched ? (
              <div className="text-center py-20 border border-dashed border-border bg-card">
                <HelpCircle className="w-8 h-8 text-muted mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">No Matches Found</h4>
                <p className="text-[10px] text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">Try clearing filters or refining your query syntax to locate other indexed vectors.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border bg-card text-center">
                <div className="w-10 h-10 border border-border bg-background flex items-center justify-center text-muted-foreground mb-4">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-1 uppercase tracking-wider">Ready for Semantic Query</h3>
                <p className="text-xs text-muted-foreground max-w-xs font-sans leading-relaxed">Enter a concept query to inspect vector segment layouts and scores.</p>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Similarity Match Results ({results.length})</h3>
              
              <div className="space-y-4">
                {results.map((result, idx) => (
                  <div key={idx} className="border border-border bg-card p-5 space-y-3.5 hover:border-primary transition-colors">
                    {/* Top row: match percentage and source metadata */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={result.metadata.source}>
                          {result.metadata.source}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Page {result.metadata.page}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {result.metadata.chunk_index !== undefined && (
                          <span className="px-1.5 py-0.5 border border-border text-[9px] text-muted-foreground">
                            Chunk #{result.metadata.chunk_index}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-medium ${getScoreColor(result.score)}`}>
                          {formatScore(result.score)}
                        </span>
                      </div>
                    </div>

                    {/* Text passage block */}
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {result.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SemanticSearch() {
  return (
    <Suspense fallback={
      <div className="py-20 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">Loading search workspace...</span>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
