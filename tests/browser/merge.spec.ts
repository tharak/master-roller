import { expect, test } from "@playwright/test";
import { newGame, rollGame, type GameState } from "../../src/game";

async function setup(page: import("@playwright/test").Page, state: GameState) {
  await page.addInitScript((state) => {
    if (!localStorage.getItem("master-roller:save"))
      localStorage.setItem("master-roller:save", JSON.stringify(state));
    Math.random = () => 0.99;
  }, state);
  await page.goto("./");
  await page.getByRole("button", { name: /Dicecoin$/ }).click();
}

test("merging after a roll frees space without charge and survives reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = rollGame(
    { ...newGame(), slots: 2, inventory: { ...newGame().inventory, d4: 2 } },
    () => 0.99,
  );
  await setup(page, state);
  await expect(
    page.getByRole("button", { name: "Buy d6 for 7 Dicecoin", exact: true }),
  ).toBeDisabled();
  const merge = page.getByRole("button", {
    name: "Merge d4 and d4 into d8",
    exact: true,
  });
  await expect(merge.locator(".die-value")).toHaveText(["4", "4", "8"]);
  await expect(
    page.getByRole("region", { name: "Merge dice", exact: true }),
  ).toContainText("average income per roll drops by 0.5");
  await merge.evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.click();
    button.click();
    button.click();
  });
  await expect(page.getByText("1 / 2 slots used")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy d6 for 7 Dicecoin", exact: true }),
  ).toBeEnabled();
  await expect(merge).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({
    version: 3,
    balance: 8,
    level: 2,
    slots: 2,
    inventory: { d4: 0, d8: 1 },
    lastRoll: null,
  });
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Recover save" })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("d8 not rolled yet", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("target")).toHaveText("2");
  await page.getByRole("button", { name: "8 Dicecoin", exact: true }).click();
  await page
    .getByRole("button", { name: "Buy d4 for 5 Dicecoin", exact: true })
    .click();
  await expect(page.getByText("2 / 2 slots used")).toBeVisible();
  await page
    .getByRole("button", { name: "Merge d4 and d8 into d12", exact: true })
    .click();
  await expect(page.getByText("1 / 2 slots used")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy slot for 6 Dicecoin", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Close dice shop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Roll your die", exact: true })
    .click();
  await expect(page.getByLabel("d12 rolled 12", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "15 Dicecoin", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("target")).toHaveText("3");
});

test("mixed dice can merge and unavailable sums are not offered", async ({
  page,
}) => {
  await setup(page, {
    ...newGame(),
    slots: 3,
    inventory: { ...newGame().inventory, d6: 1, d100: 1 },
  });
  await expect(page.getByRole("button", { name: /^Merge / })).toHaveCount(1);
  await page
    .getByRole("button", { name: "Merge d4 and d6 into d10", exact: true })
    .click();
  await expect(page.getByText("2 / 3 slots used")).toBeVisible();
  await expect(page.getByText(/No matching pair yet/)).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({
    balance: 0,
    slots: 3,
    inventory: { d4: 0, d6: 0, d10: 1, d100: 1 },
  });
});

test("merge choices fit a narrow shop and cannot be used during a roll", async ({
  page,
}) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page, {
    ...newGame(),
    slots: 14,
    inventory: { d4: 2, d6: 2, d8: 2, d10: 2, d12: 2, d20: 2, d100: 2 },
  });
  await expect(page.getByRole("button", { name: /^Merge / })).toHaveCount(6);
  const button = page.getByRole("button", {
    name: "Merge d10 and d10 into d20",
    exact: true,
  });
  await button.scrollIntoViewIfNeeded();
  const bounds = await button.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Close dice shop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Roll your dice", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "0 Dicecoin", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Merge / })).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("master-roller:save")!).inventory.d4,
    ),
  ).toBe(2);
});
