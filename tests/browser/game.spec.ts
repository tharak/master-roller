import { expect, test, type Page } from "@playwright/test";

async function section(page: Page, name: "Play" | "Dice shop") {
  if (name === "Dice shop") {
    await page.getByRole("button", { name: "Dice shop", exact: true }).click();
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
  await page.reload();
  await expect(page.getByTestId("target")).toHaveText("3");
  await expect(page.getByLabel("30 Dicecoin", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Your collection" })
      .getByText("×2", { exact: true }),
  ).toBeVisible();
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
  await expect(page.getByText("TRY AGAIN", { exact: true })).toBeVisible();
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
  await expect(
    page
      .getByRole("region", { name: "Your collection" })
      .getByText("10 dice", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("10000 Dicecoin", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Your collection" })
      .getByText("10 dice", { exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "Dice shop", exact: true }),
  ).toBeFocused();
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
  await expect(page.getByText("+44", { exact: true })).toBeVisible();
});
