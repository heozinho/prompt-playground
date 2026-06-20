const fs = require('fs');

async function test() {
  const res = await fetch('http://localhost:3000/api/free-keys');
  const data = await res.json();
  const keys = data.keys;
  console.log(`Testing ${keys.length} keys...`);
  
  let working = 0;
  for (let i = 0; i < Math.min(10, keys.length); i++) {
    const k = keys[i];
    console.log(`Testing key for ${k.model} (Budget: $${k.budget})`);
    
    const start = Date.now();
    try {
      const resp = await fetch("https://aiapiv2.pekpik.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${k.key}`
        },
        body: JSON.stringify({
          model: k.model,
          messages: [{role: "user", content: "hi"}],
          max_tokens: 10
        })
      });
      const body = await resp.json();
      console.log(`  -> Status: ${resp.status} (${Date.now() - start}ms)`);
      if (resp.ok) {
        working++;
        console.log(`  -> SUCCESS! Output: ${body.choices[0].message.content}`);
      } else {
        console.log(`  -> ERROR: ${body.error?.message}`);
      }
    } catch (e) {
      console.log(`  -> FETCH ERROR: ${e.message}`);
    }
  }
  console.log(`Working keys found: ${working}`);
}
test();
