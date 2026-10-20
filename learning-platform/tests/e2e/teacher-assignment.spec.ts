import { expect, test } from "@playwright/test";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Preview E2E test.`);
  return value;
}

test("teacher saves, submits, and sees an immutable assignment", async ({ page }) => {
  const email = requiredEnvironment("SMOKE_TEACHER_EMAIL");
  const password = requiredEnvironment("SMOKE_TEACHER_PASSWORD");
  const courseId = requiredEnvironment("SMOKE_COURSE_ID");
  const assignmentId = requiredEnvironment("SMOKE_ASSIGNMENT_ID");

  await page.goto("/");
  await page.getByRole("tab", { name: "Teacher" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // A cold serverless deployment answers the login redirect and the route
  // prefetches in sequence, which can exceed the 5s expect default.
  await page.waitForURL(/\/teacher$/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/teacher$/);

  await page.goto(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
  await expect(page.getByRole("heading", { name: "Twenty-question smoke assignment" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Assignment workflow" })).toBeVisible();
  await page.getByRole("button", { name: /Sources/ }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await page.getByRole("button", { name: /Draft/ }).click();
  await page.getByRole("button", { name: "Edit question 1", exact: true }).click();
  const prompt = page.getByLabel("Prompt").first();
  await prompt.fill(`${await prompt.inputValue()} Review.`);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/Version \d+ · Submitted /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
});
