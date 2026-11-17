// Lógica de la sección de la Raspberry Pi (solo Deméter; T-659, D-065). Funciones puras, sin Preact: de
// `salud.pi`, `salud.temp_pi_c` y `estado.act.cam_ok` sacan lo que se muestra.
//
// Los nombres de `salud.pi.estado` son los del `StatusCode` de `visionpack/demeter_protocol.py` (más
// "DESCONOCIDO" cuando la Pi lleva más de 3 s sin latido) y los de `motivo`, los del `ErrorCode`.
// Los textos en español son (P): `visionpack_integracion.md` describe los estados, pero no trae textos para el
// público; los propone esta tarea y los confirma Juan Pablo o Jerónimo.
// Batería y temperatura de la Pi llegan en `null` (la UART no las trae): son "sin dato", no una falla.
import type { Estado, Salud } from "../contrato/tipos";

const MS_POR_S = 1000;

/**
 * Cómo se lee el estado de la Pi:
 * - `sin_dato`: no llegó nada, o la Pi lleva más de 3 s sin latido.
 * - `espera`: arrancando, preparándose o armada (todavía no graba).
 * - `activo`: grabando el ascenso o capturando el descenso.
 * - `procesando`: ordenando y revelando lo capturado.
 * - `completo`: la misión de la Pi terminó bien.
 * - `falla`: cualquier estado 0xE* del `StatusCode`.
 */
export type NivelPi = "sin_dato" | "espera" | "activo" | "procesando" | "completo" | "falla";

/** Los cinco pasos de la misión de la Pi, en orden. El paso "Procesar" se completa con COMPLETE. */
export const PASOS_PI: readonly { id: string; nombre: string }[] = [
  { id: "preparar", nombre: "Preparar" },
  { id: "armada", nombre: "Armada" },
  { id: "ascenso", nombre: "Ascenso" },
  { id: "descenso", nombre: "Descenso" },
  { id: "procesar", nombre: "Procesar" },
];

interface TextoEstado {
  nivel: NivelPi;
  titulo: string;
  detalle: string;
  /** Índice del paso en curso de `PASOS_PI`; `PASOS_PI.length` = todos hechos; `null` = fuera de la secuencia. */
  paso: number | null;
}

const CON_FALLA = "Con falla";

/** Cada `StatusCode` con su texto (P). Lo que no está aquí se trata como estado no reconocido. */
const ESTADOS: Readonly<Record<string, TextoEstado>> = {
  BOOT: {
    nivel: "espera",
    titulo: "Arrancando",
    detalle: "La Raspberry Pi se está encendiendo.",
    paso: 0,
  },
  PREFLIGHT: {
    nivel: "espera",
    titulo: "Preparándose",
    detalle: "Revisa la tarjeta, las cámaras y el reloj antes del vuelo.",
    paso: 0,
  },
  READY: {
    nivel: "espera",
    titulo: "Lista",
    detalle: "Todo en orden: espera a que el cohete la arme.",
    paso: 0,
  },
  ARMED: {
    nivel: "espera",
    titulo: "Armada",
    detalle: "Espera el despegue para empezar a grabar.",
    paso: 1,
  },
  STARTING: {
    nivel: "activo",
    titulo: "Grabando el ascenso",
    detalle: "Está arrancando la cámara para la subida.",
    paso: 2,
  },
  ASCENT: {
    nivel: "activo",
    titulo: "Grabando el ascenso",
    detalle: "Video de la subida en curso.",
    paso: 2,
  },
  RECORDING: {
    nivel: "activo",
    titulo: "Capturando el descenso",
    detalle: "Toma imágenes durante la caída.",
    paso: 3,
  },
  INGESTING: {
    nivel: "procesando",
    titulo: "Procesando imágenes",
    detalle: "Guarda y ordena lo que capturó.",
    paso: 4,
  },
  PROCESSING: {
    nivel: "procesando",
    titulo: "Procesando imágenes",
    detalle: "Revela las imágenes del descenso.",
    paso: 4,
  },
  COMPLETE: {
    nivel: "completo",
    titulo: "Misión completa",
    detalle: "Las imágenes quedaron guardadas en la Pi.",
    paso: PASOS_PI.length,
  },
  ABORTED: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "La grabación se abortó.",
    paso: null,
  },
  SD_FULL: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "La tarjeta de memoria está llena.",
    paso: null,
  },
  RATE_FALLBACK: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "Graba con menos cuadros por segundo de lo previsto.",
    paso: null,
  },
  TELEMETRY_LOST: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "No recibe la telemetría del cohete.",
    paso: null,
  },
  ABORT_REQUESTED: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "Se pidió abortar la grabación.",
    paso: null,
  },
  CLOCK_UNSYNCED: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "Su reloj no está sincronizado.",
    paso: null,
  },
  PIPELINE_ERROR: {
    nivel: "falla",
    titulo: CON_FALLA,
    detalle: "Falló el procesamiento de las imágenes.",
    paso: null,
  },
};

