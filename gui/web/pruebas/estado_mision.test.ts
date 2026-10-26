import { describe, expect, it } from "vitest";
import { estadoEjemplo } from "../src/contrato/ejemplos";
import type { Estado, Evento, Fase, TipoEvento } from "../src/contrato/tipos";
import { SostenedorAlarma } from "../src/mision/alarma";
import { numero } from "../src/mision/formato";
import { construirPasos } from "../src/mision/linea_fases";
import { calcularObjetivos } from "../src/mision/objetivos";
import { datoViejo, sentidoVertical, textoONulo, vistaTelemetria } from "../src/mision/telemetria";

const estadoEn = (fase: Fase, resto: Partial<Estado> = {}): Estado => ({
  ...estadoEjemplo,
  fase,
  ...resto,
});

function ev(tipo: TipoEvento, t_mas_s: number | null, extra: Partial<Evento> = {}): Evento {
  return {
    tipo,
    t_ms: 1_000_000 + (t_mas_s ?? 0) * 1000,
    utc_ms: null,
    t_mas_s,
    valor: null,
    fase: null,
    activa: null,
    ...extra,
  };
}
const cambioDeFase = (fase: Fase, t: number | null) => ev("fase", t, { fase });

/** Los eventos del escenario `nominal` de Deméter, hasta el aterrizaje (dev/datos). */
const NOMINAL: Evento[] = [
  cambioDeFase("ARMED", null),
  ev("despegue", 0),
  cambioDeFase("BOOST", 0),
  ev("camaras", 0),
  ev("fin_combustion", 2.04),
  cambioDeFase("COAST", 2.04),
  ev("eyeccion", 10.04),
  ev("apogeo", 11.51, { valor: 669.3 }),
  cambioDeFase("APOGEE", 11.51),
  cambioDeFase("DESCENT", 11.72),
  ev("aterrizaje", 85.05),
  cambioDeFase("LANDED", 85.05),
];
const hasta = (n: number) => NOMINAL.slice(0, n);

const situaciones = (e: Estado | null, evs: Evento[]) =>
  construirPasos(e, evs).map((p) => `${p.id}:${p.situacion}`);

describe("línea de fases (03 §3.2)", () => {
  it("sin datos, todos los pasos están pendientes y no hay 'Cayendo'", () => {
    expect(situaciones(null, [])).toEqual([
      "rampa:pendiente",
      "despegue:pendiente",
      "inercia:pendiente",
      "apogeo:pendiente",
      "paracaidas:pendiente",
      "tierra:pendiente",
    ]);
  });

  it("en la rampa (ARMED), el actual es la rampa y no tiene T+", () => {
    const pasos = construirPasos(estadoEn("ARMED"), hasta(1));
    expect(pasos[0]).toMatchObject({ id: "rampa", situacion: "actual", tMasS: null });
    expect(pasos.slice(1).every((p) => p.situacion === "pendiente")).toBe(true);
  });

  it("se encienden en orden, cada uno con el T+ de su evento", () => {
    const pasos = construirPasos(estadoEn("COAST"), hasta(6));
    expect(pasos.map((p) => [p.id, p.situacion, p.tMasS])).toEqual([
      ["rampa", "hecho", null],
      ["despegue", "hecho", 0],
      ["inercia", "actual", 2.04],
      ["apogeo", "pendiente", null],
      ["paracaidas", "pendiente", null],
      ["tierra", "pendiente", null],
    ]);
  });

  it("en tierra, todo está hecho y el último es el actual, con los T+ del vuelo", () => {
    const pasos = construirPasos(estadoEn("LANDED"), NOMINAL);
    expect(pasos.map((p) => [p.id, p.situacion, p.tMasS])).toEqual([
      ["rampa", "hecho", null],
      ["despegue", "hecho", 0],
      ["inercia", "hecho", 2.04],
      ["apogeo", "hecho", 11.51],
      ["paracaidas", "hecho", 11.72],
      ["tierra", "actual", 85.05],
    ]);
  });

  it("'Cayendo' (FREE_FALL) solo aparece si ocurre", () => {
    expect(construirPasos(estadoEn("DESCENT"), NOMINAL).some((p) => p.id === "caida")).toBe(false);
    const conCaida = [...hasta(9), cambioDeFase("FREE_FALL", 12), cambioDeFase("DESCENT", 15)];
    const pasos = construirPasos(estadoEn("DESCENT"), conCaida);
    expect(pasos.map((p) => p.id)).toEqual([
      "rampa",
      "despegue",
      "inercia",
      "apogeo",
      "caida",
      "paracaidas",
      "tierra",
    ]);
    expect(pasos.find((p) => p.id === "caida")).toMatchObject({ situacion: "hecho", tMasS: 12 });
    // Si el estado actual es FREE_FALL, aparece aunque aún no llegue el evento.
    const ahora = construirPasos(estadoEn("FREE_FALL"), hasta(9));
    expect(ahora.find((p) => p.id === "caida")?.situacion).toBe("actual");
  });

  it("al abrir la página a mitad de vuelo (sin eventos), la fase actual deja atrás los pasos previos", () => {
    const pasos = construirPasos(estadoEn("DESCENT"), []);
    expect(pasos.map((p) => `${p.id}:${p.situacion}`)).toEqual([
      "rampa:hecho",
      "despegue:hecho",
      "inercia:hecho",
      "apogeo:hecho",
      "paracaidas:actual",
      "tierra:pendiente",
    ]);
    // No inventa horas: sin evento no hay T+.
    expect(pasos.every((p) => p.tMasS === null)).toBe(true);
  });

  it("ERROR es solo de tierra: queda en la rampa", () => {
    expect(construirPasos(estadoEn("ERROR"), [])[0]).toMatchObject({ situacion: "actual" });
  });
});

