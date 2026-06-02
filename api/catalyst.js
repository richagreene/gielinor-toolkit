/**
 * Vercel Edge Function — 30-second timeout on Hobby tier (vs 10s for standard serverless).
 * The `runtime = "edge"` export is what unlocks the longer window.
 *
 * DEBUGGING: Results appear in TWO places:
 *   1. Browser DevTools → Network tab → click the /api/catalyst request → Response tab
 *      This shows the JSON your app actually received (ok/reason/arr).
 *   2. Vercel dashboard → your project → Functions tab → select catalyst → Logs
 *      This shows the console.log lines below, which trace each step.
 *
 * SETUP: Vercel project → Settings → Environment Variables → ANTHROPIC_API_KEY = sk-ant-...
 *        Then Deployments → ⋯ → Redeploy to pick up the key.
 */

export const runtime = "edge";
export const maxDuration = 30;

const PROMPT =
  "You are an expert Old School RuneScape economy analyst. Use your web search to find the " +
  "most recent OSRS news, patch notes, upcoming content, and roadmap items — prioritise " +
  "anything from the last 60 days. Identify up to 5 specific upcoming or recent events " +
  "likely to move Grand Exchange item prices. For each catalyst: name the exact items " +
  "affected, give concrete buy/sell timing relative to the event, and explain the supply " +
  "or demand mechanism in plain English. " +
  "You MUST respond with ONLY a valid JSON array and nothing else — no prose, no markdown, " +
  "no code fences, no commentary before or after. " +
  'Each element must be: {"event":string,"date":string,"action":string,' +
  '"items":[string],"direction":"up"|"down","timing":string,"why":string}';

export default async function handler(request) {
  const headers = { "Content-Type": "application/json" };
  const respond = (obj) => new Response(JSON.stringify(obj), { headers });

  try {
    const key = process.env.ANTHROPIC_API_KEY;
    console.log("[catalyst] key present:", !!key);
    if (!key) return respond({ ok: false, reason: "no_key" });

    console.log("[catalyst] calling Anthropic...");
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet 3.5 reliably supports web_search and returns structured JSON.
        // Change to "claude-sonnet-4-6" if you want the newest model (may be slower).
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: PROMPT }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    console.log("[catalyst] API status:", apiRes.status);
    if (!apiRes.ok) {
      const errBody = await apiRes.json().catch(() => ({}));
      const reason = errBody?.error?.message || `http_${apiRes.status}`;
      console.log("[catalyst] API error:", reason);
      return respond({ ok: false, reason });
    }

    const data = await apiRes.json();
    const blockTypes = (data.content || []).map((b) => b.type).join(", ");
    console.log("[catalyst] content block types:", blockTypes);

    const rawText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    console.log("[catalyst] raw text length:", rawText.length, "| first 120:", rawText.slice(0, 120));

    if (!rawText) {
      console.log("[catalyst] no text block in response — stop reason:", data.stop_reason);
      return respond({ ok: false, reason: "empty_response", stop_reason: data.stop_reason });
    }

    // Try direct parse first; fall back to extracting the first [...] block from prose
    let arr = null;
    try {
      arr = JSON.parse(rawText);
    } catch {
      console.log("[catalyst] direct parse failed, trying regex extraction");
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try { arr = JSON.parse(match[0]); }
        catch (e2) { console.log("[catalyst] regex parse also failed:", e2.message); }
      }
    }

    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      console.log("[catalyst] no usable array produced");
      return respond({ ok: false, reason: "parse_failed", preview: rawText.slice(0, 300) });
    }

    console.log("[catalyst] success —", arr.length, "catalysts");
    return respond({ ok: true, arr: arr.slice(0, 5) });

  } catch (e) {
    console.log("[catalyst] exception:", e.message);
    return respond({ ok: false, reason: "exception", message: String(e.message) });
  }
}
