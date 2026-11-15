// El vuelo real reconstruido (T-681, D-W24): los guiones que genera `python -m tools.vuelo_real`, su
// validación (nunca pueden pasar por un vuelo en vivo) y los textos de la página.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { indicadorDe } from "../src/mision/BarraMision";
import { demeter } from "../src/contenido/demeter";
import { hermes } from "../src/contenido/hermes";
import { esGuion, FORMATO_RECONSTRUCCION, type Guion } from "../src/simulacion/guion";

const leer = (mision: string): Guion =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/assets/${mision}/vuelo_real.json`, import.meta.url)), "utf8"),
  ) as Guion;
const sinPlano = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const PRESUPUESTO_BYTES = 400 * 1024;

describe.each([
  ["hermes", 393],
  ["demeter", 598],
])("el guion del vuelo real de %s", (mision, apogeo) => {
  const g = leer(mision);

  it("es un guion válido de reconstrucción, de su misión, con todo su meta en modo reconstrucción", () => {
    expect(esGuion(g)).toBe(true);
    expect(g.formato).toBe(FORMATO_RECONSTRUCCION);
    expect(g.mision).toBe(mision);
    const metas = g.lineas.filter((l) => l.evento === "meta");
    expect(metas.length).toBeGreaterThan(0);
    for (const m of metas) if (m.evento === "meta") expect(m.datos.modo).toBe("reconstruccion");
  });

  it("pesa unos cientos de KB como máximo", () => {
    expect(JSON.stringify(g).length).toBeLessThanOrEqual(PRESUPUESTO_BYTES);
  });

  it("trae los momentos en orden y el apogeo oficial", () => {
    const tipos = g.lineas
      .filter((l) => l.evento === "evento" && l.datos.tipo !== "fase" && l.datos.tipo !== "alarma_descenso")
      .map((l) => (l.evento === "evento" ? l.datos.tipo : ""));
    expect(tipos).toEqual(["despegue", "fin_combustion", "apogeo", "eyeccion", "aterrizaje"]);
    const ev = g.lineas.find((l) => l.evento === "evento" && l.datos.tipo === "apogeo");
    expect(ev?.evento === "evento" ? ev.datos.valor : null).toBe(apogeo);
  });
});

describe("esGuion con reconstrucciones", () => {
  const base = (): Guion => sinPlano(leer("hermes"));

  it("rechaza una reconstrucción con un meta de otro modo (ni vivo ni simulación)", () => {
    for (const modo of ["vivo", "simulacion"] as const) {
      const g = base();
      const meta = g.lineas.find((l) => l.evento === "meta");
      if (meta?.evento === "meta") meta.datos.modo = modo;
      expect(esGuion(g)).toBe(false);
    }
  });

  it("un formato que no existe no pasa, aunque se llame como una propiedad del objeto", () => {
    expect(esGuion({ ...base(), formato: "toString" })).toBe(false);
    expect(esGuion({ ...base(), formato: "__proto__" })).toBe(false);
  });
});

describe("los textos del vuelo real", () => {
  it("cada misión tiene su aviso y su banner, que dicen que es la repetición del vuelo real", () => {
    for (const c of [hermes, demeter]) {
      expect(c.reconstruccion?.nota).toMatch(/vuelo real/);
      expect(c.reconstruccion?.banner).toMatch(/^Repetición:/);
    }
  });

  it("el indicador no dice EN VIVO durante la repetición", () => {
    expect(indicadorDe("en_vivo", true, true)).toMatchObject({ clase: "info", texto: "REPETICIÓN" });
    expect(indicadorDe("en_vivo", true)).toMatchObject({ texto: "SIMULACIÓN" });
  });
});
