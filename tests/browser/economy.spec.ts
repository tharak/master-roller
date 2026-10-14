import { expect, test } from "@playwright/test";

test("economy graphs recalculate drafts without changing game prices or saves", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  const save = await page.evaluate(() =>
    localStorage.getItem("master-roller:save"),
  );
  await page.getByRole("button", { name: "0 Dicecoin", exact: true }).click();
  await page.getByRole("link", { name: "Economy lab", exact: true }).click();
  await expect(page).toHaveURL(/#economy$/);
  await expect(
    page.getByRole("heading", { name: "Economy lab", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Possible values for all seven dice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Probability of each total/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Cumulative earnings and upgrade budgets" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("200 seeded runs · ready");
  const first = page.locator(".upgrade-table tbody tr").first();
  await expect(first.locator("td").nth(0)).toHaveText("120");
  await expect(first.locator("td").nth(2)).toContainText("49");
  await page.getByRole("checkbox", { name: "Log scale" }).check();
  await page.getByLabel("d6 draft price", { exact: true }).fill("0");
  await page.getByLabel("Draft slot price", { exact: true }).fill("0");
  await expect(first.locator("td").nth(0)).toHaveText("0");
  await expect(first.locator("td").nth(2)).toHaveText(/0\s*0–0/);
  await page
    .getByRole("group", { name: "Pool stage" })
    .getByRole("button", { name: "d6", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Probability of each total for a pool through d6",
    }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Inspect level" }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByText("0.0% win chance", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("master-roller:save")),
  ).toBe(save);
  await page.reload();
  await expect(page.getByLabel("d6 draft price", { exact: true })).toHaveValue(
    "0",
  );
  await expect(
    page.getByLabel("Draft slot price", { exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Reset draft prices" }).click();
  await expect(page.getByLabel("d6 draft price", { exact: true })).toHaveValue(
    "70",
  );
  await page.getByRole("link", { name: "Back to game" }).click();
  await page.getByRole("button", { name: "0 Dicecoin", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Buy d6 for 70 Dicecoin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy slot for 50 Dicecoin", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("analysis handles narrow screens and unreachable high-price upgrades", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("./#economy");
  await expect(page.getByRole("status")).toHaveText("200 seeded runs · ready");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Draft slot price", { exact: true }).fill("20000");
  await expect(
    page.locator(".upgrade-table tbody tr").first().locator("td").last(),
  ).toHaveText("0/200");
  await expect(
    page.locator(".upgrade-table tbody tr").first().locator("td").nth(2),
  ).toContainText("—");
  await page
    .getByRole("group", { name: "Pool stage" })
    .getByRole("button", { name: "d100", exact: true })
    .click();
  await expect(page.getByText("7–160", { exact: true })).toBeVisible();
  await expect(page.getByText("83.5", { exact: true })).toBeVisible();
});

test("analysis preserves invalid game saves and tolerates an invalid draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("master-roller:save", "broken");
    localStorage.setItem("master-roller:economy-draft:v1", '{"slot":-2}');
  });
  await page.goto("./#economy");
  await expect(page.getByLabel("d6 draft price", { exact: true })).toHaveValue(
    "70",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("master-roller:save")),
  ).toBe("broken");
  await page.getByRole("link", { name: "Back to game" }).click();
  await expect(
    page.getByRole("dialog", { name: "Recover save" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("master-roller:save")),
  ).toBe("broken");
});