describe("objetivos de la misión (03 §3.2)", () => {
  const enciende = (e: Estado | null, evs: Evento[], m: "demeter" | "hermes" = "demeter") =>
    calcularObjetivos(e, evs, m)
      .filter((o) => o.encendido)
      .map((o) => o.id);

  it("antes del vuelo no hay ninguno encendido", () => {
    const e = estadoEn("ARMED", {
      flags: { ...estadoEjemplo.flags, eyeccion: false, apogeo: false },
      act: { ...estadoEjemplo.act, cam_ok: false },
    });
    expect(enciende(e, hasta(1))).toEqual([]);
    expect(enciende(null, [])).toEqual([]);
  });

  it("se encienden solos, en orden, con el T+ de su evento", () => {
    const flagsFuera = { ...estadoEjemplo.flags, eyeccion: false, apogeo: false };
    const act = { ...estadoEjemplo.act, cam_ok: true };
    const coast = estadoEn("COAST", { flags: flagsFuera, act });
    expect(enciende(coast, hasta(6))).toEqual(["despegue", "fin_combustion", "camaras"]);
    const antesApogeo = estadoEn("COAST", { flags: { ...flagsFuera, eyeccion: true }, act });
    expect(enciende(antesApogeo, hasta(7))).toEqual([
      "despegue",
      "fin_combustion",
      "eyeccion",
      "camaras",
    ]);
    const todos = calcularObjetivos(estadoEn("LANDED"), NOMINAL, "demeter");
    expect(todos.map((o) => [o.id, o.encendido, o.tMasS])).toEqual([
      ["despegue", true, 0],
      ["fin_combustion", true, 2.04],
      ["eyeccion", true, 10.04],
      ["apogeo", true, 11.51],
      ["aterrizaje", true, 85.05],
      ["camaras", true, 0],
    ]);
    expect(todos.find((o) => o.id === "apogeo")?.altitudM).toBe(669.3);
  });

  it("salen de fase y flags aunque no haya eventos (página abierta a mitad de vuelo)", () => {
    expect(enciende(estadoEn("DESCENT"), [])).toEqual([
      "despegue",
      "fin_combustion",
      "eyeccion",
      "apogeo",
      "camaras",
    ]);
    expect(calcularObjetivos(estadoEn("DESCENT"), [], "demeter")[0]?.tMasS).toBeNull();
  });

  it("'Cámaras grabando' solo existe en Deméter y sigue a act.cam_ok", () => {
    expect(
      calcularObjetivos(estadoEn("DESCENT"), NOMINAL, "hermes").map((o) => o.id),
    ).not.toContain("camaras");
    const sinCamara = estadoEn("DESCENT", { act: { ...estadoEjemplo.act, cam_ok: false } });
    expect(enciende(sinCamara, NOMINAL)).not.toContain("camaras");
  });

  it("aterrizaje se enciende con la fase LANDED o con su evento", () => {
    expect(enciende(estadoEn("LANDED"), [])).toContain("aterrizaje");
    expect(enciende(estadoEn("DESCENT"), [ev("aterrizaje", 85)])).toContain("aterrizaje");
    expect(enciende(estadoEn("DESCENT"), [])).not.toContain("aterrizaje");
  });
});

