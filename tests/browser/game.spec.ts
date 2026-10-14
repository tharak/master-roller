import { expect, test, type Page } from "@playwright/test";

async function section(page: Page, name: "Play" | "Dice shop") {
  if (name === "Dice shop") {
    await page.getByRole("button", { name: /Dicecoin$/ }).click();
  } else if (await page.getByRole("dialog").isVisible()) {
    await page
      .getByRole("button", { name: "Close dice shop", exact: true })
      .click();
  }
}
test("starting journey, purchases, reload, and confirmed reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(page.getByTestId("target")).toHaveText("1");
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
  await section(page, "Dice shop");
  await expect(
    page.getByRole("button", { name: "Buy d2 for 10 Dicecoin", exact: true }),
  ).toBeDisabled();
  await section(page, "Play");
  await page
    .getByRole("button", { name: "Roll your die", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Rolling…" })).toBeDisabled();
  await expect(page.getByTestId("target")).toHaveText("2");
  await expect(page.getByLabel("20 Dicecoin", { exact: true })).toBeVisible();
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy d2 for 10 Dicecoin", exact: true })
    .click();
  await expect(page.getByLabel("10 Dicecoin", { exact: true })).toBeVisible();
  await section(page, "Play");
  await page
    .getByRole("button", { name: "Roll your dice", exact: true })
    .click();
  await expect(page.getByTestId("target")).toHaveText("3");
  await expect(page.getByLabel("30 Dicecoin", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Roll arena" }),
  ).toHaveAttribute("data-phase", "idle");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await page.reload();
  await expect(page.getByTestId("target")).toHaveText("3");
  await expect(page.getByLabel("30 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await expect(page.locator(".sum-burst")).toHaveCSS("opacity", "0");
  await expect(
    page
      .getByRole("region", { name: "Your collection" })
      .getByLabel("d2 rolled 1", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Reset progress", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByTestId("target")).toHaveText("3");
  await page
    .getByRole("button", { name: "Reset progress", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset progress" })
    .click();
  await expect(page.getByTestId("target")).toHaveText("1");
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("losing roll earns a d2; rapid taps cannot double resolve", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("./");
  // Dispatch multiple taps in one turn to exercise the lock before React re-renders.
  await page
    .getByRole("button", { name: "Roll your die", exact: true })
    .evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
      button.click();
    });
  await expect(page.getByTestId("roll-total")).toHaveText("0");
  await expect(page.getByLabel("10 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByTestId("target")).toHaveText("1");
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy d2 for 10 Dicecoin", exact: true })
    .click();
  await expect(page.getByLabel("0 Dicecoin", { exact: true })).toBeVisible();
});
test("all test offers grant rewards and are clearly simulated", async ({
  page,
}) => {
  await page.goto("./");
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Test purchases", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/No charge, no payment details/)).toBeVisible();
  await dialog.getByRole("button", { name: /THE BIG COIN PACK/ }).click();
  await expect(
    page.getByLabel("10000 Dicecoin", { exact: true }),
  ).toBeVisible();
  for (const die of [
    "d2",
    "d3",
    "d4",
    "d6",
    "d8",
    "d10",
    "d12",
    "d20",
    "d100",
  ]) {
    await dialog
      .getByRole("button", { name: `Simulate purchase of ${die}`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Close test purchases" }).click();
  await section(page, "Play");
  const shapes = await page
    .getByRole("region", { name: "Your collection" })
    .locator("svg[data-die-shape]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-die-shape")),
    );
  expect(new Set(shapes).size).toBe(9);
  expect(shapes).toContain("coin");
  expect(shapes).toContain("pyramid");
  await expect(
    page.getByRole("region", { name: "Your collection" }),
  ).toHaveAttribute("aria-description", "10 dice");
  await page.reload();
  await expect(
    page.getByLabel("10000 Dicecoin", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your collection" }),
  ).toHaveAttribute("aria-description", "10 dice");
});
test("invalid save offers recovery without silently overwriting it", async ({
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
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("master-roller:save")))!,
    ),
  ).toMatchObject({ version: 1, level: 1, balance: 0 });
});
test("storage failure is visible and play remains available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(page.getByText(/Saving is unavailable/)).toBeVisible();
  await page
    .getByRole("button", { name: "Roll your die", exact: true })
    .click();
  await expect(page.getByTestId("target")).toHaveText("2");
});
test("fits narrow screens, keyboard controls work, and reduced motion resolves rolls", async ({
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
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const roll = page.getByRole("button", { name: "Roll your die", exact: true });
  await roll.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("target")).toHaveText("2");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await expect(page.locator(".arena [role=status]")).toContainText(
    "Total 1. Level cleared. Earned 20 Dicecoin.",
  );
  await section(page, "Dice shop");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Test purchases", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Dicecoin$/ })).toBeFocused();
});

test("dice are on the main screen and show each rolled face", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  const dice = page.getByRole("region", { name: "Your collection" });
  await expect(page.locator(".level-label")).toHaveCSS("font-size", "11px");
  await expect(page.locator(".target-value")).toHaveCSS("font-size", "11px");
  const labelBounds = await page.locator(".level-label").boundingBox();
  const levelBounds = await page.getByTestId("target").boundingBox();
  expect(Math.abs(labelBounds!.y - levelBounds!.y)).toBeLessThan(2);
  await expect(
    page.locator(".dice-count, .result-area, .ready-label, .toast"),
  ).toHaveCount(0);
  await expect(dice.locator("svg[data-die-shape=coin]")).toBeVisible();
  await expect(
    dice.getByLabel("d2 not rolled yet", { exact: true }),
  ).toBeVisible();
  const roll = page.getByRole("button", { name: "Roll your die", exact: true });
  const bounds = await roll.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await roll.click();
  await expect(dice.getByLabel("d2 rolled 1", { exact: true })).toBeVisible();
  await section(page, "Dice shop");
  await page
    .getByRole("button", { name: "Buy d2 for 10 Dicecoin", exact: true })
    .click();
  await section(page, "Play");
  await expect(
    dice.getByLabel("d2 not rolled yet", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Roll your dice", exact: true })
    .click();
  await expect(dice.getByLabel("d2 rolled 1", { exact: true })).toHaveCount(2);
  await expect(page.getByTestId("roll-total")).toHaveText("2");
  await expect(
    page.getByRole("region", { name: "Roll arena" }),
  ).toHaveAttribute("data-phase", "idle");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await expect(page.locator(".sum-burst")).toHaveCSS("opacity", "0");
});

test("pool fills the viewport, resizes dense dice, and keeps overlays usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "master-roller:save",
      JSON.stringify({
        version: 1,
        level: 1,
        balance: 100,
        lastRoll: null,
        inventory: {
          d2: 6,
          d3: 6,
          d4: 6,
          d6: 6,
          d8: 6,
          d10: 6,
          d12: 6,
          d20: 6,
          d100: 6,
        },
      }),
    );
  });
  await page.goto("./");
  await expect(page.locator(".play-die")).toHaveCount(54);
  // Wait for entry animations before measuring the settled dice.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () =>
        page.getByRole("region", { name: "Your collection" }).boundingBox(),
      )
      .toEqual({ x: 0, y: 0, ...viewport });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const bounds = Array.from(
            document.querySelectorAll(".play-die"),
            (die) => die.getBoundingClientRect(),
          );
          const level = document
            .querySelector(".level-target")!
            .getBoundingClientRect();
          const controls = document
            .querySelector(".controls")!
            .getBoundingClientRect();
          const shell = document
            .querySelector(".game-shell")!
            .getBoundingClientRect();
          return bounds.every(
            (die) =>
              die.left >= shell.left &&
              die.right <= shell.right &&
              die.top >= level.bottom &&
              die.bottom <= controls.top,
          );
        }),
      )
      .toBe(true);
    const spread = await page.locator(".play-die").evaluateAll((dice) => {
      const bounds = dice.map((die) => die.getBoundingClientRect());
      return {
        width:
          Math.max(...bounds.map((die) => die.right)) -
          Math.min(...bounds.map((die) => die.left)),
        height:
          Math.max(...bounds.map((die) => die.bottom)) -
          Math.min(...bounds.map((die) => die.top)),
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
    const rollBounds = await page.locator(".roll-button").boundingBox();
    expect(rollBounds!.width).toBeCloseTo(Math.min(480, viewport.width - 32));
    await section(page, "Dice shop");
    await expect(page.getByRole("dialog", { name: "Dice shop" })).toBeVisible();
    await section(page, "Play");
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(
      page.getByRole("dialog", { name: "How to play" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Reset progress", exact: true })
      .click();
    await page.getByRole("button", { name: "Keep playing" }).click();
  }
  await page
    .getByRole("button", { name: "Roll your dice", exact: true })
    .click();
  await expect(page.getByLabel("120 Dicecoin", { exact: true })).toBeVisible();
  await expect(page.getByTestId("roll-total")).toBeEmpty();
});

test("large collections still roll every die and expose all die types", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "master-roller:save",
      JSON.stringify({
        version: 1,
        level: 1,
        balance: 0,
        lastRoll: null,
        inventory: {
          d2: 50,
          d3: 0,
          d4: 0,
          d6: 0,
          d8: 0,
          d10: 0,
          d12: 0,
          d20: 0,
          d100: 1,
        },
      }),
    );
    Math.random = () => 0.99;
  });
  await page.goto("./");
  await expect(
    page.getByLabel("d100 not rolled yet", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Roll your dice", exact: true })
    .click();
  await expect(page.getByTestId("roll-total")).toHaveText("150");
  await expect(
    page.getByLabel("d100 rolled 100", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your collection" }),
  ).toHaveAttribute("aria-description", "51 dice");
});

for (const scenario of [
  { name: "win", random: 0.99, earned: 20, total: 1, level: 2 },
  { name: "loss", random: 0, earned: 10, total: 0, level: 1 },
]) {
  test(`${scenario.name}: dice gather before the sum and coins credit only on arrival`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.addInitScript((value) => {
      Math.random = () => value;
    }, scenario.random);
    await page.goto("./");
    const arena = page.getByRole("region", { name: "Roll arena" });
    const wallet = page.getByRole("button", {
      name: "0 Dicecoin",
      exact: true,
    });
    await expect(page.locator(".target-value")).toHaveText("1");
    await expect(page.locator(".controls button")).toHaveCount(1);
    await wallet.click();
    await expect(page.getByRole("dialog", { name: "Dice shop" })).toBeVisible();
    await section(page, "Play");
    await page
      .getByRole("button", { name: "Roll your die", exact: true })
      .click();
    await page.clock.fastForward(550);
    await expect(arena).toHaveAttribute("data-phase", "faces");
    await expect(
      page.getByLabel(`d2 rolled ${scenario.total}`, { exact: true }),
    ).toBeVisible();
    await expect(wallet).toBeDisabled();
    await expect(page.getByTestId("target")).toHaveText("1");
    // Complete state is durable during the visual sequence, but the visible money is withheld.
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("master-roller:save")!).balance,
      ),
    ).toBe(scenario.earned);
    await page.clock.fastForward(280);
    await expect(arena).toHaveAttribute("data-phase", "gathering");
    expect(
      await page
        .locator(".play-die")
        .evaluateAll((dice) =>
          dice.every((die) => die.getAnimations().length > 0),
        ),
    ).toBe(true);
    await expect(arena).toHaveAttribute("data-phase", "total");
    await expect(page.locator(".play-die").first()).toHaveCSS("opacity", "0");
    await expect(page.locator(".sum-burst")).toHaveCSS("opacity", "1");
    await expect(page.locator(".sum-burst strong")).toHaveText(
      String(scenario.total),
    );
    await expect(wallet).toBeVisible();
    await page.clock.fastForward(350);
    await expect(arena).toHaveAttribute("data-phase", "reward");
    await expect(page.locator(".earned-reward")).toContainText(
      `+${scenario.earned}`,
    );
    await page.clock.fastForward(500);
    await expect(arena).toHaveAttribute("data-phase", "crediting");
    await expect(page.getByTestId("reward-flight")).toBeVisible();
    await expect(wallet).toBeVisible();
    await expect(arena).toHaveAttribute("data-phase", "collected");
    await expect(
      page.getByRole("button", {
        name: `${scenario.earned} Dicecoin`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("target")).toHaveText(String(scenario.level));
    await expect(page.getByTestId("reward-flight")).toHaveCount(0);
    await page.clock.fastForward(220);
    await expect(arena).toHaveAttribute("data-phase", "idle");
    await expect(page.getByTestId("roll-total")).toBeEmpty();
    await expect(page.locator(".sum-burst")).toHaveCSS("opacity", "0");
    await expect(
      page.getByLabel(`d2 rolled ${scenario.total}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Roll your die", exact: true }),
    ).toBeEnabled();
  });
}

test("refresh during the reward flight preserves exactly one reward", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto("./");
  const arena = page.getByRole("region", { name: "Roll arena" });
  await page
    .getByRole("button", { name: "Roll your die", exact: true })
    .click();
  await page.clock.fastForward(550);
  await expect(arena).toHaveAttribute("data-phase", "faces");
  await page.clock.fastForward(280);
  await expect(arena).toHaveAttribute("data-phase", "total");
  await page.clock.fastForward(350);
  await page.clock.fastForward(500);
  await expect(arena).toHaveAttribute("data-phase", "crediting");
  await expect(
    page.getByRole("button", { name: "0 Dicecoin", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "20 Dicecoin", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("target")).toHaveText("2");
  await expect(arena).toHaveAttribute("data-phase", "idle");
  await expect(page.getByTestId("roll-total")).toBeEmpty();
  await expect(page.locator(".sum-burst")).toHaveCSS("opacity", "0");
  await page.clock.fastForward(10000);
  await expect(
    page.getByRole("button", { name: "20 Dicecoin", exact: true }),
  ).toBeVisible();
});
