// Lógica de la sección Salud del cohete (03 §3.8, Objetivos 7.C, T-625; simplificada en T-658, D-065).
// Funciones puras, sin Preact: de `salud` (STATUS, 1 Hz) y del último `estado` sacan el estado general,
// el Go/No-Go y el detalle. T-668 (dashboard de operación) la reutiliza.
//
// Una sola fila de estado general: "Sin fallas reportadas" o "Falla: <qué>". Es honesta con lo que SÍ llega:
// `salud.fallas` y `fallas_bits` van siempre vacíos con `net_proto` v2 (hallazgo A2), así que no basta con
// ellos. Cada causa sale de un dato que existe:
//   - los nombres de `fallas` / `fallas_bits`, si algún día llegan (con nombres genéricos);
//   - `estado.flags.falla_activa`;
//   - `estado.fase === "ERROR"`;
//   - `estado.flags.ekf_ok` y `estado.flags.gnss_fix`, salvo en BOOT (recién encendido, aún sin solución);
//   - la batería: el bit 13 de `fallas` o, antes del vuelo, la condición `bateria` del Go/No-Go (su umbral
//     lo pone el servicio de tierra, `vbat_arm_mv`; la web no inventa ninguno);
//   - el enlace: el dato viejo (`WEB_DATO_VIEJO_S`);
//   - la Pi (`salud.pi`, opcional, lo agrega T-657): solo si su estado es de error.
// Ningún nombre de chip llega a la web pública (D-065): ver `sinModelos`.
import type { CondicionGoNogo, Estado, Fase, Mision, Salud } from "../contrato/tipos";

const MV_POR_V = 1000;
const MS_POR_S = 1000;
/** Las fases en las que el Go/No-Go es lo que importa: antes del despegue (maquina_estados §4). */
const FASES_GO_NOGO: ReadonlySet<Fase> = new Set<Fase>(["PREFLIGHT", "ARMED"]);

export type NivelSalud = "sin_dato" | "ok" | "falla";

/**
 * Los bits de `fallas` (protocolo_paquetes §3), con nombre genérico: la web pública no muestra el modelo
 * de cada sensor. Los de respaldo son los de la placa de vuelo.
 */
export const BITS_FALLA: readonly { bit: number; nombre: string }[] = [
  { bit: 0, nombre: "Acelerómetro y giróscopo" },
  { bit: 1, nombre: "Barómetro" },
  { bit: 2, nombre: "Magnetómetro" },
  { bit: 3, nombre: "Acelerómetro y giróscopo de respaldo" },
  { bit: 4, nombre: "Barómetro de respaldo" },
  { bit: 5, nombre: "Magnetómetro de respaldo" },
  { bit: 6, nombre: "GNSS sin datos" },
  { bit: 7, nombre: "SD" },
  { bit: 8, nombre: "PMIC" },
  { bit: 9, nombre: "Radio (fallo de TX)" },
  { bit: 10, nombre: "EKF divergente" },
  { bit: 11, nombre: "UART del VisionPack" },
  { bit: 12, nombre: "RTC" },
  { bit: 13, nombre: "Batería baja" },
];

const NOMBRE_BATERIA_BAJA = "Batería baja";

// ---- Sin modelos de chip (D-065) ----

/**
 * Los números de parte de los chips (los que pueden llegar en `fallas` o en el nombre de una condición) y su
 * nombre genérico. Son patrones por familia, no una lista de modelos: cualquier otro del mismo fabricante
 * también se esconde. Los de la placa de vuelo son los sensores de respaldo.
 */
