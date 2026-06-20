"use client";

import { useState } from "react";
import { Variant } from "../types";
import VariantCard from "./VariantCard";
import SettingsModal from "./SettingsModal";

function getPromptString(v: Variant): string {
  if (v.mode === "raw") return v.rawPrompt;
  return [
    v.fields.role && `[Role]\n${v.fields.role}`,
    v.fields.task && `[Task]\n${v.fields.task}`,
    v.fields.constraints && `[Constraints]\n${v.fields.constraints}`,
    v.fields.examples && `[Examples]\n${v.fields.examples}`,
    v.fields.format && `[Output Format]\n${v.fields.format}`,
    v.fields.failureRules && `[Failure Rules]\n${v.fields.failureRules}`,
  ].filter(Boolean).join("\n\n");
}

export default function PlaygroundWorkspace() {
  const [variants, setVariants] = useState<Variant[]>([
    {
      id: "1",
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Replace an entire variant by id
  const setVariant = (updated: Variant) => {
    setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const addVariant = () => {
    const letter = String.fromCharCode(65 + variants.length);
    setVariants((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: `Variant ${letter}`,
        mode: "builder",
        fields: { role: "", task: "", constraints: "", examples: "", format: "", failureRules: "" },
        rawPrompt: "",
        output: "",
        status: "idle",
      },
    ]);
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const runCompletion = async (v: Variant) => {
    const promptText = getPromptString(v);

    if (!promptText.trim()) {
      setVariant({ ...v, status: "error", output: "Prompt is empty. Fill in at least one field." });
      return;
    }

    setVariant({ ...v, status: "loading", output: "" });

    try {
      const apiKey = localStorage.getItem("pp_api_key") || "";
      const provider = localStorage.getItem("pp_provider") || "groq";

      if (!apiKey) {
        // Simulated response when no key is set
        await new Promise((r) => setTimeout(r, 1200));
        const out = promptText.toLowerCase().includes("json")
          ? `{\n  "company": "Acme Corp",\n  "role": "Software Engineer",\n  "salary": "$120,000",\n  "location": "Remote"\n}`
          : `[Simulated] Your prompt had ${promptText.length} characters.\n\nAdd a real API key in Settings to get actual LLM responses.`;
        setVariant({ ...v, status: "success", output: out });
        return;
      }

      const res = await fetch("/api/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, apiKey, provider }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API request failed");

      setVariant({ ...v, status: "success", output: data.output });
    } catch (err: any) {
      setVariant({ ...v, status: "error", output: err.message });
    }
  };

  const runAll = () => {
    // Capture current snapshot so each call gets its own copy
    variants.forEach((v, idx) => {
      setTimeout(() => runCompletion(v), idx * 300);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header
        style={{
          padding: "1rem 2rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
          Prompt Playground
        </h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            id="btn-settings"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--foreground)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            ⚙ Settings
          </button>
          <button
            id="btn-run-all"
            onClick={runAll}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ▶ Run All
          </button>
        </div>
      </header>

      {/* Variant cards */}
      <div
        style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          display: "flex",
          gap: "1.25rem",
          padding: "1.25rem",
          background: "var(--background)",
        }}
      >
        {variants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            onChange={setVariant}
            onRun={() => runCompletion(variant)}
            onRemove={() => removeVariant(variant.id)}
          />
        ))}

        {/* Add Variant */}
        <button
          id="btn-add-variant"
          onClick={addVariant}
          style={{
            width: "280px",
            flexShrink: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "0.75rem",
            color: "var(--foreground)",
            opacity: 0.6,
            border: "2px dashed var(--border)",
            borderRadius: "var(--radius-md)",
            background: "transparent",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: "2rem", lineHeight: 1 }}>+</span>
          Add Variant
        </button>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
