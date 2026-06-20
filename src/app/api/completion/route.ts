import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, apiKey, provider } = await req.json();

    if (!prompt || !apiKey) {
      return NextResponse.json({ error: "Missing prompt or API key" }, { status: 400 });
    }

    let url = "";
    let headers: any = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
    let body: any = {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    };

    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      body.model = "llama3-8b-8192";
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
      // Using a free model for OpenRouter
      body.model = "meta-llama/llama-3-8b-instruct:free";
    } else {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "API request failed");
    }

    const output = data.choices?.[0]?.message?.content || "No output generated.";

    return NextResponse.json({ output });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
