// Mensajes de ejemplo de `web-1`, uno por tipo, tomados de 05 §2 (Deméter, en DESCENT).
// Sirven a las pruebas del validador y al snapshot estático de `datos/api.ts` (T-611).
// Se tipan con los tipos del contrato: si cambian, el compilador lo avisa.
import type { Backfill, Estacion, Estado, Evento, Meta, Salud, Serie, Snapshot } from "./tipos";

export const metaEjemplo: Meta = {
  contrato_version: "web-1",
  mision: "demeter",
  nodo: 1,
  modo: "vivo",
  mission_id: 1793980800,
  proto_version: 3,
  sitio: { lat: 6.582, lon: -75.823, alt_msl_m: 510.0 },
};

export const estadoEjemplo: Estado = {
  seq: 41,
  t_ms: 1234567,
  utc_ms: 1793981012345,
  rx_utc_ms: 1793981012360,
  relay_utc_ms: 1793981012410,
  fase: "DESCENT",
  fase_cod: 7,
  pos: { lat: 6.5823456, lon: -75.8231234, alt_agl_m: 312.4, alt_msl_m: 822.4, fuente: "ekf" },
  vel: { n_ms: 0.42, e_ms: -1.1, u_ms: -9.21, total_ms: 9.29 },
  acc_g: { x: 1.012, y: 0.031, z: -0.02 },
  q: { w: 0.998, x: 0.012, y: -0.051, z: 0.02 },
  flags: {
    gnss_fix: true,
    ekf_ok: true,
    falla_activa: false,
    eyeccion: true,
    apogeo: true,
    log_activo: true,
    reanudado: false,
  },
  act: { pi_pulso: true, cam_ok: true, buzzer: false, wifi_ap: false, backfill: false },
  bat_pct: 87,
  secundario: { codigo: 12, texto: "Grabando" },
  calc: {
    dist_horiz_m: 842.3,
    azimut_deg: 271.4,
    elevacion_deg: 20.3,
    elipse: {
      lat: 6.583,
      lon: -75.8302,
      semieje_mayor_m: 120.0,
      semieje_menor_m: 60.0,
      rumbo_deg: 270.0,
    },
    t_a_apogeo_s: null,
    t_restante_s: 33.9,
    siguiente_fase: "LANDED",
    t_siguiente_fase_s: 33.9,
  },
  enlace: { rssi_dbm: -97, snr_db: 6.5, perdidos_pct_10s: 3.0 },
  alarmas: { descenso_rapido: false },
  lkp: { lat: 6.5823456, lon: -75.8231234, alt_agl_m: 312.4, utc_ms: 1793981012345 },
};

export const saludEjemplo: Salud = {
  t_ms: 1234000,
  utc_ms: 1793981011778,
  mission_id: 1793980800,
  boot_count: 3,
  gnss: { fix: 3, sv: 11, hacc_m: 1.8 },
  bat_mv: 3980,
  temp_esp_c: 41,
  temp_pi_c: 55,
  fallas: [],
  fallas_bits: 0,
  calib: { giro: true, mag: true, baro: true, origen: true, actitud: true },
  nav_innov_m: 0.84,
  apogeo_m: 669.1,
  alt_origen_msl_m: 510.0,
  sd_libre_mb: 28100,
  rssi_tierra_dbm: -88,
  ultimo_cmd_seq: 7,
  go_nogo: {
    listo: true,
    condiciones: [{ id: "gnss", nombre: "Satélites y precisión", ok: true }],
  },
  fw_version: "a1b2c3d",
};

export const estacionEjemplo: Estacion = {
  utc_ms: 1793981012500,
  pos: { lat: 6.579, lon: -75.815, alt_msl_m: 505.0 },
  gnss_ok: true,
  ultimo_paquete_hace_ms: 230,
};

export const eventoEjemplo: Evento = {
  tipo: "apogeo",
  t_ms: 1245900,
  utc_ms: 1793981023678,
  t_mas_s: 11.54,
  valor: 669.1,
  fase: null,
  activa: null,
};

export const eventoFaseEjemplo: Evento = {
  tipo: "fase",
  t_ms: 1250000,
  utc_ms: 1793981027778,
  t_mas_s: 15.64,
  valor: null,
  fase: "FREE_FALL",
  activa: null,
};

export const eventoAlarmaEjemplo: Evento = {
  tipo: "alarma_descenso",
  t_ms: 1260000,
  utc_ms: 1793981037778,
  t_mas_s: 25.64,
  valor: -21.5,
  fase: null,
  activa: true,
};

export const backfillEjemplo: Backfill = {
  activo: true,
  recibidos: 534,
  esperados: 850,
  progreso: 0.63,
  completo: false,
};

export const serieEjemplo: Serie = {
  t_mas_s: [0, 4, 8, 11.54, 16, 20],
  lat: [6.582, 6.5821, 6.5822, 6.5823, 6.5823, 6.5823456],
  lon: [-75.823, -75.8231, -75.8232, -75.8233, -75.8232, -75.8231234],
  alt_agl_m: [0, 310.2, 590.8, 669.1, 520.3, 312.4],
  vz_ms: [0, 120.5, 40.2, 0, -14.9, -9.21],
  acc_x_g: [1.0, 8.2, 0.4, 0.0, 0.9, 1.012],
  acc_y_g: [0.0, 0.1, 0.0, 0.0, 0.0, 0.031],
  acc_z_g: [0.0, 0.0, 0.0, 0.0, 0.0, -0.02],
};

/** Snapshot completo de ejemplo (05 §3). La `serie` es corta a propósito. */
export const snapshotEjemplo: Snapshot = {
  meta: metaEjemplo,
  estado: estadoEjemplo,
  salud: saludEjemplo,
  estacion: estacionEjemplo,
  eventos: [eventoEjemplo, eventoFaseEjemplo],
  serie: serieEjemplo,
  backfill: null,
  vuelo_completo_url: null,
};

/** Snapshot de una misión que no ha empezado (05 §3: lo que no existe es null y las listas van vacías). */
export const snapshotVacioEjemplo: Snapshot = {
  meta: { ...metaEjemplo, mission_id: null },
  estado: null,
  salud: null,
  estacion: null,
  eventos: [],
  serie: {
    t_mas_s: [],
    lat: [],
    lon: [],
    alt_agl_m: [],
    vz_ms: [],
    acc_x_g: [],
    acc_y_g: [],
    acc_z_g: [],
  },
  backfill: null,
  vuelo_completo_url: null,
};
