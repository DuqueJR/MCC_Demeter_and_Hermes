import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// T-614: la página de desarrollo (/dev/) y que no entre al dist/.
// El servidor de desarrollo (puerto 5174) sirve /dev/; el dist/ no la tiene.
const DEV = "http://localhost:5174";

test("/dev/ enlaza todo y cada enlace responde 200", async ({ page, request }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${DEV}/dev/`);
  const hrefs = await page
    .locator("main a[href]")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  for (const esperado of ["/", "/demeter/", "/hermes/", "/dev/tokens.html"]) {
    expect(hrefs).toContain(esperado);
  }
  expect(hrefs.filter((h) => h.endsWith(".jsonl"))).toHaveLength(12);
  for (const href of hrefs) {
    const r = await request.get(`${DEV}${href}`);
    expect(r.status(), href).toBe(200);
  }
  expect(errores).toEqual([]);
  await page.screenshot({ path: "e2e/capturas/dev-1440x900.png", fullPage: true });
});

test("dev/index.html no está en el dist/", () => {
  const dist = resolve(import.meta.dirname, "../dist");
  expect(existsSync(resolve(dist, "index.html"))).toBe(true); // el dist/ existe
  expect(existsSync(resolve(dist, "dev"))).toBe(false);
});
