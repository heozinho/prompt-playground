"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────
type Fields = {
  role: string;
  task: string;
  constraints: string;
  examples: string;
  format: string;
  failureRules: string;
};

type Variant = {
  id: string;
  name: string;
  mode: "builder" | "raw";
  fields: Fields;
  rawPrompt: string;
  output: string;
  status: "idle" | "loading" | "success" | "error";
};

// ── Helpers ──────────────────────────────────────────────────
function buildPrompt(v: Variant, userInput: string): string {
  let systemPart = "";

  if (v.mode === "raw") {
    systemPart = v.rawPrompt;
  } else {
    const parts: string[] = [];
    if (v.fields.role) parts.push(`[Role]\n${v.fields.role}`);
    if (v.fields.task) parts.push(`[Task]\n${v.fields.task}`);
    if (v.fields.constraints) parts.push(`[Constraints]\n${v.fields.constraints}`);
    if (v.fields.examples) parts.push(`[Examples]\n${v.fields.examples}`);
    if (v.fields.format) parts.push(`[Output Format]\n${v.fields.format}`);
    if (v.fields.failureRules) parts.push(`[Failure Rules]\n${v.fields.failureRules}`);
    systemPart = parts.join("\n\n");
  }

  return userInput
    ? `${systemPart}\n\n---\nInput:\n${userInput}`
    : systemPart;
}

let variantCounter = 1;
function newVariant(name?: string): Variant {
  variantCounter++;
  return {
    id: `v-${Date.now()}-${variantCounter}`,
    name: name ?? `Variant ${String.fromCharCode(64 + variantCounter)}`,
    mode: "builder",
    fields: { role: "", task: "", constraints: "", examples: "", format: "", failureRules: "" },
    rawPrompt: "",
    output: "",
    status: "idle",
  };
}

// ── Settings Modal ────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("pp_key") ?? "");
  const [provider, setProvider] = useState(() => localStorage.getItem("pp_provider") ?? "groq");
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem("pp_key", apiKey.trim());
    localStorage.setItem("pp_provider", provider);
    setSaved(true);
    setTimeout(onClose, 700);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h2 className="modal-title">Settings</h2>

        <div className="field-group">
          <label>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="groq">Groq — free at console.groq.com</option>
            <option value="openrouter">OpenRouter — free tier at openrouter.ai</option>
          </select>
        </div>

        <div className="field-group">
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "groq" ? "gsk_..." : "sk-or-..."}
            style={{ fontFamily: "monospace" }}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Stored in your browser only — never leaves your machine except to call the AI.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={save}
            style={{ background: saved ? "var(--success)" : undefined }}
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Variant Card ──────────────────────────────────────────────
const FIELDS: { key: keyof Fields; label: string; placeholder: string }[] = [
  { key: "role",         label: "Role / Context",  placeholder: "e.g. You are a strict JSON extractor…" },
  { key: "task",         label: "Task",             placeholder: "e.g. Extract: company, role, salary, location…" },
  { key: "constraints",  label: "Constraints",      placeholder: "e.g. No filler, never guess…" },
  { key: "examples",     label: "Examples",         placeholder: "Input: …\nOutput: …" },
  { key: "format",       label: "Output Format",    placeholder: "e.g. Return valid JSON only." },
  { key: "failureRules", label: "Failure Rules",    placeholder: "e.g. Use null for missing fields." },
];

