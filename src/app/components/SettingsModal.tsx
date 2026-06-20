"use client";

import { useState, useEffect } from "react";

export default function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("groq");
  const [saved, setSaved] = useState(false);

  // Load from localStorage each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem("pp_api_key") || "");
      setProvider(localStorage.getItem("pp_provider") || "groq");
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem("pp_api_key", apiKey.trim());
    localStorage.setItem("pp_provider", provider);
    setSaved(true);
    setTimeout(onClose, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          width: "420px",
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Settings</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Provider</label>
          <select
            id="settings-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              padding: "0.6rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            <option value="groq">Groq — free at console.groq.com</option>
            <option value="openrouter">OpenRouter — free tier at openrouter.ai</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>API Key</label>
          <input
            id="settings-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              provider === "groq"
                ? "gsk_xxxxxxxxxxxxxxxxxxxx"
                : "sk-or-xxxxxxxxxxxxxxxxxxxx"
            }
            style={{
              padding: "0.6rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              fontSize: "0.9rem",
              fontFamily: "monospace",
            }}
          />
          <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
            Saved in your browser only — never sent anywhere except the AI provider.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            id="settings-cancel"
            onClick={onClose}
            style={{
              padding: "0.5rem 1.1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--foreground)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            id="settings-save"
            onClick={handleSave}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "var(--radius-sm)",
              background: saved ? "#22c55e" : "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              transition: "background 0.2s",
            }}
          >
            {saved ? "✓ Saved!" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
