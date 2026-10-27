import { describe, expect, it } from "vitest";
import { estadoEjemplo, saludEjemplo } from "../src/contrato/ejemplos";
import type { Estado, Fase, Salud } from "../src/contrato/tipos";
import {
  BITS_FALLA,
  fallasActivas,
  nombresDeBits,
  vistaSalud,
  vistaSaludVacia,
} from "../src/mision/vista_salud";

const estadoEn = (fase: Fase, resto: Partial<Estado> = {}): Estado => ({
  ...estadoEjemplo,
  fase,
  ...resto,
});
const saludCon = (resto: Partial<Salud>): Salud => ({ ...saludEjemplo, ...resto });
const bits = (...n: number[]) => n.reduce((acc, b) => acc | (1 << b), 0);

describe("falla = algún bit en `fallas` (protocolo §3)", () => {
  it("los 14 bits tienen nombre; 14 y 15 están reservados", () => {
    expect(BITS_FALLA).toHaveLength(14);
    expect(BITS_FALLA.map((b) => b.bit)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(nombresDeBits(bits(14, 15))).toEqual([]);
  });

  it("decodifica `fallas_bits` y une los nombres que manda el servicio, sin repetir", () => {
    expect(nombresDeBits(bits(0, 10))).toEqual(["LSM6DSO32", "EKF divergente"]);
    const s = saludCon({ fallas: ["BMP581", "LSM6DSO32"], fallas_bits: bits(0) });
    expect(fallasActivas(s).sort()).toEqual(["BMP581", "LSM6DSO32"]);
  });
});

describe("resumen siempre visible (03 §3.8)", () => {
  it("sin `salud`: estado vacío claro, sin chip ni detalle", () => {
    const v = vistaSalud(null, estadoEjemplo, "demeter");
    expect(v).toEqual(vistaSaludVacia());
    expect(v.nivel).toBe("sin_dato");
    expect(v.resumen).toBe("Sin datos de salud todavía");
    expect(v.goNogo).toBeNull();
    expect(v.sensores).toEqual([]);
  });

  it("todo bien: 'Todo en orden'", () => {
    const v = vistaSalud(saludEjemplo, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("ok");
    expect(v.resumen).toBe("Todo en orden");
    expect(v.fallas).toEqual([]);
    expect(v.avisos).toEqual([]);
  });

  it("un sensor en falla: 'Falla en un sensor', con su nombre", () => {
    const s = saludCon({ fallas: ["BMP581"], fallas_bits: bits(1) });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("falla");
    expect(v.resumen).toBe("Falla en un sensor");
    expect(v.fallas).toEqual(["BMP581"]);
    expect(v.sensores.find((f) => f.nombre === "BMP581")?.falla).toBe(true);
    expect(v.sensores.find((f) => f.nombre === "LSM6DSO32")?.falla).toBe(false);
  });

  it("una falla que no es un sensor: 'Falla en un sistema'", () => {
    const v = vistaSalud(
      saludCon({ fallas: ["SD"], fallas_bits: bits(7) }),
      estadoEjemplo,
      "demeter",
    );
    expect(v.resumen).toBe("Falla en un sistema");
    expect(v.sistemas.find((f) => f.nombre === "SD")?.falla).toBe(true);
  });

  it("varias fallas: 'N fallas'", () => {
    const s = saludCon({ fallas: ["BMP581", "SD", "RTC"], fallas_bits: bits(1, 7, 12) });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.resumen).toBe("3 fallas");
    expect(v.fallas).toHaveLength(3);
  });

  it("solo `fallas_bits` (sin nombres): igual hay falla", () => {
    const v = vistaSalud(saludCon({ fallas: [], fallas_bits: bits(4) }), estadoEjemplo, "demeter");
    expect(v.fallas).toEqual(["BME280"]);
    expect(v.nivel).toBe("falla");
  });

  it("un nombre de falla que la web no conoce no se pierde", () => {
    const v = vistaSalud(saludCon({ fallas: ["Bit nuevo"] }), estadoEjemplo, "demeter");
    expect(v.fallas).toEqual(["Bit nuevo"]);
    expect(v.sistemas.at(-1)).toEqual({ bit: -1, nombre: "Bit nuevo", falla: true });
  });

  it("la falla manda sobre los avisos", () => {
    const s = saludCon({
      fallas: ["QMC6310"],
      fallas_bits: bits(5),
      calib: { ...saludEjemplo.calib, mag: false },
    });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("falla");
    expect(v.avisos.map((a) => a.id)).toEqual(["calibraciones"]);
  });
});

describe("avisos: calibraciones y EKF; la batería baja es solo el bit 13", () => {
  it("calibraciones sin terminar: un solo aviso que las nombra", () => {
    const s = saludCon({ calib: { ...saludEjemplo.calib, giro: false, mag: false } });
    const v = vistaSalud(s, estadoEjemplo, "demeter");
    expect(v.nivel).toBe("aviso");
    expect(v.resumen).toBe("1 aviso");
    expect(v.avisos[0]?.texto).toContain("Giróscopo");
    expect(v.avisos[0]?.texto).toContain("Magnetómetro");
    expect(v.calibraciones.filter((c) => !c.completa).map((c) => c.id)).toEqual(["giro", "mag"]);
  });

  it("EKF no listo: aviso; con EKF divergente es una falla y no se repite como aviso", () => {
    const sinEkf = estadoEn("PREFLIGHT", { flags: { ...estadoEjemplo.flags, ekf_ok: false } });
    expect(vistaSalud(saludEjemplo, sinEkf, "demeter").avisos.map((a) => a.id)).toEqual(["ekf"]);
    const diverge = saludCon({ fallas: ["EKF divergente"], fallas_bits: bits(10) });
    const v = vistaSalud(diverge, sinEkf, "demeter");
    expect(v.avisos).toEqual([]);
    expect(v.fallas).toEqual(["EKF divergente"]);
  });

  it("la innovación del EKF solo se muestra: sin umbral en constantes.md no genera aviso", () => {
    const v = vistaSalud(saludCon({ nav_innov_m: 999 }), estadoEjemplo, "demeter");
    expect(v.navegacion.innovacionM).toBe(999);
    expect(v.avisos).toEqual([]);
  });

  it("la web no recalcula la batería: un % bajo sin el bit 13 no genera aviso ni falla", () => {
    const v = vistaSalud(saludEjemplo, estadoEn("ARMED", { bat_pct: 5 }), "demeter");
    expect(v.avisos).toEqual([]);
    expect(v.fallas).toEqual([]);
    expect(v.nivel).toBe("ok");
    expect(v.bateria.pct).toBe(5);
  });

  it("batería baja = la falla del bit 13 que manda el firmware, y el detalle sigue con % y V", () => {
    const s = saludCon({ fallas: ["Batería baja"], fallas_bits: bits(13) });
    const v = vistaSalud(s, estadoEn("ARMED", { bat_pct: 40 }), "demeter");
    expect(v.avisos).toEqual([]);
    expect(v.fallas).toEqual(["Batería baja"]);
    expect(v.nivel).toBe("falla");
    expect(v.sistemas.find((f) => f.nombre === "Batería baja")?.falla).toBe(true);
    expect(v.bateria).toEqual({ pct: 40, voltios: 3.98 });
  });

  it("batería sin dato (`bat_pct` null): ni aviso ni número inventado", () => {
    const v = vistaSalud(saludEjemplo, estadoEn("ARMED", { bat_pct: null }), "demeter");
    expect(v.avisos).toEqual([]);
    expect(v.bateria.pct).toBeNull();
  });

  it("varios avisos: 'N avisos'", () => {
    const s = saludCon({ calib: { ...saludEjemplo.calib, baro: false } });
    const e = estadoEn("PREFLIGHT", { flags: { ...estadoEjemplo.flags, ekf_ok: false } });
    const v = vistaSalud(s, e, "demeter");
    expect(v.resumen).toBe("2 avisos");
  });
});

describe("chip maestro Go/No-Go: solo en PREFLIGHT y ARMED", () => {
  const goNoGo = (ok: boolean) => ({
    listo: ok,
    condiciones: [
      { id: "gnss", nombre: "Satélites y precisión", ok },
      { id: "bateria", nombre: "Batería", ok: true },
      { id: "sd", nombre: "SD", ok },
    ],
  });

  it("en PREFLIGHT con todo en verde", () => {
    const v = vistaSalud(saludCon({ go_nogo: goNoGo(true) }), estadoEn("PREFLIGHT"), "demeter");
    expect(v.goNogo).toMatchObject({ listo: true, faltan: 0 });
    expect(v.goNogo?.condiciones).toHaveLength(3);
  });

  it("en ARMED con condiciones sin cumplir: cuenta las que faltan", () => {
    const v = vistaSalud(saludCon({ go_nogo: goNoGo(false) }), estadoEn("ARMED"), "demeter");
    expect(v.goNogo).toMatchObject({ listo: false, faltan: 2 });
  });

  it("no aparece en las demás fases, ni sin estado", () => {
    const s = saludCon({ go_nogo: goNoGo(true) });
    for (const fase of ["BOOT", "BOOST", "COAST", "DESCENT", "LANDED", "ERROR"] as const) {
      expect(vistaSalud(s, estadoEn(fase), "demeter").goNogo).toBeNull();
    }
    expect(vistaSalud(s, null, "demeter").goNogo).toBeNull();
  });
});

describe("detalle", () => {
  it("la Pi solo existe en Deméter; en Hermes `temp_pi_c` es null y la fila no se muestra", () => {
    const hermes = vistaSalud(saludCon({ temp_pi_c: null }), estadoEjemplo, "hermes");
    expect(hermes.temperatura.mostrarPi).toBe(false);
    expect(hermes.sistemas.some((f) => f.nombre === "UART del VisionPack")).toBe(false);
    const demeter = vistaSalud(saludCon({ temp_pi_c: null }), estadoEjemplo, "demeter");
    expect(demeter.temperatura.mostrarPi).toBe(true);
    expect(demeter.temperatura.piC).toBeNull();
    expect(demeter.sistemas.some((f) => f.nombre === "UART del VisionPack")).toBe(true);
  });

  it("si el UART de la Pi falla en Hermes, se muestra igual", () => {
    const s = saludCon({ fallas: ["UART del VisionPack"], fallas_bits: bits(11) });
    const v = vistaSalud(s, estadoEjemplo, "hermes");
    expect(v.sistemas.find((f) => f.nombre === "UART del VisionPack")?.falla).toBe(true);
  });

  it("el enlace, la batería, la SD y la temperatura salen de salud y estado", () => {
    const v = vistaSalud(saludEjemplo, estadoEjemplo, "demeter");
    expect(v.enlace).toMatchObject({ rssiDbm: -97, snrDb: 6.5, satelites: 11, haccM: 1.8, fix: 3 });
    expect(v.bateria).toEqual({ pct: 87, voltios: 3.98 });
    expect(v.sdLibreMb).toBe(28100);
    expect(v.temperatura).toMatchObject({ espC: 41, piC: 55 });
    expect(v.navegacion).toEqual({ ekfListo: true, innovacionM: 0.84 });
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
    expect(v.temperatura.espC).toBeNull();
    expect(v.navegacion).toEqual({ ekfListo: null, innovacionM: null });
    expect(v.enlace.haccM).toBeNull();
    expect(v.enlace.rssiDbm).toBeNull();
  });
});
