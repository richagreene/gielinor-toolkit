# Deploying your OSRS toolkit — step by step

This gets your app **live on the internet and on your phone home screen**, for free, with no coding and nothing to install. You do it all in a web browser.

**What you'll end up with:** a real URL (like `https://gielinor.vercel.app`) that shows live OSRS Grand Exchange prices, opens full-screen on your phone like a real app, and updates itself whenever you change it.

**Time:** about 10–15 minutes for Part 1 and 2.
**Cost:** $0. (The optional AI feature in Part 3 costs a few cents per use and is entirely optional.)
**You need:** a web browser and an email address. That's it.

---

## The idea in one sentence

You'll put the project files on **GitHub** (free code storage), then connect them to **Vercel** (free hosting). Vercel does all the building and serving for you in the cloud — you never touch a command line.

---

## Part 1 — Put it online

### Step 1 — Unzip the project
Unzip `coffer-app.zip`. You'll get a folder called **`coffer-app`** containing `package.json`, `index.html`, a `src` folder, a `public` folder, and an `api` folder. Keep this folder handy.

> **Important:** the files *inside* `coffer-app` (especially `package.json`) must end up at the **top level** of your GitHub repo — not tucked inside an extra folder. Step 3 explains exactly how.

### Step 2 — Create a GitHub account and a repository
1. Go to **github.com** and sign up (free) if you don't already have an account.
2. Click the **+** in the top-right → **New repository**.
3. Give it a name, e.g. `gielinor-toolkit`.
4. Leave it **Public** (or Private — either works).
5. **Don't** tick "Add a README." Leave it empty.
6. Click **Create repository**.

### Step 3 — Upload the project files
On the empty repo page, click the **"uploading an existing file"** link (or **Add file → Upload files**).

1. Open your unzipped `coffer-app` folder on your computer.
2. **Select everything *inside* it** — `package.json`, `index.html`, `vite.config.js`, `README.md`, `DEPLOY-GUIDE.md`, `.gitignore`, and the `src`, `public`, and `api` folders.
3. **Drag that selection** onto the GitHub upload page. GitHub keeps the folder structure.
4. Scroll down and click **Commit changes**.

After it finishes, your repo's main page should show `package.json` and `index.html` listed directly (not inside another folder). If you see a single `coffer-app` folder instead, that's the nesting mistake — delete and re-upload the **contents**, or just remember the folder name for the Vercel "Root Directory" setting in Step 5.

### Step 4 — Create a Vercel account
1. Go to **vercel.com** → **Sign Up**.
2. Choose **Continue with GitHub** (easiest — it links the two automatically).
3. Approve the access GitHub asks for.

### Step 5 — Import and deploy
1. In Vercel, click **Add New… → Project**.
2. Find your `gielinor-toolkit` repo in the list and click **Import**.
3. Vercel auto-detects it's a **Vite** app — you don't need to change any build settings.
   - *(Only if you hit the nesting mistake from Step 3: expand **Root Directory**, click **Edit**, and pick the `coffer-app` folder.)*
4. Click **Deploy**.
5. Wait about a minute while it builds. When it's done you'll see a confetti screen and a link.

### Step 6 — Open it
Click the link (or the preview). You're live. On a real connection (not the chat sandbox), you'll now see **live OSRS prices** and **real item icons**. 🎉

Your permanent URL looks like `https://gielinor-toolkit.vercel.app`. Bookmark it.

---

## Part 2 — Add it to your phone home screen

### iPhone (Safari)
1. Open your Vercel URL in **Safari** (must be Safari, not Chrome, for this).
2. Tap the **Share** button (the square with the up-arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

You'll get the gold coin icon on your home screen. Tapping it opens the app **full-screen**, with no browser bars — it feels native.

### Android (Chrome)
1. Open the URL in **Chrome**.
2. Tap the **⋮** menu → **Add to Home screen** (or **Install app**).
3. Confirm.

---

## Part 3 — (Optional) Turn on the live AI catalyst analysis

The Forecast tab's **"Generate live AI analysis"** button reads recent OSRS news and reasons about which items it might move. This is the one feature that needs your own API key, because it calls Claude.

**You can skip this entirely.** Without a key, the app shows the built-in illustrative catalyst examples and everything else works exactly the same.

If you want it on:

1. **Get an API key:** go to **console.anthropic.com**, sign in, open **Settings → API Keys → Create Key**, and copy it (it starts with `sk-ant-`). Add a little billing credit under **Plans & Billing** (usage is roughly a cent or two per click).
2. **Add it to Vercel (kept secret on the server, never in your app):**
   - Vercel → your project → **Settings → Environment Variables**.
   - Name: `ANTHROPIC_API_KEY`  ·  Value: your key  ·  add it.
3. **Redeploy:** go to **Deployments**, click the **⋯** on the latest one → **Redeploy**.
4. Open the app's **Forecast** tab and tap **Generate live AI analysis**.

> If it doesn't return results, open `api/catalyst.js` and check the two notes in the comments: the `model` name may need updating to a current one from **docs.claude.com**, and if your account doesn't support the web-search tool, delete the `tools:` line. The app falls back to the examples either way, so it never breaks.

---

## Updating the app later

You don't redo any of this. To change something:
- Edit a file straight in GitHub (open the file → pencil icon → edit → **Commit**), **or** upload a new version of `src/App.jsx`.
- Vercel notices the change and **rebuilds automatically** in about a minute. Refresh your URL.

If I hand you an updated `App.jsx` in the future, you just replace that one file in GitHub and it redeploys itself.

---

## Adding more tools to the hub later

The landing page is a grid of cards defined by the `TOOLS` list near the bottom of `src/App.jsx`. The extra cards (Drop Ledger, Gear & DPS Lab, etc.) are marked `live: false` ("Coming soon"). When we build one of those, it becomes its own component and we flip its card to `live: true` — the rest of the site is untouched. One site, one login, one URL, growing over time.

---

## Optional polish — a custom domain

The free `*.vercel.app` URL works forever. If you want something like `gielinor.gg`:
- Vercel → your project → **Settings → Domains** → add a domain you own, or buy one right there. Vercel walks you through it.

---

## Troubleshooting

- **Still says "Sample data" / no live prices:** refresh once; the OSRS API can briefly rate-limit. If it *never* loads live, the price API may be blocking browser requests from your domain — tell me and I'll add a tiny proxy (a second small file) that fixes it.
- **Icons not showing:** hard-refresh the page. Item icons load from RuneLite's image server; a momentary hiccup there resolves on reload.
- **Vercel build failed:** almost always the nesting mistake from Step 3. Make sure `package.json` is at the repo root, or set the **Root Directory** to `coffer-app` in Vercel's project settings, then redeploy.
- **My saved data disappeared:** your watchlist, tracker, alerts, timers and bankroll are saved in *that browser, on that device* (private to you). Clearing the site's data, or opening it in a different browser, starts fresh.
- **AI button says it needs a key:** you haven't added `ANTHROPIC_API_KEY` yet, or you added it but haven't redeployed.

---

## One honest reminder

Once live, the price data and quant signals are real. The forecasts and theses are still **decision-support, not guarantees** — exactly as the app's own banners say. Use them to inform your buy-low / sell-high timing, not as a sure thing. Happy flipping.
