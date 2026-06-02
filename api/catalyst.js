// Vercel Serverless Function — keeps your Anthropic API key on the SERVER (never in the browser).
//
// To enable the live AI catalyst analysis:
//   1. Get an API key at https://console.anthropic.com  (Settings -> API Keys)
//   2. In your Vercel project: Settings -> Environment Variables
//        Name:  ANTHROPIC_API_KEY
//        Value: your key (starts with sk-ant-...)
//   3. Redeploy.
//
// Until a key is set, the app simply shows the built-in illustrative examples — everything else works.

export default async function handler(req, res) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(200).json({ ok: false, reason: "no_key" });

    const prompt =
      "Search for the most recent Old School RuneScape news, game updates, and roadmap announcements. " +
      "Identify up to 5 upcoming or recent catalysts likely to move Grand Exchange item prices. " +
      "For each, name the SPECIFIC supplies or items most affected and give concrete timing advice on when to buy and when to sell relative to the event. " +
      "Respond with ONLY a JSON array (no prose, no code fences) where each element is " +
      '{"event":string,"date":string,"action":string,"items":[string],"direction":"up"|"down","timing":string,"why":string}.';

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Use a current model string from https://docs.claude.com (update if needed).
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
        // Live web search. If your account/model doesn't support it, delete the next line.
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(200).json({ ok: false, reason: data.error.message || "api_error" });

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!text) return res.status(200).json({ ok: false, reason: "empty" });
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "exception" });
  }
}
