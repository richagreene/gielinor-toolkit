// Vercel Serverless Function — calls Anthropic server-side so your key is never exposed.
//
// To enable live AI catalyst analysis:
//   1. Get a key at https://console.anthropic.com  (Settings → API Keys)
//   2. Vercel project → Settings → Environment Variables → ANTHROPIC_API_KEY = sk-ant-...
//   3. Redeploy.
//
// Without a key the app falls back to built-in illustrative examples — everything else works.

export default async function handler(req, res) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(200).json({ ok: false, reason: "no_key" });

    const prompt =
      "You are an expert Old School RuneScape economy analyst with access to live web search. " +
      "Search for the LATEST OSRS news, patch notes, and upcoming content from the last few weeks. " +
      "Use what you find to identify 5 upcoming or very recent events that are likely to move Grand Exchange prices. " +
      "For each: name the SPECIFIC items most affected, explain concretely when to buy and when to sell relative to the event, and why prices should move. " +
      "You MUST respond with ONLY a valid JSON array — no prose, no markdown, no code fences. " +
      'Each element must be: {"event":string,"date":string,"action":string,"items":[string],"direction":"up"|"down","timing":string,"why":string}';

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        // Required for the built-in web search tool
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        // claude-3-5-sonnet supports web search and structured output well.
        // Update to any Claude model your API account supports — see docs.anthropic.com/models
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: false, reason: err.error?.message || `http_${r.status}` });
    }

    const data = await r.json();

    // The model may return tool_use blocks (search queries) alongside text blocks.
    // We only need the text blocks — the final analysis.
    const rawText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    if (!rawText) return res.status(200).json({ ok: false, reason: "empty_response" });

    // Parse robustly — find a JSON array even if the model wraps it in prose.
    let arr = null;
    try { arr = JSON.parse(rawText); }
    catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) { try { arr = JSON.parse(match[0]); } catch { /* fall through */ } }
    }

    if (!Array.isArray(arr) || arr.length === 0) {
      return res.status(200).json({ ok: false, reason: "no_json_array", raw: rawText.slice(0, 300) });
    }

    return res.status(200).json({ ok: true, arr: arr.slice(0, 5) });

  } catch (e) {
    return res.status(200).json({ ok: false, reason: "exception", message: e?.message || "unknown" });
  }
}
