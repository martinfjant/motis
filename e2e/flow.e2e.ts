import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

// The whole life of a protocol, as a board would go through it, in one
// browser session: sign up, set up the board, hold a meeting, close it,
// have it justerat by email, share it. Then a second meeting that refers
// back to the first, and search. The steps build on each other, so they
// run in order and stop at the first failure.
test.describe.configure({ mode: "serial" });

let page: Page;
let protocolUrl = "";
let secondUrl = "";
let shareUrl = "";

/** Anything the Content-Security-Policy blocked, on any page. */
const blocked: string[] = [];

/** Reports what the policy blocks, as console errors the tests collect. */
async function watchPolicy(target: Page) {
	await target.addInitScript(() =>
		document.addEventListener("securitypolicyviolation", (e) =>
			console.error(
				`CSP: ${e.violatedDirective} blocked ${e.blockedURI || "inline"} ${e.sample}`,
			),
		),
	);
	target.on("console", (m) => {
		if (/^CSP: |Content Security Policy/.test(m.text()))
			blocked.push(`${target.url()}: ${m.text()}`);
	});
}

test.beforeAll(async ({ browser }) => {
	page = await browser.newPage();
	await watchPolicy(page);
});

// Every step: nothing the app needs was blocked by its own policy.
test.afterEach(() => {
	expect(blocked).toEqual([]);
});
test.afterAll(async () => {
	await page.close();
});

/** Opens a page and waits until its scripts have taken over. */
async function open(path: string) {
	await page.goto(path);
	// Typing before that would be wiped when the page comes alive.
	await page.waitForLoadState("networkidle");
}

/** A point of the meeting: a group named by its title. */
const point = (name: string) =>
	page.getByRole("group", { name, exact: true });

/** A point that is dealt with is named "<title> (avklarad)". */
const done = (name: string) =>
	expect(
		page.getByRole("group", { name: `${name} (avklarad)`, exact: true }),
	).toBeVisible();

/** Calls a meeting from the board page and starts it. */
async function startMeeting(
	boardUrl: string,
	title: string,
	at: string,
	/** Done on the agenda before the meeting starts. */
	onAgenda?: () => Promise<void>,
) {
	await open(boardUrl);
	await page.getByRole("button", { name: "Kalla till möte" }).click();
	const dialog = page.getByRole("dialog", { name: "Kalla till möte" });
	await dialog.getByLabel("Rubrik").fill(title);
	await dialog.getByLabel("Datum och tid").fill(at);
	await dialog.getByLabel("Plats").fill("Föreningslokalen");
	await dialog.getByRole("button", { name: "Skapa dagordning" }).click();
	await expect(
		page.getByRole("heading", { name: `Dagordning: ${title}` }),
	).toBeVisible();
	await onAgenda?.();
	await page.getByRole("button", { name: "Starta möte" }).click();
	await expect(
		page.getByRole("heading", { name: `Protokoll: ${title}` }),
	).toBeVisible();
	await page.waitForLoadState("networkidle");
}

let boardUrl = "";

