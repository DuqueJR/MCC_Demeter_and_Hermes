import { describe, expect, it } from "vitest";
import { estadoEjemplo, saludEjemplo } from "../src/contrato/ejemplos";
import type { Estado, Fase, Salud } from "../src/contrato/tipos";
import {
  BITS_FALLA,
  causasDeFalla,
  fallasActivas,
  nombresDeBits,
  respondioAlArmado,
  sinModelos,
  vistaSalud,
  vistaSaludVacia,
} from "../src/mision/vista_salud";

const estadoEn = (fase: Fase, resto: Partial<Estado> = {}): Estado => ({
  ...estadoEjemplo,
  fase,
  ...resto,
});
const conFlags = (fase: Fase, flags: Partial<Estado["flags"]>): Estado =>
  estadoEn(fase, { flags: { ...estadoEjemplo.flags, ...flags } });
const saludCon = (resto: Partial<Salud>): Salud => ({ ...saludEjemplo, ...resto });
const bits = (...n: number[]) => n.reduce((acc, b) => acc | (1 << b), 0);
/** `salud.pi` es opcional y lo agrega T-657: aquí se arma sin depender de su tipo. */
const conPi = (pi: { estado: string; motivo?: string | null }): Salud =>
  ({ ...saludEjemplo, pi }) as Salud;

/** Los modelos de chip que no pueden salir en la web pública (D-065). */
const MODELOS = ["LSM6DSO32", "BMP581", "MMC5983MA", "QMI8658", "BME280", "QMC6310", "ESP32"];
const sinChips = (texto: string) => {
  for (const m of MODELOS) expect(texto.toUpperCase()).not.toContain(m);
};

