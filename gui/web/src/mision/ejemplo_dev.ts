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
/** T+ del estado de ejemplo. El `ejemplos.ts` original trae el estado ANTES de sus eventos. */
const T_MAS_EJEMPLO_S = 42;
const EDAD_SIN_SENAL_S = 38;

export async function cargarEjemplo(mision: Mision): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (!params.has("ejemplo")) return;
  const variante = params.get("ejemplo") || "en_vivo";
  const { snapshotEjemplo, snapshotVacioEjemplo } = await import("../contrato/ejemplos");

  const base: Snapshot = variante === "sin_transmision" ? snapshotVacioEjemplo : snapshotEjemplo;
  // Los ejemplos son de Deméter: para Hermes se adaptan la misión y el nodo (y no hay Pi).
  const hermes = mision === "hermes";
  // Los ejemplos del contrato no traen el evento `despegue` y su estado (t_ms 1234567) es anterior
  // a su apogeo (t_ms 1245900). Para ver un T+ coherente se agrega el despegue (el instante que
  // implican sus eventos) y se adelanta el estado. Solo desarrollo; el contrato no se toca.
  const apogeo = base.eventos.find((e) => e.tipo === "apogeo");
  const tDespegueMs =
    apogeo && apogeo.t_mas_s !== null ? apogeo.t_ms - apogeo.t_mas_s * MS_POR_S : null;
  const eventos =
    tDespegueMs === null
      ? base.eventos
      : [
          {
            tipo: "despegue" as const,
            t_ms: tDespegueMs,
            utc_ms: null,
            t_mas_s: 0,
            valor: null,
            fase: null,
            activa: null,
          },
          ...base.eventos,
        ];
  const s: Snapshot = {
    ...base,
    eventos,
    meta: {
      ...base.meta,
      mision,
      nodo: hermes ? 2 : 1,
      modo: variante === "simulacion" ? "simulacion" : base.meta.modo,
    },
    estado: base.estado && {
      ...base.estado,
      t_ms: tDespegueMs === null ? base.estado.t_ms : tDespegueMs + T_MAS_EJEMPLO_S * MS_POR_S,
      secundario: hermes ? null : base.estado.secundario,
    },
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
