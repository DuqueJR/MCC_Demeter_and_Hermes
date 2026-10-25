// `datos/api.ts` arranca vacío y se alimenta con los ejemplos solo desde las pruebas;
// y los estados de la página (03 §4).
import { describe, expect, it } from "vitest";
import { snapshotEjemplo, snapshotVacioEjemplo } from "../src/contrato/ejemplos";
import type { Fase } from "../src/contrato/tipos";
import * as api from "../src/datos/api";
import {
  WEB_ALARMA_SOSTENER_S,
  WEB_DATO_VIEJO_S,
  WEB_SIN_SENAL_S,
  WEB_SIN_TRANSMISION_MIN,
} from "../src/datos/constantes";
import {
  calcularEdadMs,
  calcularEstadoPagina,
  type EntradaEstadoPagina,
} from "../src/datos/estado_pagina";

describe("api.ts", () => {
  it("arranca vacío: nada de datos inventados en producción", () => {
    expect(api.meta.value).toBeNull();
    expect(api.estado.value).toBeNull();
    expect(api.salud.value).toBeNull();
    expect(api.estacion.value).toBeNull();
    expect(api.eventos.value).toEqual([]);
    expect(api.serie.value.t_mas_s).toEqual([]);
    expect(api.edad.value).toBeNull();
    expect(api.conexion.value).toBe("cargando");
    expect(api.estadoPagina.value.principal).toBe("cargando");
  });

  it("con el snapshot de ejemplo expone los datos, y los umbrales cambian el estado", () => {
    api.alimentar.snapshot(snapshotEjemplo, 0);
    api.alimentar.conexion("conectado");
    expect(api.meta.value?.mision).toBe("demeter");
    expect(api.estado.value?.fase).toBe("DESCENT");
    expect(api.salud.value?.go_nogo.listo).toBe(true);
    expect(api.estacion.value?.gnss_ok).toBe(true);
    expect(api.eventos.value.map((e) => e.tipo)).toContain("apogeo");
    expect(api.serie.value.t_mas_s.length).toBeGreaterThan(0);
    expect(api.edad.value).toBe(230);
    expect(api.estadoPagina.value.principal).toBe("en_vivo");

    api.alimentar.reloj(WEB_DATO_VIEJO_S * 1000);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
    api.alimentar.reloj(WEB_SIN_SENAL_S * 1000);
    expect(api.estadoPagina.value.principal).toBe("sin_senal");
    api.alimentar.conexion("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    api.alimentar.conexion("conectado");
    api.alimentar.snapshot(snapshotVacioEjemplo, 0);
    expect(api.estado.value).toBeNull();
    expect(api.estadoPagina.value.principal).toBe("cargando");
  });
});

describe("constantes", () => {
  it("WEB_ALARMA_SOSTENER_S replica constantes (10 s)", () => {
    expect(WEB_ALARMA_SOSTENER_S).toBe(10);
  });
});

describe("calcularEdadMs (05 §4.4)", () => {
  it("suma el tiempo local desde la llegada del latido, sin usar el reloj de pared", () => {
    expect(calcularEdadMs(230, 1000, 1500)).toBe(730);
    expect(calcularEdadMs(230, 1000, 900)).toBe(230); // un reloj que retrocede no resta
    expect(calcularEdadMs(null, 0, 5000)).toBeNull();
  });
});

describe("calcularEstadoPagina (03 §4)", () => {
  const MIN = 60_000;
  const base = (): EntradaEstadoPagina => ({
    conexion: "conectado",
    meta: snapshotEjemplo.meta,
    estado: snapshotEjemplo.estado,
    estacion: snapshotEjemplo.estacion,
    backfill: null,
    edadMs: 0,
  });
  const conFase = (fase: Fase) => {
    const estado = structuredClone(snapshotEjemplo.estado);
    if (!estado) throw new Error("falta el estado de ejemplo");
    estado.fase = fase;
    return estado;
  };
  const con = (edadMs: number | null, extra: Partial<EntradaEstadoPagina> = {}) =>
    calcularEstadoPagina({ ...base(), edadMs, ...extra }).principal;

  it("bordes exactos: 2 s es señal débil y 5 s es sin señal", () => {
    expect(con(WEB_DATO_VIEJO_S * 1000 - 1)).toBe("en_vivo");
    expect(con(WEB_DATO_VIEJO_S * 1000)).toBe("senal_debil");
    expect(con(WEB_SIN_SENAL_S * 1000 - 1)).toBe("senal_debil");
    expect(con(WEB_SIN_SENAL_S * 1000)).toBe("sin_senal");
  });

  it("sin transmisión si nunca llegó un dato del cohete", () => {
    expect(con(null)).toBe("sin_transmision");
    expect(con(0, { estado: null })).toBe("sin_transmision");
  });

  it("en vuelo nunca pasa a sin transmisión: sin señal con LKP sin límite de tiempo (GS-03)", () => {
    expect(con(30 * MIN, { estado: conFase("DESCENT") })).toBe("sin_senal");
    expect(con(2 * 60 * MIN, { estado: conFase("LANDED") })).toBe("sin_senal");
    expect(con(WEB_SIN_TRANSMISION_MIN * MIN, { estado: conFase("ARMED") })).toBe("sin_senal");
  });

  it("en banco (BOOT, PREFLIGHT, ERROR) se pasa a sin transmisión a los WEB_SIN_TRANSMISION_MIN", () => {
    expect(con(11 * MIN, { estado: conFase("PREFLIGHT") })).toBe("sin_transmision");
    expect(con(WEB_SIN_TRANSMISION_MIN * MIN, { estado: conFase("BOOT") })).toBe("sin_transmision");
    expect(con(WEB_SIN_TRANSMISION_MIN * MIN, { estado: conFase("ERROR") })).toBe(
      "sin_transmision",
    );
    expect(con(WEB_SIN_TRANSMISION_MIN * MIN - 1, { estado: conFase("PREFLIGHT") })).toBe(
      "sin_senal",
    );
  });

  it("la caída del SSE y la carga inicial mandan sobre la edad", () => {
    expect(con(0, { conexion: "reconectando" })).toBe("sin_servidor");
    expect(con(0, { conexion: "cargando" })).toBe("cargando");
    expect(con(0, { estacion: null })).toBe("cargando");
  });

  it("los avisos se superponen: simulación, aterrizado, reconstruyendo, alarma", () => {
    const estado = conFase("LANDED");
    estado.alarmas.descenso_rapido = true;
    const r = calcularEstadoPagina({
      ...base(),
      estado,
      meta: { ...snapshotEjemplo.meta, modo: "simulacion" },
      backfill: { activo: true, recibidos: 1, esperados: 2, progreso: 0.5, completo: false },
    });
    expect(r).toEqual({
      principal: "en_vivo",
      simulacion: true,
      aterrizado: true,
      reconstruyendo: true,
      alarma_descenso: true,
    });
  });
});
