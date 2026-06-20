"use client";

import { useState, useEffect } from "react";
import Dropdown, { DropdownItem } from "./Dropdown";
import { getFreeKeys, executeCompletion } from "@/lib/api";

type Artifact = {
  id: string;
  timestamp: string;
  prompt: string;
  system: string;
  output: string;
  outputType?: "text" | "image";
  status: "running" | "success" | "error";
  modelUsed: string;
  keyMeta?: { budget: number; attemptsUsed: number } | null;
  runtime?: number;
};

type Block = {
  id: string;
  type: string;
  content: string;
};

const BLOCK_TYPES: DropdownItem[] = [
  { id: "SYSTEM", label: "SYSTEM" },
  { id: "USER", label: "USER" },
  { id: "STYLE", label: "STYLE" },
  { id: "TEXTURE", label: "TEXTURE" },
  { id: "CONSTRAINTS", label: "CONSTRAINTS" },
  { id: "NEGATIVE", label: "NEGATIVE" },
  { id: "EXAMPLES", label: "EXAMPLES" },
  { id: "OUTPUT FORMAT", label: "OUTPUT FORMAT" },
  { id: "NOTES", label: "NOTES" },
];

const MODES: DropdownItem[] = [
  { id: "TEXT", label: "TEXT" },
  { id: "IMAGE PROMPT", label: "IMAGE PROMPT" },
  { id: "AGENT PLAN", label: "AGENT PLAN" },
  { id: "CODE", label: "CODE" }
];

const DEFAULT_PROVIDERS: DropdownItem[] = [
  { id: "free", label: "FREE COMMUNITY", meta: "POOL" },
  { id: "pollinations", label: "POLLINATIONS IMAGE", meta: "FREE" },
  { id: "groq", label: "GROQ", meta: "API" },
  { id: "openrouter", label: "OPENROUTER", meta: "API" }
];

const PRESETS = [
  {
    id: "VISUAL_STYLE_EXTRACTOR",
    tag: "IMAGE",
    desc: "Turns references into reusable art direction.",
    blocks: [
      { id: "1", type: "SYSTEM", content: "You are an expert art director. Analyze the user's description of an image and extract a strict, reusable prompt formula focusing on lighting, medium, camera angle, and color grading. Output ONLY the formula." },
      { id: "2", type: "USER", content: "A 1990s anime style shot of a rainy cyberpunk city, neon reflections on wet asphalt, slightly blurred background." }
    ]
  },
  {
    id: "AGENT_PLANNER",
    tag: "AGENT",
    desc: "Breaks tasks into tool-ready steps.",
    blocks: [
      { id: "1", type: "SYSTEM", content: "You are an autonomous agent planner. Break the user's goal into a strict JSON array of sequential steps. Each step must define the required tool, inputs, and expected output." },
      { id: "2", type: "USER", content: "Research the latest top 3 open-source LLMs, summarize their context window sizes, and write a markdown report." }
    ]
  }
];

