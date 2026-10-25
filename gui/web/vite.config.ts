import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { imagetools } from "vite-imagetools";
import { defineConfig } from "vitest/config";

// Repetidor de desarrollo (T-630) o servicio local: mismo contrato de lectura.
const OBJETIVO_API = "http://localhost:8787";

const aqui = (ruta: string) => resolve(import.meta.dirname, ruta);

export default defineConfig({
  plugins: [preact(), imagetools()],
  build: {
    target: "es2022",
    rollupOptions: {
      // Tres entradas independientes (D-W01). `operacion/` es de T-660.
      input: {
        portada: aqui("index.html"),
        demeter: aqui("demeter/index.html"),
        hermes: aqui("hermes/index.html"),
      },
      output: {
        // Nombres legibles: la prueba de aislamiento los inspecciona.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    proxy: { "/api": { target: OBJETIVO_API, changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: OBJETIVO_API, changeOrigin: true } },
  },
  test: {
    include: ["pruebas/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
