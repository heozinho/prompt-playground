"use client";

import { useState, useEffect } from "react";

type Artifact = {
  id: string;
  timestamp: string;
  prompt: string;
  system: string;
  output: string;
  status: "running" | "success" | "error";
  modelUsed: string;
  keyMeta?: { budget: number; expires: string; rateLimit: string; attemptsUsed: number } | null;
  runtime?: number;
};

export default function Playground() {
  // ── State ────────────────────────────────────────────────────────
  const [isClient, setIsClient] = useState(false);
  
  // Left: Settings & Meta
  const [provider, setProvider] = useState("free");
  const [apiKey, setApiKey] = useState("");
  const [freeKeyCount, setFreeKeyCount] = useState<number | null>(null);
  const [freeKeyError, setFreeKeyError] = useState("");

  // Center: Active Command Center
  const [activeSystem, setActiveSystem] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [activeModel, setActiveModel] = useState("auto"); // For free keys it's auto, for Groq it's llama3...
  
  // Right: Archive
  const [archive, setArchive] = useState<Artifact[]>([]);

  // ── Initialization & Persistence ──────────────────────────────────
  useEffect(() => {
    setIsClient(true);
    setProvider(localStorage.getItem("pp_provider") ?? "free");
    setApiKey(localStorage.getItem("pp_key") ?? "");
    const savedArchive = localStorage.getItem("pp_archive");
    if (savedArchive) {
      try {
        setArchive(JSON.parse(savedArchive));
      } catch (e) {
        console.error("Failed to parse archive", e);
      }
    }
  }, []);

  // Save settings when changed
  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem("pp_provider", provider);
    localStorage.setItem("pp_key", apiKey.trim());
  }, [provider, apiKey, isClient]);

  // Save archive when changed
  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem("pp_archive", JSON.stringify(archive));
  }, [archive, isClient]);

  // Fetch free keys status
  useEffect(() => {
    if (provider !== "free") return;
    setFreeKeyCount(null);
    setFreeKeyError("");
    fetch("/api/free-keys")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setFreeKeyError(d.error);
        else setFreeKeyCount(d.keys?.length ?? 0);
      })
      .catch(() => setFreeKeyError("Could not reach key list"));
  }, [provider]);

  // ── Execution ─────────────────────────────────────────────────────
  async function executePrompt() {
    if (!activePrompt.trim()) return;

    const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const startTime = Date.now();
    
    // Create pending artifact
    const newArtifact: Artifact = {
      id: runId,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      prompt: activePrompt,
      system: activeSystem,
      output: "",
      status: "running",
      modelUsed: provider === "free" ? "AUTO" : (provider === "groq" ? "llama3-8b-8192" : "meta-llama/llama-3-8b-instruct:free")
    };

    setArchive((prev) => [newArtifact, ...prev]);

    try {
      const fullPrompt = activeSystem.trim() 
        ? `System: ${activeSystem}\n\nUser: ${activePrompt}`
        : activePrompt;

      const res = await fetch("/api/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, apiKey, provider }),
      });

      const data = await res.json();
      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));

      if (!res.ok) throw new Error(data.error ?? "API request failed");

      setArchive((prev) =>
        prev.map((a) =>
          a.id === runId
            ? {
                ...a,
                status: "success",
                output: data.output,
                modelUsed: data.model || a.modelUsed,
                keyMeta: data.keyMeta ?? null,
                runtime,
              }
            : a
        )
      );
    } catch (err: any) {
      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));
      setArchive((prev) =>
        prev.map((a) =>
          a.id === runId
            ? { ...a, status: "error", output: err.message, runtime }
            : a
        )
      );
    }
  }

  function clearArchive() {
    if (confirm("Clear all archived outputs?")) {
      setArchive([]);
    }
  }

  function loadToCenter(a: Artifact) {
    setActivePrompt(a.prompt);
    setActiveSystem(a.system);
  }

  // Prevents hydration mismatch
  if (!isClient) return null;

  return (
    <div className="app-shell">
      
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">PROMPTLAB.</div>
          <div className="sidebar-meta">LOCAL WORKSPACE</div>
        </div>

        <div className="sidebar-section">
          <span className="label">Navigation</span>
          <button className="nav-link active">PLAYGROUND</button>
          <button className="nav-link">PRESETS</button>
          <button className="nav-link">ARCHIVE</button>
        </div>

        <div className="sidebar-section">
          <span className="label">Configuration</span>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span className="label" style={{ fontSize: "9px" }}>Provider</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="free">FREE COMMUNITY</option>
              <option value="groq">GROQ</option>
              <option value="openrouter">OPENROUTER</option>
            </select>
          </div>

          {provider === "free" ? (
            <div className="free-key-status">
              {freeKeyCount === null && !freeKeyError && <span style={{ color: "var(--text-muted)" }}>SYNCING...</span>}
              {freeKeyCount !== null && <span style={{ color: "var(--text)" }}>STATUS: {freeKeyCount} KEYS ONLINE</span>}
              {freeKeyError && <span style={{ color: "var(--danger)" }}>ERR: {freeKeyError}</span>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span className="label" style={{ fontSize: "9px" }}>API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="mono"
              />
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER COMMAND ─────────────────────────────────────────────── */}
      <main className="command-center">
        <div className="editor-header">
          <div>
            <span className="title">ACTIVE_EXPERIMENT</span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span className="label">MODE: RAW</span>
            <span className="label">TEMP: 0.7</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div className="editor-block">
            <div className="editor-block-header">
              <span className="label">[ SYSTEM ]</span>
            </div>
            <textarea
              className="editor-textarea"
              placeholder="You are a cold visual prompt assistant..."
              value={activeSystem}
              onChange={(e) => setActiveSystem(e.target.value)}
              style={{ minHeight: "80px" }}
            />
          </div>

          <div className="editor-block">
            <div className="editor-block-header">
              <span className="label">[ USER ]</span>
            </div>
            <textarea
              className="editor-textarea"
              placeholder="Generate ten variations of..."
              value={activePrompt}
              onChange={(e) => setActivePrompt(e.target.value)}
              style={{ minHeight: "200px" }}
            />
          </div>

        </div>

        <div>
          <button className="btn btn-primary" onClick={executePrompt}>
            [ EXECUTE → ]
          </button>
        </div>
      </main>

      {/* ── RIGHT ARCHIVE ──────────────────────────────────────────────── */}
      <aside className="archive-pane">
        <div className="archive-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="title">OUTPUT_ARCHIVE</span>
          {archive.length > 0 && (
            <button className="nav-link" onClick={clearArchive} style={{ fontSize: "9px" }}>CLEAR</button>
          )}
        </div>

        <div className="archive-feed">
          {archive.length === 0 && (
            <div className="label" style={{ textAlign: "center", marginTop: "40px" }}>NO ARTIFACTS SAVED</div>
          )}

          {archive.map((art) => (
            <div key={art.id} className="artifact-card">
              <div className="artifact-meta">
                <div className="artifact-meta-item">
                  <span className="label">ID</span>
                  <span className="mono">{art.id}</span>
                </div>
                <div className="artifact-meta-item">
                  <span className="label">TIME</span>
                  <span className="mono">{art.timestamp}</span>
                </div>
                <div className="artifact-meta-item">
                  <span className="label">MODEL</span>
                  <span className="mono">{art.modelUsed}</span>
                </div>
                {art.runtime && (
                  <div className="artifact-meta-item">
                    <span className="label">SPEED</span>
                    <span className="mono">{art.runtime}s</span>
                  </div>
                )}
              </div>

              {art.keyMeta && (
                <div className="artifact-meta" style={{ borderTop: "none", paddingTop: 0 }}>
                  <div className="artifact-meta-item">
                    <span className="label">BUDGET</span>
                    <span className="mono">${art.keyMeta.budget}</span>
                  </div>
                  {art.keyMeta.attemptsUsed > 1 && (
                    <div className="artifact-meta-item">
                      <span className="label">RETRIES</span>
                      <span className="mono">{art.keyMeta.attemptsUsed - 1}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="artifact-content">
                {art.status === "running" && <span style={{ color: "var(--text-muted)" }}>[ PROCESSING ]</span>}
                {art.status === "error" && <span style={{ color: "red" }}>[ ERROR: {art.output} ]</span>}
                {art.status === "success" && art.output}
              </div>

              <div className="artifact-actions">
                <button className="artifact-action" onClick={() => loadToCenter(art)}>BRANCH</button>
                <button className="artifact-action" onClick={() => navigator.clipboard.writeText(art.output)}>COPY</button>
                <button className="artifact-action" onClick={() => setArchive(archive.filter(a => a.id !== art.id))}>DELETE</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

    </div>
  );
}