const SIN_SENAL: TextoEstado = {
  nivel: "sin_dato",
  titulo: "Sin señal de la Pi",
  detalle: "El cohete no recibe su latido desde hace más de 3 segundos.",
  paso: null,
};

const NO_RECONOCIDO: TextoEstado = {
  nivel: "sin_dato",
  titulo: "Estado no reconocido",
  detalle: "La Pi informó un estado que esta página no conoce.",
  paso: null,
};

/** El `ErrorCode` (`motivo`) en palabras. `NINGUNO` llega como `null`. */
export const MOTIVOS_PI: Readonly<Record<string, string>> = {
  SD_ESPACIO: "Poco espacio en la tarjeta",
  SD_LENTA: "La tarjeta es demasiado lenta para grabar",
  RAM: "Poca memoria disponible",
  CAMARA: "Falla de la cámara",
  TELEMETRIA: "Sin telemetría del cohete",
  PROCESO: "Falló el procesamiento de las imágenes",
  ARCHIVOS: "Problema con los archivos del sistema",
  OTRO: "Causa sin identificar",
};

export type CamaraPi = "sin_dato" | "grabando" | "lista" | "no_lista" | "terminada" | "falla";

export interface VistaPi {
  /** ¿Llegó `salud.pi`? Si no, la sección muestra su estado vacío y nada más. */
  hayDato: boolean;
  nivel: NivelPi;
  /** El nombre del estado (`StatusCode`) tal como llegó, o `null` sin dato. Para depurar y para las pruebas. */
  codigo: string | null;
  titulo: string;
  detalle: string;
  /** El motivo del último error, en palabras. `vigente` = la Pi está hoy en un estado de falla. */
  motivo: { texto: string; vigente: boolean } | null;
  /** Los pasos de la misión con su avance; `null` fuera de la secuencia (falla o sin señal). */
  pasos: { id: string; nombre: string; avance: "hecho" | "actual" | "pendiente" }[] | null;
  camara: CamaraPi;
  /** `salud.pi.bat_pct`: hoy siempre `null`. */
  bateriaPct: number | null;
  /** `salud.temp_pi_c`: hoy siempre `null`. */
  temperaturaC: number | null;
  /** El dato del cohete es viejo (`WEB_DATO_VIEJO_S`): la Pi puede estar en otro estado. */
  viejo: boolean;
  /** Segundos desde el último dato, enteros; `null` si no se sabe. */
  edadS: number | null;
}

/** La vista vacía: aún no llegó `salud`, o llegó sin `pi`. */
export function vistaPiVacia(): VistaPi {
  return {
    hayDato: false,
    nivel: "sin_dato",
    codigo: null,
    titulo: "Sin datos de la Pi todavía",
    detalle: "La Pi informa su estado una vez por segundo cuando el cohete transmite.",
    motivo: null,
    pasos: null,
    camara: "sin_dato",
    bateriaPct: null,
    temperaturaC: null,
    viejo: false,
    edadS: null,
  };
}

function pasosDe(paso: number | null): VistaPi["pasos"] {
  if (paso === null) return null;
  return PASOS_PI.map((p, i) => ({
    ...p,
    avance: i < paso ? "hecho" : i === paso ? "actual" : "pendiente",
  }));
}

function camaraDe(camOk: boolean | null, motivo: string | null, texto: TextoEstado): CamaraPi {
  if (camOk === null || texto.nivel === "sin_dato") return "sin_dato";
  if (texto.nivel === "procesando" || texto.nivel === "completo") return "terminada";
  if (camOk) return texto.nivel === "activo" ? "grabando" : "lista";
  return texto.nivel === "falla" || motivo === "CAMARA" ? "falla" : "no_lista";
}

/**
 * Todo lo que pinta la sección. `edadMs` es la antigüedad del último dato del cohete y `viejo` si ya pasó
 * `WEB_DATO_VIEJO_S`. Sin `salud` o sin `salud.pi` devuelve la vista vacía.
 */
export function vistaPi(
  salud: Salud | null,
  estado: Estado | null,
  edadMs: number | null = null,
  viejo = false,
): VistaPi {
  const pi = salud?.pi ?? null;
  if (salud === null || pi === null) return vistaPiVacia();

  const texto = pi.estado === "DESCONOCIDO" ? SIN_SENAL : (ESTADOS[pi.estado] ?? NO_RECONOCIDO);
  const textoMotivo = pi.motivo ? (MOTIVOS_PI[pi.motivo] ?? MOTIVOS_PI.OTRO) : undefined;

  return {
    hayDato: true,
    nivel: texto.nivel,
    codigo: pi.estado,
    titulo: texto.titulo,
    detalle: texto.detalle,
    motivo:
      textoMotivo === undefined ? null : { texto: textoMotivo, vigente: texto.nivel === "falla" },
    pasos: pasosDe(texto.paso),
    camara: camaraDe(estado?.act.cam_ok ?? null, pi.motivo ?? null, texto),
    bateriaPct: pi.bat_pct ?? null,
    temperaturaC: salud.temp_pi_c ?? null,
    viejo,
    edadS: edadMs === null ? null : Math.floor(edadMs / MS_POR_S),
  };
}
