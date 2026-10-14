# Mobile Web Test Release — v0.1.0

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
