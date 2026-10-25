// Isolated CI smoke checks: user actions, error handling and screenshots.
// This never connects to an actual home or changes real devices.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.NEXUS_PLAYWRIGHT));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("product/qa", { recursive: true });
try {
  await page.goto("http://127.0.0.1:4173/");
  await page
    .getByRole("heading", { name: "Casa Aurora", exact: true })
    .waitFor();
  const light = page.getByRole("switch", { name: "Luz da sala", exact: true });
  assert.equal(await light.getAttribute("aria-checked"), "true");
  await light.click();
  await page.waitForFunction(
    () =>
      document.querySelector("nexus-panel").hass.states["light.living"]
        .state === "off"
  );
  await page.screenshot({ path: "product/qa/home-en.png", fullPage: true });
  await page.locator('[data-page="settings"]').click();
  await page.locator('select[name="language"]').selectOption("es");
  await page.locator("#preferences-form button").click();
  await page.getByRole("heading", { name: "Ajustes", exact: true }).waitFor();
  await page.screenshot({ path: "product/qa/settings-es.png", fullPage: true });
  await page.goto("http://127.0.0.1:4173/?setup&lang=pt");
  await page
    .getByRole("heading", { name: "Uma casa do seu jeito.", exact: true })
    .waitFor();
  await page.locator("#initial-language").selectOption("es");
  await page
    .getByRole("button", { name: "Configurar Nexus", exact: true })
    .click();
  await page.getByRole("heading", { name: "Tu cuenta", exact: true }).waitFor();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#home-name").fill("Casa Nexus");
  await page.locator("#home-form button").click();
  await page
    .getByRole("heading", { name: "Tu conexión", exact: true })
    .waitFor();
  await page
    .getByRole("button", {
      name: "Continuar con la conexión actual",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Abrir mi hogar", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Casa Nexus", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.querySelector("nexus-panel").preferences.language
    ),
    "es"
  );
  await page.setViewportSize({ width: 800, height: 480 });
  await page.goto("http://127.0.0.1:4173/?lang=pt");
  await page
    .getByRole("heading", { name: "Casa Aurora", exact: true })
    .waitFor();
  await page.screenshot({
    path: "product/qa/touch-800x480-pt.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:4173/?action-fail");
  await page
    .getByRole("heading", { name: "Casa Aurora", exact: true })
    .waitFor();
  await page.getByRole("switch", { name: "Luz da sala", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("switch", { name: "Luz da sala", exact: true })
      .getAttribute("aria-checked"),
    "true"
  );
  await page.goto("http://127.0.0.1:4173/?nonadmin");
  await page
    .getByRole("heading", { name: "Casa Aurora", exact: true })
    .waitFor();
  await page.locator('[data-page="settings"]').click();
  assert.equal(
    await page
      .getByRole("heading", { name: "Home administration", exact: true })
      .count(),
    0
  );
  assert.deepEqual(errors, []);
  process.stdout.write(
    "UI smoke passed: control, errors, language, setup, non-admin, touch viewport.\n"
  );
} catch (error) {
  await page.screenshot({ path: "product/qa/failure.png", fullPage: true });
  process.stderr.write(`Browser errors: ${JSON.stringify(errors)}\n`);
  throw error;
} finally {
  await browser.close();
}
