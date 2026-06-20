import { NextResponse } from "next/server";
import type { FreeKey } from "../free-keys/route";

const FREE_KEY_BASE_URL = "https://aiapiv2.pekpik.com/v1/chat/completions";
const MAX_KEY_ATTEMPTS = 3;

export async function POST(req: Request) {
  try {
    const { prompt, apiKey, provider } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // ── Free community keys (no user API key needed) ────────────────────────
    if (provider === "free") {
      return handleFreeProvider(prompt, req);
    }

    // ── User-supplied key providers ─────────────────────────────────────────
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }

    let url = "";
    let model = "";

    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      model = "llama3-8b-8192";
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
      model = "meta-llama/llama-3-8b-instruct:free";
    } else {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "API request failed");
    }

    const output = data.choices?.[0]?.message?.content ?? "No output generated.";
    return NextResponse.json({ output, model });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ── Free provider handler ─────────────────────────────────────────────────────

async function handleFreeProvider(
  prompt: string,
  _req: Request
): Promise<NextResponse> {
  // Fetch key list from our own caching route
  let keys: FreeKey[] = [];

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const keysRes = await fetch(`${baseUrl}/api/free-keys`, {
      cache: "no-store",
    });

    if (!keysRes.ok) throw new Error("Key list unavailable");

    const payload = await keysRes.json();
    keys = payload.keys ?? [];
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not load community keys. GitHub may be temporarily unreachable.",
      },
      { status: 503 }
    );
  }

  if (keys.length === 0) {
    return NextResponse.json(
      {
        error:
          "No community keys available right now — they may all be expired. Try again in a few minutes or add your own key in Settings.",
      },
      { status: 503 }
    );
  }

  // Try up to MAX_KEY_ATTEMPTS keys, rotating on 401/429
  const attempts = keys.slice(0, MAX_KEY_ATTEMPTS);
  const errors: string[] = [];

  for (const freeKey of attempts) {
    const response = await fetch(FREE_KEY_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${freeKey.key}`,
      },
      body: JSON.stringify({
        model: freeKey.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // 401 = key invalid/expired, 429 = rate limited — both are rotatable
      if (response.status === 401 || response.status === 429) {
        errors.push(
          `${freeKey.model} (${response.status}): ${data.error?.message ?? "key failed"}`
        );
        continue;
      }
      // Any other error is not a key problem — surface it immediately
      throw new Error(data.error?.message || `API error ${response.status}`);
    }

    const output =
      data.choices?.[0]?.message?.content ?? "No output generated.";

    return NextResponse.json({
      output,
      model: freeKey.model,
      keyMeta: {
        model: freeKey.model,
        budget: freeKey.budget,
        expires: freeKey.expires,
        rateLimit: freeKey.rateLimit,
        attemptsUsed: errors.length + 1,
      },
    });
  }

  // All attempted keys failed
  return NextResponse.json(
    {
      error: `All community keys are rate-limited or expired right now. Try again in a few minutes.\n\nDetails: ${errors.join(" | ")}`,
    },
    { status: 503 }
  );
}