export default function Playground() {
  const [isClient, setIsClient] = useState(false);
  const [currentView, setCurrentView] = useState<"playground" | "presets" | "compare">("playground");
  
  // Left: Settings & Meta
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [provider, setProvider] = useState("free");
  const [apiKey, setApiKey] = useState("");
  const [freeKeyCount, setFreeKeyCount] = useState<number | null>(null);
  const [freeKeyError, setFreeKeyError] = useState("");
  const [availableFreeModels, setAvailableFreeModels] = useState<DropdownItem[]>([]);

  // Flicker state sequence
  const [statusMessage, setStatusMessage] = useState("STATUS: READY");

  // Center: Active Command Center
  const [activeMode, setActiveMode] = useState("TEXT");
  const [blocks, setBlocks] = useState<Block[]>([
    { id: "init-sys", type: "SYSTEM", content: "" },
    { id: "init-usr", type: "USER", content: "" }
  ]);
  const [runState, setRunState] = useState<"idle" | "running" | "complete" | "error">("idle");
  
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
    let initialProvider = localStorage.getItem("pp_provider") ?? "free";
    setApiKey(localStorage.getItem("pp_key") ?? "");
    
    // Background check for free keys immediately on load
    getFreeKeys().then((d) => {
      if (d.keys && d.keys.length === 0) {
        // Remove 'free' from selectable options
        setProviders(prev => prev.filter(p => p.id !== "free"));
        // If current provider is free, bump them to the next free option
        if (initialProvider === "free" || provider === "free") {
          initialProvider = "pollinations";
          setProvider("pollinations");
        }
      } else if (d.keys && d.keys.length > 0) {
        setFreeKeyCount(d.keys.length);
      }
    });

    setProvider(initialProvider);

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
    if (provider === "pollinations") {
      setFreeKeyCount(null);
      setFreeKeyError("");
      const imgModels = [
        { id: "flux", label: "FLUX", meta: "DEFAULT" },
        { id: "turbo", label: "TURBO", meta: "FAST" },
        { id: "sana", label: "SANA", meta: "ALT" }
      ];
      setAvailableFreeModels(imgModels);
      setCompareModel1("flux");
      setCompareModel2("sana");
      return;
    }
    
    if (provider !== "free") return;
    setFreeKeyCount(null);
    setFreeKeyError("");
    getFreeKeys().then((d) => {
      if (d.error) setFreeKeyError(d.error);
      else {
        setFreeKeyCount(d.keys.length);
        if (d.keys.length > 0) {
          const unique = Array.from(new Set(d.keys.map((k: any) => k.model))) as string[];
          const modelItems = unique.map(m => ({ id: m, label: m, meta: "FREE" }));
          setAvailableFreeModels(modelItems);
          if (modelItems.length >= 2) {
            setCompareModel1(modelItems[0].id);
            setCompareModel2(modelItems[1].id);
          }
        }
      }
    }).catch(() => setFreeKeyError("Could not reach key list"));
  }, [provider]);

  // ── UI Actions ─────────────────────────────────────────────────────
  function flashStatus(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage("STATUS: READY");
    }, 1500);
  }

  function handleModeChange(modeId: string) {
    setActiveMode(modeId);
    flashStatus(`MODE UPDATED → ${modeId}`);
    
    // Very basic restructuring demo
    if (modeId === "IMAGE PROMPT") {
      setBlocks([
        { id: Math.random().toString(), type: "SUBJECT", content: "" },
        { id: Math.random().toString(), type: "STYLE", content: "" },
        { id: Math.random().toString(), type: "NEGATIVE", content: "" }
      ]);
    } else if (modeId === "AGENT PLAN") {
      setBlocks([
        { id: Math.random().toString(), type: "GOAL", content: "" },
        { id: Math.random().toString(), type: "TOOLS", content: "" },
        { id: Math.random().toString(), type: "STEPS", content: "" }
      ]);
    } else {
      setBlocks([
        { id: Math.random().toString(), type: "SYSTEM", content: "" },
        { id: Math.random().toString(), type: "USER", content: "" }
      ]);
    }
  }

  function updateBlock(id: string, field: "type" | "content", value: string) {
    setBlocks(prev => prev.map(b => {
      if (b.id === id) {
        if (field === "type") flashStatus(`BLOCK TYPE → ${value}`);
        return { ...b, [field]: value };
      }
      return b;
    }));
  }

  function addBlock(type: string) {
    setBlocks(prev => [...prev, { id: Math.random().toString(), type, content: "" }]);
  }

  function removeBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  // ── Execution ─────────────────────────────────────────────────────
  async function executeSinglePrompt(combinedPrompt: string, sys: string, forcedModel?: string): Promise<Artifact> {
    const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const startTime = Date.now();
    
    const initialArtifact: Artifact = {
      id: runId,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      prompt: combinedPrompt,
      system: sys,
      output: "",
      outputType: provider === "pollinations" ? "image" : "text",
      status: "running",
      modelUsed: forcedModel || (provider === "free" ? "AUTO" : (provider === "pollinations" ? "flux" : (provider === "groq" ? "llama3-8b-8192" : "meta-llama/llama-3-8b-instruct:free")))
    };

    try {
      if (provider === "pollinations") {
        const seed = Math.floor(Math.random() * 1000000);
        const mod = forcedModel || "flux";
        const promptString = sys.trim() ? `${sys} ${combinedPrompt}` : combinedPrompt;
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptString)}?nologo=true&seed=${seed}&model=${mod}`;
        
        // Fetch to ensure we wait for it to generate so we get accurate runtime, but we just save the URL.
        const res = await fetch(imgUrl);
        if (!res.ok) throw new Error("Image generation failed");
        
        const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));
        return {
          ...initialArtifact,
          status: "success",
          output: imgUrl,
          runtime,
        };
      }

      const fullPrompt = sys.trim() ? `System: ${sys}\n\n${combinedPrompt}` : combinedPrompt;
      const res = await executeCompletion(fullPrompt, provider, apiKey, forcedModel);

      if (res.error) throw new Error(res.error);

      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));

      return {
        ...initialArtifact,
        status: "success",
        output: res.output,
        modelUsed: res.model || initialArtifact.modelUsed,
        keyMeta: res.keyMeta ?? null,
        runtime,
      };
    } catch (err: any) {
      const runtime = Number(((Date.now() - startTime) / 1000).toFixed(1));
      return { ...initialArtifact, status: "error", output: err.message, runtime };
    }
  }

  async function executePlayground() {
    // Concatenate all blocks into a single string for the LLM
    const sysBlocks = blocks.filter(b => b.type === "SYSTEM").map(b => b.content).join("\n\n");
    const userBlocks = blocks.filter(b => b.type !== "SYSTEM" && b.content.trim())
      .map(b => `${b.type}:\n${b.content}`)
      .join("\n\n");

    if (!userBlocks.trim() && !sysBlocks.trim()) return;

    setRunState("running");
    
    const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const pending: Artifact = {
      id: runId,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      prompt: userBlocks,
      system: sysBlocks,
      output: "",
      status: "running",
      modelUsed: "..."
    };
    setArchive((prev) => [pending, ...prev]);

    const result = await executeSinglePrompt(userBlocks, sysBlocks);
    
    setArchive((prev) => prev.map((a) => a.id === runId ? result : a));
    
    setRunState(result.status === "success" ? "complete" : "error");
    setTimeout(() => setRunState("idle"), 1500);
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
      executeSinglePrompt(comparePrompt, "", compareModel1),
      executeSinglePrompt(comparePrompt, "", compareModel2)
    ]);

    setCompareOutput1(res1);
    setCompareOutput2(res2);
    
    setArchive((prev) => [res1, res2, ...prev]);
  }

  function loadPreset(preset: typeof PRESETS[0]) {
    setBlocks(preset.blocks);
    setCurrentView("playground");
    flashStatus(`PRESET LOADED → ${preset.id}`);
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
          <button className={`nav-link ${currentView === "playground" ? "active" : ""}`} onClick={() => setCurrentView("playground")}>PLAYGROUND</button>
          <button className={`nav-link ${currentView === "compare" ? "active" : ""}`} onClick={() => setCurrentView("compare")}>COMPARE</button>
          <button className={`nav-link ${currentView === "presets" ? "active" : ""}`} onClick={() => setCurrentView("presets")}>PRESETS</button>
        </div>

        <div className="sidebar-section">
          <span className="label">Configuration</span>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span className="label" style={{ fontSize: "9px" }}>Provider</span>
            <Dropdown 
              title="SELECT_PROVIDER" 
              value={provider} 
              items={providers} 
              onChange={setProvider} 
            />
          </div>

          {provider === "free" || provider === "pollinations" ? (
            <div className="free-key-status">
              {provider === "pollinations" ? (
                <span style={{ color: "var(--text)" }}>STATUS: IMAGE ENGINE ONLINE</span>
              ) : (
                <>
                  {freeKeyCount === null && !freeKeyError && <span style={{ color: "var(--text-muted)" }}>SYNCING...</span>}
                  {freeKeyCount !== null && <span style={{ color: "var(--text)" }}>STATUS: {freeKeyCount} KEYS ONLINE</span>}
                  {freeKeyError && <span style={{ color: "var(--danger)" }}>ERR: {freeKeyError}</span>}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span className="label" style={{ fontSize: "9px" }}>API Key</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="mono" />
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER COMMAND ─────────────────────────────────────────────── */}
      <main className="command-center">
        
        {currentView === "playground" && (
          <>
            <div className="editor-header">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span className="title">ACTIVE_EXPERIMENT</span>
                <span className={`label ${statusMessage !== "STATUS: READY" ? "status-flicker" : ""}`}>{statusMessage}</span>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <Dropdown 
                  title="SELECT_MODE"
                  value={activeMode}
                  items={MODES}
                  onChange={handleModeChange}
                  inline
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {blocks.map((block) => (
                <div key={block.id} className="editor-block">
                  <div className="editor-block-header" style={{ display: "flex", justifyContent: "space-between" }}>
                    <Dropdown 
                      title="BLOCK_TYPE"
                      value={block.type}
                      items={BLOCK_TYPES}
                      onChange={(val) => updateBlock(block.id, "type", val)}
                      inline
                    />
                    <button className="nav-link" onClick={() => removeBlock(block.id)} style={{ fontSize: "10px" }}>×</button>
                  </div>
                  <textarea
                    className="editor-textarea"
                    placeholder={`Enter ${block.type.toLowerCase()} content...`}
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                    style={{ minHeight: block.type === "SYSTEM" ? "80px" : "160px" }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button 
                className="btn btn-primary" 
                onClick={executePlayground}
                disabled={runState === "running"}
              >
                {runState === "idle" ? "[ RUN → ]" : runState === "running" ? "[ RUNNING... ]" : runState === "complete" ? "[ COMPLETE ]" : "[ ERROR ]"}
              </button>
              
              <div style={{ marginLeft: "16px", width: "120px" }}>
                <Dropdown 
                  title="ADD_PROMPT_BLOCK"
                  value="+ ADD BLOCK"
                  items={BLOCK_TYPES}
                  onChange={addBlock}
                  inline
                />
              </div>
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
                <div key={p.id} className="artifact-card artifact-card-interactive" style={{ cursor: "pointer" }} onClick={() => loadPreset(p)}>
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
                {provider === "free" || provider === "pollinations" ? (
                  <Dropdown title="SELECT_MODEL" value={compareModel1} items={availableFreeModels} onChange={setCompareModel1} />
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
                      {compareOutput1.status === "success" && compareOutput1.outputType === "image" ? (
                        <img src={compareOutput1.output} alt="Generated output" style={{ width: "100%", height: "auto", display: "block", border: "1px solid var(--text)" }} />
                      ) : (
                        compareOutput1.status === "success" && compareOutput1.output
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SLOT 2 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {provider === "free" || provider === "pollinations" ? (
                  <Dropdown title="SELECT_MODEL" value={compareModel2} items={availableFreeModels} onChange={setCompareModel2} />
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
                      {compareOutput2.status === "success" && compareOutput2.outputType === "image" ? (
                        <img src={compareOutput2.output} alt="Generated output" style={{ width: "100%", height: "auto", display: "block", border: "1px solid var(--text)" }} />
                      ) : (
                        compareOutput2.status === "success" && compareOutput2.output
                      )}
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
            <div key={art.id} className="artifact-card artifact-card-interactive">
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
                {art.status === "success" && art.outputType === "image" ? (
                  <img src={art.output} alt="Generated output" style={{ width: "100%", height: "auto", display: "block", border: "1px solid var(--text)" }} />
                ) : (
                  art.status === "success" && art.output
                )}
              </div>

              <div className="artifact-actions">
                <button className="artifact-action" onClick={() => {
                  setBlocks([
                    { id: "b1", type: "SYSTEM", content: art.system },
                    { id: "b2", type: "USER", content: art.prompt }
                  ]);
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