describe("sin modelos de chip (D-065)", () => {
  it("los 14 bits tienen nombre genérico; 14 y 15 están reservados", () => {
    expect(BITS_FALLA).toHaveLength(14);
    expect(BITS_FALLA.map((b) => b.bit)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (const b of BITS_FALLA) sinChips(b.nombre);
    expect(nombresDeBits(bits(14, 15))).toEqual([]);
    expect(nombresDeBits(bits(0, 10))).toEqual(["Acelerómetro y giróscopo", "EKF divergente"]);
  });

  it("los nombres que manda el servicio con el modelo salen genéricos", () => {
    expect(sinModelos("LSM6DSO32")).toBe("Acelerómetro y giróscopo");
    expect(sinModelos("BMP581")).toBe("Barómetro");
    expect(sinModelos("MMC5983MA")).toBe("Magnetómetro");
    expect(sinModelos("QMI8658")).toBe("Acelerómetro y giróscopo de respaldo");
    expect(sinModelos("BME280")).toBe("Barómetro de respaldo");
    expect(sinModelos("QMC6310")).toBe("Magnetómetro de respaldo");
    expect(sinModelos("Placa (ESP32)")).toBe("Placa (placa)");
    expect(sinModelos("LSM6DSO32 sin datos")).toBe("Acelerómetro y giróscopo sin datos");
    expect(sinModelos("falla del BMP581 en vuelo")).toBe("falla del barómetro en vuelo");
    expect(sinModelos("SD llena")).toBe("SD llena");
  });

  it("`fallas` con modelos y `fallas_bits` se unen, sin repetir y sin chips", () => {
    const s = saludCon({ fallas: ["BMP581", "LSM6DSO32"], fallas_bits: bits(0) });
    const nombres = fallasActivas(s);
    expect(nombres.sort()).toEqual(["Acelerómetro y giróscopo", "Barómetro"]);
    for (const n of nombres) sinChips(n);
  });

  it("las condiciones del Go/No-Go que traen el modelo salen genéricas", () => {
    const s = saludCon({
      go_nogo: {
        listo: false,
        condiciones: [
          { id: "lsm", nombre: "LSM6DSO32 con datos", ok: false },
          { id: "bmp", nombre: "BMP581 con datos", ok: true },
          { id: "otro", nombre: "QMC6310 sin lectura", ok: false },
          { id: "sd", nombre: "SD registrando", ok: true },
        ],
      },
    });
    const v = vistaSalud(s, estadoEn("PREFLIGHT"), "demeter");
    const nombres = v.goNogo?.condiciones.map((c) => c.nombre);
    expect(nombres).toEqual([
      "Acelerómetro y giróscopo con datos",
      "Barómetro con datos",
      "Magnetómetro de respaldo sin lectura",
      "SD registrando",
    ]);
    sinChips(JSON.stringify(v));
  });
});

describe("estado general: una sola fila", () => {
  it("sin `salud`: estado vacío claro, sin chip ni detalle", () => {
    const v = vistaSalud(null, estadoEjemplo, "demeter");
    expect(v).toEqual(vistaSaludVacia());
    expect(v.nivel).toBe("sin_dato");
    expect(v.resumen).toBe("Sin datos de salud todavía");
    expect(v.goNogo).toBeNull();
  });

  it("todo bien: 'Sin fallas reportadas'", () => {
    const v = vistaSalud(saludEjemplo, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("ok");
    expect(v.resumen).toBe("Sin fallas reportadas");
    expect(v.causas).toEqual([]);
  });

  it("una falla con nombre: 'Falla: <qué>'", () => {
    const s = saludCon({ fallas: ["BMP581"], fallas_bits: bits(1) });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("falla");
    expect(v.resumen).toBe("Falla: Barómetro");
    expect(v.causas).toEqual(["Barómetro"]);
  });

  it("varias fallas: 'N fallas' y la lista completa", () => {
    const s = saludCon({ fallas: ["BMP581", "SD", "RTC"], fallas_bits: bits(1, 7, 12) });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.resumen).toBe("3 fallas");
    expect(v.causas).toHaveLength(3);
  });

  it("solo `fallas_bits` (sin nombres): igual hay falla", () => {
    const v = vistaSalud(saludCon({ fallas: [], fallas_bits: bits(4) }), estadoEjemplo, "demeter");
    expect(v.causas).toEqual(["Barómetro de respaldo"]);
    expect(v.nivel).toBe("falla");
  });

  it("un nombre de falla que la web no conoce no se pierde", () => {
    const v = vistaSalud(saludCon({ fallas: ["Bit nuevo"] }), estadoEjemplo, "demeter");
    expect(v.causas).toEqual(["Bit nuevo"]);
  });
});

describe("estado general con lo que SÍ llega (`fallas` va siempre vacío)", () => {
  it("`flags.falla_activa` sin nombres: falla", () => {
    const v = vistaSalud(saludEjemplo, conFlags("COAST", { falla_activa: true }), "demeter");
    expect(v.resumen).toBe("Falla: El cohete reporta una falla");
  });

  it("`falla_activa` con nombres: no repite la causa genérica", () => {
    const s = saludCon({ fallas: ["SD"], fallas_bits: bits(7) });
    const v = vistaSalud(s, conFlags("COAST", { falla_activa: true }), "demeter");
    expect(v.causas).toEqual(["SD"]);
  });

  it("fase ERROR: falla", () => {
    expect(vistaSalud(saludEjemplo, estadoEn("ERROR"), "demeter").causas).toContain(
      "El cohete está en estado de error",
    );
  });

  it("EKF no listo: falla; en BOOT no se juzga", () => {
    const sinEkf = conFlags("PREFLIGHT", { ekf_ok: false });
    expect(vistaSalud(saludEjemplo, sinEkf, "demeter").causas).toEqual([
      "Navegación del cohete no lista",
    ]);
    expect(vistaSalud(saludEjemplo, conFlags("BOOT", { ekf_ok: false }), "demeter").causas).toEqual(
      [],
    );
  });

  it("EKF divergente nombrado: no se repite como 'no lista'", () => {
    const s = saludCon({ fallas: ["EKF divergente"], fallas_bits: bits(10) });
    const v = vistaSalud(s, conFlags("COAST", { ekf_ok: false }), "demeter");
    expect(v.causas).toEqual(["EKF divergente"]);
  });

  it("sin fix del GNSS: falla; en BOOT no se juzga", () => {
    const v = vistaSalud(saludEjemplo, conFlags("PREFLIGHT", { gnss_fix: false }), "demeter");
    expect(v.resumen).toBe("Falla: Sin fix del GNSS");
    expect(
      vistaSalud(saludEjemplo, conFlags("BOOT", { gnss_fix: false }), "demeter").causas,
    ).toEqual([]);
  });

  it("EKF y GNSS a la vez: '2 fallas' con las dos causas", () => {
    const e = conFlags("PREFLIGHT", { ekf_ok: false, gnss_fix: false });
    const v = vistaSalud(saludEjemplo, e, "demeter");
    expect(v.resumen).toBe("2 fallas");
    expect(v.causas).toEqual(["Navegación del cohete no lista", "Sin fix del GNSS"]);
  });

  it("dato viejo (enlace): falla con la antigüedad; fresco no", () => {
    const viejo = vistaSalud(saludEjemplo, estadoEjemplo, "demeter", 20_400, true);
    expect(viejo.resumen).toBe("Falla: Sin datos recientes del cohete (último hace 20 s)");
    const fresco = vistaSalud(saludEjemplo, estadoEjemplo, "demeter", 500, false);
    expect(fresco.causas).toEqual([]);
  });

  it("batería baja: el bit 13 que manda el firmware", () => {
    const s = saludCon({ fallas: ["Batería baja"], fallas_bits: bits(13) });
    const v = vistaSalud(s, estadoEn("ARMED", { bat_pct: 40 }), "demeter");
    expect(v.causas).toEqual(["Batería baja"]);
    expect(v.bateria).toEqual({ pct: 40, voltios: 3.98 });
  });

  it("batería baja antes del vuelo: la condición `bateria` del Go/No-Go (umbral del servicio)", () => {
    const s = saludCon({
      go_nogo: {
        listo: false,
        condiciones: [{ id: "bateria", nombre: "Bateria suficiente", ok: false }],
      },
    });
    expect(vistaSalud(s, estadoEn("PREFLIGHT"), "demeter").causas).toEqual(["Batería baja"]);
    // En vuelo la condición del Go/No-Go ya no aplica.
    expect(vistaSalud(s, estadoEn("COAST"), "demeter").causas).toEqual([]);
  });

  it("la web no inventa un umbral: un % bajo sin el bit ni la condición no es falla", () => {
    const v = vistaSalud(saludEjemplo, estadoEn("ARMED", { bat_pct: 5 }), "demeter");
    expect(v.causas).toEqual([]);
    expect(v.nivel).toBe("ok");
    expect(v.bateria.pct).toBe(5);
  });

  it("batería sin dato (`bat_pct` null): ni falla ni número inventado", () => {
    const v = vistaSalud(saludEjemplo, estadoEn("ARMED", { bat_pct: null }), "demeter");
    expect(v.causas).toEqual([]);
    expect(v.bateria.pct).toBeNull();
  });

  it("la Pi (`salud.pi`, opcional): solo un estado de error es falla", () => {
    for (const estado of ["ABORTED", "SD_FULL", "PIPELINE_ERROR"]) {
      const v = vistaSalud(conPi({ estado }), estadoEjemplo, "demeter");
      expect(v.nivel).toBe("falla");
      expect(v.causas[0]).toMatch(/^Cámara: /);
    }
    expect(
      vistaSalud(conPi({ estado: "SD_FULL", motivo: "SD_ESPACIO" }), estadoEjemplo, "demeter")
        .resumen,
    ).toBe("Falla: Cámara: tarjeta SD llena (sin espacio en la SD)");
    for (const estado of ["RECORDING", "READY", "ARMED", "COMPLETE", "DESCONOCIDO"]) {
      expect(vistaSalud(conPi({ estado }), estadoEjemplo, "demeter").causas).toEqual([]);
    }
  });

  it("sin `salud.pi` (Hermes, o el contrato sin T-657) o con `null`: sin causa de la Pi", () => {
    expect(vistaSalud(saludEjemplo, estadoEjemplo, "hermes").causas).toEqual([]);
    const nula = { ...saludEjemplo, pi: null } as Salud;
    expect(vistaSalud(nula, estadoEjemplo, "hermes").causas).toEqual([]);
  });

  it("sin `estado` solo se juzga lo que viene en `salud`", () => {
    expect(causasDeFalla(saludEjemplo, null, null, false)).toEqual([]);
    expect(causasDeFalla(saludCon({ fallas: ["SD"] }), null, null, false)).toEqual(["SD"]);
  });
});

describe("antes de armar: 'Esperando armado', no 'No Go' (hallazgo A7)", () => {
  /** Lo que `web1.py` manda sin que el cohete haya respondido a un armado: solo gnss, bateria y reserva. */
  const antesDeArmar = (gnssOk: boolean) => ({
    listo: false,
    condiciones: [
      { id: "gnss", nombre: "Fix 3D del GNSS", ok: gnssOk },
      { id: "bateria", nombre: "Bateria suficiente", ok: true },
      { id: "reserva", nombre: "Reserva de la SD completa", ok: false },
    ],
  });
  /** La respuesta NO APTO a un armado: el checklist completo. */
  const armadoNegado = {
    listo: false,
    condiciones: [
      { id: "reserva", nombre: "Reserva de la SD completa", ok: true },
      { id: "sd", nombre: "SD registrando", ok: true },
      { id: "lsm", nombre: "LSM6DSO32 con datos", ok: false },
      { id: "bmp", nombre: "BMP581 con datos", ok: true },
      { id: "gnss", nombre: "Fix 3D del GNSS", ok: true },
      { id: "bateria", nombre: "Bateria suficiente", ok: true },
      { id: "movimiento", nombre: "Cohete quieto (1 g)", ok: true },
    ],
  };
  const aptoAlArmar = {
    listo: true,
    condiciones: armadoNegado.condiciones.map((c) => ({ ...c, ok: true })),
  };

  it("PREFLIGHT sin respuesta al armado: 'esperando', con las condiciones visibles", () => {
    const v = vistaSalud(
      saludCon({ go_nogo: antesDeArmar(true) }),
      estadoEn("PREFLIGHT"),
      "demeter",
    );
    expect(v.goNogo?.estado).toBe("esperando");
    expect(v.goNogo?.condiciones).toHaveLength(3);
    expect(v.goNogo?.faltan).toBe(1);
  });

  it("esperando aunque falle una condición visible (sin fix): sigue sin ser 'No Go'", () => {
    const v = vistaSalud(
      saludCon({ go_nogo: antesDeArmar(false) }),
      estadoEn("PREFLIGHT"),
      "demeter",
    );
    expect(v.goNogo?.estado).toBe("esperando");
  });

  it("el cohete negó el armado: 'nogo' con lo que falta", () => {
    const v = vistaSalud(saludCon({ go_nogo: armadoNegado }), estadoEn("PREFLIGHT"), "demeter");
    expect(v.goNogo).toMatchObject({ estado: "nogo", faltan: 1 });
  });

  it("el cohete respondió APTO: 'go'", () => {
    const pre = vistaSalud(saludCon({ go_nogo: aptoAlArmar }), estadoEn("PREFLIGHT"), "demeter");
    expect(pre.goNogo).toMatchObject({ estado: "go", faltan: 0, armado: false });
    const armado = vistaSalud(saludCon({ go_nogo: aptoAlArmar }), estadoEn("ARMED"), "demeter");
    expect(armado.goNogo).toMatchObject({ estado: "go", armado: true });
  });

  it("ARMED sin respuesta registrada (el dashboard se reinició): no hay chip que esperar", () => {
    const v = vistaSalud(saludCon({ go_nogo: antesDeArmar(true) }), estadoEn("ARMED"), "demeter");
    expect(v.goNogo).toBeNull();
  });

  it("`respondioAlArmado`: solo con ids del checklist completo", () => {
    expect(respondioAlArmado(antesDeArmar(true).condiciones)).toBe(false);
    expect(respondioAlArmado(armadoNegado.condiciones)).toBe(true);
    expect(respondioAlArmado([])).toBe(false);
  });

  it("no aparece en las demás fases, ni sin estado", () => {
    const s = saludCon({ go_nogo: aptoAlArmar });
    for (const fase of ["BOOT", "BOOST", "COAST", "DESCENT", "LANDED", "ERROR"] as const) {
      expect(vistaSalud(s, estadoEn(fase), "demeter").goNogo).toBeNull();
    }
    expect(vistaSalud(s, null, "demeter").goNogo).toBeNull();
  });

  it("el estado general no dice 'No Go' ni 'Falla' por estar esperando", () => {
    const v = vistaSalud(
      saludCon({ go_nogo: antesDeArmar(true) }),
      estadoEn("PREFLIGHT"),
      "demeter",
    );
    expect(v.resumen).toBe("Sin fallas reportadas");
  });
});

describe("detalle", () => {
  it("el enlace, la batería, la SD y la temperatura de la placa salen de salud y estado", () => {
    const v = vistaSalud(saludEjemplo, estadoEjemplo, "demeter");
    expect(v.enlace).toMatchObject({ rssiDbm: -97, snrDb: 6.5, satelites: 11, haccM: 1.8, fix: 3 });
    expect(v.bateria).toEqual({ pct: 87, voltios: 3.98 });
    expect(v.sdLibreMb).toBe(28100);
    expect(v.temperatura).toEqual({ placaC: 41 });
    expect(v.navegacion).toEqual({ ekfListo: true, innovacionM: 0.84 });
  });

  it("la vista no trae calibraciones, sensores, sistemas ni la Pi", () => {
    const v = vistaSalud(saludEjemplo, estadoEjemplo, "demeter");
    for (const clave of ["calibraciones", "sensores", "sistemas", "avisos"]) {
      expect(v).not.toHaveProperty(clave);
    }
    expect(v.temperatura).not.toHaveProperty("piC");
  });

  it("calibraciones sin terminar no generan ningún aviso ni falla", () => {
    const s = saludCon({
      calib: { giro: false, mag: false, baro: false, origen: false, actitud: false },
    });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.causas).toEqual([]);
    expect(v.resumen).toBe("Sin fallas reportadas");
  });

  it("con lecturas null no inventa números", () => {
    const s = saludCon({
      bat_mv: null,
      sd_libre_mb: null,
      temp_esp_c: null,
      nav_innov_m: null,
      rssi_tierra_dbm: null,
      gnss: { fix: 0, sv: 0, hacc_m: null },
    });
    const v = vistaSalud(s, null, "demeter");
    expect(v.bateria).toEqual({ pct: null, voltios: null });
    expect(v.sdLibreMb).toBeNull();
    expect(v.temperatura.placaC).toBeNull();
    expect(v.navegacion).toEqual({ ekfListo: null, innovacionM: null });
    expect(v.enlace.haccM).toBeNull();
    expect(v.enlace.rssiDbm).toBeNull();
  });
});
