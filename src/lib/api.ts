export type FreeKey = {
  key: string;
  model: string;
  provider: string;
  budget: number;
};

// ── Shared Cache ────────────────────────────────────────────────────────────
let _keysCache: { keys: FreeKey[]; cachedAt: number } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ── Fetch & Validate Free Keys ─────────────────────────────────────────────
export async function getFreeKeys(): Promise<{ keys: FreeKey[]; error?: string }> {
  if (_keysCache && Date.now() - _keysCache.cachedAt < CACHE_DURATION_MS) {
    return { keys: _keysCache.keys };
  }

  try {
    const res = await fetch("https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/refs/heads/main/README.md");
    if (!res.ok) throw new Error("GitHub fetch failed");
    
    const text = await res.text();
    let parsedKeys = parseReadme(text);
    parsedKeys = await validateKeys(parsedKeys);
    
    _keysCache = { keys: parsedKeys, cachedAt: Date.now() };
    return { keys: parsedKeys };
  } catch (err: any) {
    // If GitHub is down but we have a stale cache, return it
    if (_keysCache) return { keys: _keysCache.keys, error: "Using stale cache." };
    return { error: "Could not load community keys. GitHub may be temporarily unreachable.", keys: [] };
  }
}

// ── Validation ──────────────────────────────────────────────────────────────
async function validateKeys(keys: FreeKey[]): Promise<FreeKey[]> {
  const validKeys: FreeKey[] = [];
  const checks = keys.map(async (k) => {
    try {
      const res = await fetch("https://aiapiv2.pekpik.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${k.key}` },
        body: JSON.stringify({ model: k.model, messages: [{ role: "user", content: "test" }], max_tokens: 1 }),
      });
      if (res.ok) validKeys.push(k);
    } catch (e) {
      // assume dead
    }
  });

  await Promise.allSettled(checks);
  return validKeys;
}

// ── Parser ──────────────────────────────────────────────────────────────────
function parseReadme(text: string): FreeKey[] {
  const keys: FreeKey[] = [];
  const lines = text.split("\n");
  
  let inTable = false;
  let headers: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
    if (!inTable) {
      if (cells.some((c) => c.toLowerCase().includes("api key"))) {
        inTable = true;
        headers = cells.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
      }
      continue;
    }

    if (cells[0].includes("---")) continue;

    let key = "", model = "gpt-4o-mini", provider = "Unknown", budget = 0;

    cells.forEach((cell, i) => {
      const h = headers[i];
      if (!h) return;
      if (h.includes("apikey") || h.includes("key")) key = cell.replace(/`/g, "").trim();
      else if (h.includes("model")) model = cell.replace(/`/g, "").trim();
      else if (h.includes("provider")) provider = cell.replace(/`/g, "").trim();
      else if (h.includes("budget") || h.includes("quota")) {
        const match = cell.match(/[\d.]+/);
        if (match) budget = parseFloat(match[0]);
      }
    });

    if (key.startsWith("sk-")) {
      keys.push({ key, model, provider, budget });
    }
  }

  // Fallback pattern matching if table parsing fails
  if (keys.length === 0) {
    const keyRegex = /sk-[a-zA-Z0-9_-]{20,}/g;
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
      keys.push({ key: match[0], model: "gpt-4o-mini", provider: "Unknown", budget: 0 });
    }
  }

  return keys.sort((a, b) => b.budget - a.budget);
}

// ── Execution Logic ─────────────────────────────────────────────────────────
type ExecutionResult = {
  output: string;
  model: string;
  keyMeta?: { budget: number; attemptsUsed: number };
  error?: string;
};

export async function executeCompletion(
  prompt: string,
  provider: string,
  apiKey: string,
  forceModel?: string
): Promise<ExecutionResult> {
  if (provider === "free") {
    return handleFreeProvider(prompt, forceModel);
  }

  // ── User-supplied key providers ─────────────────────────────────────────
  let baseUrl = "https://api.openai.com/v1/chat/completions";
  let targetModel = "gpt-4o-mini";

  if (provider === "groq") {
    baseUrl = "https://api.groq.com/openai/v1/chat/completions";
    targetModel = "llama3-8b-8192";
  } else if (provider === "openrouter") {
    baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    targetModel = "meta-llama/llama-3-8b-instruct:free";
  }

  const modelToUse = forceModel || targetModel;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelToUse, messages: [{ role: "user", content: prompt }] }),
    });

    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error?.message ?? "API request failed");

    return { output: payload.choices[0].message.content, model: modelToUse };
  } catch (err: any) {
    return { error: err.message, output: "", model: modelToUse };
  }
}

async function handleFreeProvider(prompt: string, forceModel?: string): Promise<ExecutionResult> {
  const { keys, error } = await getFreeKeys();
  if (error && keys.length === 0) return { error, output: "", model: "" };
  if (keys.length === 0) return { error: "No community keys active.", output: "", model: "" };

  let attemptsList = keys;
  if (forceModel) {
    attemptsList = keys.filter((k) => k.model === forceModel);
    if (attemptsList.length === 0) return { error: `No active community keys found for model: ${forceModel}`, output: "", model: "" };
  }

  attemptsList = attemptsList.slice(0, 8); // MAX 8 attempts

  for (let i = 0; i < attemptsList.length; i++) {
    const currentKey = attemptsList[i];
    try {
      const res = await fetch("https://aiapiv2.pekpik.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentKey.key}` },
        body: JSON.stringify({ model: currentKey.model, messages: [{ role: "user", content: prompt }] }),
      });

      const payload = await res.json();
      
      if (res.status === 429 || res.status === 401) continue;
      if (!res.ok) throw new Error(payload.error?.message ?? "Provider failed");

      return {
        output: payload.choices[0].message.content,
        model: currentKey.model,
        keyMeta: { budget: currentKey.budget, attemptsUsed: i + 1 }
      };
    } catch (e: any) {
      if (i === attemptsList.length - 1) {
        return { error: e.message, output: "", model: "" };
      }
    }
  }

  return { error: "All available community keys failed or are rate limited.", output: "", model: "" };
}
