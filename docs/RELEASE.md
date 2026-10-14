# Mobile Web Test Release — v0.1.0

## Value pricing and increasing slot costs — #25

Live dice prices are 5/7/9/11/13/21/101, twice each die’s average. Extra slots cost 3 × slots already owned: 3, 6, 9, 12… Dicecoin. The starter die and slot are free. Existing saves retain their balance, collection and capacity; the next slot price follows saved capacity without a schema change.

The Economy lab now shows whole-pool comparisons and guaranteed checkpoint wallets after previous spending. A d6 plus the first extra slot costs 10, fully covered by clearing levels 1–4. At level 10 after that purchase, the minimum wallet is 45: adding a d8 and a slot costs 15, or two d4s and two slots cost 25. Draft edits recalculate tables and simulations, including increasing slot prices. Untouched old defaults update; custom draft values remain, with the slot value used as the scaling base.

The 200-seed upgrade analysis buys d6 on median roll 5 (middle 80%: 4–6) and d100 on roll 17 (16–19), spending 225 cumulatively. Progression through level 100 averages 102.8 rolls / 2.8 losses for d4-only buying and 102.7 rolls / 2.7 losses for next-die buying. These are strategy baselines rather than optimal-play claims.

Validation: full gate passes with 52 unit checks, 52 desktop/mobile browser checks, type checking, production build, 200 progression runs through level 100 and 200 upgrade-analysis runs. Visual review covers 1440px desktop and 390px phone layouts; the 320px browser check confirms no page overflow. Tests cover minimum winning income funding the first d6, successive slot prices and reload, table recalculation, unavailable later budgets, draft compatibility and game-save isolation.

## Economy and analysis update — #21

Rules at the #21 release (prices superseded by #25 above): start with one d4 and one slot; supported dice are d4/d6/d8/d10/d12/d20/d100; extra slots cost a flat 50 Dicecoin; each roll earns its total, on wins and losses. Die prices remain 50/70/90/110/130/210/1010 while the economy lab offers separate editable drafts.

The lab graphs all possible faces, exact pool probabilities, and seeded upgrade affordability including slots. At default prices, the first d6 plus slot costs 120, with median purchase roll 49 and 41 median rolls at an unreachable level. Cumulative cost through d100 is 1,920, purchased on median roll 144. Simulation assumptions and capped-run counts are shown in the view.

Version 1 saves are backed up before migration to version 2. Removed dice become d4, capacity is granted for the existing collection, level/balance are kept, and obsolete last-roll history is cleared with a visible notice. Invalid saves are not overwritten.

Validation: 47 unit checks, 44 desktop/mobile browser checks, production build/type checking, and 200 progression simulations through level 100. d4-only buying averages 202.5 rolls / 102.5 losses / 68.2 dice and slot purchases; buying each next die then repeat d100 averages 206.5 rolls / 106.5 losses / 26.5 purchases. A separate 200-seed run supplies lab upgrade windows. Both progression strategies use only earned coins.

Game: https://tharak.github.io/master-roller/

Milestone: https://github.com/tharak/master-roller/milestone/1

## Implementation tickets

| Issue                                                  | Deliverable                               | Dependencies |
| ------------------------------------------------------ | ----------------------------------------- | ------------ |
| [#1](https://github.com/tharak/master-roller/issues/1) | Project bootstrap and CI                  | None         |
| [#2](https://github.com/tharak/master-roller/issues/2) | Dice engine and economy                   | #1           |
| [#3](https://github.com/tharak/master-roller/issues/3) | Mobile gameplay interface                 | #2           |
| [#4](https://github.com/tharak/master-roller/issues/4) | Dicecoin shop                             | #2, #3       |
| [#5](https://github.com/tharak/master-roller/issues/5) | Simulated purchase offers                 | #2, #4       |
| [#6](https://github.com/tharak/master-roller/issues/6) | Local saves, recovery and reset           | #2, #3       |
| [#7](https://github.com/tharak/master-roller/issues/7) | Progression and mobile verification       | #3–#6        |
| [#8](https://github.com/tharak/master-roller/issues/8) | Pages deployment and release verification | #1–#7        |

Each issue includes acceptance criteria and dependencies. For future assigned agent work, use one branch and PR per issue, reference the issue, and attach relevant validation evidence. The first implementation delivers the full release together; completed tickets remain as an implementation record.

## Validation baseline

- 44 deterministic unit tests covering every supported die, summed rolls, win/loss rewards, repeated purchases and save validation.
- 12 browser checks across desktop and Pixel 7 emulation, including 320px layouts, keyboard input, reduced motion, overlapping taps, all test offers, reload/reset and invalid/unavailable storage.
- Visual review at 1440px desktop and 390px phone widths.
- Production dependency audit: zero known vulnerabilities at implementation time.
- Type checking and production build pass.

Seeded progression simulation, 100 seeds per strategy, clearing level 100 using only earned Dicecoin:

| Strategy                                        | Average rolls | Average losses | Average purchases | Maximum rolls |
| ----------------------------------------------- | ------------: | -------------: | ----------------: | ------------: |
| Buy d2 immediately                              |         118.3 |           18.3 |             218.3 |           123 |
| Save for d20; buy d2 when target is unreachable |           145 |             45 |                14 |           154 |

These are reproducible baselines, not a claim of optimal play or final balance. Prices were not changed after simulation. Current average-value pricing rewards immediate d2 accumulation with faster progression, while saving for larger dice produces a smaller collection.

## Test release boundaries

All nine dice are text labels. All test-purchase offers are free simulations. Saves are browser-local. There are no native store integrations, real-money transactions, accounts or backend. Mobile checks use Chromium emulation rather than physical iOS/Android devices.

## Game board update — #9

Replaced the text-heavy page with a single game board: owned dice and rolled faces in the center, the target above, and Roll plus a compact shop button below. Rules and roll details are available on demand. The shop is a compact three-column dialog. Existing rules, prices, and saves are preserved.

Validation now includes 16 desktop/mobile browser checks, including on-screen die faces, newly bought dice joining the board, the Roll button fitting a 390 × 844 viewport, and all 51 dice contributing to a large-pool roll. The original 44 unit tests and 200 progression simulations still pass.

## Roll animation update — #11

Dice tumble, show their faces, fly into a sum, then reveal earned Dicecoin. The reward flies from the result into the wallet; the displayed balance increases on arrival. The wallet opens the shop, replacing the separate dice button. The level has no comparison symbol.

The sequence prevents overlapping rolls and purchases. Complete results are saved once before presentation finishes, so a refresh during flight preserves the reward without duplicating it. Reduced-motion mode completes immediately. Six new desktop/mobile checks cover win/loss sequence ordering, delayed wallet credit, and refreshing during the flight, bringing the browser suite to 22 checks.

## Distinct dice and simpler board — #13

LEVEL and its number share one horizontal line at the existing 11px label size. Removed the dice count, per-die quantity badges, result captions, and prompts between the pool and Roll. The numerical total stays visible within the pool after the animation.

Added shared vector shapes to the main pool and shop: coin, triangular prism, pyramid, cube, octahedron, trapezohedron, dodecahedron, icosahedron, and faceted sphere. Numeric faces, dice flights, coin collection, prices, rules, and save compatibility are preserved. Browser journeys verify all nine distinct shapes, the small horizontal level label, absent captions, and the total remaining visible after completion.
