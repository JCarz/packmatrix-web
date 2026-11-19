# PackMatrix Web

PackMatrix Web is a Vite + React + TypeScript progressive web app port of the PackMatrix SwiftUI packing-list app. It is a client-only application with no backend.

## Stack and source layout

- React 18 with TypeScript and Vite 5.
- `vite-plugin-pwa` generates the web manifest and service worker during production builds.
- `src/engine.ts` contains pure packing-rule and checklist functions.
- `src/store.ts` owns the single-state local persistence and seed data.
- `src/App.tsx` contains the React UI and state-update flows.

## Data rule

Keep all app data local-only. `src/store.ts` stores the complete `State` JSON object under the `packmatrix:v1` key in `localStorage`; do not add a backend, remote sync, or analytics persistence without an explicit product request. Backups are exported and imported in the Settings UI.

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
npm test
```

`npm run build` type-checks with `tsc --noEmit` before Vite writes the deployable PWA to `dist/`.
