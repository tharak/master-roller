import { expect, test, type Page } from "@playwright/test";
import { DICE, newGame, type GameState } from "../../src/game";

async function seed(page: Page, changes: Partial<GameState> = {}) {
  await page.addInitScript(
    (state) => {
      if (localStorage.getItem("master-roller:save") === null)
        localStorage.setItem("master-roller:save", JSON.stringify(state));
    },
    { ...newGame(), ...changes },
  );
}
const rollButton = (page: Page) =>
  page.getByRole("button", { name: /^Roll your (die|dice)$/ });
async function section(page: Page, name: "Play" | "Dice shop") {
  if (name === "Dice shop")
    await page.getByRole("button", { name: /Dicecoin$/ }).click();
  else if (await page.getByRole("dialog").isVisible())
    await page
      .getByRole("button", { name: "Close dice shop", exact: true })
      .click();
}
async function resolveFaces(page: Page) {
  await page.clock.fastForward(120);
  await expect(page.locator(".arena")).toHaveAttribute("data-phase", "faces");
  await page.clock.fastForward(80);
  await expect(page.locator(".arena")).toHaveAttribute(
    "data-phase",
    "gathering",
  );
  await page.clock.fastForward(160);
  await expect(page.locator(".arena")).toHaveAttribute("data-phase", "total");
}

test("earned-money journey buys a slot and d6, reloads, and resets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(page.getByTestId("target")).toHaveText("1");
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("d4 not rolled yet", { exact: true }),
  ).toBeVisible();
  await section(page, "Dice shop");
  await expect(page.getByText("1 / 1 slots used")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy d6 for 7 Dicecoin", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Buy d[23] / })).toHaveCount(0);
  await section(page, "Play");
  for (let count = 0; count < 4; count++) {
    await page.evaluate((value) => {
      Math.random = () => value;
    }, count / 4);
    await rollButton(page).click();
  }
  await page.evaluate(() => {
    Math.random = () => 0.99;
  });
  await expect(page.getByTestId("target")).toHaveText("5");
  await expect(page.getByLabel("10 Dicecoin", { exact: true })).toBeVisible();
  await section(page, "Dice shop");
  const buyDie = page.getByRole("button", {
    name: "Buy d6 for 7 Dicecoin",
    exact: true,
  });
  await expect(buyDie).toBeDisabled(); // Money alone does not bypass capacity.
  await page
    .getByRole("button", { name: "Buy slot for 3 Dicecoin", exact: true })
    .click();
  await expect(page.getByText("1 / 2 slots used")).toBeVisible();
  await buyDie.click();
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByText("2 / 2 slots used")).toBeVisible();
  await section(page, "Play");
  await rollButton(page).click();
  await expect(page.getByTestId("target")).toHaveText("6");
  await expect(page.getByLabel("10 Dicecoin", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("target")).toHaveText("6");
  await expect(page.getByLabel("10 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByLabel("d4 rolled 4", { exact: true })).toBeVisible();
  await expect(page.getByLabel("d6 rolled 6", { exact: true })).toBeVisible();
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await page
    .getByRole("button", { name: "Reset progress", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByTestId("target")).toHaveText("6");
  await page
    .getByRole("button", { name: "Reset progress", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset progress" })
    .click();
  await expect(page.getByTestId("target")).toHaveText("1");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({
    version: 2,
    slots: 1,
    balance: 0,
    inventory: { d4: 1, d6: 0 },
  });
  expect(errors).toEqual([]);
});

test("a loss earns its total and rapid taps cannot double resolve", async ({
  page,
}) => {
  await seed(page, { level: 5 });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("./");
  await rollButton(page).evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.click();
    button.click();
    button.click();
  });
  await expect(page.locator(".arena [role=status]")).toContainText("Total 1.");
  await expect(page.getByLabel("1 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByTestId("target")).toHaveText("5");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("master-roller:save")!).balance,
    ),
  ).toBe(1);
});

test("simulated offers are free and respect purchased slots", async ({
  page,
}) => {
  await page.goto("./");
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Test purchases", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/No charge, no payment details/)).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Simulate purchase of d6",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Simulate purchase of d[23]$/ }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /THE BIG COIN PACK/ }).click();
  await page.getByRole("button", { name: "Back to dice shop" }).click();
  for (let count = 0; count < 7; count++)
    await page
      .getByRole("button", {
        name: `Buy slot for ${(count + 1) * 3} Dicecoin`,
        exact: true,
      })
      .click();
  await page
    .getByRole("button", { name: "Test purchases", exact: true })
    .click();
  for (const die of DICE)
    await dialog
      .getByRole("button", {
        name: `Simulate purchase of ${die.id}`,
        exact: true,
      })
      .click();
  await expect(
    dialog.getByRole("button", {
      name: "Simulate purchase of d4",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close test purchases" }).click();
  const dice = page.getByRole("region", { name: "Your collection" });
  const shapes = await dice
    .locator("svg[data-die-shape]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-die-shape")),
    );
  expect(new Set(shapes).size).toBe(7);
  expect(shapes).not.toContain("coin");
  expect(shapes).not.toContain("triangular prism");
  await expect(dice).toHaveAttribute("aria-description", "8 dice");
  await page.reload();
  await expect(page.getByLabel("9916 Dicecoin", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("master-roller:save")!).slots,
    ),
  ).toBe(8);
});

