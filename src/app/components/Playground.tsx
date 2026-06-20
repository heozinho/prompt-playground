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

const PRESETS = [
  {
    id: "VISUAL_STYLE_EXTRACTOR",
    tag: "IMAGE",
    desc: "Turns references into reusable art direction.",
    sys: "You are an expert art director. Analyze the user's description of an image and extract a strict, reusable prompt formula focusing on lighting, medium, camera angle, and color grading. Output ONLY the formula.",
    usr: "A 1990s anime style shot of a rainy cyberpunk city, neon reflections on wet asphalt, slightly blurred background."
  },
  {
    id: "AGENT_PLANNER",
    tag: "AGENT",
    desc: "Breaks tasks into tool-ready steps.",
    sys: "You are an autonomous agent planner. Break the user's goal into a strict JSON array of sequential steps. Each step must define the required tool, inputs, and expected output.",
    usr: "Research the latest top 3 open-source LLMs, summarize their context window sizes, and write a markdown report."
  },
  {
    id: "CODE_REVIEW_HARSH",
    tag: "CODE",
    desc: "A cold, ruthless code reviewer.",
    sys: "You are a ruthless, senior systems engineer. Review the provided code. Point out logic flaws, security issues, and performance bottlenecks. Do not compliment the author. Be cold and brief.",
    usr: "function isEven(n) {\n  if (n === 0) return true;\n  if (n === 1) return false;\n  return isEven(n - 2);\n}"
  },
  {
    id: "ZERO_SHOT_CLASSIFIER",
    tag: "EVAL",
    desc: "Strictly categorizes text inputs.",
    sys: "Classify the user's text into one of the following categories: SPAM, INQUIRY, COMPLAINT, PRAISE. Output ONLY the category name. No other text.",
    usr: "Hey there! I've been trying to get my refund for 3 weeks now and no one is replying to my emails. What is going on?"
  }
];

