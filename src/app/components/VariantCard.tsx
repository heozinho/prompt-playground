"use client";

import { Variant } from "../types";
import PromptBuilder from "./PromptBuilder";

export default function VariantCard({
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
  const isLoading = variant.status === "loading";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "420px",
        flexShrink: 0,
        height: "100%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "1.25rem",
        gap: "1rem",
        overflowY: "auto",
      }}
    >
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          value={variant.name}
          onChange={(e) => onChange({ ...variant, name: e.target.value })}
          style={{
            flex: 1,
            fontSize: "1rem",
            fontWeight: 600,
            background: "transparent",
            border: "none",
            color: "inherit",
            outline: "none",
          }}
        />
        <button
          id={`btn-run-${variant.id}`}
          onClick={onRun}
          disabled={isLoading}
          style={{
            padding: "0.35rem 0.85rem",
            borderRadius: "var(--radius-sm)",
            background: isLoading ? "var(--border)" : "var(--primary)",
            color: isLoading ? "var(--foreground)" : "white",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            border: "none",
          }}
        >
          {isLoading ? "Running…" : "▶ Run"}
        </button>
        <button
          id={`btn-remove-${variant.id}`}
          onClick={onRemove}
          style={{
            padding: "0.35rem 0.6rem",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--danger)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Prompt builder */}
      <PromptBuilder variant={variant} onChange={onChange} />

      {/* Output */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Output
        </h3>
        <div
          style={{
            minHeight: "120px",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--background)",
            border: `1px solid ${variant.status === "error" ? "var(--danger)" : "var(--border)"}`,
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            overflowY: "auto",
            color:
              variant.status === "error"
                ? "var(--danger)"
                : "var(--foreground)",
          }}
        >
          {variant.status === "idle" && (
            <span style={{ opacity: 0.4 }}>Output will appear here after you click Run.</span>
          )}
          {variant.status === "loading" && (
            <span style={{ opacity: 0.5 }}>Generating…</span>
          )}
          {(variant.status === "success" || variant.status === "error") && variant.output}
        </div>
      </div>
    </div>
  );
}