test("rapid slot taps cannot spend unavailable money", async ({ page }) => {
  await seed(page, { balance: 3 });
  await page.goto("./");
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy slot for 3 Dicecoin", exact: true })
    .evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
      button.click();
    });
  await expect(page.getByText("1 / 2 slots used")).toBeVisible();
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
});

test("slot prices increase with capacity and survive reload", async ({
  page,
}) => {
  await seed(page, { balance: 20 });
  await page.goto("./");
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy slot for 3 Dicecoin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buy slot for 6 Dicecoin", exact: true })
    .click();
  await expect(page.getByText("1 / 3 slots used")).toBeVisible();
  await page.reload();
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy slot for 9 Dicecoin", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Buy slot for 12 Dicecoin", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("1 / 4 slots used")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({ version: 2, slots: 4, balance: 2 });
});

test("invalid save requires explicit recovery and remains untouched", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("master-roller:save", "broken"),
  );
  await page.goto("./");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("master-roller:save")),
  ).toBe("broken");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Start new game" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({ version: 2, slots: 1, level: 1, balance: 0 });
});

test("storage failure stays visible while play works", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(page.getByText(/Saving is unavailable/)).toBeVisible();
  await rollButton(page).click();
  await expect(page.getByTestId("target")).toHaveText("2");
});

test("narrow screens, keyboard controls and reduced motion work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await rollButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("target")).toHaveText("2");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await expect(page.locator(".arena [role=status]")).toContainText(
    "Total 4. Level cleared. Earned 4 Dicecoin.",
  );
  await section(page, "Dice shop");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Test purchases", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Dicecoin$/ })).toBeFocused();
});