describe("telemetría (03 §3.3)", () => {
  it("sin estado, todo es sin dato", () => {
    const v = vistaTelemetria(null, [], null, "sin_transmision");
    expect(v.altitud.valor).toBeNull();
    expect(v.vertical.valor).toBeNull();
    expect(v.aceleracion).toBeNull();
    expect(v.apogeo).toEqual({ alturaM: null, tMasS: null });
  });

  it("toma altitud, velocidades y aceleración del estado", () => {
    const v = vistaTelemetria(estadoEjemplo, [], null, "en_vivo");
    expect(v.altitud).toEqual({ valor: 312.4, lkp: false });
    expect(v.vertical).toEqual({ valor: -9.21, sentido: "baja" });
    expect(v.total).toBe(9.29);
    expect(v.aceleracion).toEqual({ x: 1.012, y: 0.031, z: -0.02 });
  });

  it("el apogeo queda fijo con su altura y el T+ del evento", () => {
    const v = vistaTelemetria(estadoEjemplo, NOMINAL, null, "en_vivo");
    expect(v.apogeo).toEqual({ alturaM: 669.3, tMasS: 11.51 });
  });

  it("sin el evento, el apogeo sale de salud.apogeo_m cuando flags.apogeo ya está (sin T+)", () => {
    const salud = { apogeo_m: 669.1 } as Parameters<typeof vistaTelemetria>[2];
    expect(vistaTelemetria(estadoEjemplo, [], salud, "en_vivo").apogeo).toEqual({
      alturaM: 669.1,
      tMasS: null,
    });
    const antes = estadoEn("COAST", { flags: { ...estadoEjemplo.flags, apogeo: false } });
    expect(vistaTelemetria(antes, [], salud, "en_vivo").apogeo.alturaM).toBeNull();
  });

  it("sin velocidad (sin fix ni EKF) las velocidades son sin dato, no cero", () => {
    const v = vistaTelemetria(estadoEn("COAST", { vel: null }), [], null, "en_vivo");
    expect(v.vertical).toEqual({ valor: null, sentido: null });
    expect(v.total).toBeNull();
  });

  it("sin posición o sin señal, la altitud es la última conocida (LKP, GS-03)", () => {
    const sinPos = estadoEn("DESCENT", { pos: null });
    expect(vistaTelemetria(sinPos, [], null, "en_vivo").altitud).toEqual({
      valor: 312.4,
      lkp: true,
    });
    expect(vistaTelemetria(estadoEjemplo, [], null, "sin_senal").altitud.lkp).toBe(true);
    const sinNada = estadoEn("DESCENT", { pos: null, lkp: null });
    expect(vistaTelemetria(sinNada, [], null, "sin_senal").altitud).toEqual({
      valor: null,
      lkp: true,
    });
  });

  it("la flecha sigue el signo de lo que se muestra; 0,0 no tiene flecha", () => {
    expect(sentidoVertical(24.6)).toBe("sube");
    expect(sentidoVertical(-0.4)).toBe("baja");
    expect(sentidoVertical(0)).toBe("quieto");
    expect(sentidoVertical(0.04)).toBe("quieto");
    expect(sentidoVertical(-0.04)).toBe("quieto");
    expect(sentidoVertical(0.05)).toBe("sube");
  });

  it("el dato es viejo desde WEB_DATO_VIEJO_S (2 s) en adelante, al milisegundo", () => {
    expect(datoViejo(null)).toBe(false);
    expect(datoViejo(0)).toBe(false);
    expect(datoViejo(1999)).toBe(false);
    expect(datoViejo(2000)).toBe(true);
    expect(datoViejo(38_000)).toBe(true);
  });

  it("formato: coma decimal, unidades aparte y sin dato como guion", () => {
    expect(textoONulo(312.4, 0)).toBe("312");
    expect(textoONulo(-9.21, 1)).toBe("−9,2");
    expect(textoONulo(1.012, 2)).toBe("1,01");
    expect(textoONulo(null, 1)).toBe("—");
  });

  it("un valor que redondea a cero no lleva signo menos", () => {
    expect(numero(-0.04, 1)).toBe("0,0");
    expect(numero(-0.004, 2)).toBe("0,00");
    expect(numero(-0.05, 1)).toBe("−0,1");
    expect(numero(0, 1)).toBe("0,0");
  });
});

