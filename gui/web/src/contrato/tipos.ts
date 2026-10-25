// Contrato de datos de la web `web-1` (T-611). CONGELADO tras la sincronización H0.
// Fuente de verdad: docs/08_gui/05_contrato_datos_web.md. Debe decir lo mismo que `esquema.json`
// (la prueba pruebas/contrato.test.ts compara las claves de los ejemplos con las del esquema).
// Reglas de 05 §0: `null` = sin dato; un campo nunca se omite, salvo los marcados "opcional".
// Cambiar o quitar un campo exige `web-2` y una decisión D-W; agregar uno opcional es compatible.

export const CONTRATO_VERSION = "web-1" as const;

export type Mision = "demeter" | "hermes";
/** Demeter es el nodo 1 y Hermes el nodo 2 (05 §0). */
export type Nodo = 1 | 2;
export type Modo = "vivo" | "simulacion" | "sintetico";

/** Nombres de maquina_estados §1, con su código (`fase_cod`) igual al índice. */
export const FASES = [
  "BOOT",
  "PREFLIGHT",
  "ARMED",
  "BOOST",
  "COAST",
  "APOGEE",
  "FREE_FALL",
  "DESCENT",
  "LANDED",
  "ERROR",
] as const;
export type Fase = (typeof FASES)[number];

/** Tipos de mensaje del stream (05 §2) y nombre del `event:` de SSE. */
export const TIPOS_MENSAJE = ["meta", "estado", "salud", "estacion", "evento", "backfill"] as const;
export type TipoMensaje = (typeof TIPOS_MENSAJE)[number];

/** 05 §2.1: al conectar y cuando cambie. */
export interface Meta {
  contrato_version: typeof CONTRATO_VERSION;
  mision: Mision;
  nodo: Nodo;
  modo: Modo;
  /** STATUS.mission_id; null antes de ARM. */
  mission_id: number | null;
  /** Opcional (PA-15 / D-W13). 2 o 3; v3 = STATUS con `fw_version` (DP-07). */
  proto_version?: 2 | 3;
  sitio: { lat: number; lon: number; alt_msl_m: number };
}

/** 05 §2.2, opcional (PA-22): la última posición válida. */
export interface Lkp {
  lat: number;
  lon: number;
  alt_agl_m: number;
  utc_ms: number | null;
}

export interface Posicion {
  lat: number;
  lon: number;
  alt_agl_m: number;
  /** null si aún no hay `alt_origen_msl_dm` de STATUS. */
  alt_msl_m: number | null;
  fuente: "ekf" | "gnss";
}

/** 05 §2.2: con cada NAV (en vuelo ~9 Hz; en tierra el relay lo baja a 1 Hz). */
export interface Estado {
  seq: number;
  /** Reloj del cohete. */
  t_ms: number;
  /** Hora UTC estimada por el cohete; null si no hay hora válida. */
  utc_ms: number | null;
  /** Hora en que lo recibió la estación. */
  rx_utc_ms: number;
  /** Hora en que lo emitió el relay; null si lo emite el servicio local sin relay. */
  relay_utc_ms: number | null;
  fase: Fase;
  fase_cod: number;
  /** null sin fix: entonces la web dibuja `lkp` (GS-03). */
  pos: Posicion | null;
  vel: { n_ms: number; e_ms: number; u_ms: number; total_ms: number };
  /** Marco del cuerpo, promedio de 100 ms. */
  acc_g: { x: number; y: number; z: number };
  /** Cuaternión del cuerpo a ENU. */
  q: { w: number; x: number; y: number; z: number };
  flags: {
    gnss_fix: boolean;
    ekf_ok: boolean;
    falla_activa: boolean;
    eyeccion: boolean;
    apogeo: boolean;
    log_activo: boolean;
    reanudado: boolean;
  };
  act: { pi_pulso: boolean; cam_ok: boolean; buzzer: boolean; wifi_ap: boolean; backfill: boolean };
  /** 0xFF -> null. */
  bat_pct: number | null;
  /** Demeter: StatusCode de la Pi; 0xFE -> {codigo:254, texto:"Sin respuesta"}. Hermes: null. */
  secundario: { codigo: number; texto: string } | null;
  /** Lo calcula el servicio de tierra; cada campo es null si no aplica. */
  calc: {
    dist_horiz_m: number | null;
    azimut_deg: number | null;
    elevacion_deg: number | null;
    elipse: {
      lat: number;
      lon: number;
      semieje_mayor_m: number;
      semieje_menor_m: number;
      rumbo_deg: number;
    } | null;
    t_a_apogeo_s: number | null;
    t_restante_s: number | null;
    siguiente_fase: Fase | null;
    t_siguiente_fase_s: number | null;
  };
  enlace: { rssi_dbm: number | null; snr_db: number | null; perdidos_pct_10s: number | null };
  /** La web la muestra, no la recalcula. */
  alarmas: { descenso_rapido: boolean };
  /** Opcional (PA-22 / D-W13); null si nunca hubo posición. */
  lkp?: Lkp | null;
}