test("dice have shapes and numeric faces without type labels", async ({
  page,
}) => {
  await seed(page, { balance: 10 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  const dice = page.getByRole("region", { name: "Your collection" });
  await expect(page.locator(".level-label")).toHaveCSS("font-size", "11px");
  await expect(page.locator(".target-value")).toHaveCSS("font-size", "11px");
  const label = await page.locator(".level-label").boundingBox(),
    level = await page.getByTestId("target").boundingBox();
  expect(Math.abs(label!.y - level!.y)).toBeLessThan(2);
  await expect(
    page.locator(".die-type, .dice-count, .result-area, .ready-label, .toast"),
  ).toHaveCount(0);
  await expect(dice.locator("svg[data-die-shape=pyramid]")).toBeVisible();
  const bounds = await rollButton(page).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await rollButton(page).click();
  await expect(dice.getByLabel("d4 rolled 4", { exact: true })).toBeVisible();
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy slot for 3 Dicecoin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buy d6 for 7 Dicecoin", exact: true })
    .click();
  await section(page, "Play");
  await expect(
    dice.getByLabel("d6 not rolled yet", { exact: true }),
  ).toBeVisible();
  await rollButton(page).click();
  await expect(page.locator(".arena [role=status]")).toContainText("Total 10.");
  await expect(page.locator(".arena")).toHaveAttribute("data-phase", "idle");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
});

test("full-screen dense pool resizes and overlay controls remain usable", async ({
  page,
}) => {
  await seed(page, {
    slots: 42,
    balance: 100,
    inventory: Object.fromEntries(
      DICE.map((die) => [die.id, 6]),
    ) as GameState["inventory"],
  });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".play-die")).toHaveCount(42);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.getByRole("region", { name: "Your collection" }).boundingBox(),
      )
      .toEqual({ x: 0, y: 0, ...viewport });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dice = Array.from(
            document.querySelectorAll(".play-die"),
            (element) => element.getBoundingClientRect(),
          );
          const level = document
              .querySelector(".level-target")!
              .getBoundingClientRect(),
            controls = document
              .querySelector(".controls")!
              .getBoundingClientRect();
          return dice.every(
            (die) =>
              die.left >= 0 &&
              die.right <= innerWidth &&
              die.top >= level.bottom &&
              die.bottom <= controls.top,
          );
        }),
      )
      .toBe(true);
    const spread = await page.locator(".play-die").evaluateAll((elements) => {
      const dice = elements.map((element) => element.getBoundingClientRect());
      return {
        width:
          Math.max(...dice.map((die) => die.right)) -
          Math.min(...dice.map((die) => die.left)),
        height:
          Math.max(...dice.map((die) => die.bottom)) -
          Math.min(...dice.map((die) => die.top)),
      };
    });
    expect(spread.width).toBeGreaterThan(viewport.width * 0.6);
    expect(spread.height).toBeGreaterThan((viewport.height - 242) * 0.6);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await rollButton(page).boundingBox())!.width).toBeCloseTo(
      Math.min(480, viewport.width - 32),
    );
    await section(page, "Dice shop");
    await expect(page.getByRole("dialog", { name: "Dice shop" })).toBeVisible();
    await section(page, "Play");
    await page.getByRole("button", { name: "How to play" }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Reset progress", exact: true })
      .click();
    await page.getByRole("button", { name: "Keep playing" }).click();
  }
  await rollButton(page).click();
  await expect(page.getByLabel("1060 Dicecoin", { exact: true })).toBeVisible();
});