describe("sostener el banner de alarma (03 §4, D-W18)", () => {
  /** Un programador falso: guarda los plazos y los dispara a mano. */
  function falso() {
    const plazos: { f: () => void; ms: number; cancelado: boolean }[] = [];
    const programar = (f: () => void, ms: number) => {
      const p = { f, ms, cancelado: false };
      plazos.push(p);
      return () => {
        p.cancelado = true;
      };
    };
    const vencer = () => {
      for (const p of plazos) if (!p.cancelado) p.f();
    };
    return { plazos, programar, vencer };
  }

  it("no se ve mientras la alarma no se active", () => {
    const f = falso();
    const s = new SostenedorAlarma(10_000, f.programar);
    s.actualizar(false);
    expect(s.visible.value).toBe(false);
    expect(f.plazos).toHaveLength(0);
  });

  it("se ve de inmediato al activarse y sigue visible mientras dure", () => {
    const f = falso();
    const s = new SostenedorAlarma(10_000, f.programar);
    s.actualizar(true);
    expect(s.visible.value).toBe(true);
    expect(s.sosteniendo.value).toBe(false);
    s.actualizar(true);
    expect(f.plazos).toHaveLength(0);
  });

  it("al apagarse sigue WEB_ALARMA_SOSTENER_S (10 s) más y luego desaparece", () => {
    const f = falso();
    const s = new SostenedorAlarma(undefined, f.programar);
    s.actualizar(true);
    s.actualizar(false);
    expect(s.visible.value).toBe(true);
    expect(s.sosteniendo.value).toBe(true);
    expect(f.plazos).toHaveLength(1);
    expect(f.plazos[0]?.ms).toBe(10_000);
    f.vencer();
    expect(s.visible.value).toBe(false);
    expect(s.sosteniendo.value).toBe(false);
  });

  it("si se reactiva antes del plazo, el plazo se cancela y no hay parpadeo", () => {
    const f = falso();
    const s = new SostenedorAlarma(10_000, f.programar);
    s.actualizar(true);
    s.actualizar(false);
    s.actualizar(true);
    expect(f.plazos[0]?.cancelado).toBe(true);
    expect(s.sosteniendo.value).toBe(false);
    f.vencer();
    expect(s.visible.value).toBe(true);
    // Y al apagarse otra vez, empieza un plazo completo nuevo.
    s.actualizar(false);
    expect(f.plazos).toHaveLength(2);
    expect(f.plazos[1]?.ms).toBe(10_000);
  });

  it("detener cancela el plazo pendiente", () => {
    const f = falso();
    const s = new SostenedorAlarma(10_000, f.programar);
    s.actualizar(true);
    s.actualizar(false);
    s.detener();
    expect(f.plazos[0]?.cancelado).toBe(true);
  });
});
