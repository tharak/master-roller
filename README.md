# Master Roller

[Play the mobile web test release](https://tharak.github.io/master-roller/) · [Release tickets](https://github.com/tharak/master-roller/milestone/1) · [Report a bug](https://github.com/tharak/master-roller/issues)

A small dice collection game built for phones. Start with one d2, earn Dicecoin, buy more dice, and keep climbing.

## How to play

- Every tap of **Roll** rolls all your owned dice once.
- Beat level X by rolling a combined total **at least X**. A win advances exactly one level.
- A winning roll earns **20 Dicecoin**. A losing roll earns **10 Dicecoin** and stays on the current level.
- Buy unlimited copies of any die. Prices stay fixed, and every copy contributes to the next roll.
- d2 rolls **0 or 1**; all other dice roll **1 through their face count**, uniformly.

| Die  | Range | Dicecoin price |
| ---- | ----- | -------------: |
| d2   | 0–1   |             10 |
| d3   | 1–3   |             40 |
| d4   | 1–4   |             50 |
| d6   | 1–6   |             70 |
| d8   | 1–8   |             90 |
| d10  | 1–10  |            110 |
| d12  | 1–12  |            130 |
| d20  | 1–20  |            210 |
| d100 | 1–100 |          1,010 |

Prices equal 20 × average roll. Balancing constants live in `src/game.ts`. The initial rules deliberately let one loss buy another d2, so players can always grow their collection.

## Purchases and saves

**All purchase offers in the Test Lab are simulated.** Each die offer grants one copy, and the coin pack grants 10,000 Dicecoin. Offers can be repeated, never charge real money, and do not ask for payment information. Dicecoin has no real monetary value in this test release.

Progress automatically saves in localStorage in the current browser. It does not sync across devices; clearing browser data removes it. Storage failures show a warning while allowing play. An unreadable or unsupported save offers an explicit fresh-start recovery. Use the reset button to clear progress after confirmation.

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
