// Ayudas de las pruebas e2e (T-624). No es una prueba (no termina en .spec.ts).
// Desde T-624 las páginas de producción arrancan el cliente de datos y piden `/api/...`. Las pruebas
// que miran la página "sin datos" dejan esas peticiones colgadas (ni respuesta ni error): la página
// se queda en "Cargando", sin errores de consola y sin depender de que haya un servidor.
import type { Page } from "@playwright/test";

export async function apiColgada(page: Page): Promise<void> {
  await page.route("**/api/**", () => {});
}

/**
 * Espera a que la página termine de pintar (dos cuadros). Reemplaza a `networkidle`, que nunca llega
 * con una petición colgada o un stream SSE abierto.
 */
export async function esperarPintado(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolver) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolver())),
      ),
  );
}
