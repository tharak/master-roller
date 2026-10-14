# Master Roller

[Play the mobile web test release](https://tharak.github.io/master-roller/) · [Release tickets](https://github.com/tharak/master-roller/milestone/1) · [Report a bug](https://github.com/tharak/master-roller/issues)

A small dice collection game built for phones. Start with one d4 in one slot, earn your rolled total in Dicecoin, buy space and more dice, and keep climbing.

Dice spread across a full-screen pool that adapts to the viewport, with the wallet, level and Roll control overlaid above it. Each type has its own shape, from a d4 pyramid to a faceted d100 sphere. They gather into a larger version of your highest-sided die showing the combined total, then it flies toward the level. A winning total breaks the old level text and reveals the next level; a losing result die breaks apart. Totals and fragments clear after the sequence and stay hidden on reload. Earned Dicecoin flies into the wallet before its displayed balance increases. Tap the **wallet** to open the shop; **?** holds the rules and last-roll details. Large stacks show up to six copies per type; quantities remain in the shop and every owned copy contributes to the total. Reduced-motion mode resolves rolls immediately, announcing the result without the animations.

## How to play

- Every tap of **Roll** rolls all your owned dice once.
- Beat level X by rolling a combined total **at least X**. A win advances exactly one level.
- Every roll earns **Dicecoin equal to its total**, on wins and losses. A losing roll stays on the current level.
- Each die uses one slot. Buy an extra slot for **50 Dicecoin** before adding another die. Slot prices are flat; every owned die contributes to every roll.
- All seven dice roll **1 through their face count**, uniformly. d2 and d3 have been removed.

| Die  | Range | Dicecoin price |
| ---- | ----- | -------------: |
| d4   | 1–4   |             50 |
| d6   | 1–6   |             70 |
| d8   | 1–8   |             90 |
| d10  | 1–10  |            110 |
| d12  | 1–12  |            130 |
| d20  | 1–20  |            210 |
| d100 | 1–100 |          1,010 |

The remaining die prices retain their previous starting values, equal to 20 × average roll. Balancing constants live in `src/game.ts`. Roll-total earnings and slot costs are live; draft prices in the economy lab do not change the game.

## Economy lab

[Open the economy lab](https://tharak.github.io/master-roller/#economy), or use its link in the shop or help screen. Edit all seven die prices and the flat slot price, reset to live prices, compare every possible face and average, and inspect exact summed-pool probabilities at any level. Drafts persist separately from the game save.

The upgrade analysis runs 200 seeded journeys: start with a free d4 and one slot, save for one of each next die in ascending order, and buy a slot with each upgrade. All owned dice keep rolling and each total becomes income. It graphs one representative earnings path against cumulative purchase budgets, highlights a 10th–90th percentile purchase window, and reports median purchase rolls/levels and rolls spent at an unreachable level. The free starting d4 price only affects extra copies, which this strategy does not buy.

Runs stop after buying d100 or 2,000 rolls. Reached counts and conditional percentiles make capped runs visible. This is a comparison of that strategy, not an optimal-play claim. With current prices, the first d6 plus slot costs 120 and is bought on median roll 49 (middle 80%: 45–53), at median level 5 after 41 unreachable-level rolls. Buying d100 costs 1,920 cumulatively including all preceding upgrades and slots; median purchase roll is 144.

## Purchases and saves

**All offers under Test purchases are simulated.** Open them from the dice shop. Each die offer grants one copy into an empty slot, and the coin pack grants 10,000 Dicecoin. Buy space in the shop before adding more test dice. Offers can be repeated, never charge real money, and do not ask for payment information. Dicecoin has no real monetary value in this test release.

Progress automatically saves in localStorage in the current browser. It does not sync across devices; clearing browser data removes it. Storage failures show a warning while allowing play. An unreadable or unsupported save offers an explicit fresh-start recovery. Use the reset button to clear progress after confirmation.

Resolved rolls save once before their visual sequence finishes. Refreshing during the coin animation restores the completed result and reward without adding it again.

Version 2 saves include slots and roll-total rewards. Valid version 1 saves migrate automatically: every d2/d3 becomes a d4, remaining dice and level/balance stay intact, and enough slots are granted for the collection. Obsolete last-roll history is cleared, and a notice explains the update. The original save, including that history, is backed up under `master-roller:save:v1-backup` before the new save is written. If backup fails, play remains available but the original save is not replaced. Invalid saves still require explicit recovery.

## Development

Use Node.js 24 or newer and npm.

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open `http://127.0.0.1:5173/master-roller/`.

```sh
npm test               # Deterministic engine and save validation tests
npm run build          # Type check and build dist/
npm run test:browser   # Desktop and mobile Chromium journeys; build first
npm run simulate       # 100 seeds per strategy through level 100
npm run gate           # All of the above, in order
npm run preview        # Serve dist/ at http://127.0.0.1:4173/master-roller/
```

For Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`.

Test the published build with:

```sh
PLAYWRIGHT_BASE_URL=https://tharak.github.io/master-roller/ npm run test:browser
```

The engine accepts injected randomness for deterministic tests. Browser tests isolate progress per context; progression simulations never use test purchase grants. Tests run against the built `/master-roller/` path, including reloading and loading its assets.

## Deployment and release

The **Validate and deploy** workflow checks pull requests and pushes to `main`. Passing `main` builds publish `dist/` to GitHub Pages using the `github-pages` environment. Pages must have GitHub Actions selected as its publishing source.

See [release notes and agent ticket map](docs/RELEASE.md). This release covers mobile web, local saves and simulated purchases. Native packaging, real billing, accounts, cloud saves and dice artwork are future work.

Fonts are self-hosted: DM Sans and Space Grotesk, under the SIL Open Font License. Their notices ship in `public/licenses/`.
