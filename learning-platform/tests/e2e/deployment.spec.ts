import { expect, test } from "@playwright/test";

test("deployment serves a healthy database and the sign-in page", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toEqual({ status: "ok" });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("tab", { name: "Teacher" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
