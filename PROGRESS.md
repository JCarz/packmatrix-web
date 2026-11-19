# Progress

## Import hardening — plan

Centralize backup parsing and normalization outside the Settings component.
Accept iOS-export-compatible records while filling missing optional values safely.
Drop dangling references with visible skipped counts, and cover the behavior with a fixture-based test.

Completed: added `importState`, an iOS-format fixture, and two focused Vitest cases.
Settings now restores normalized state and reports the total skipped invalid rows in its toast.
Verification passed: TypeScript, 7 Vitest tests, and the PWA production build.

## Playwright end-to-end tests — plan

Install the Playwright runner and Chromium, documenting a skip if browser installation is unavailable.
Cover the requested end-to-end flow against a local Vite server using the visible UI.
Keep E2E execution separate from the fast `verify` script, then re-run the verifier.

Completed: added Playwright with a Chromium-backed E2E flow for create, pack, duplicate, template, export, and import.
Chromium installed and `pnpm run test:e2e` passed (1 test); E2E runs against an isolated browser context.
Verification passed after excluding E2E files from Vitest: TypeScript, 7 unit tests, and the PWA production build.

## Category management — plan

Add a compact category manager from the Master tab for creating, renaming, and reordering categories.
Use existing category references to prevent deletion while any item still belongs to that category.
Persist ordering through `sortOrder` only and preserve all master-item behavior.

Completed: the Master tab now opens a category manager for add, rename, and up/down reorder actions.
Deletion is allowed only for an empty category; referenced categories produce a clear toast instead.
Verification passed: TypeScript, 7 Vitest tests, and the PWA production build.

## Trip checklist row editing — plan

Add a focused checklist-row editor reachable from each trip row.
Update only that row's quantity and notes, leaving the master packing item untouched.
Keep existing pack-toggle and removal interactions unchanged, then run the full verifier.

Completed: each checklist row now has an Edit action for that trip row's quantity and notes.
The editor updates only `checklist`, so its master item remains unchanged.
Verification passed: TypeScript, 7 Vitest tests, and the PWA production build.
