// Validador del contrato `web-1` (T-611): el esquema acepta los ejemplos, rechaza casos falsos
// y valida cualquier .jsonl de dev/datos/ (los genera T-612; si no hay, la prueba se salta).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  backfillEjemplo,
  estacionEjemplo,
  estadoEjemplo,
  eventoAlarmaEjemplo,
  eventoEjemplo,
  eventoFaseEjemplo,
  metaEjemplo,
  saludEjemplo,
  snapshotEjemplo,
  snapshotVacioEjemplo,
} from "../src/contrato/ejemplos";
import { TIPOS_MENSAJE } from "../src/contrato/tipos";
import { validarExtra } from "../src/contrato/validacion_extra";
import { WEB_SERIE_MAX_PUNTOS } from "../src/datos/constantes";

const raiz = resolve(import.meta.dirname, "..");
const esquema = JSON.parse(readFileSync(join(raiz, "src/contrato/esquema.json"), "utf8"));

// Draft-07 (Ajv por defecto, modo estricto). Ver el encabezado de la bitácora de T-611.
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(esquema);

function validar(def: string, dato: unknown): string[] {
  const v = ajv.getSchema(`${esquema.$id}#/$defs/${def}`);
  if (!v) throw new Error(`No existe #/$defs/${def} en el esquema`);
  return v(dato) ? [] : (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

/** Copia profunda editable de un ejemplo. */
const copia = <T>(x: T): T => structuredClone(x);

describe("el esquema acepta los ejemplos", () => {
  const ejemplos: [string, unknown][] = [
    ["meta", metaEjemplo],
    ["estado", estadoEjemplo],
    ["salud", saludEjemplo],
    ["estacion", estacionEjemplo],
    ["evento", eventoEjemplo],
    ["evento", eventoFaseEjemplo],
    ["evento", eventoAlarmaEjemplo],
    ["backfill", backfillEjemplo],
    ["snapshot", snapshotEjemplo],
    ["snapshot", snapshotVacioEjemplo],
  ];
  for (const [def, dato] of ejemplos) {
    it(`${def}`, () => expect(validar(def, dato)).toEqual([]));
  }

  it("cubre los 6 tipos de mensaje del stream", () => {
    expect(new Set(ejemplos.map(([d]) => d))).toEqual(new Set([...TIPOS_MENSAJE, "snapshot"]));
  });

  it("la raíz del esquema valida un snapshot", () => {
    const v = ajv.getSchema(esquema.$id);
    expect(v?.(snapshotEjemplo)).toBe(true);
  });

  it("los campos opcionales de D-W13 pueden faltar", () => {
    const meta = copia(metaEjemplo);
    delete meta.proto_version;
    const salud = copia(saludEjemplo);
    delete salud.fw_version;
    const estado = copia(estadoEjemplo);
    delete estado.lkp;
    expect(validar("meta", meta)).toEqual([]);
    expect(validar("salud", salud)).toEqual([]);
    expect(validar("estado", estado)).toEqual([]);
  });

  it("acepta los null de 'sin dato' (pos, lkp, bat_pct, fw_version, secundario)", () => {
    const e = copia(estadoEjemplo);
    e.pos = null;
    e.lkp = null;
    e.bat_pct = null;
    e.secundario = null;
    e.utc_ms = null;
    const s = copia(saludEjemplo);
    s.fw_version = null;
    s.temp_pi_c = null;
    expect(validar("estado", e)).toEqual([]);
    expect(validar("salud", s)).toEqual([]);
  });

  it("acepta una línea JSONL y un cuerpo de ingesta", () => {
    expect(validar("linea_jsonl", { t_rel_ms: 0, evento: "estado", datos: estadoEjemplo })).toEqual(
      [],
    );
    expect(
      validar("ingesta", {
        mensajes: [
          { tipo: "meta", mision: "demeter", datos: metaEjemplo },
          { tipo: "evento", mision: "demeter", datos: eventoEjemplo },
        ],
      }),
    ).toEqual([]);
  });
});

describe("el esquema rechaza casos falsos", () => {
  it("falta un campo obligatorio (estado.fase)", () => {
    const e = copia(estadoEjemplo) as unknown as Record<string, unknown>;
    delete e.fase;
    const errores = validar("estado", e);
    expect(errores.join("|")).toContain("required");
  });

  it("falta un campo obligatorio anidado (salud.calib.mag)", () => {
    const s = copia(saludEjemplo) as unknown as { calib: Record<string, unknown> };
    delete s.calib.mag;
    expect(validar("salud", s)).not.toEqual([]);
  });

  it("un campo omitido en vez de null no vale (estacion.ultimo_paquete_hace_ms)", () => {
    const e = copia(estacionEjemplo) as unknown as Record<string, unknown>;
    delete e.ultimo_paquete_hace_ms;
    expect(validar("estacion", e)).not.toEqual([]);
  });

  it("tipo equivocado (lat como texto, bat_pct como texto, flag como número)", () => {
    const a = copia(estadoEjemplo) as unknown as { pos: { lat: unknown } };
    a.pos.lat = "6.58";
    expect(validar("estado", a)).not.toEqual([]);
    const b = copia(estadoEjemplo) as unknown as Record<string, unknown>;
    b.bat_pct = "87";
    expect(validar("estado", b)).not.toEqual([]);
    const c = copia(estadoEjemplo) as unknown as { flags: { apogeo: unknown } };
    c.flags.apogeo = 1;
    expect(validar("estado", c)).not.toEqual([]);
  });

  it("estado.vel puede ser null (D-W19), como pos", () => {
    const e = { ...copia(estadoEjemplo), pos: null, vel: null };
    expect(validar("estado", e)).toEqual([]);
    expect(validarExtra("estado", e)).toEqual([]);
  });

  it("estado.vel como texto, número o incompleto se rechaza", () => {
    for (const v of ["0,4", 0.4, [], { n_ms: 1 }, { ...estadoEjemplo.vel, extra: 1 }]) {
      const e = { ...copia(estadoEjemplo), vel: v };
      expect(validar("estado", e), `vel=${JSON.stringify(v)}`).not.toEqual([]);
    }
  });

  it("versión distinta de web-1", () => {
    for (const v of ["web-2", "web-0", "", 1]) {
      const m = { ...metaEjemplo, contrato_version: v };
      expect(validar("meta", m), `contrato_version=${JSON.stringify(v)}`).not.toEqual([]);
    }
  });

  it("valores fuera de lo permitido (proto_version 4, fase inventada, lat 91)", () => {
    expect(validar("meta", { ...metaEjemplo, proto_version: 4 })).not.toEqual([]);
    expect(validar("estado", { ...estadoEjemplo, fase: "VOLANDO" })).not.toEqual([]);
    const e = copia(estadoEjemplo);
    if (e.pos) e.pos.lat = 91;
    expect(validar("estado", e)).not.toEqual([]);
  });

  it("evento sin fase ni activa (van siempre, con null si no aplican)", () => {
    const { fase: _f, activa: _a, ...sin } = eventoEjemplo;
    expect(validar("evento", sin)).not.toEqual([]);
  });

  it("campo desconocido (una errata en el generador)", () => {
    expect(validar("estado", { ...estadoEjemplo, alt: 1 })).not.toEqual([]);
  });

  it("snapshot sin meta, o con una lista donde va un objeto", () => {
    const s = copia(snapshotEjemplo) as unknown as Record<string, unknown>;
    delete s.meta;
    expect(validar("snapshot", s)).not.toEqual([]);
    expect(validar("snapshot", { ...snapshotEjemplo, serie: [] })).not.toEqual([]);
  });

  it("línea JSONL cuyo `datos` no corresponde a su `evento`", () => {
    expect(
      validar("linea_jsonl", { t_rel_ms: 0, evento: "salud", datos: estadoEjemplo }),
    ).not.toEqual([]);
    expect(validar("linea_jsonl", { t_rel_ms: 0, evento: "otro", datos: {} })).not.toEqual([]);
  });

  it("ingesta con un mensaje de una misión inexistente", () => {
    expect(
      validar("ingesta", { mensajes: [{ tipo: "meta", mision: "apolo", datos: metaEjemplo }] }),
    ).not.toEqual([]);
  });
});

describe("validacion_extra (lo que el esquema no expresa)", () => {
  it("acepta los ejemplos", () => {
    expect(validarExtra("snapshot", snapshotEjemplo)).toEqual([]);
    expect(validarExtra("snapshot", snapshotVacioEjemplo)).toEqual([]);
    expect(validarExtra("meta", metaEjemplo)).toEqual([]);
    expect(validarExtra("estado", estadoEjemplo)).toEqual([]);
  });

  it("rechaza columnas de la serie de distinto largo", () => {
    const s = copia(snapshotEjemplo);
    s.serie.lat.pop();
    expect(validarExtra("snapshot", s).join("|")).toContain("serie.lat");
  });

  it("rechaza una serie con más de WEB_SERIE_MAX_PUNTOS puntos", () => {
    const s = copia(snapshotVacioEjemplo);
    for (const col of Object.values(s.serie)) col.length = WEB_SERIE_MAX_PUNTOS + 1;
    expect(validarExtra("snapshot", s).join("|")).toContain("WEB_SERIE_MAX_PUNTOS");
    for (const col of Object.values(s.serie)) col.length = WEB_SERIE_MAX_PUNTOS;
    expect(validarExtra("snapshot", s)).toEqual([]);
  });

  it("rechaza misión y nodo que no cuadran (demeter=1, hermes=2)", () => {
    expect(validarExtra("meta", { ...metaEjemplo, mision: "hermes" })).not.toEqual([]);
    expect(validarExtra("meta", { ...metaEjemplo, mision: "hermes", nodo: 2 })).toEqual([]);
    expect(validarExtra("meta", { ...metaEjemplo, nodo: 2 })).not.toEqual([]);
  });

  it("rechaza una fase que no corresponde a su fase_cod (maquina_estados §1)", () => {
    expect(validarExtra("estado", { ...estadoEjemplo, fase_cod: 6 })).not.toEqual([]);
    expect(validarExtra("estado", { ...estadoEjemplo, fase: "ERROR", fase_cod: 9 })).toEqual([]);
  });
});

describe("tipos y esquema dicen lo mismo", () => {
  // Los ejemplos están tipados con tipos.ts y completos (incluyen los opcionales): sus claves
  // deben ser exactamente las propiedades del esquema.
  const claves = (o: object) => Object.keys(o).sort();
  const props = (def: string) => Object.keys(esquema.$defs[def].properties).sort();

  it("claves de primer nivel de cada mensaje", () => {
    expect(claves(metaEjemplo)).toEqual(props("meta"));
    expect(claves(estadoEjemplo)).toEqual(props("estado"));
    expect(claves(saludEjemplo)).toEqual(props("salud"));
    expect(claves(estacionEjemplo)).toEqual(props("estacion"));
    expect(claves(backfillEjemplo)).toEqual(props("backfill"));
    expect(claves(snapshotEjemplo)).toEqual(props("snapshot"));
    expect(claves(snapshotEjemplo.serie)).toEqual(props("serie"));
    for (const ev of [eventoEjemplo, eventoFaseEjemplo, eventoAlarmaEjemplo]) {
      expect(claves(ev)).toEqual(props("evento"));
    }
  });

  it("las columnas de la serie tienen el mismo largo", () => {
    const largos = new Set(Object.values(snapshotEjemplo.serie).map((c) => c.length));
    expect(largos.size).toBe(1);
  });
});

// ---- JSONL de dev/datos/ (T-612) ----
const carpetaFixtures = join(raiz, "dev", "datos");
const jsonl = existsSync(carpetaFixtures)
  ? readdirSync(carpetaFixtures).filter((f) => f.endsWith(".jsonl"))
  : [];

describe("JSONL de ejemplo de dev/datos/", () => {
  if (jsonl.length === 0) {
    console.warn(
      "AVISO: no hay .jsonl en gui/web/dev/datos/ (los genera T-612); la validación se salta.",
    );
  }
  it.skipIf(jsonl.length === 0)("hay archivos", () => expect(jsonl.length).toBeGreaterThan(0));
  for (const archivo of jsonl) {
    it(`valida ${archivo}`, () => {
      const lineas = readFileSync(join(carpetaFixtures, archivo), "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "");
      expect(lineas.length).toBeGreaterThan(0);
      lineas.forEach((texto, i) => {
        const linea = JSON.parse(texto);
        expect(validar("linea_jsonl", linea), `${archivo}:${i + 1}`).toEqual([]);
        expect(validarExtra(linea.evento, linea.datos), `${archivo}:${i + 1}`).toEqual([]);
      });
    });
  }
});
