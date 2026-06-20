import { NextResponse } from "next/server";

export interface FreeKey {
  key: string;
  model: string;
  budget: number; // dollars
  rateLimit: string;
  expires: string; // YYYY-MM-DD
  description: string;
}

interface Cache {
  keys: FreeKey[];
  cachedAt: number;
}

// Module-level in-memory cache (survives across requests in the same process)
let _cache: Cache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const README_URL =
  "https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/main/README.md";

export async function GET() {
  // Serve from cache if still fresh
  if (_cache && Date.now() - _cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      keys: _cache.keys,
      cachedAt: _cache.cachedAt,
      cached: true,
    });
  }

  let readmeText: string;

  try {
    const res = await fetch(README_URL, {
      // Always bypass Next.js fetch cache so we get the live README
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`GitHub returned ${res.status}`);
    }

    readmeText = await res.text();
  } catch (err: any) {
    // If GitHub is down but we have stale cache, return it rather than failing
    if (_cache) {
      return NextResponse.json({
        keys: _cache.keys,
        cachedAt: _cache.cachedAt,
        cached: true,
        stale: true,
        warning: "Could not refresh — serving stale keys",
      });
    }
    return NextResponse.json(
      { error: `Failed to fetch key list: ${err.message}` },
      { status: 502 }
    );
  }

  const keys = parseReadme(readmeText);
  _cache = { keys, cachedAt: Date.now() };

  return NextResponse.json({
    keys,
    cachedAt: _cache.cachedAt,
    cached: false,
  });
}

function parseReadme(readme: string): FreeKey[] {
  // Narrow to just the "Available Keys" section to avoid false positives
  const startMarker = "## 📋 Available Keys";
  const endMarker = "## 🚀 How to Use";

  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1) return [];

  const section =
    endIdx === -1 ? readme.slice(startIdx) : readme.slice(startIdx, endIdx);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const keys: FreeKey[] = [];

  for (const line of section.split("\n")) {
    // Only process lines that contain a backtick-wrapped sk- key
    if (!line.includes("`sk-")) continue;

    // Split on pipe, trim each cell, remove empty leading/trailing cells
    const cols = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    // Expected: [key, model, status, budget, rateLimit, expires, description]
    if (cols.length < 7) continue;

    const keyMatch = cols[0].match(/`(sk-[A-Za-z0-9]+)`/);
    if (!keyMatch) continue;

    const key = keyMatch[1];
    const model = cols[1];
    const budgetMatch = cols[3].match(/\$(\d+)/);
    const budget = budgetMatch ? parseInt(budgetMatch[1], 10) : 0;
    const rateLimit = cols[4];
    const expires = cols[5];
    const description = cols[6];

    // Skip keys that have already expired
    const expiresMatch = expires.match(/(\d{4}-\d{2}-\d{2})/);
    if (expiresMatch) {
      // Give keys the full expiry day (expire at end of day UTC)
      const expiryDate = new Date(expiresMatch[1] + "T23:59:59Z");
      if (expiryDate < today) continue;
    }

    keys.push({ key, model, budget, rateLimit, expires, description });
  }

  // Shuffle the keys first so keys with the same budget are randomized
  // This prevents always hitting the same dead keys at the top of the list
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }

  // Sort highest budget first — most likely to still have credit
  return keys.sort((a, b) => b.budget - a.budget);
}
