# Master Roller

[Play the mobile web test release](https://tharak.github.io/master-roller/) · [Release tickets](https://github.com/tharak/master-roller/milestone/1) · [Report a bug](https://github.com/tharak/master-roller/issues)

A small dice collection game built for phones. Start with one d4 in one slot, earn your rolled total in Dicecoin, buy space and more dice, and keep climbing.

Dice spread across a full-screen pool that adapts to the viewport, with the wallet, level and Roll control overlaid above it. Each type has its own shape, from a d4 pyramid to a faceted d100 sphere. They gather into a larger version of your highest-sided die showing the combined total, then it flies toward the level. A winning total breaks the old level text and reveals the next level; a losing result die breaks apart. Totals and fragments clear after the sequence and stay hidden on reload. Earned Dicecoin appears at the level text and flies up into the wallet before its displayed balance increases. Normal rolls keep the full animation pace (about 4.7 seconds); **Roll** becomes **Skip** while they run. Clicking Skip accelerates the remaining sequence to finish within one second, continuing from its current position. If less than a second remains, it finishes naturally. Repeated clicks do not extend the deadline. The wallet still credits the reward once when the coins arrive. Tap the **wallet** to open the shop; **?** holds the rules and last-roll details. Large stacks show up to six copies per type; quantities remain in the shop and every owned copy contributes to the total. Reduced-motion mode resolves rolls immediately, announcing the result without the animations.

## How to play

- Every tap of **Roll** rolls all your owned dice once.
- Beat level X by rolling a combined total **at least X**. A win advances exactly one level.
- Every roll earns **Dicecoin equal to its total**, on wins and losses. A losing roll stays on the current level.
- Each die uses one slot. Buy extra slots for **3, 6, 9, 12… Dicecoin** before adding more dice. The next slot costs 3 × slots already owned; the starting slot is free. Every owned die contributes to every roll.
- All seven dice roll **1 through their face count**, uniformly. d2 and d3 have been removed.

| Die  | Range | Dicecoin price |
| ---- | ----- | -------------: |
| d4   | 1–4   |              5 |
| d6   | 1–6   |              7 |
| d8   | 1–8   |              9 |
| d10  | 1–10  |             11 |
| d12  | 1–12  |             13 |
| d20  | 1–20  |             21 |
| d100 | 1–100 |            101 |

Die prices equal 2 × average roll. A d6 costs 7 versus 10 for two d4s, whose average and maximum total are higher. The starting d4 is free. Clearing levels 1–4 guarantees at least 10 coins, enough for a d6 and the first extra slot. Balancing constants live in `src/game.ts`. Roll-total earnings and slot costs are live; draft prices in the economy lab do not change the game.

## Merging dice

Open **Merge dice** in the shop to combine two owned dice for free when their maximum values add up to a supported die. Only available pairs are offered; identical types need two copies.

| Input dice | Result |
| ---------- | ------ |
| d4 + d4    | d8     |
| d4 + d6    | d10    |
| d4 + d8    | d12    |
| d6 + d6    | d12    |
| d8 + d12   | d20    |
| d10 + d10  | d20    |

A merge consumes exactly those two copies and grants one result die. It frees one used slot, keeps all purchased capacity and coins, and leaves your level unchanged. The maximum total stays the same; the minimum drops by 1 and average income per roll drops by 0.5. Merging is optional and clears the previous roll’s faces/details so the consumed dice are not shown as current results. The merged collection saves immediately and rolls together on the next turn. Merges are unavailable while a roll animates.

## Economy lab

[Open the economy lab](https://tharak.github.io/master-roller/#economy), or use its link in the shop or help screen. Edit all seven die prices and the slot base price, reset to live prices, compare every possible face and average, and inspect exact summed-pool probabilities at any level. Pool comparison and guaranteed upgrade-budget tables include 2d4, previous spending, and increasing slot costs. With live prices, adding a d8 to d4 + d6 costs 15; adding two d4s costs 25, including both slots. Later guaranteed wallets are unavailable if an earlier purchase exceeds its budget. Drafts persist separately from the game save. Untouched old defaults update automatically; custom draft values are retained, with the slot value now serving as the scaling base.

The upgrade analysis runs 200 seeded journeys: start with a free d4 and one slot, save for one of each next die in ascending order, and buy a slot with each upgrade. These buy-only journeys do not use merges. All owned dice keep rolling and each total becomes income. It graphs one representative earnings path against cumulative purchase budgets, highlights a 10th–90th percentile purchase window, and reports median purchase rolls/levels and rolls spent at an unreachable level. The free starting d4 price only affects extra copies, which this strategy does not buy.

Runs stop after buying d100 or 2,000 rolls. Reached counts and conditional percentiles make capped runs visible. This is a comparison of that strategy, not an optimal-play claim. With current prices, the first d6 plus slot costs 10 and is bought on median roll 5 (middle 80%: 4–6), at median level 4 with zero median unreachable-level rolls. Buying d100 costs 225 cumulatively including all preceding upgrades and increasing slot costs; median purchase roll is 17 (middle 80%: 16–19).

## Purchases and saves

**All offers under Test purchases are simulated.** Open them from the dice shop. Each die offer grants one copy into an empty slot, and the coin pack grants 10,000 Dicecoin. Buy space in the shop before adding more test dice. Offers can be repeated, never charge real money, and do not ask for payment information. Dicecoin has no real monetary value in this test release.

Progress automatically saves in localStorage in the current browser. It does not sync across devices; clearing browser data removes it. Storage failures show a warning while allowing play. An unreadable or unsupported save offers an explicit fresh-start recovery. Use the reset button to clear progress after confirmation.

Resolved rolls save once before their visual sequence finishes. Refreshing during the coin animation restores the completed result and reward without adding it again.

Version 2 saves include slots and roll-total rewards. Existing capacity determines the next scaled slot price; this pricing update needs no save migration. Valid version 1 saves migrate automatically: every d2/d3 becomes a d4, remaining dice and level/balance stay intact, and enough slots are granted for the collection. Obsolete last-roll history is cleared, and a notice explains the update. The original save, including that history, is backed up under `master-roller:save:v1-backup` before the new save is written. If backup fails, play remains available but the original save is not replaced. Invalid saves still require explicit recovery.

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