test("all owned dice contribute even beyond the visual six-copy cap", async ({
  page,
}) => {
  await seed(page, {
    slots: 51,
    inventory: { ...newGame().inventory, d4: 50, d100: 1 },
  });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(
    page.getByLabel("d100 not rolled yet", { exact: true }),
  ).toBeVisible();
  await rollButton(page).click();
  await expect(page.locator(".arena [role=status]")).toContainText(
    "Total 300.",
  );
  await expect(
    page.getByLabel("d100 rolled 100", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your collection" }),
  ).toHaveAttribute("aria-description", "51 dice");
});

for (const scenario of [
  {
    name: "exact-target win",
    random: 0.99,
    count: 1,
    face: 4,
    total: 4,
    startLevel: 4,
    level: 5,
    won: true,
  },
  {
    name: "overshoot win",
    random: 0.99,
    count: 2,
    face: 4,
    total: 8,
    startLevel: 1,
    level: 2,
    won: true,
  },
  {
    name: "loss",
    random: 0,
    count: 1,
    face: 1,
    total: 1,
    startLevel: 5,
    level: 5,
    won: false,
  },
]) {
  test(`${scenario.name}: result die strikes the level then pays its rolled total on arrival`, async ({
    page,
  }) => {
    await seed(page, {
      level: scenario.startLevel,
      slots: scenario.count,
      inventory: { ...newGame().inventory, d4: scenario.count },
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript((random) => {
      Math.random = () => random;
    }, scenario.random);
    await page.goto("./");
    const arena = page.locator(".arena"),
      wallet = page.getByRole("button", { name: "0 Dicecoin", exact: true });
    await wallet.click();
    await section(page, "Play");
    const started = await page.evaluate(() => performance.now());
    await rollButton(page).click();
    await expect(
      page.getByRole("button", { name: "Skip animation", exact: true }),
    ).toBeEnabled();
    await page.clock.fastForward(120);
    await expect(arena).toHaveAttribute("data-phase", "faces");
    await expect(
      page.getByLabel(`d4 rolled ${scenario.face}`, { exact: true }),
    ).toHaveCount(scenario.count);
    await expect(wallet).toBeDisabled();
    await expect(page.getByTestId("target")).toHaveText(
      String(scenario.startLevel),
    );
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("master-roller:save")!).balance,
      ),
    ).toBe(scenario.total);
    await page.clock.fastForward(80);
    await expect(arena).toHaveAttribute("data-phase", "gathering");
    expect(
      await page
        .locator(".play-die")
        .evaluateAll((dice) =>
          dice.every((die) => die.getAnimations().length > 0),
        ),
    ).toBe(true);
    await page.clock.fastForward(160);
    await expect(arena).toHaveAttribute("data-phase", "total");
    await expect(page.locator(".play-die").first()).toHaveCSS("opacity", "0");
    await expect(page.getByTestId("roll-total")).toHaveText(
      String(scenario.total),
    );
    await expect(page.locator(".sum-burst .result-die svg")).toHaveAttribute(
      "data-die-shape",
      "pyramid",
    );
    await page.clock.fastForward(90);
    await expect(arena).toHaveAttribute("data-phase", "targeting");
    const collision = await page
      .locator(".total-flight")
      .evaluate((element) => {
        const animation = element.getAnimations()[0];
        animation.pause();
        animation.currentTime = Number(animation.effect!.getTiming().duration);
        const die = element.getBoundingClientRect(),
          level = document
            .querySelector(".level-target > .level-copy")!
            .getBoundingClientRect();
        const result = {
          centerGap: Math.abs(
            die.left + die.width / 2 - level.left - level.width / 2,
          ),
          edgeGap: Math.abs(die.top - level.bottom),
        };
        animation.play();
        return result;
      });
    expect(collision.centerGap).toBeLessThan(1);
    expect(collision.edgeGap).toBeLessThan(1);
    await page.clock.fastForward(150);
    await expect(arena).toHaveAttribute("data-phase", "impact");
    await expect(page.locator(".impact-shard")).toHaveCount(12);
    await expect(page.getByTestId("target")).toHaveText(
      String(scenario.startLevel),
    );
    await expect(page.locator(".level-target > .level-copy")).toHaveCSS(
      "opacity",
      scenario.won ? "0" : "1",
    );
    await expect(
      page.locator(scenario.won ? ".level-shatter" : ".total-shatter"),
    ).toHaveCount(1);
    await expect(wallet).toBeVisible();
    await expect(wallet).toBeDisabled();
    await page.clock.fastForward(scenario.won ? 100 : 160);
    if (scenario.won) {
      await expect(arena).toHaveAttribute("data-phase", "leveling");
      await expect(page.getByTestId("target")).toHaveText(
        String(scenario.level),
      );
      await page.clock.fastForward(60);
    }
    await expect(arena).toHaveAttribute("data-phase", "reward");
    await expect(page.locator(".earned-reward")).toContainText(
      `+${scenario.total}`,
    );
    const origin = await page.locator(".earned-reward").boundingBox(),
      levelText = await page
        .locator(".level-target > .level-copy")
        .boundingBox();
    expect(
      Math.abs(
        origin!.x + origin!.width / 2 - levelText!.x - levelText!.width / 2,
      ),
    ).toBeLessThan(1);
    expect(
      Math.abs(
        origin!.y + origin!.height / 2 - levelText!.y - levelText!.height / 2,
      ),
    ).toBeLessThan(1);
    await page.clock.fastForward(60);
    await expect(arena).toHaveAttribute("data-phase", "crediting");
    await expect(page.getByTestId("reward-flight")).toBeVisible();
    await expect(wallet).toBeVisible();
    const flight = await page
      .getByTestId("reward-flight")
      .evaluate((element) => {
        const animation = element.getAnimations()[0];
        animation.pause();
        animation.currentTime = 0;
        const start = element.getBoundingClientRect();
        const level = document
          .querySelector(".level-target > .level-copy")!
          .getBoundingClientRect();
        animation.currentTime = Number(animation.effect!.getTiming().duration);
        const end = element.getBoundingClientRect();
        const destination = document
          .querySelector(".wallet")!
          .getBoundingClientRect();
        const gap = (a: DOMRect, b: DOMRect) =>
          Math.hypot(
            a.x + a.width / 2 - b.x - b.width / 2,
            a.y + a.height / 2 - b.y - b.height / 2,
          );
        animation.currentTime = 0;
        animation.play();
        return {
          originGap: gap(start, level),
          destinationGap: gap(end, destination),
          upward: end.y < start.y,
        };
      });
    expect(flight.originGap).toBeLessThan(1);
    expect(flight.destinationGap).toBeLessThan(1);
    expect(flight.upward).toBe(true);
    await page.clock.fastForward(150);
    await expect(arena).toHaveAttribute("data-phase", "collected");
    await expect(
      page.getByRole("button", {
        name: `${scenario.total} Dicecoin`,
        exact: true,
      }),
    ).toBeVisible();
    await page.clock.fastForward(29);
    await expect(
      page.getByRole("button", { name: "Skip animation", exact: true }),
    ).toBeEnabled();
    await page.clock.fastForward(1);
    await expect(arena).toHaveAttribute("data-phase", "idle");
    expect((await page.evaluate(() => performance.now())) - started).toBe(1000);
    expect(
      await page
        .locator(".play-die")
        .evaluateAll((dice) =>
          dice.every((die) => die.getAnimations().length === 0),
        ),
    ).toBe(true);
    await expect(page.getByTestId("roll-total")).toBeEmpty();
    await expect(
      page.locator(".total-flight, .impact-shatter, .reward-flight"),
    ).toHaveCount(0);
    await expect(rollButton(page)).toBeEnabled();
  });
}