test("signing up and setting up the board", async () => {
	await open("/registrera");
	// Asked for when sign-up is closed (SIGNUP_PASSWORD, see the config).
	const code = page.getByLabel("Lösenord för att skapa konto");
	if (await code.isVisible()) await code.fill("e2e-kod");
	await page.getByLabel("Namn").fill("Test Testsson");
	await page.getByLabel("E-post").fill("test@example.se");
	const password = page.getByLabel("Välj ett lösenord för ditt konto");
	await password.fill("hemligt123");
	// "Visa lösenord" shows what was typed.
	const show = password.locator("xpath=following-sibling::button");
	await expect(show).toHaveAccessibleName("Visa lösenord");
	await show.click();
	await expect(password).toHaveAttribute("type", "text");
	// The browser holds the form back while the two differ.
	await page.getByLabel("Skriv lösenordet igen").fill("hemligt12");
	await page.getByRole("button", { name: "Skapa konto" }).click();
	await expect(page.getByLabel("Skriv lösenordet igen")).toHaveJSProperty(
		"validationMessage",
		"Lösenorden är inte likadana.",
	);
	await page.getByLabel("Skriv lösenordet igen").fill("hemligt123");
	await page.getByRole("button", { name: "Skapa konto" }).click();

	await page.getByRole("button", { name: "Ny styrelse" }).click();
	await page.getByLabel("Föreningens namn").fill("BRF Provhuset");
	await page.getByRole("button", { name: "Skapa styrelse" }).click();
	await expect(
		page.getByRole("heading", { name: "BRF Provhuset", level: 1 }),
	).toBeVisible();
	boardUrl = page.url();

	// Two members without accounts, who will justera by email.
	await page
		.getByRole("link", { name: "Inställningar: mallar och ledamöter" })
		.click();
	for (const [name, email] of [
		["Anna Andersson", "anna@example.se"],
		["Bo Berg", "bo@example.se"],
	]) {
		const add = page.getByRole("region", { name: "Lägg till ledamot" });
		await add.getByLabel(/^Namn/).fill(name);
		await add.getByLabel("E-postadress").fill(email);
		await add.getByRole("button", { name: "Lägg till" }).click();
		await expect(page.getByRole("rowheader", { name })).toBeVisible();
	}

	// The board's logo and a banner picture, shown on its pages.
	for (const [label, saved, color] of [
		["Välj logotyp", "Logotypen är sparad.", "#0f766e"],
		["Välj bild", "Bilden är sparad.", "#7dd3fc"],
	]) {
		const field = page.getByLabel(label);
		await field.setInputFiles({
			name: "bild.png",
			mimeType: "image/png",
			buffer: await sharp({
				create: { width: 600, height: 300, channels: 3, background: color },
			})
				.png()
				.toBuffer(),
		});
		await page
			.locator("form", { has: field })
			.getByRole("button", { name: "Ladda upp" })
			.click();
		await expect(page.getByText(saved)).toBeVisible();
	}
	await open(boardUrl);
	const header = page.locator("main > header").first();
	for (const img of await header.locator("img").all())
		expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
	await expect(header.locator("img")).toHaveCount(2);
});

/** A one-page PDF and a small picture, as attachments. */
async function attachmentFiles() {
	const pdf = await PDFDocument.create();
	pdf.addPage().drawText("Budget 2027");
	const png = await sharp({
		create: { width: 120, height: 80, channels: 3, background: "#b45309" },
	})
		.png()
		.toBuffer();
	return [
		{
			name: "Budget 2027.pdf",
			mimeType: "application/pdf",
			buffer: Buffer.from(await pdf.save()),
		},
		{ name: "Taket.png", mimeType: "image/png", buffer: png },
	];
}

/** The dialog an attachment opens in. */
const viewer = (target: Page, title: string) =>
	target.getByRole("dialog", { name: title });

