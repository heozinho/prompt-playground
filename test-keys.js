const fs = require("fs");

async function run() {
  const res = await fetch("https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/refs/heads/main/README.md");
  const text = await res.text();
  
  const keys = [];
  const keyRegex = /sk-[a-zA-Z0-9_-]{20,}/g;
  let match;
  while ((match = keyRegex.exec(text)) !== null) {
    keys.push(match[0]);
  }
  
  console.log("Found", keys.length, "keys.");
  
  let valid = 0;
  for (const k of keys.slice(0, 10)) {
    const r = await fetch("https://aiapiv2.pekpik.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "test" }], max_tokens: 1 })
    });
    console.log(k.substring(0, 10), r.status);
    if (r.ok) valid++;
  }
  console.log("Valid in first 10:", valid);
}
run();