export default function Playground() {
  // ── State ────────────────────────────────────────────────────────
  const [isClient, setIsClient] = useState(false);
  const [currentView, setCurrentView] = useState<"playground" | "presets" | "compare">("playground");
  
  // Left: Settings & Meta
  const [provider, setProvider] = useState("free");
  const [apiKey, setApiKey] = useState("");
  const [freeKeyCount, setFreeKeyCount] = useState<number | null>(null);
  const [freeKeyError, setFreeKeyError] = useState("");
  const [availableFreeModels, setAvailableFreeModels] = useState<string[]>([]);

  // Center: Active Command Center
  const [activeSystem, setActiveSystem] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  
  // Right: Archive
  const [archive, setArchive] = useState<Artifact[]>([]);

  // Compare Mode State
  const [comparePrompt, setComparePrompt] = useState("");
  const [compareModel1, setCompareModel1] = useState("gemini-2.5-flash");
  const [compareModel2, setCompareModel2] = useState("deepseek-chat");
  const [compareOutput1, setCompareOutput1] = useState<Artifact | null>(null);
  const [compareOutput2, setCompareOutput2] = useState<Artifact | null>(null);

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

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem("pp_provider", provider);
    localStorage.setItem("pp_key", apiKey.trim());
  }, [provider, apiKey, isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem("pp_archive", JSON.stringify(archive));
  }, [archive, isClient]);

  useEffect(() => {
    if (provider !== "free") return;
    setFreeKeyCount(null);
    setFreeKeyError("");
    fetch("/api/free-keys")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setFreeKeyError(d.error);
        else {
          setFreeKeyCount(d.keys?.length ?? 0);
          if (d.keys) {
            const unique = Array.from(new Set(d.keys.map((k: any) => k.model))) as string[];
            setAvailableFreeModels(unique);
            if (unique.length >= 2) {
              setCompareModel1(unique[0]);
              setCompareModel2(unique[1]);
            }
          }
        }
      })
      .catch(() => setFreeKeyError("Could not reach key list"));
  }, [provider]);

  // ── Execution ─────────────────────────────────────────────────────
  async function executeSinglePrompt(sys: string, usr: string, forcedModel?: string): Promise<Artifact> {
    const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const startTime = Date.now();
    
    const initialArtifact: Artifact = {
      id: runId,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      prompt: usr,
      system: sys,
      output: "",
      status: "running",
      modelUsed: forcedModel || (provider === "free" ? "AUTO" : (provider === "groq" ? "llama3-8b-8192" : "meta-llama/llama-3-8b-instruct:free"))
    };

    try {
      const fullPrompt = sys.trim() ? `System: ${sys}\n\nUser: ${usr}` : usr;
      const res = await fetch("/api/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, apiKey, provider, forceModel: forcedModel }),
      });

      const data = await res.json();
      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));

      if (!res.ok) throw new Error(data.error ?? "API request failed");

      return {
        ...initialArtifact,
        status: "success",
        output: data.output,
        modelUsed: data.model || initialArtifact.modelUsed,
        keyMeta: data.keyMeta ?? null,
        runtime,
      };
    } catch (err: any) {
      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));
      return { ...initialArtifact, status: "error", output: err.message, runtime };
    }
  }

  async function executePlayground() {
    if (!activePrompt.trim()) return;
    
    // Create pending artifact in UI immediately
    const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const pending: Artifact = {
      id: runId,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      prompt: activePrompt,
      system: activeSystem,
      output: "",
      status: "running",
      modelUsed: "..."
    };
    setArchive((prev) => [pending, ...prev]);

    const result = await executeSinglePrompt(activeSystem, activePrompt);
    
    setArchive((prev) => prev.map((a) => a.id === runId ? result : a));
  }

  async function executeCompare() {
    if (!comparePrompt.trim()) return;

    setCompareOutput1({
      id: "comp1", timestamp: "", prompt: comparePrompt, system: "", output: "", status: "running", modelUsed: compareModel1
    });
    setCompareOutput2({
      id: "comp2", timestamp: "", prompt: comparePrompt, system: "", output: "", status: "running", modelUsed: compareModel2
    });

    const [res1, res2] = await Promise.all([
      executeSinglePrompt("", comparePrompt, compareModel1),
      executeSinglePrompt("", comparePrompt, compareModel2)
    ]);

    setCompareOutput1(res1);
    setCompareOutput2(res2);
    
    // Save both to archive
    setArchive((prev) => [res1, res2, ...prev]);
  }

  function loadPreset(preset: typeof PRESETS[0]) {
    setActiveSystem(preset.sys);
    setActivePrompt(preset.usr);
    setCurrentView("playground");
  }

  // Prevents hydration mismatch
  if (!isClient) return null;

  return (
    <div className="app-shell">
      
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">PROMPTLAB.</div>
          <div className="sidebar-meta">made by heo</div>
        </div>

        <div className="sidebar-section">
          <span className="label">Navigation</span>
          <button 
            className={`nav-link ${currentView === "playground" ? "active" : ""}`}
            onClick={() => setCurrentView("playground")}
          >
            PLAYGROUND
          </button>
          <button 
            className={`nav-link ${currentView === "compare" ? "active" : ""}`}
            onClick={() => setCurrentView("compare")}
          >
            COMPARE
          </button>
          <button 
            className={`nav-link ${currentView === "presets" ? "active" : ""}`}
            onClick={() => setCurrentView("presets")}
          >
            PRESETS
          </button>
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
        
        {currentView === "playground" && (
          <>
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
              <button className="btn btn-primary" onClick={executePlayground}>
                [ EXECUTE → ]
              </button>
            </div>
          </>
        )}

        {currentView === "presets" && (
          <>
            <div className="editor-header">
              <div>
                <span className="title">PRESET_LIBRARY</span>
              </div>
            </div>
            <div className="preset-grid">
              {PRESETS.map((p) => (
                <div key={p.id} className="artifact-card" style={{ cursor: "pointer" }} onClick={() => loadPreset(p)}>
                  <div className="editor-block-header" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{p.id}</span>
                    <span className="label">{p.tag}</span>
                  </div>
                  <div style={{ padding: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {p.desc}
                  </div>
                  <div className="artifact-actions">
                    <button className="artifact-action">LOAD →</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {currentView === "compare" && (
          <>
            <div className="editor-header">
              <div>
                <span className="title">COMPARE_MODELS</span>
              </div>
            </div>
            
            <div className="editor-block">
              <div className="editor-block-header">
                <span className="label">[ SHARED PROMPT ]</span>
              </div>
              <textarea
                className="editor-textarea"
                placeholder="Enter a prompt to run simultaneously..."
                value={comparePrompt}
                onChange={(e) => setComparePrompt(e.target.value)}
                style={{ minHeight: "120px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* SLOT 1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {provider === "free" ? (
                  <select value={compareModel1} onChange={(e) => setCompareModel1(e.target.value)}>
                    {availableFreeModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <span className="label">USING DEFAULT PROVIDER MODEL</span>
                )}
                
                {compareOutput1 && (
                  <div className="artifact-card" style={{ flex: 1 }}>
                    <div className="artifact-meta">
                      <span className="mono">{compareOutput1.modelUsed}</span>
                      {compareOutput1.runtime && <span className="label">{compareOutput1.runtime}s</span>}
                    </div>
                    <div className="artifact-content">
                      {compareOutput1.status === "running" && <span style={{ color: "var(--text-muted)" }}>[ PROCESSING ]</span>}
                      {compareOutput1.status === "error" && <span style={{ color: "red" }}>[ ERROR: {compareOutput1.output} ]</span>}
                      {compareOutput1.status === "success" && compareOutput1.output}
                    </div>
                  </div>
                )}
              </div>

              {/* SLOT 2 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {provider === "free" ? (
                  <select value={compareModel2} onChange={(e) => setCompareModel2(e.target.value)}>
                    {availableFreeModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <span className="label">USING DEFAULT PROVIDER MODEL</span>
                )}
                
                {compareOutput2 && (
                  <div className="artifact-card" style={{ flex: 1 }}>
                    <div className="artifact-meta">
                      <span className="mono">{compareOutput2.modelUsed}</span>
                      {compareOutput2.runtime && <span className="label">{compareOutput2.runtime}s</span>}
                    </div>
                    <div className="artifact-content">
                      {compareOutput2.status === "running" && <span style={{ color: "var(--text-muted)" }}>[ PROCESSING ]</span>}
                      {compareOutput2.status === "error" && <span style={{ color: "red" }}>[ ERROR: {compareOutput2.output} ]</span>}
                      {compareOutput2.status === "success" && compareOutput2.output}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <button className="btn btn-primary" onClick={executeCompare}>
                [ EXECUTE ALL → ]
              </button>
            </div>
          </>
        )}

      </main>

      {/* ── RIGHT ARCHIVE ──────────────────────────────────────────────── */}
      <aside className="archive-pane">
        <div className="archive-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="title">OUTPUT_ARCHIVE</span>
          {archive.length > 0 && (
            <button className="nav-link" onClick={() => { if(confirm("Clear archive?")) setArchive([]); }} style={{ fontSize: "9px" }}>CLEAR</button>
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
                <button className="artifact-action" onClick={() => {
                  setActivePrompt(art.prompt);
                  setActiveSystem(art.system);
                  setCurrentView("playground");
                }}>BRANCH</button>
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
