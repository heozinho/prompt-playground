"use client";

import { Variant } from "../types";

function getCombinedPrompt(v: Variant): string {
  return [
    v.fields.role && `[Role]\n${v.fields.role}`,
    v.fields.task && `[Task]\n${v.fields.task}`,
    v.fields.constraints && `[Constraints]\n${v.fields.constraints}`,
    v.fields.examples && `[Examples]\n${v.fields.examples}`,
    v.fields.format && `[Output Format]\n${v.fields.format}`,
    v.fields.failureRules && `[Failure Rules]\n${v.fields.failureRules}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function PromptBuilder({
  variant,
  onChange,
}: {
  variant: Variant;
  onChange: (v: Variant) => void;
}) {
  const updateField = (field: keyof Variant["fields"], value: string) => {
    onChange({ ...variant, fields: { ...variant.fields, [field]: value } });
  };

  const switchToRaw = () => {
    onChange({
      ...variant,
      mode: "raw",
      rawPrompt: variant.rawPrompt || getCombinedPrompt(variant),
    });
  };

  const switchToBuilder = () => {
    onChange({ ...variant, mode: "builder" });
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.25rem 0.75rem",
    fontSize: "0.75rem",
    fontWeight: active ? 600 : 400,
    borderRadius: "var(--radius-sm)",
    background: active ? "var(--surface)" : "transparent",
    boxShadow: active ? "var(--shadow-sm)" : "none",
    border: "none",
    color: "var(--foreground)",
    cursor: "pointer",
  });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    background: "var(--background)",
    color: "var(--foreground)",
    resize: "vertical",
    minHeight: "60px",
    fontSize: "0.875rem",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Prompt
        </h3>
        <div
          style={{
            display: "flex",
            gap: "0.15rem",
            background: "var(--background)",
            padding: "0.2rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          <button onClick={switchToBuilder} style={tabStyle(variant.mode === "builder")}>
            Builder
          </button>
          <button onClick={switchToRaw} style={tabStyle(variant.mode === "raw")}>
            Raw
          </button>
        </div>
      </div>

      {/* Builder fields */}
      {variant.mode === "builder" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {(
            [
              { key: "role", label: "Role / Context", placeholder: "e.g. You are a strict JSON extractor..." },
              { key: "task", label: "Task", placeholder: "e.g. Extract: company, role, salary, location..." },
              { key: "constraints", label: "Constraints", placeholder: "e.g. Do not guess. No filler text." },
              { key: "examples", label: "Examples", placeholder: "Input: ...\nOutput: ..." },
              { key: "format", label: "Output Format", placeholder: "e.g. Return valid JSON only." },
              { key: "failureRules", label: "Failure Rules", placeholder: "e.g. If missing, use null." },
            ] as { key: keyof Variant["fields"]; label: string; placeholder: string }[]
          ).map(({ key, label, placeholder }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label
                style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)" }}
              >
                {label}
              </label>
              <textarea
                value={variant.fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={placeholder}
                style={fieldStyle}
              />
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={variant.rawPrompt}
          onChange={(e) => onChange({ ...variant, rawPrompt: e.target.value })}
          placeholder="Write your full prompt here…"
          style={{ ...fieldStyle, minHeight: "240px" }}
        />
      )}
    </div>
  );
}
