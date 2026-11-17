// La serie viva y el criterio de "posterior al snapshot" (T-631).
import { describe, expect, it } from "vitest";
import {
  backfillEjemplo,
  estacionEjemplo,
  estadoEjemplo,
  eventoEjemplo,
  eventoFaseEjemplo,
  saludEjemplo,
  serieEjemplo,
  snapshotEjemplo,
  snapshotVacioEjemplo,
} from "../src/contrato/ejemplos";
import type { Estado, Fase, Snapshot } from "../src/contrato/tipos";
import { WEB_SERIE_MAX_PUNTOS } from "../src/datos/constantes";
import { claveEvento, esPosterior, type MensajeSse } from "../src/datos/costura";
import { SERIE_RECORTE_FRACCION } from "../src/datos/parametros";
import { SerieViva, serieVacia, tMasS } from "../src/datos/serie";

const estadoEn = (t_ms: number, fase: Fase = "COAST"): Estado => ({ ...estadoEjemplo, t_ms, fase });

describe("SerieViva", () => {
  it("agrega un punto por estado, con T+ de 2 decimales y null antes del despegue", () => {
    const v = new SerieViva();
    v.agregar(estadoEn(1000), null);
    v.agregar(estadoEn(2111), 1000);
    const s = v.serie();
    expect(s.t_mas_s).toEqual([null, 1.11]);
    expect(s.alt_agl_m).toEqual([312.4, 312.4]);
    expect(s.vz_ms).toEqual([-9.21, -9.21]);
    expect(new Set(Object.values(s).map((c) => c.length))).toEqual(new Set([2]));
  });

  it("sin posición ni velocidad deja null en esas columnas (no inventa)", () => {
    const v = new SerieViva();
    v.agregar({ ...estadoEn(0), pos: null, vel: null }, null);
    const s = v.serie();
    expect([s.lat[0], s.lon[0], s.alt_agl_m[0], s.vz_ms[0]]).toEqual([null, null, null, null]);
    expect(s.acc_x_g[0]).toBe(estadoEjemplo.acc_g.x);
  });

  it("serie() es una copia: lo ya publicado no cambia al agregar", () => {
    const v = new SerieViva();
    v.agregar(estadoEn(0), null);
    const publicada = v.serie();
    v.agregar(estadoEn(100), null);
    expect(publicada.t_mas_s).toHaveLength(1);
    expect(v.serie().t_mas_s).toHaveLength(2);
  });

  it("desde(snapshot) conserva las columnas y sigue agregando", () => {
    const v = SerieViva.desde(serieEjemplo);
    v.agregar(estadoEn(1_300_000), 1_234_000);
    expect(v.largo).toBe(serieEjemplo.t_mas_s.length + 1);
    expect(v.serie().t_mas_s.slice(0, 6)).toEqual(serieEjemplo.t_mas_s);
  });

  it("nunca pasa de WEB_SERIE_MAX_PUNTOS y conserva todo el vuelo al recortar la tierra", () => {
    const v = new SerieViva();
    const tDespegue = 10_000_000;
    // 1900 puntos de espera en tierra (1 Hz) y luego 300 de vuelo (9 Hz)
    for (let i = 0; i < 1900; i++) v.agregar(estadoEn(i * 1000, "PREFLIGHT"), null);
    for (let i = 0; i < 300; i++) v.agregar(estadoEn(tDespegue + i * 111, "COAST"), tDespegue);
    expect(v.largo).toBeLessThanOrEqual(WEB_SERIE_MAX_PUNTOS);
    const s = v.serie();
    const deVuelo = s.t_mas_s.filter((t) => t !== null);
    expect(deVuelo).toHaveLength(300); // ni un punto de vuelo se perdió
    expect(deVuelo).toEqual([...deVuelo].sort((a, b) => (a as number) - (b as number)));
    // la tierra se recortó parejo y no desapareció
    expect(s.t_mas_s.length).toBeGreaterThan(300);
  });

  it("al recortar baja a la fracción configurada (no recorta a cada punto)", () => {
    const v = new SerieViva();
    for (let i = 0; i <= WEB_SERIE_MAX_PUNTOS; i++) {
      v.agregar(estadoEn(i * 1000, "PREFLIGHT"), null);
    }
    expect(v.largo).toBe(Math.floor(WEB_SERIE_MAX_PUNTOS * SERIE_RECORTE_FRACCION));
  });

  it("si solo el vuelo ya excede el cupo, decima parejo todo (último recurso)", () => {
    const v = new SerieViva();
    for (let i = 0; i < WEB_SERIE_MAX_PUNTOS + 50; i++) v.agregar(estadoEn(i * 100), 0);
    expect(v.largo).toBeLessThanOrEqual(WEB_SERIE_MAX_PUNTOS);
  });

  it("tMasS redondea a centésimas", () => {
    expect(tMasS(11_546, 0)).toBe(11.55);
    expect(tMasS(5, null)).toBeNull();
    expect(serieVacia().t_mas_s).toEqual([]);
  });
});

