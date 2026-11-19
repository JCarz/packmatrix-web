# PackMatrix Web

Web/PWA port of the PackMatrix SwiftUI app. Local-first: all data lives in the browser (localStorage), no backend.

```bash
npm install
npm run dev      # local dev server
npm run build    # outputs dist/
```

## Deploy (free)
Cloudflare Pages, Netlify, or Vercel: connect the GitHub repo, build command `npm run build`, output directory `dist`.

## Install on iPhone
Open the URL in **Safari** → Share → **Add to Home Screen**. Installing matters: it stops Safari from clearing the data after a stretch of non-use.
Use Settings → Export backup now and then.

## Layout
- `src/engine.ts` – port of PackingRuleEngine.swift (checklist generation, templates, duplication)
- `src/store.ts` – persistence + first-launch seed data (from SampleData.swift)
- `src/App.tsx` – all screens