const PATRONES_DE_CHIP: readonly { re: RegExp; generico: string }[] = [
  { re: /LSM6D\w*/gi, generico: "acelerómetro y giróscopo" },
  { re: /QMI\d+\w*/gi, generico: "acelerómetro y giróscopo de respaldo" },
  { re: /BMP\d+\w*/gi, generico: "barómetro" },
  { re: /BME\d+\w*/gi, generico: "barómetro de respaldo" },
  { re: /MMC\d+\w*/gi, generico: "magnetómetro" },
  { re: /QMC\d+\w*/gi, generico: "magnetómetro de respaldo" },
  { re: /ESP\d+[\w-]*/gi, generico: "placa" },
];
const RE_EMPIEZA_CON_CHIP = new RegExp(
  `^\\s*(?:${PATRONES_DE_CHIP.map((p) => p.re.source).join("|")})`,
  "i",
);

/** El nombre de una condición del Go/No-Go por su `id`, para las que el servicio nombra con el chip. */
const NOMBRE_CONDICION: Readonly<Record<string, string>> = {
  lsm: "Acelerómetro y giróscopo con datos",
  bmp: "Barómetro con datos",
};

/** Cambia cualquier modelo de chip de un texto por su nombre genérico. Un texto sin modelos no cambia. */
export function sinModelos(texto: string): string {
  let nuevo = texto;
  for (const { re, generico } of PATRONES_DE_CHIP) nuevo = nuevo.replace(re, generico);
  // Si la frase empezaba con el modelo, queda con mayúscula inicial.
  return RE_EMPIEZA_CON_CHIP.test(texto) ? mayuscula(nuevo) : nuevo;
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function condicionPublica(c: CondicionGoNogo): CondicionGoNogo {
  return { ...c, nombre: NOMBRE_CONDICION[c.id] ?? sinModelos(c.nombre) };
}

// ---- La Pi (`salud.pi`, opcional: lo agrega T-657) ----

/** `salud.pi` (D-065). Se tipa aquí, opcional, para que esta web compile con y sin el contrato nuevo. */
interface SaludPi {
  estado: string;
  motivo?: string | null;
  bat_pct?: number | null;
}
const piDe = (salud: Salud): SaludPi | null =>
  (salud as Salud & { pi?: SaludPi | null }).pi ?? null;

/** Los estados de error de la Pi (`StatusCode` 0xE0 o más) y cómo se dicen. `DESCONOCIDO` no es un error. */
const ERROR_PI: Readonly<Record<string, string>> = {
  ABORTED: "grabación abortada",
  SD_FULL: "tarjeta SD llena",
  RATE_FALLBACK: "grabando con menos cuadros por segundo",
  TELEMETRY_LOST: "sin telemetría del cohete",
  ABORT_REQUESTED: "aborto solicitado",
  CLOCK_UNSYNCED: "reloj sin sincronizar",
  PIPELINE_ERROR: "error al procesar la grabación",
};

/** El `ErrorCode` de la Pi (`motivo`), en palabras. Los que no se conocen no se muestran. */
const MOTIVO_PI: Readonly<Record<string, string>> = {
  SD_ESPACIO: "sin espacio en la SD",
  SD_LENTA: "SD demasiado lenta",
  RAM: "memoria insuficiente",
  CAMARA: "cámara",
  TELEMETRIA: "telemetría",
  PROCESO: "procesamiento",
  ARCHIVOS: "archivos",
};

function causaDeLaPi(salud: Salud): string | null {
  const pi = piDe(salud);
  if (pi === null) return null;
  const texto = ERROR_PI[pi.estado];
  if (texto === undefined) return null;
  const motivo = pi.motivo ? MOTIVO_PI[pi.motivo] : undefined;
  return `Cámara: ${texto}${motivo ? ` (${motivo})` : ""}`;
}

// ---- Estado general ----

/** Lo que está en falla según `fallas` y `fallas_bits`, con nombres genéricos y sin repetidos. */
export function fallasActivas(salud: Salud): string[] {
  const nombres = new Set<string>(salud.fallas.map(sinModelos));
  for (const n of nombresDeBits(salud.fallas_bits)) nombres.add(n);
  return [...nombres];
}

/** Los nombres de los bits que `fallas_bits` trae en 1 (14 y 15 están reservados). */
export function nombresDeBits(bits: number): string[] {
  return BITS_FALLA.filter((b) => (bits & (1 << b.bit)) !== 0).map((b) => b.nombre);
}

/** Todas las causas de falla que se pueden afirmar con lo que llega, en orden de importancia. */
export function causasDeFalla(
  salud: Salud,
  estado: Estado | null,
  edadMs: number | null,
  viejo: boolean,
): string[] {
  const causas: string[] = [];
  const nombradas = fallasActivas(salud);
  causas.push(...nombradas);

  if (estado !== null) {
    // `falla_activa` sin nombres: el cohete avisa que hay una falla, aunque no diga cuál.
    if (estado.flags.falla_activa && nombradas.length === 0) {
      causas.push("El cohete reporta una falla");
    }
    if (estado.fase === "ERROR") causas.push("El cohete está en estado de error");
  }

  const pi = causaDeLaPi(salud);
  if (pi !== null) causas.push(pi);

  // Batería: el bit 13 ya viene en `nombradas`; si no, la condición del Go/No-Go (umbral del servicio).
  if (
    !nombradas.includes(NOMBRE_BATERIA_BAJA) &&
    estado !== null &&
    FASES_GO_NOGO.has(estado.fase)
  ) {
    if (salud.go_nogo.condiciones.some((c) => c.id === "bateria" && !c.ok)) {
      causas.push(NOMBRE_BATERIA_BAJA);
    }
  }

  // Sin solución de navegación o sin fix: no se juzga en BOOT, el cohete acaba de encenderse.
  if (estado !== null && estado.fase !== "BOOT") {
    if (!estado.flags.ekf_ok && !nombradas.includes("EKF divergente")) {
      causas.push("Navegación del cohete no lista");
    }
    if (!estado.flags.gnss_fix && !nombradas.includes("GNSS sin datos")) {
      causas.push("Sin fix del GNSS");
    }
  }

  if (viejo && edadMs !== null) {
    causas.push(`Sin datos recientes del cohete (último hace ${Math.floor(edadMs / MS_POR_S)} s)`);
  }
  return causas;
}

function resumenDe(causas: string[]): { nivel: NivelSalud; resumen: string } {
  if (causas.length === 0) return { nivel: "ok", resumen: "Sin fallas reportadas" };
  if (causas.length === 1) return { nivel: "falla", resumen: `Falla: ${causas[0]}` };
  return { nivel: "falla", resumen: `${causas.length} fallas` };
}

// ---- Go / No-Go ----

/**
 * Las condiciones que `web1.py` calcula SIN que el cohete haya respondido a un armado (solo lo que se ve en
 * el TELEM y el LogInfo). La respuesta a un armado (APTO o NO APTO) trae el checklist completo, con más ids.
 */
const IDS_ANTES_DE_ARMAR: ReadonlySet<string> = new Set(["gnss", "bateria", "reserva"]);

/**
 * `esperando`: el cohete aún no responde a un armado (D-065, hallazgo A7): se ven las condiciones, sin
 *   decir "No Go". `go`: el cohete respondió APTO. `nogo`: el cohete se negó a armar.
 */
export type EstadoGoNogo = "esperando" | "go" | "nogo";

export interface VistaGoNogo {
  estado: EstadoGoNogo;
  faltan: number;
  condiciones: CondicionGoNogo[];
  /** En ARMED el Go ya se cumplió: el texto dice "armado". */
  armado: boolean;
}

/** ¿El cohete ya contestó a un armado? Solo entonces un `listo: false` significa "No Go". */
export function respondioAlArmado(condiciones: readonly CondicionGoNogo[]): boolean {
  return condiciones.some((c) => !IDS_ANTES_DE_ARMAR.has(c.id));
}

function goNogoDe(salud: Salud, estado: Estado | null): VistaGoNogo | null {
  if (estado === null || !FASES_GO_NOGO.has(estado.fase)) return null;
  const condiciones = salud.go_nogo.condiciones.map(condicionPublica);
  const armado = estado.fase === "ARMED";
  const faltan = condiciones.filter((c) => !c.ok).length;
  if (salud.go_nogo.listo) return { estado: "go", faltan, condiciones, armado };
  if (respondioAlArmado(salud.go_nogo.condiciones)) {
    return { estado: "nogo", faltan, condiciones, armado };
  }
  // Ya armado pero sin respuesta registrada (por ejemplo, el dashboard se reinició): no hay nada que esperar.
  if (armado) return null;
  return { estado: "esperando", faltan, condiciones, armado };
}

// ---- La vista ----

export interface VistaSalud {
  nivel: NivelSalud;
  /** La fila de estado general: "Sin fallas reportadas", "Falla: <qué>" o "N fallas". */
  resumen: string;
  /** Todas las causas (vacío si no hay). Con más de una, la sección las lista. */
  causas: string[];
  /** El chip maestro: solo en PREFLIGHT y ARMED, y solo si llegó `salud`. */
  goNogo: VistaGoNogo | null;
  navegacion: { ekfListo: boolean | null; innovacionM: number | null };
  enlace: {
    rssiDbm: number | null;
    snrDb: number | null;
    perdidosPct: number | null;
    rssiCohetePDbm: number | null;
    satelites: number;
    haccM: number | null;
    fix: 0 | 2 | 3;
  };
  bateria: { pct: number | null; voltios: number | null };
  sdLibreMb: number | null;
  temperatura: { placaC: number | null };
}

/** La vista vacía de cuando aún no llegó ningún `salud`. */
export function vistaSaludVacia(): VistaSalud {
  return {
    nivel: "sin_dato",
    resumen: "Sin datos de salud todavía",
    causas: [],
    goNogo: null,
    navegacion: { ekfListo: null, innovacionM: null },
    enlace: {
      rssiDbm: null,
      snrDb: null,
      perdidosPct: null,
      rssiCohetePDbm: null,
      satelites: 0,
      haccM: null,
      fix: 0,
    },
    bateria: { pct: null, voltios: null },
    sdLibreMb: null,
    temperatura: { placaC: null },
  };
}

/**
 * Todo lo que pinta la sección Salud. `edadMs` es la antigüedad del último dato del cohete y `viejo` si ya
 * pasó `WEB_DATO_VIEJO_S`. Sin `salud` devuelve la vista vacía: la sección muestra un estado vacío claro.
 * `mision` ya no cambia nada aquí (la Pi tiene su propia sección, T-659); se conserva por compatibilidad.
 */
export function vistaSalud(
  salud: Salud | null,
  estado: Estado | null,
  _mision: Mision | null,
  edadMs: number | null = null,
  viejo = false,
): VistaSalud {
  if (salud === null) return vistaSaludVacia();

  const causas = causasDeFalla(salud, estado, edadMs, viejo);
  const { nivel, resumen } = resumenDe(causas);

  return {
    nivel,
    resumen,
    causas,
    goNogo: goNogoDe(salud, estado),
    navegacion: { ekfListo: estado?.flags.ekf_ok ?? null, innovacionM: salud.nav_innov_m },
    enlace: {
      rssiDbm: estado?.enlace.rssi_dbm ?? null,
      snrDb: estado?.enlace.snr_db ?? null,
      perdidosPct: estado?.enlace.perdidos_pct_10s ?? null,
      rssiCohetePDbm: salud.rssi_tierra_dbm,
      satelites: salud.gnss.sv,
      haccM: salud.gnss.hacc_m,
      fix: salud.gnss.fix,
    },
    bateria: {
      pct: estado?.bat_pct ?? null,
      voltios: salud.bat_mv === null ? null : salud.bat_mv / MV_POR_V,
    },
    sdLibreMb: salud.sd_libre_mb,
    temperatura: { placaC: salud.temp_esp_c },
  };
}
