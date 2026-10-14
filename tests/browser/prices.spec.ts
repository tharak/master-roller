import { expect, test } from "@playwright/test";
import { newGame } from "../../src/game";

test("paid die prices double independently and do not reset after merging or reload", async ({
  page,
}) => {
  await page.addInitScript(
    (state) => {
      if (!localStorage.getItem("master-roller:save"))
        localStorage.setItem("master-roller:save", JSON.stringify(state));
    },
    { ...newGame(), slots: 3, balance: 50 },
  );
  await page.goto("./");
  await page.getByRole("button", { name: "50 Dicecoin", exact: true }).click();
  await page
    .getByRole("button", { name: "Buy d4 for 5 Dicecoin", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Buy d4 for 10 Dicecoin", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Merge d4 and d4 into d8", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buy d4 for 10 Dicecoin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buy d6 for 7 Dicecoin", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "28 Dicecoin", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Buy d4 for 20 Dicecoin", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Buy d6 for 14 Dicecoin", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Buy slot for 12 Dicecoin", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({
    version: 3,
    balance: 28,
    purchases: { d4: 2, d6: 1, d8: 0 },
  });
});

test("rapid repeated purchases charge the new price instead of the previous price", async ({
  page,
}) => {
  await page.addInitScript(
    (state) =>
      localStorage.setItem("master-roller:save", JSON.stringify(state)),
    { ...newGame(), slots: 5, balance: 14 },
  );
  await page.goto("./");
  await page.getByRole("button", { name: "14 Dicecoin", exact: true }).click();
  await page
    .getByRole("button", { name: "Buy d4 for 5 Dicecoin", exact: true })
    .evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.click();
      button.click();
      button.click();
    });
  await expect(
    page.getByRole("button", { name: "Buy d4 for 10 Dicecoin", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("master-roller:save")!),
    ),
  ).toMatchObject({ balance: 9, inventory: { d4: 2 }, purchases: { d4: 1 } });
});

for (const backupFails of [false, true]) {
  test(`version 2 price-count migration ${backupFails ? "preserves the original when backup fails" : "backs up progress and persists inferred prices"}`, async ({
    page,
  }) => {
    const { purchases: _, ...old } = newGame();
    const raw = JSON.stringify({
      ...old,
      version: 2,
      slots: 4,
      balance: 99,
      level: 7,
      inventory: { ...old.inventory, d4: 2, d6: 1 },
    });
    await page.addInitScript(
      ({ raw, backupFails }) => {
        if (!localStorage.getItem("master-roller:save"))
          localStorage.setItem("master-roller:save", raw);
        if (backupFails) {
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === "master-roller:save:v2-backup")
              throw new Error("blocked");
            write.call(this, key, value);
          };
        }
      },
      { raw, backupFails },
    );
    await page.goto("./");
    await expect(page.getByTestId("target")).toHaveText("7");
    if (backupFails) {
      await expect(page.getByText(/Saving is unavailable/)).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("master-roller:save")),
      ).toBe(raw);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("master-roller:save:v2-backup"),
        ),
      ).toBeNull();
    } else {
      await expect(
        page.getByText(/Prices now double with purchases/),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          localStorage.getItem("master-roller:save:v2-backup"),
        ),
      ).toBe(raw);
      await page.reload();
      await expect(
        page.getByText(/Prices now double with purchases/),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "99 Dicecoin", exact: true })
        .click();
      await expect(page.getByText("3 / 4 slots used")).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Buy d4 for 10 Dicecoin",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", {
          name: "Buy d6 for 14 Dicecoin",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", {
          name: "Buy slot for 24 Dicecoin",
          exact: true,
        }),
      ).toBeEnabled();
    }
  });
}

test("unrepresentable exponential prices are unavailable", async ({ page }) => {
  await page.addInitScript(
    (state) =>
      localStorage.setItem("master-roller:save", JSON.stringify(state)),
    {
      ...newGame(),
      slots: 100,
      purchases: { ...newGame().purchases, d4: 100 },
    },
  );
  await page.goto("./");
  await page.getByRole("button", { name: "0 Dicecoin", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "d4 price limit reached", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Slot price limit reached", exact: true }),
  ).toBeDisabled();
});
