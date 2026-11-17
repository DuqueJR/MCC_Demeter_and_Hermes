import { describe, expect, it } from "vitest";
import { estadoEjemplo, saludEjemplo } from "../src/contrato/ejemplos";
import type { Estado, Salud } from "../src/contrato/tipos";
import { MOTIVOS_PI, PASOS_PI, vistaPi, vistaPiVacia } from "../src/mision/vista_pi";

/** Los `StatusCode` de `visionpack/demeter_protocol.py` (con "DESCONOCIDO" sin latido) y su nivel. */
const NIVEL_POR_ESTADO = {
  BOOT: "espera",
  PREFLIGHT: "espera",
  READY: "espera",
  ARMED: "espera",
  STARTING: "activo",
  ASCENT: "activo",
  RECORDING: "activo",
  INGESTING: "procesando",
  PROCESSING: "procesando",
  COMPLETE: "completo",
  ABORTED: "falla",
  SD_FULL: "falla",
  RATE_FALLBACK: "falla",
  TELEMETRY_LOST: "falla",
  ABORT_REQUESTED: "falla",
  CLOCK_UNSYNCED: "falla",
  PIPELINE_ERROR: "falla",
  DESCONOCIDO: "sin_dato",
} as const;

const conPi = (
  estado: string,
  motivo: string | null = null,
  extra: Partial<Salud> = {},
): Salud => ({
  ...saludEjemplo,
  temp_pi_c: null,
  pi: { estado, motivo, bat_pct: null },
  ...extra,
});
const conCam = (camOk: boolean): Estado => ({
  ...estadoEjemplo,
  act: { ...estadoEjemplo.act, cam_ok: camOk },
});

/** Los modelos de chip que no pueden salir en la web pública (D-065). */
const MODELOS = /LSM6DSO32|BMP581|MMC5983MA|QMI8658|BME280|QMC6310|ESP32/i;

describe("vistaPi: sin dato", () => {
  it("sin `salud`: estado vacío claro, sin pasos ni cámara", () => {
    const v = vistaPi(null, null);
    expect(v).toEqual(vistaPiVacia());
    expect(v.hayDato).toBe(false);
    expect(v.nivel).toBe("sin_dato");
    expect(v.titulo).toBe("Sin datos de la Pi todavía");
    expect(v.pasos).toBeNull();
    expect(v.camara).toBe("sin_dato");
  });

  it("`salud` sin `pi` (la simulación pública) o con `pi: null` es lo mismo que sin dato", () => {
    const sinPi = { ...saludEjemplo } as Salud;
    delete sinPi.pi;
    expect(vistaPi(sinPi, estadoEjemplo).hayDato).toBe(false);
    expect(vistaPi({ ...saludEjemplo, pi: null }, estadoEjemplo).hayDato).toBe(false);
  });

  it("DESCONOCIDO: 'Sin señal de la Pi' (no es una falla) y la cámara sin dato", () => {
    const v = vistaPi(conPi("DESCONOCIDO"), conCam(false));
    expect(v.hayDato).toBe(true);
    expect(v.nivel).toBe("sin_dato");
    expect(v.titulo).toBe("Sin señal de la Pi");
    expect(v.pasos).toBeNull();
    expect(v.camara).toBe("sin_dato");
  });

  it("un estado que no se conoce no se inventa: 'Estado no reconocido', sin dato", () => {
    const v = vistaPi(conPi("OTRO_NUEVO"), estadoEjemplo);
    expect(v.nivel).toBe("sin_dato");
    expect(v.titulo).toBe("Estado no reconocido");
  });
});

describe("vistaPi: el estado de la misión", () => {
  it("cada `StatusCode` tiene su nivel", () => {
    for (const [codigo, nivel] of Object.entries(NIVEL_POR_ESTADO)) {
      expect(vistaPi(conPi(codigo), estadoEjemplo).nivel, codigo).toBe(nivel);
    }
  });

  it("los títulos en español que pidió el equipo", () => {
    const titulo = (c: string) => vistaPi(conPi(c), estadoEjemplo).titulo;
    expect(titulo("BOOT")).toBe("Arrancando");
    expect(titulo("PREFLIGHT")).toBe("Preparándose");
    expect(titulo("READY")).toBe("Lista");
    expect(titulo("ARMED")).toBe("Armada");
    expect(titulo("STARTING")).toBe("Grabando el ascenso");
    expect(titulo("ASCENT")).toBe("Grabando el ascenso");
    expect(titulo("RECORDING")).toBe("Capturando el descenso");
    expect(titulo("INGESTING")).toBe("Procesando imágenes");
    expect(titulo("PROCESSING")).toBe("Procesando imágenes");
    expect(titulo("COMPLETE")).toBe("Misión completa");
  });

  it("todo estado 0xE* dice 'Con falla' y explica cuál", () => {
    const fallas = [
      "ABORTED",
      "SD_FULL",
      "RATE_FALLBACK",
      "TELEMETRY_LOST",
      "ABORT_REQUESTED",
      "CLOCK_UNSYNCED",
      "PIPELINE_ERROR",
    ];
    const detalles = new Set<string>();
    for (const c of fallas) {
      const v = vistaPi(conPi(c), estadoEjemplo);
      expect(v.titulo, c).toBe("Con falla");
      expect(v.detalle.length, c).toBeGreaterThan(10);
      detalles.add(v.detalle);
      expect(v.pasos, c).toBeNull();
    }
    expect(detalles.size).toBe(fallas.length);
  });

  it("los pasos avanzan con la misión y COMPLETE los cierra todos", () => {
    const avance = (c: string) => vistaPi(conPi(c), estadoEjemplo).pasos?.map((p) => p.avance);
    expect(PASOS_PI).toHaveLength(5);
    expect(avance("PREFLIGHT")).toEqual([
      "actual",
      "pendiente",
      "pendiente",
      "pendiente",
      "pendiente",
    ]);
    expect(avance("ARMED")).toEqual(["hecho", "actual", "pendiente", "pendiente", "pendiente"]);
    expect(avance("ASCENT")).toEqual(["hecho", "hecho", "actual", "pendiente", "pendiente"]);
    expect(avance("RECORDING")).toEqual(["hecho", "hecho", "hecho", "actual", "pendiente"]);
    expect(avance("PROCESSING")).toEqual(["hecho", "hecho", "hecho", "hecho", "actual"]);
    expect(avance("COMPLETE")).toEqual(["hecho", "hecho", "hecho", "hecho", "hecho"]);
  });
});