function VariantCard({
  variant,
  onChange,
  onRun,
  onRemove,
}: {
  variant: Variant;
  onChange: (v: Variant) => void;
  onRun: () => void;
  onRemove: () => void;
}) {
  function setField(key: keyof Fields, val: string) {
    onChange({ ...variant, fields: { ...variant.fields, [key]: val } });
  }

  function switchToRaw() {
    const combined = FIELDS
      .filter(({ key }) => variant.fields[key])
      .map(({ key, label }) => `[${label}]\n${variant.fields[key]}`)
      .join("\n\n");
    onChange({ ...variant, mode: "raw", rawPrompt: variant.rawPrompt || combined });
  }

  return (
    <div className="variant-card">
      {/* Header */}
      <div className="variant-header">
        <input
          className="variant-name-input"
          value={variant.name}
          onChange={(e) => onChange({ ...variant, name: e.target.value })}
        />
        <button
          className="btn btn-primary"
          onClick={onRun}
          disabled={variant.status === "loading"}
          style={{ flexShrink: 0 }}
        >
          {variant.status === "loading" ? "Running…" : "▶ Run"}
        </button>
        <button className="btn btn-danger-ghost" onClick={onRemove} style={{ flexShrink: 0 }}>
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="variant-body">
        {/* Mode toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            Prompt
          </span>
          <div className="mode-toggle">
            <button
              className={`mode-btn ${variant.mode === "builder" ? "active" : ""}`}
              onClick={() => onChange({ ...variant, mode: "builder" })}
            >
              Builder
            </button>
            <button
              className={`mode-btn ${variant.mode === "raw" ? "active" : ""}`}
              onClick={switchToRaw}
            >
              Raw
            </button>
          </div>
        </div>

        {/* Fields */}
        {variant.mode === "builder" ? (
          FIELDS.map(({ key, label, placeholder }) => (
            <div className="field-group" key={key}>
              <div className="field-label-primary">{label}</div>
              <textarea
                value={variant.fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={placeholder}
                rows={2}
              />
            </div>
          ))
        ) : (
          <textarea
            value={variant.rawPrompt}
            onChange={(e) => onChange({ ...variant, rawPrompt: e.target.value })}
            placeholder="Write your full prompt here…"
            rows={14}
          />
        )}
      </div>

      {/* Output */}
      <div className={`variant-output ${variant.status}`}>
        {variant.status === "idle" && "Output will appear here after you hit Run."}
        {variant.status === "loading" && "Thinking…"}
        {(variant.status === "success" || variant.status === "error") && variant.output}
      </div>
    </div>
  );
}

// ── Main Playground ───────────────────────────────────────────
export default function Playground() {
  const [variants, setVariants] = useState<Variant[]>([
    {
      id: "v-init",
      name: "Variant A",
      mode: "builder",
      fields: {
        role: "You are a strict JSON extractor.",
        task: "Extract only:\n- company\n- role\n- salary\n- location",
        constraints: "",
        examples: "",
        format: "Return valid JSON only.",
        failureRules: "If missing, use null.",
      },
      rawPrompt: "",
      output: "",
      status: "idle",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  function updateVariant(updated: Variant) {
    setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, newVariant()]);
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }

  async function runVariant(variant: Variant) {
    const prompt = buildPrompt(variant, userInput);

    if (!prompt.trim()) {
      updateVariant({ ...variant, status: "error", output: "Nothing to send — fill in at least one field." });
      return;
    }

    updateVariant({ ...variant, status: "loading", output: "" });

    try {
      const apiKey = localStorage.getItem("pp_key") ?? "";
      const provider = localStorage.getItem("pp_provider") ?? "groq";

      if (!apiKey) {
        await new Promise((r) => setTimeout(r, 900));
        const mock = prompt.toLowerCase().includes("json")
          ? '{\n  "company": "Acme Corp",\n  "role": "Engineer",\n  "salary": null,\n  "location": "Remote"\n}'
          : `[No API key set]\n\nYour prompt (${prompt.length} chars) was received.\nClick ⚙ Settings and add a free Groq key to get real responses.`;
        updateVariant({ ...variant, status: "success", output: mock });
        return;
      }

      const res = await fetch("/api/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey, provider }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "API request failed");
      updateVariant({ ...variant, status: "success", output: data.output });
    } catch (err: any) {
      updateVariant({ ...variant, status: "error", output: err.message });
    }
  }

  function runAll() {
    variants.forEach((v, i) => setTimeout(() => runVariant(v), i * 300));
  }

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <span className="topbar-title">Prompt Playground</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>
            ⚙ Settings
          </button>
          <button className="btn btn-run-all" onClick={runAll}>
            ▶ Run All
          </button>
        </div>
      </header>

      {/* User test input */}
      <div className="input-bar">
        <div style={{ flex: 1 }}>
          <label style={{ marginBottom: 6 }}>Test Input (sent to every variant)</label>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="e.g. We're hiring a Senior Dev at Google, London, £90k–£120k"
            rows={3}
          />
        </div>
      </div>

      {/* Variants */}
      <div className="variants-rail">
        {variants.map((v) => (
          <VariantCard
            key={v.id}
            variant={v}
            onChange={updateVariant}
            onRun={() => runVariant(v)}
            onRemove={() => removeVariant(v.id)}
          />
        ))}
        <button className="add-variant-btn" onClick={addVariant}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
          Add Variant
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
