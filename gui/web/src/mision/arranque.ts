// Arranque de los datos de la página de misión (T-624): conecta el cliente de datos (T-631).
// Es común a las dos misiones; cada entrada solo le dice cuál es la suya (D-W01).
import type { Mision } from "../contrato/tipos";
import { iniciarCliente } from "../datos/cliente";

/**
 * ¿Debe arrancar el cliente? En producción, siempre. En desarrollo, no si la URL lleva `?ejemplo`
 * (los datos de ejemplo escriben en las mismas signals y se pisarían) ni `?sin_cliente` (las
 * pruebas e2e que inyectan su propio snapshot en `datos/api.ts`).
 */
export function debeIniciarCliente(desarrollo: boolean, busqueda: string): boolean {
  if (!desarrollo) return true;
  const params = new URLSearchParams(busqueda);
  return !params.has("ejemplo") && !params.has("sin_cliente");
}

/** Arranca el cliente de datos de `mision`, si corresponde. */
export function arrancarDatos(mision: Mision): void {
  if (debeIniciarCliente(import.meta.env.DEV, location.search)) iniciarCliente({ mision });
}
