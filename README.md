# Gielinor Toolkit

An OSRS toolkit. The first tool, **Coffer**, is a Grand Exchange flipping
intelligence app (flip finder, capital-aware decision engine, forecasts,
profit tracker, alerts, and trading tools).

Built with React + Vite. Live prices come from the free
[OSRS Wiki real-time prices API](https://prices.runescape.wiki/).

## Run / deploy

See **DEPLOY-GUIDE.md** for a full step-by-step (no coding required).

Short version:
1. Put these files in a GitHub repo (package.json must be at the repo root).
2. Import the repo at vercel.com — it auto-detects Vite and deploys for free.
3. Open the URL on your phone and "Add to Home Screen."

## Optional: live AI catalyst analysis

Add an `ANTHROPIC_API_KEY` environment variable in Vercel to enable the
"Generate live AI analysis" button on the Forecast tab. See `api/catalyst.js`.
Without it, the app shows built-in illustrative examples and everything else
works normally.

## Project layout

```
package.json          deps + build scripts
vite.config.js        Vite config
index.html            app shell + PWA tags
src/main.jsx          mounts the app
src/App.jsx           the whole app (hub + Coffer)
public/               icons + web manifest
api/catalyst.js       serverless function for the optional AI feature
```
