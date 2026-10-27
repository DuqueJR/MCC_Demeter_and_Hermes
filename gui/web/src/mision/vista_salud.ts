// Lógica de la sección Salud del cohete (03 §3.8, Objetivos 7.C, T-625). Funciones puras, sin Preact:
// de `salud` (STATUS, 1 Hz) y del último `estado` sacan el resumen, el Go/No-Go y el detalle.
// T-668 (dashboard de operación) la reutiliza.
//
// Qué es una falla y qué un aviso (propuesta de T-625; 03 §3.8 no lo define):
//   - FALLA (⛔): algún bit en `fallas` (protocolo_paquetes §3). Se muestran sus nombres.
//   - AVISO (⚠), una causa cuenta una vez: calibraciones sin terminar; EKF no listo (`flags.ekf_ok`
//     en falso). No hay umbral en constantes.md para la innovación del EKF, así que solo se muestra
//     su valor: no genera aviso.
//   - Batería (decisión del usuario): la web no recalcula. La batería baja sale solo como la falla
//     del bit 13 que manda el firmware; el detalle muestra el % y los V.
import type { CondicionGoNogo, Estado, Fase, Mision, Salud } from "../contrato/tipos";

const MV_POR_V = 1000;
/** Las fases en las que el Go/No-Go es lo que importa: antes del despegue (maquina_estados §4). */
const FASES_GO_NOGO: ReadonlySet<Fase> = new Set<Fase>(["PREFLIGHT", "ARMED"]);

export type NivelSalud = "sin_dato" | "ok" | "aviso" | "falla";
export type GrupoBit = "sensor" | "sistema";

/** Los bits de `fallas` (protocolo_paquetes §3). El nombre es el que manda el servicio de tierra. */
export const BITS_FALLA: readonly {
  bit: number;
  nombre: string;
  grupo: GrupoBit;
  /** Solo se muestra en Deméter (Hermes no tiene Pi), salvo que esté en falla. */
  soloDemeter?: true;
}[] = [
  { bit: 0, nombre: "LSM6DSO32", grupo: "sensor" },
  { bit: 1, nombre: "BMP581", grupo: "sensor" },
  { bit: 2, nombre: "MMC5983MA", grupo: "sensor" },
  { bit: 3, nombre: "QMI8658", grupo: "sensor" },
  { bit: 4, nombre: "BME280", grupo: "sensor" },
  { bit: 5, nombre: "QMC6310", grupo: "sensor" },
  { bit: 6, nombre: "GNSS sin datos", grupo: "sensor" },
  { bit: 7, nombre: "SD", grupo: "sistema" },
  { bit: 8, nombre: "PMIC", grupo: "sistema" },
  { bit: 9, nombre: "Radio (fallo de TX)", grupo: "sistema" },
  { bit: 10, nombre: "EKF divergente", grupo: "sistema" },
  { bit: 11, nombre: "UART del VisionPack", grupo: "sistema", soloDemeter: true },
  { bit: 12, nombre: "RTC", grupo: "sistema" },
  { bit: 13, nombre: "Batería baja", grupo: "sistema" },
];

const NOMBRE_EKF_DIVERGENTE = "EKF divergente";

/** Las calibraciones de `salud.calib`, con su nombre público (protocolo_paquetes §3). */
export const CALIBRACIONES = [
  { id: "giro", nombre: "Giróscopo (bias)" },
  { id: "mag", nombre: "Magnetómetro" },
  { id: "baro", nombre: "Referencia barométrica" },
  { id: "origen", nombre: "Origen del EKF" },
  { id: "actitud", nombre: "Alineación de la actitud" },
] as const;
export type IdCalibracion = (typeof CALIBRACIONES)[number]["id"];

export type IdAviso = "calibraciones" | "ekf";
export interface Aviso {
  id: IdAviso;
  texto: string;
}

export interface FilaBit {
  bit: number;
  nombre: string;
  falla: boolean;
}

export interface VistaSalud {
  nivel: NivelSalud;
  /** El resumen siempre visible, sin el ícono: "Todo en orden", "2 avisos", "Falla en un sensor". */
  resumen: string;
  /** Nombres de lo que está en falla (vacío si no hay). */
  fallas: string[];
  avisos: Aviso[];
  /** El chip maestro: solo en PREFLIGHT y ARMED, y solo si llegó `salud`. */
  goNogo: { listo: boolean; faltan: number; condiciones: CondicionGoNogo[] } | null;
  sensores: FilaBit[];
  sistemas: FilaBit[];
  calibraciones: { id: IdCalibracion; nombre: string; completa: boolean }[];
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
  temperatura: { espC: number | null; piC: number | null; mostrarPi: boolean };
}

