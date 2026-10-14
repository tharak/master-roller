# Working on Master Roller

- Read the assigned GitHub issue and its dependencies first. Use a branch and PR per new ticket; reference the issue and provide validation evidence.
- The game is a static React/TypeScript/Vite app deployed under `/master-roller/` on GitHub Pages. Preserve project-relative asset loading.
- Rules and balancing constants belong in `src/game.ts`. Keep the engine pure and randomness injectable. React manages presentation, animation and saving.
- Start with one d4 in one slot. Supported dice are d4, d6, d8, d10, d12, d20 and d100, each rolling 1 through its face count. All owned dice roll together. A sum at least the level wins and advances exactly one level. Every roll earns its total in Dicecoin. Extra slots cost a flat 50 Dicecoin; owned dice cannot exceed slots. Change these only when the assigned task requests it.
- Purchases in the Test Lab are simulated and must clearly say no charge. There is no billing backend.
- Preserve the versioned save contract or provide an explicit migration. Version 2 adds slots and roll-total rewards. Version 1 migration upgrades d2/d3 to d4, grants capacity for the collection, keeps level/balance, clears obsolete last-roll history, and backs up the original before replacing it. Invalid saves must not be silently overwritten.
- Economy-lab prices are drafts stored separately from game saves. Keep its simulations pure, seeded, and explicit about strategy, slot costs, sample size and capped/unreached runs.
- Use Node.js 24+. Install with `npm ci`; install Chromium with `npx playwright install chromium` (CI also needs `--with-deps`). Run `npm run gate` before completing changes that affect gameplay or release behavior.
- Tests live in `tests/unit` and `tests/browser`. Progression reports come from `npm run simulate`. Avoid changing prices just to satisfy a test or simulation.
