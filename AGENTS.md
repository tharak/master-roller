# Working on Master Roller

- Read the assigned GitHub issue and its dependencies first. Use a branch and PR per new ticket; reference the issue and provide validation evidence.
- The game is a static React/TypeScript/Vite app deployed under `/master-roller/` on GitHub Pages. Preserve project-relative asset loading.
- Rules and balancing constants belong in `src/game.ts`. Keep the engine pure and randomness injectable. React manages presentation, animation and saving.
- d2 rolls 0 or 1. All owned dice roll together. A sum at least the level wins and advances exactly one level. Lose earns 10 Dicecoin; win earns 20. Change these only when the assigned task requests it.
- Purchases in the Test Lab are simulated and must clearly say no charge. There is no billing backend.
- Preserve the versioned save contract or provide an explicit migration. Invalid saves must not be silently overwritten.
- Use Node.js 24+. Install with `npm ci`; install Chromium with `npx playwright install chromium` (CI also needs `--with-deps`). Run `npm run gate` before completing changes that affect gameplay or release behavior.
- Tests live in `tests/unit` and `tests/browser`. Progression reports come from `npm run simulate`. Avoid changing prices just to satisfy a test or simulation.