for (const [offset, phase] of [
  [0, "rolling"],
  [200, "gathering"],
  [820, "crediting"],
] as const) {
  test(`Skip during ${phase} credits one result and cancels the remaining timeline`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript(() => {
      Math.random = () => 0.99;
    });
    await page.goto("./");
    await rollButton(page).click();
    if (offset) await page.clock.runFor(offset);
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", phase);
    const skip = page.getByRole("button", {
      name: "Skip animation",
      exact: true,
    });
    await expect(skip).toHaveText(/SKIP/);
    await skip.click();
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", "idle");
    await expect(
      page.getByRole("button", { name: "4 Dicecoin", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("target")).toHaveText("2");
    await expect(
      page.locator(".total-flight, .impact-shatter, .reward-flight"),
    ).toHaveCount(0);
    expect(
      await page
        .locator(".play-die")
        .evaluateAll((dice) =>
          dice.every((die) => die.getAnimations().length === 0),
        ),
    ).toBe(true);
    await page.clock.runFor(2000);
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", "idle");
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("master-roller:save")!),
      ),
    ).toMatchObject({ level: 2, balance: 4 });
    await rollButton(page).click();
    await page.clock.runFor(1000);
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", "idle");
    await expect(
      page.getByRole("button", { name: "8 Dicecoin", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("target")).toHaveText("3");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "8 Dicecoin", exact: true }),
    ).toBeEnabled();
  });
}

