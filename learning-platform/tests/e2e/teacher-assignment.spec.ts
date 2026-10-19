import { expect, test } from "@playwright/test";

test("teacher saves, submits, and sees an immutable assignment", async ({ page }) => {
  const email = process.env.SMOKE_TEACHER_EMAIL;
  const password = process.env.SMOKE_TEACHER_PASSWORD;
  const courseId = process.env.SMOKE_COURSE_ID;
  const assignmentId = process.env.SMOKE_ASSIGNMENT_ID;
  test.skip(!email || !password || !courseId || !assignmentId, "Cloud smoke credentials and resource IDs are required.");

  await page.goto("/");
  await page.getByRole("tab", { name: "Teacher" }).click();
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await page.goto(`/teacher/courses/${courseId}/assignments/${assignmentId}`);
  await expect(page.getByRole("heading", { name: "Twenty-question smoke assignment" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Assignment workflow" })).toBeVisible();
  await page.getByRole("button", { name: /Sources/ }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await page.getByRole("button", { name: /Draft/ }).click();
  const prompt = page.getByLabel("Prompt").first();
  await prompt.fill(`${await prompt.inputValue()} Review.`);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("SUBMITTED", { exact: true })).toBeVisible();
  await expect(prompt).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});
