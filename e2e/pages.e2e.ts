import { expect, test } from "@playwright/test";

// The static pages from content/sidor/: reachable from the footer, linked
// to each other, and an address that is no page gets a real 404.

test("the footer leads to the static pages, and they link onwards", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const footer = page.getByRole("navigation", { name: "Om Mötis" });
	await footer.getByRole("link", { name: "Integritetspolicy" }).click();
	await expect(page).toHaveURL(/\/integritet$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Integritetspolicy" }),
	).toBeVisible();
	await expect(page).toHaveTitle("Integritetspolicy – Mötis");
	await expect(
		page.getByRole("heading", { level: 2, name: "Dina rättigheter" }),
	).toBeVisible();

	await footer.getByRole("link", { name: "Hjälp" }).click();
	await page
		.getByRole("main")
		.getByRole("link", { name: "Från kallelse till justerat protokoll" })
		.click();
	await expect(page).toHaveURL(/\/hjalp\/moten$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Från kallelse till justerat protokoll",
		}),
	).toBeVisible();
});

test("an address that is no page is a 404", async ({ page }) => {
	const response = await page.goto("/hjalp/finns-inte");
	expect(response?.status()).toBe(404);
	await expect(
		page.getByRole("heading", { level: 1, name: "Sidan finns inte" }),
	).toBeVisible();
});