describe("vistaPi: el motivo", () => {
  it("cada `ErrorCode` tiene un texto legible, sin nombres de código", () => {
    for (const m of [
      "SD_ESPACIO",
      "SD_LENTA",
      "RAM",
      "CAMARA",
      "TELEMETRIA",
      "PROCESO",
      "ARCHIVOS",
      "OTRO",
    ]) {
      const texto = MOTIVOS_PI[m];
      expect(texto, m).toBeTruthy();
      expect(texto).not.toMatch(/_/);
      expect(texto).not.toMatch(MODELOS);
    }
    expect(MOTIVOS_PI.SD_ESPACIO).toBe("Poco espacio en la tarjeta");
  });

  it("en una falla el motivo es vigente", () => {
    const v = vistaPi(conPi("SD_FULL", "SD_ESPACIO"), estadoEjemplo);
    expect(v.motivo).toEqual({ texto: "Poco espacio en la tarjeta", vigente: true });
  });

  it("fuera de una falla, un motivo anterior se ve como aviso (no vigente)", () => {
    const v = vistaPi(conPi("PREFLIGHT", "CAMARA"), estadoEjemplo);
    expect(v.motivo).toEqual({ texto: MOTIVOS_PI.CAMARA, vigente: false });
  });

  it("sin motivo, o con uno desconocido, no se inventa nada", () => {
    expect(vistaPi(conPi("ABORTED", null), estadoEjemplo).motivo).toBeNull();
    expect(vistaPi(conPi("ABORTED", "NUEVO"), estadoEjemplo).motivo?.texto).toBe(MOTIVOS_PI.OTRO);
  });
});

describe("vistaPi: cámara, batería y temperatura", () => {
  it("la cámara sale de `estado.act.cam_ok`", () => {
    expect(vistaPi(conPi("READY"), conCam(true)).camara).toBe("lista");
    expect(vistaPi(conPi("ASCENT"), conCam(true)).camara).toBe("grabando");
    expect(vistaPi(conPi("RECORDING"), conCam(true)).camara).toBe("grabando");
    expect(vistaPi(conPi("PREFLIGHT"), conCam(false)).camara).toBe("no_lista");
    expect(vistaPi(conPi("COMPLETE"), conCam(false)).camara).toBe("terminada");
    expect(vistaPi(conPi("PROCESSING"), conCam(false)).camara).toBe("terminada");
  });

  it("falla de cámara: por el motivo o por un estado de falla sin cámara", () => {
    expect(vistaPi(conPi("PREFLIGHT", "CAMARA"), conCam(false)).camara).toBe("falla");
    expect(vistaPi(conPi("ABORTED"), conCam(false)).camara).toBe("falla");
  });

  it("sin `estado` la cámara es 'sin dato'", () => {
    expect(vistaPi(conPi("READY"), null).camara).toBe("sin_dato");
  });

  it("batería y temperatura en `null` (hoy) quedan en `null`, sin afectar el nivel", () => {
    const v = vistaPi(conPi("READY"), conCam(true));
    expect(v.bateriaPct).toBeNull();
    expect(v.temperaturaC).toBeNull();
    expect(v.nivel).toBe("espera");
  });

  it("si algún día llegan, se muestran", () => {
    const s = conPi("READY", null, {
      temp_pi_c: 55,
      pi: { estado: "READY", motivo: null, bat_pct: 87 },
    });
    const v = vistaPi(s, conCam(true));
    expect(v.bateriaPct).toBe(87);
    expect(v.temperaturaC).toBe(55);
  });
});

describe("vistaPi: dato viejo y textos", () => {
  it("pasa la antigüedad en segundos enteros y la marca de viejo", () => {
    const v = vistaPi(conPi("ASCENT"), estadoEjemplo, 7_800, true);
    expect(v.viejo).toBe(true);
    expect(v.edadS).toBe(7);
    expect(vistaPi(conPi("ASCENT"), estadoEjemplo).edadS).toBeNull();
  });

  it("ningún texto trae modelos de chip ni nombres de código", () => {
    const codigos = Object.keys(NIVEL_POR_ESTADO);
    for (const c of codigos) {
      const v = vistaPi(conPi(c, "SD_LENTA"), estadoEjemplo);
      const todo = [
        v.titulo,
        v.detalle,
        v.motivo?.texto ?? "",
        ...(v.pasos ?? []).map((p) => p.nombre),
      ].join(" ");
      expect(todo).not.toMatch(MODELOS);
      expect(todo).not.toMatch(/[A-Z]{3,}_[A-Z]+/);
    }
  });
});
