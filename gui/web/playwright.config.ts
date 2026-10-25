import { defineConfig } from "@playwright/test";

const PUERTO = 4173;
const PUERTO_DEV = 5174;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PUERTO}` },
  // Sirve el dist/ ya construido (npm run e2e lo construye antes).
  webServer: [
    {
      command: `npx vite preview --port ${PUERTO} --strictPort`,
      url: `http://localhost:${PUERTO}`,
      reuseExistingServer: !process.env.CI,
    },
    // Solo para dev/tokens.html (T-613), que no existe en el dist/.
    {
      command: `npx vite --port ${PUERTO_DEV} --strictPort`,
      url: `http://localhost:${PUERTO_DEV}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