describe("claveEvento y esPosterior (la costura)", () => {
  const snap: Snapshot = snapshotEjemplo;
  const msg = (tipo: MensajeSse["tipo"], datos: unknown): MensajeSse =>
    ({ tipo, datos, llegadaMs: 0 }) as unknown as MensajeSse;

  it("los eventos con el mismo t_ms pero distinto tipo o fase son distintos", () => {
    const otro = { ...eventoEjemplo, tipo: "fase" as const, fase: "APOGEE" as const };
    expect(claveEvento(eventoEjemplo)).not.toBe(claveEvento(otro));
    expect(claveEvento(eventoFaseEjemplo)).not.toBe(
      claveEvento({ ...eventoFaseEjemplo, fase: "DESCENT" }),
    );
    expect(claveEvento(eventoEjemplo)).toBe(claveEvento({ ...eventoEjemplo, valor: 1 })); // el valor no identifica
  });

  it("estado y salud: solo con t_ms mayor que el del snapshot (seq no sirve: da la vuelta en 255)", () => {
    const t = estadoEjemplo.t_ms;
    expect(esPosterior(snap, msg("estado", { ...estadoEjemplo, t_ms: t }))).toBe(false);
    expect(esPosterior(snap, msg("estado", { ...estadoEjemplo, t_ms: t - 1, seq: 255 }))).toBe(
      false,
    );
    expect(esPosterior(snap, msg("estado", { ...estadoEjemplo, t_ms: t + 1, seq: 0 }))).toBe(true);
    expect(esPosterior(snap, msg("salud", saludEjemplo))).toBe(false);
    expect(esPosterior(snap, msg("salud", { ...saludEjemplo, t_ms: saludEjemplo.t_ms + 1 }))).toBe(
      true,
    );
  });

  it("estacion: por la hora de la estación", () => {
    expect(esPosterior(snap, msg("estacion", estacionEjemplo))).toBe(false);
    const mas = { ...estacionEjemplo, utc_ms: estacionEjemplo.utc_ms + 1 };
    expect(esPosterior(snap, msg("estacion", mas))).toBe(true);
  });

  it("evento: lo que ya está en el snapshot no se repite; lo que no está se conserva aunque sea viejo", () => {
    expect(esPosterior(snap, msg("evento", eventoEjemplo))).toBe(false);
    const eyeccion = { ...eventoEjemplo, tipo: "eyeccion" as const, valor: null };
    expect(esPosterior(snap, msg("evento", eyeccion))).toBe(true);
    expect(esPosterior(snap, msg("evento", { ...eventoEjemplo, t_ms: 1 }))).toBe(true);
  });

  it("backfill: más progreso, o completo", () => {
    const con = { ...snap, backfill: backfillEjemplo };
    expect(esPosterior(con, msg("backfill", backfillEjemplo))).toBe(false);
    expect(esPosterior(con, msg("backfill", { ...backfillEjemplo, recibidos: 535 }))).toBe(true);
    expect(esPosterior(con, msg("backfill", { ...backfillEjemplo, recibidos: 100 }))).toBe(false);
    const completo = { ...backfillEjemplo, recibidos: 1, completo: true };
    expect(esPosterior(con, msg("backfill", completo))).toBe(true);
    expect(esPosterior(snap, msg("backfill", backfillEjemplo))).toBe(true); // el snapshot no tenía
  });

  it("con un snapshot vacío todo es posterior", () => {
    const v = snapshotVacioEjemplo;
    expect(esPosterior(v, msg("estado", estadoEjemplo))).toBe(true);
    expect(esPosterior(v, msg("salud", saludEjemplo))).toBe(true);
    expect(esPosterior(v, msg("estacion", estacionEjemplo))).toBe(true);
    expect(esPosterior(v, msg("evento", eventoEjemplo))).toBe(true);
  });
});