/** Los nombres de los bits que `fallas_bits` trae en 1 (14 y 15 están reservados). */
export function nombresDeBits(bits: number): string[] {
  return BITS_FALLA.filter((b) => (bits & (1 << b.bit)) !== 0).map((b) => b.nombre);
}

/**
 * Lo que está en falla: los nombres de `fallas` y, si el servicio no los mandó, los de `fallas_bits`.
 * Sin repetidos y en el orden de los bits cuando se conocen.
 */
export function fallasActivas(salud: Salud): string[] {
  const nombres = new Set<string>(salud.fallas);
  for (const n of nombresDeBits(salud.fallas_bits)) nombres.add(n);
  return [...nombres];
}

function resumenDe(fallas: string[], avisos: Aviso[]): { nivel: NivelSalud; resumen: string } {
  if (fallas.length > 0) {
    if (fallas.length > 1) return { nivel: "falla", resumen: `${fallas.length} fallas` };
    const sensor = BITS_FALLA.some((b) => b.nombre === fallas[0] && b.grupo === "sensor");
    return { nivel: "falla", resumen: sensor ? "Falla en un sensor" : "Falla en un sistema" };
  }
  if (avisos.length > 0) {
    return {
      nivel: "aviso",
      resumen: avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`,
    };
  }
  return { nivel: "ok", resumen: "Todo en orden" };
}

function avisosDe(salud: Salud, estado: Estado | null, fallas: string[]): Aviso[] {
  const avisos: Aviso[] = [];
  const pendientes = CALIBRACIONES.filter((c) => !salud.calib[c.id]).map((c) => c.nombre);
  if (pendientes.length > 0) {
    avisos.push({
      id: "calibraciones",
      texto: `Calibraciones sin terminar: ${pendientes.join(", ")}`,
    });
  }
  // Un EKF divergente ya es una falla: no se repite como aviso.
  if (estado !== null && !estado.flags.ekf_ok && !fallas.includes(NOMBRE_EKF_DIVERGENTE)) {
    avisos.push({ id: "ekf", texto: "El EKF aún no está listo" });
  }
  return avisos;
}

function filasDeBits(
  salud: Salud,
  fallas: string[],
  mision: Mision | null,
): Record<GrupoBit, FilaBit[]> {
  const filas: Record<GrupoBit, FilaBit[]> = { sensor: [], sistema: [] };
  const conocidos = new Set<string>();
  for (const b of BITS_FALLA) {
    conocidos.add(b.nombre);
    const falla = (salud.fallas_bits & (1 << b.bit)) !== 0 || fallas.includes(b.nombre);
    if (b.soloDemeter && mision === "hermes" && !falla) continue;
    filas[b.grupo].push({ bit: b.bit, nombre: b.nombre, falla });
  }
  // Un nombre que esta web no conoce (un bit nuevo del firmware) no se pierde: va como falla de sistema.
  for (const n of fallas) {
    if (!conocidos.has(n)) filas.sistema.push({ bit: -1, nombre: n, falla: true });
  }
  return filas;
}

/** La vista vacía de cuando aún no llegó ningún `salud`. */
export function vistaSaludVacia(): VistaSalud {
  return {
    nivel: "sin_dato",
    resumen: "Sin datos de salud todavía",
    fallas: [],
    avisos: [],
    goNogo: null,
    sensores: [],
    sistemas: [],
    calibraciones: [],
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
    temperatura: { espC: null, piC: null, mostrarPi: false },
  };
}

/**
 * Todo lo que pinta la sección Salud. `mision` decide qué filas aplican (la Pi solo existe en Deméter).
 * Sin `salud` devuelve la vista vacía: la sección muestra un estado vacío claro.
 */
export function vistaSalud(
  salud: Salud | null,
  estado: Estado | null,
  mision: Mision | null,
): VistaSalud {
  if (salud === null) return vistaSaludVacia();

  const fallas = fallasActivas(salud);
  const avisos = avisosDe(salud, estado, fallas);
  const { nivel, resumen } = resumenDe(fallas, avisos);
  const filas = filasDeBits(salud, fallas, mision);
  const condiciones = salud.go_nogo.condiciones;

  return {
    nivel,
    resumen,
    fallas,
    avisos,
    goNogo:
      estado !== null && FASES_GO_NOGO.has(estado.fase)
        ? {
            listo: salud.go_nogo.listo,
            faltan: condiciones.filter((c) => !c.ok).length,
            condiciones,
          }
        : null,
    sensores: filas.sensor,
    sistemas: filas.sistema,
    calibraciones: CALIBRACIONES.map((c) => ({ ...c, completa: salud.calib[c.id] })),
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
    temperatura: {
      espC: salud.temp_esp_c,
      piC: salud.temp_pi_c,
      // Hermes no tiene Pi: su `temp_pi_c` es `null` y la fila no existe. En Deméter, sin dato, se ve "sin dato".
      mostrarPi: mision !== "hermes",
    },
  };
}
