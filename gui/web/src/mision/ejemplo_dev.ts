// SOLO DESARROLLO: carga los datos de ejemplo cuando la URL lleva `?ejemplo` (T-622).
// Se importa únicamente dentro de `if (import.meta.env.DEV)`, así que el build de producción no lo
// contiene (lo comprueba `buscarEjemplosEnDist` en scripts/aislamiento.mjs).
//
// Variantes: `?ejemplo` o `?ejemplo=en_vivo`, `senal_debil`, `sin_senal`, `sin_transmision`,
// `simulacion` y `reconectando`. El reloj local no avanza: el estado queda fijo para verlo.
import type { Mision, Snapshot } from "../contrato/tipos";
import { alimentar } from "../datos/api";

const MS_POR_S = 1000;
const EDAD_SENAL_DEBIL_S = 3;
const EDAD_SIN_SENAL_S = 38;

export async function cargarEjemplo(mision: Mision): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (!params.has("ejemplo")) return;
  const variante = params.get("ejemplo") || "en_vivo";
  const { snapshotEjemplo, snapshotVacioEjemplo } = await import("../contrato/ejemplos");

  const base: Snapshot = variante === "sin_transmision" ? snapshotVacioEjemplo : snapshotEjemplo;
  // Los ejemplos son de Deméter: para Hermes se adaptan la misión y el nodo (y no hay Pi).
  const hermes = mision === "hermes";
  const s: Snapshot = {
    ...base,
    meta: {
      ...base.meta,
      mision,
      nodo: hermes ? 2 : 1,
      modo: variante === "simulacion" ? "simulacion" : base.meta.modo,
    },
    estado: base.estado && { ...base.estado, secundario: hermes ? null : base.estado.secundario },
    salud: base.salud && { ...base.salud, temp_pi_c: hermes ? null : base.salud.temp_pi_c },
    estacion:
      base.estacion && variante === "senal_debil"
        ? { ...base.estacion, ultimo_paquete_hace_ms: EDAD_SENAL_DEBIL_S * MS_POR_S }
        : base.estacion && variante === "sin_senal"
          ? { ...base.estacion, ultimo_paquete_hace_ms: EDAD_SIN_SENAL_S * MS_POR_S }
          : base.estacion,
  };
  alimentar.snapshot(s, 0);
  alimentar.conexion(variante === "reconectando" ? "reconectando" : "conectado");
}