export interface CondicionGoNogo {
  id: string;
  nombre: string;
  ok: boolean;
}

/** 05 §2.3: con cada STATUS (1 Hz). */
export interface Salud {
  t_ms: number;
  utc_ms: number | null;
  mission_id: number | null;
  boot_count: number;
  /** fix: 0 sin fix, 2 fix 2D, 3 fix 3D. */
  gnss: { fix: 0 | 2 | 3; sv: number; hacc_m: number | null };
  bat_mv: number | null;
  temp_esp_c: number | null;
  /** null en Hermes. */
  temp_pi_c: number | null;
  /** Nombres de los bits activos (protocolo §3). */
  fallas: string[];
  fallas_bits: number;
  calib: { giro: boolean; mag: boolean; baro: boolean; origen: boolean; actitud: boolean };
  nav_innov_m: number | null;
  apogeo_m: number | null;
  alt_origen_msl_m: number | null;
  sd_libre_mb: number | null;
  rssi_tierra_dbm: number | null;
  ultimo_cmd_seq: number | null;
  go_nogo: { listo: boolean; condiciones: CondicionGoNogo[] };
  /** Opcional (PA-15 / D-W13): hash corto de git; null con el protocolo v2. */
  fw_version?: string | null;
}

/** 05 §2.4: latido a 1 Hz, aunque no llegue nada del cohete. */
export interface Estacion {
  utc_ms: number;
  /** null si la estación no tiene posición (gnss_ok = false). */
  pos: { lat: number; lon: number; alt_msl_m: number | null } | null;
  gnss_ok: boolean;
  /** null si todavía no ha llegado ningún paquete del cohete. */
  ultimo_paquete_hace_ms: number | null;
}

export const TIPOS_EVENTO = [
  "despegue",
  "fin_combustion",
  "eyeccion",
  "apogeo",
  "fase",
  "aterrizaje",
  "alarma_descenso",
  "camaras",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** 05 §2.5: hechos puntuales. */
export interface Evento {
  tipo: TipoEvento;
  t_ms: number;
  utc_ms: number | null;
  /** Tiempo desde el despegue (T+). */
  t_mas_s: number | null;
  /** apogeo: altitud; alarma_descenso: Vz; si no aplica, null. */
  valor: number | null;
  /** Solo aplica en `fase`; null en los demás. */
  fase: Fase | null;
  /** Solo aplica en `alarma_descenso`; null en los demás. */
  activa: boolean | null;
}

/** 05 §2.6. */
export interface Backfill {
  activo: boolean;
  recibidos: number;
  esperados: number;
  /** 0 a 1. */
  progreso: number;
  completo: boolean;
}

/** 05 §3: en columnas, todas del mismo largo, decimada a `WEB_SERIE_MAX_PUNTOS`. */
export interface Serie {
  t_mas_s: (number | null)[];
  lat: (number | null)[];
  lon: (number | null)[];
  alt_agl_m: (number | null)[];
  vz_ms: (number | null)[];
  acc_x_g: (number | null)[];
  acc_y_g: (number | null)[];
  acc_z_g: (number | null)[];
}

/** 05 §3: `GET /api/v1/{mision}/snapshot`. Lo que aún no existe va en null / listas vacías. */
export interface Snapshot {
  meta: Meta;
  estado: Estado | null;
  salud: Salud | null;
  estacion: Estacion | null;
  eventos: Evento[];
  serie: Serie;
  backfill: Backfill | null;
  vuelo_completo_url: string | null;
}

/** Mapa de tipo de mensaje a su carga (`data:` del evento SSE). */
export interface DatosPorTipo {
  meta: Meta;
  estado: Estado;
  salud: Salud;
  estacion: Estacion;
  evento: Evento;
  backfill: Backfill;
}

/** 05 §5: una línea de los JSONL de ejemplo. */
export type LineaJsonl = {
  [T in TipoMensaje]: { t_rel_ms: number; evento: T; datos: DatosPorTipo[T] };
}[TipoMensaje];

/** 05 §1: cuerpo de `POST /api/v1/ingesta` (solo el reenviador). */
export interface Ingesta {
  mensajes: {
    [T in TipoMensaje]: { tipo: T; mision: Mision; datos: DatosPorTipo[T] };
  }[TipoMensaje][];
}