test("highest-sided result die follows the level after resizing", async ({
  page,
}) => {
  await seed(page, {
    slots: 4,
    inventory: { ...newGame().inventory, d4: 2, d6: 1, d20: 1 },
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await rollButton(page).click();
  await resolveFaces(page);
  await expect(page.getByTestId("roll-total")).toHaveText("34");
  await expect(page.locator(".sum-burst .result-die svg")).toHaveAttribute(
    "data-die-shape",
    "icosahedron",
  );
  const bounds = await page.locator(".sum-burst .result-die").boundingBox(),
    viewport = page.viewportSize()!;
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2),
  ).toBeLessThan(1);
  await page.clock.fastForward(90);
  await expect(page.locator(".arena")).toHaveAttribute(
    "data-phase",
    "targeting",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.clock.fastForward(150);
  await expect(page.locator(".arena")).toHaveAttribute("data-phase", "impact");
  const shards = await page.locator(".level-shatter").boundingBox(),
    target = await page.locator(".level-target > .level-copy").boundingBox();
  expect(shards!.x).toBeCloseTo(target!.x, 0);
  expect(shards!.y).toBeCloseTo(target!.y, 0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("master-roller:save")!).balance,
    ),
  ).toBe(34);
});

for (const phase of ["targeting", "impact", "crediting"] as const) {
  test(`refresh during ${phase} keeps one reward and clears animations`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript(() => {
      Math.random = () => 0.99;
    });
    await page.goto("./");
    await rollButton(page).click();
    await resolveFaces(page);
    await page.clock.fastForward(90);
    if (phase !== "targeting") await page.clock.fastForward(150);
    if (phase === "crediting") {
      await expect(page.locator(".arena")).toHaveAttribute(
        "data-phase",
        "impact",
      );
      await page.clock.fastForward(100);
      await page.clock.fastForward(60);
      await page.clock.fastForward(60);
    }
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", phase);
    await page.reload();
    await expect(page.locator(".arena")).toHaveAttribute("data-phase", "idle");
    await expect(page.getByTestId("target")).toHaveText("2");
    await expect(
      page.getByRole("button", { name: "4 Dicecoin", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("roll-total")).toBeEmpty();
    await expect(
      page.locator(".total-flight, .impact-shatter, .reward-flight"),
    ).toHaveCount(0);
    await page.clock.fastForward(10000);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("master-roller:save")!).balance,
      ),
    ).toBe(4);
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByText("Last roll · 4")).toBeVisible();
  });
}

const legacy = {
  version: 1,
  level: 8,
  balance: 123,
  lastRoll: null,
  inventory: {
    d2: 3,
    d3: 2,
    d4: 1,
    d6: 2,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 0,
    d100: 0,
  },
};
test("legacy migration backs up the save and preserves progress and capacity", async ({
  page,
}) => {
  await page.addInitScript((state) => {
    if (!localStorage.getItem("master-roller:save"))
      localStorage.setItem("master-roller:save", JSON.stringify(state));
  }, legacy);
  await page.goto("./");
  await expect(page.getByText(/Your d2\/d3 became d4/)).toBeVisible();
  const result = await page.evaluate(() => ({
    save: JSON.parse(localStorage.getItem("master-roller:save")!),
    backup: JSON.parse(localStorage.getItem("master-roller:save:v1-backup")!),
  }));
  expect(result.backup).toEqual(legacy);
  expect(result.save).toMatchObject({
    version: 2,
    level: 8,
    balance: 123,
    slots: 8,
    inventory: { d4: 6, d6: 2 },
  });
  expect("d2" in result.save.inventory).toBe(false);
  await page.reload();
  await expect(page.getByText(/Your d2\/d3 became d4/)).toHaveCount(0);
  await section(page, "Dice shop");
  await expect(page.getByText("8 / 8 slots used")).toBeVisible();
});

test("migration backup failure does not overwrite the original save", async ({
  page,
}) => {
  await page.addInitScript((state) => {
    localStorage.setItem("master-roller:save", JSON.stringify(state));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "master-roller:save:v1-backup") throw new Error("quota");
      original.call(this, key, value);
    };
  }, legacy);
  await page.goto("./");
  await expect(page.getByText(/Saving is unavailable/)).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toEqual(legacy);
});
