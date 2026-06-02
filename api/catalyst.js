// Vercel Serverless Function — calls Anthropic server-side so your key is never in the browser.
//
// To enable live AI catalyst analysis:
//   1. Get an API key at https://console.anthropic.com (Settings → API Keys)
//   2. Vercel project → Settings → Environment Variables → add ANTHROPIC_API_KEY = sk-ant-...
//   3. Redeploy.
//
// Without a key the app shows built-in examples — everything else works fine.

export default async function handler(req, res) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(200).json({ ok: false, reason: "no_key" });

    const prompt =
      "You are an expert Old School RuneScape economy analyst. " +
      "Identify up to 5 upcoming or recent OSRS events or game changes likely to move Grand Exchange item prices. " +
      "Draw on your knowledge of OSRS updates, seasonal events, and economy patterns. " +
      "For each event name the SPECIFIC items most affected, explain when to buy and when to sell, and why prices should move. " +
      "You MUST respond with ONLY a valid JSON array and nothing else — no prose, no markdown, no code fences. " +
      "Each element: {\"event\":string,\"date\":string,\"action\":string,\"items\":[string],\"direction\":\"up\"|\"down\",\"timing\":string,\"why\":string}";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Haiku is fast, cheap, and great at structured output for this task.
        // Change to "claude-sonnet-4-6" or any model your account supports.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: false, reason: err.error?.message || `http_${r.status}` });
    }

    const data = await r.json();
    const rawText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    if (!rawText) return res.status(200).json({ ok: false, reason: "empty_response" });

    // Try a direct parse first; fall back to extracting the first [...] array from the text.
    let arr = null;
    try {
      arr = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try { arr = JSON.parse(match[0]); } catch (e2) {
          return res.status(200).json({ ok: false, reason: "json_parse_failed", raw: rawText.slice(0, 200) });
        }
      } else {
        return res.status(200).json({ ok: false, reason: "no_json_found", raw: rawText.slice(0, 200) });
      }
    }

    if (!Array.isArray(arr) || arr.length === 0) {
      return res.status(200).json({ ok: false, reason: "empty_array" });
    }

    // Return the parsed array directly — no client-side JSON.parse needed.
    return res.status(200).json({ ok: true, arr: arr.slice(0, 5) });

  } catch (e) {
    return res.status(200).json({ ok: false, reason: "exception", message: e.message });
  }
}