test("holding the meeting, point by point", async () => {
	await startMeeting(boardUrl, "Styrelsemöte", "2026-11-12T18:00", async () => {
		// Attachments go with the agenda: two on Ekonomi, chosen at once.
		await page.getByRole("button", { name: "Redigera dagordningen" }).click();
		const ekonomi = page
			.getByRole("listitem")
			.filter({ has: page.getByRole("group", { name: "Ekonomi" }) });
		const chooser = page.waitForEvent("filechooser");
		await ekonomi.getByRole("button", { name: "Lägg till bilaga" }).click();
		await (await chooser).setFiles(await attachmentFiles());
		await expect(ekonomi).toContainText("2 bilagor är tillagda.");
		await expect(
			ekonomi.getByRole("button", { name: "Bilaga 2: Taket.png", exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Klar med redigeringen" })
			.first()
			.click();
		// Read on the agenda without leaving it.
		await page
			.getByRole("button", { name: "Bilaga 1: Budget 2027.pdf", exact: true })
			.click();
		const dialog = viewer(page, "Bilaga 1: Budget 2027.pdf");
		await expect(dialog.locator("iframe")).toBeVisible();
		await dialog.getByRole("button", { name: "Stäng" }).click();
		await expect(dialog).toBeHidden();
	});
	protocolUrl = page.url();

	await point("Mötets öppnande")
		.getByRole("button", { name: /^Öppna mötet/ })
		.click();
	await done("Mötets öppnande");

	const attendance = point("Närvarande ledamöter");
	for (const name of ["Anna Andersson", "Bo Berg", "Test Testsson"])
		await attendance.getByRole("checkbox", { name }).check();
	await attendance.getByRole("button", { name: "Klar" }).click();
	await done("Närvarande ledamöter");

	for (const title of ["Val av ordförande", "Val av sekreterare"]) {
		await point(title).getByLabel("Mötet väljer").selectOption("Test Testsson");
		await done(title);
	}

	// The secretary can't justera; the two others do.
	const reviewers = point("Val av justerare");
	await expect(
		reviewers.getByRole("option", { name: "Test Testsson – sekreterare" }),
	).toHaveCount(2);
	await reviewers.getByLabel("Justerare 1").selectOption("Anna Andersson");
	await reviewers
		.getByLabel("Justerare 2 (om ni har två)")
		.selectOption("Bo Berg");
	await reviewers.getByRole("button", { name: "Klar" }).click();
	await done("Val av justerare");

	// Ja/nej: the round marker is drawn over the radio button, so click the
	// text, as people do.
	await point("Godkännande av dagordning")
		.getByText("Dagordningen godkändes.", { exact: true })
		.click();
	await done("Godkännande av dagordning");
	await point("Föregående protokoll")
		.getByText("Föregående protokoll lades till handlingarna.", {
			exact: true,
		})
		.click();
	await done("Föregående protokoll");

	// Notes, with a calculation: "=12*1500" offers the result.
	const economy = point("Ekonomi");
	const notes = economy.getByLabel("Anteckningar");
	await notes.pressSequentially("Avgifterna ger =12*1500");
	await expect(
		page.getByRole("option", { name: "18000", exact: true }),
	).toBeVisible();
	await notes.press("Enter");
	await notes.pressSequentially("kr per år. Se #bud");
	// The meeting's attachments came along from the agenda; # offers them.
	await expect(
		page.getByRole("option", { name: "Bilaga 1: Budget 2027.pdf" }),
	).toBeVisible();
	await notes.press("Enter");
	await expect(notes).toHaveValue(
		"Avgifterna ger 18000 kr per år. Se Bilaga 1 ",
	);
	await economy.getByRole("button", { name: "Klar" }).click();
	await done("Ekonomi");
	// The reference opens the attachment.
	await point("Ekonomi (avklarad)")
		.getByRole("button", { name: "Bilaga 1", exact: true })
		.click();
	await expect(
		viewer(page, "Bilaga 1: Budget 2027.pdf").locator("iframe"),
	).toBeVisible();
	await page.keyboard.press("Escape");

	await point("Driftsfrågor")
		.getByLabel("Anteckningar")
		.fill("Hissen ska besiktigas i mars.");
	await point("Driftsfrågor").getByRole("button", { name: "Klar" }).click();
	await done("Driftsfrågor");

	await point("Övriga frågor").getByRole("button", { name: "Klar" }).click();
	await done("Övriga frågor");

	await point("Nästa möte").getByLabel("Datum och tid").fill("2027-02-10T18:00");
	await point("Nästa möte").getByRole("button", { name: "Klar" }).click();
	await done("Nästa möte");

	// Closing the meeting closes the protocol, which is then read-only.
	await point("Mötets avslutande")
		.getByRole("button", { name: /^Avsluta mötet/ })
		.click();
	await expect(
		page.getByRole("button", { name: "Redigera protokollet" }),
	).toBeVisible();
	const agenda = page.getByRole("region", { name: "Dagordning" });
	await expect(agenda).toContainText("Avgifterna ger 18000 kr per år.");
	await expect(agenda).toContainText("Mötet avslutades");
});

test("justering by email, with drawn signatures", async () => {
	await page.getByRole("button", { name: "Skicka för justering" }).click();
	await expect(page.getByRole("region", { name: "Justering" })).toContainText(
		"Väntar på justering.",
	);

	// In development, mail goes to the outbox; each justerare has a link.
	await open("/utkorg");
	const linkFor = async (address: string) => {
		const mail = page
			.getByRole("region", { name: /^Justera protokollet/ })
			.filter({ hasText: address });
		const text = (await mail.textContent()) ?? "";
		const link = text.match(/http:\/\/localhost:\d+\/justera\/[\w-]+/)?.[0];
		expect(link, `the email to ${address} has a link`).toBeTruthy();
		return link as string;
	};
	const links = [
		await linkFor("anna@example.se"),
		await linkFor("bo@example.se"),
	];

	for (const link of links) {
		await open(link);
		await expect(page.getByRole("region", { name: "Dagordning" })).toContainText(
			"Hissen ska besiktigas i mars.",
		);
		await page.getByRole("button", { name: "Godkänn och signera…" }).click();
		await sign();
		await page
			.getByRole("button", { name: "Godkänn och signera", exact: true })
			.click();
		await expect(
			page.getByText(/^Du godkände protokollet .* Tack!$/),
		).toBeVisible();
	}

	await open(protocolUrl);
	const justering = page.getByRole("region", { name: "Justering" });
	await expect(justering).toContainText("Protokollet är justerat.");
	await expect(
		justering.getByRole("img", { name: "Signatur: Anna Andersson" }),
	).toBeVisible();
	await expect(
		justering.getByRole("img", { name: "Signatur: Bo Berg" }),
	).toBeVisible();
	shareUrl =
		(await page
			.getByRole("link", { name: "Visa det delade protokollet" })
			.getAttribute("href")) ?? "";
});

/** Draws a zigzag in the signature field. */
async function sign() {
	const box = await page.locator("canvas").boundingBox();
	if (!box) throw new Error("No signature field.");
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + 20, y);
	await page.mouse.down();
	for (let x = 40; x < Math.min(box.width - 20, 300); x += 20)
		await page.mouse.move(box.x + x, y + (x % 40 === 0 ? -15 : 15));
	await page.mouse.up();
}

test("the shared protocol and the PDF, without logging in", async ({
	browser,
}) => {
	expect(shareUrl).toMatch(/^\/protokoll\//);
	const visitor = await browser.newPage();
	await visitor.goto(shareUrl);
	await expect(
		visitor.getByRole("heading", { name: /Styrelsemöte/, level: 1 }),
	).toBeVisible();
	await expect(visitor.getByText("Avgifterna ger 18000 kr per år.")).toBeVisible();
	await expect(
		visitor.getByRole("img", { name: "Signatur: Bo Berg" }),
	).toBeVisible();
	// The attachments open through the share link too.
	await visitor
		.getByRole("button", { name: "Bilaga 2: Taket.png", exact: true })
		.click();
	const picture = viewer(visitor, "Bilaga 2: Taket.png").getByRole("img");
	await expect(picture).toBeVisible();
	expect(
		await picture.evaluate((img: HTMLImageElement) => img.naturalWidth),
	).toBe(120);
	await visitor.close();

	// The PDF has the attachments after the protocol: the budget's page and
	// a page for the picture.
	const id = protocolUrl.split("/").pop();
	const pages = async (path: string) => {
		const response = await page.request.get(path);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toContain("application/pdf");
		return (await PDFDocument.load(await response.body())).getPageCount();
	};
	expect(await pages(`/api/protokoll/${id}/pdf`)).toBe(
		(await pages(`/api/protokoll/${id}/pdf?bilagor=nej`)) + 2,
	);
});

test("a second meeting refers back to the first with #", async () => {
	await startMeeting(boardUrl, "Extramöte", "2026-11-26T18:00");
	secondUrl = page.url();
	const notes = point("Ekonomi").getByLabel("Anteckningar");
	await notes.pressSequentially("Se #Styrelse");
	const option = page.getByRole("option", { name: "Styrelsemöte, 12-11-2026" });
	await expect(option).toBeVisible();
	await notes.press("Enter");
	await expect(notes).toHaveValue("Se #Styrelsemöte 12-11-2026 ");
	await point("Ekonomi").getByRole("button", { name: "Klar" }).click();
	await done("Ekonomi");

	// Shown as a link to the first meeting, which lists the reference.
	await point("Ekonomi (avklarad)")
		.getByRole("link", { name: "#Styrelsemöte 12-11-2026" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Protokoll: Styrelsemöte" }),
	).toBeVisible();
	await expect(
		page
			.getByRole("region", { name: "Hänvisningar" })
			.getByRole("link", { name: "Extramöte" }),
	).toBeVisible();
});

test("unsaved notes come back after a reload", async () => {
	const text = "Tvättstugan behöver nya maskiner.";
	await open(secondUrl);
	await point("Driftsfrågor").getByLabel("Anteckningar").fill(text);
	// Loading the page anew, as after a crash or a lost connection.
	await open(secondUrl);
	await expect(point("Driftsfrågor").getByLabel("Anteckningar")).toHaveValue(
		text,
	);
	await expect(point("Driftsfrågor")).toContainText(
		"Texten är återställd från ett utkast som inte hann sparas",
	);
	await point("Driftsfrågor")
		.getByRole("button", { name: "Släng utkastet" })
		.click();
	await expect(point("Driftsfrågor").getByLabel("Anteckningar")).toHaveValue("");
});

test("one tab writes the ongoing meeting, another follows and takes over", async ({
	browser,
}) => {
	await open(secondUrl);
	// Someone else on the board (here the same account, on another device).
	const otherDevice = await browser.newContext({
		storageState: await page.context().storageState(),
	});
	const other = await otherDevice.newPage();
	await watchPolicy(other);
	await other.goto(secondUrl);
	const following = other.getByRole("complementary", {
		name: "Pågående möte",
	});
	await expect(following).toContainText("Test Testsson skriver protokollet.");
	await expect(other.getByLabel("Anteckningar")).toHaveCount(0);

	// What is written shows up there without reloading.
	const notes = point("Driftsfrågor").getByLabel("Anteckningar");
	await notes.fill("Hissen fungerar igen.");
	await point("Driftsfrågor").getByRole("button", { name: "Klar" }).click();
	await done("Driftsfrågor");
	await expect(other.getByText("Hissen fungerar igen.")).toBeVisible();

	// Taking over: the first tab follows instead, and is told why.
	await following.getByRole("button", { name: "Ta över protokollet" }).click();
	await other
		.getByRole("alertdialog", { name: "Ta över protokollet?" })
		.getByRole("button", { name: "Ta över" })
		.click();
	await expect(following).toHaveCount(0);
	await expect(
		other.getByRole("group", { name: "Driftsfrågor (avklarad)" }),
	).toBeVisible();
	const taken = page.getByRole("complementary", { name: "Pågående möte" });
	await expect(taken).toContainText("Test Testsson tog över protokollet.");
	await expect(page.getByLabel("Anteckningar")).toHaveCount(0);

	// And back again.
	await taken.getByRole("button", { name: "Ta över protokollet" }).click();
	await page
		.getByRole("alertdialog", { name: "Ta över protokollet?" })
		.getByRole("button", { name: "Ta över" })
		.click();
	await expect(taken).toHaveCount(0);
	await expect(
		other.getByRole("complementary", { name: "Pågående möte" }),
	).toBeVisible();
	await otherDevice.close();
});

test("searching the protocols", async () => {
	const search = page.getByRole("search").getByLabel("Sök i protokollen");
	await search.fill("hissen mars");
	await search.press("Enter");
	await expect(page).toHaveURL(/\/sok\?q=hissen/);
	const result = page.getByRole("region", { name: /^Styrelsemöte/ });
	await expect(result).toContainText("Driftsfrågor");
	await expect(result.locator("mark").first()).toHaveText("Hissen");
	await expect(page.getByRole("region", { name: /^Extramöte/ })).toHaveCount(0);
});
