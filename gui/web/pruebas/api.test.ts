// `datos/api.ts` se puede importar y muestra datos de ejemplo; y los estados de la página (03 §4).
import { describe, expect, it } from "vitest";
import { snapshotEjemplo, snapshotVacioEjemplo } from "../src/contrato/ejemplos";
import * as api from "../src/datos/api";
import {
  WEB_DATO_VIEJO_S,
  WEB_SIN_SENAL_S,
  WEB_SIN_TRANSMISION_MIN,
} from "../src/datos/constantes";
import {
  calcularEdadMs,
  calcularEstadoPagina,
  type EntradaEstadoPagina,
} from "../src/datos/estado_pagina";

describe("api.ts con el snapshot de ejemplo", () => {
  it("expone las signals públicas con datos de ejemplo", () => {
    expect(api.meta.value?.mision).toBe("demeter");
    expect(api.estado.value?.fase).toBe("DESCENT");
    expect(api.salud.value?.go_nogo.listo).toBe(true);
    expect(api.estacion.value?.gnss_ok).toBe(true);
    expect(api.eventos.value.map((e) => e.tipo)).toContain("apogeo");
    expect(api.serie.value.t_mas_s.length).toBeGreaterThan(0);
    expect(api.edad.value).toBe(230);
    expect(api.estadoPagina.value.principal).toBe("en_vivo");
  });

  it("la edad crece con el reloj local y el estado de la página cambia en los umbrales", () => {
    api.alimentar.reloj(WEB_DATO_VIEJO_S * 1000);
    expect(api.estadoPagina.value.principal).toBe("senal_debil");
    api.alimentar.reloj((WEB_SIN_SENAL_S + 1) * 1000);
    expect(api.estadoPagina.value.principal).toBe("sin_senal");
    api.alimentar.conexion("reconectando");
    expect(api.estadoPagina.value.principal).toBe("sin_servidor");
    api.alimentar.conexion("conectado");
    api.alimentar.snapshot(snapshotVacioEjemplo, 0);
    expect(api.estado.value).toBeNull();
    expect(api.estadoPagina.value.principal).toBe("cargando");
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
  const base = (): EntradaEstadoPagina => ({
    conexion: "conectado",
    meta: snapshotEjemplo.meta,
    estado: snapshotEjemplo.estado,
    estacion: snapshotEjemplo.estacion,
    backfill: null,
    edadMs: 0,
  });
  const con = (edadMs: number | null, extra: Partial<EntradaEstadoPagina> = {}) =>
    calcularEstadoPagina({ ...base(), edadMs, ...extra }).principal;

  it("en vivo, señal débil y sin señal respetan WEB_DATO_VIEJO_S y WEB_SIN_SENAL_S", () => {
    expect(con(WEB_DATO_VIEJO_S * 1000 - 1)).toBe("en_vivo");
    expect(con(WEB_DATO_VIEJO_S * 1000)).toBe("senal_debil");
    expect(con(WEB_SIN_SENAL_S * 1000)).toBe("senal_debil");
    expect(con(WEB_SIN_SENAL_S * 1000 + 1)).toBe("sin_senal");
  });

  it("sin transmisión: nada del cohete en WEB_SIN_TRANSMISION_MIN, o nunca ha llegado nada", () => {
    expect(con(WEB_SIN_TRANSMISION_MIN * 60_000 - 1)).toBe("sin_senal");
    expect(con(WEB_SIN_TRANSMISION_MIN * 60_000)).toBe("sin_transmision");
    expect(con(null)).toBe("sin_transmision");
    expect(con(0, { estado: null })).toBe("sin_transmision");
  });

  it("la caída del SSE y la carga inicial mandan sobre la edad", () => {
    expect(con(0, { conexion: "reconectando" })).toBe("sin_servidor");
    expect(con(0, { conexion: "cargando" })).toBe("cargando");
    expect(con(0, { estacion: null })).toBe("cargando");
  });

  it("los avisos se superponen: simulación, aterrizado, reconstruyendo, alarma", () => {
    const estado = structuredClone(snapshotEjemplo.estado);
    if (!estado) throw new Error("falta el estado de ejemplo");
    estado.fase = "LANDED";
    estado.alarmas.descenso_rapido = true;
    const meta = { ...snapshotEjemplo.meta, modo: "simulacion" as const };
    const r = calcularEstadoPagina({
      ...base(),
      estado,
      meta,
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
