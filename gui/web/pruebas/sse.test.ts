// Analizador de SSE (T-631): trozos partidos en cualquier punto, fines de línea mixtos, comentarios.
import { describe, expect, it } from "vitest";
import { AnalizadorSse, type EventoSse } from "../src/datos/sse";

const TEXTO =
  'id: 7\nevent: estado\ndata: {"a":1}\n\n: ping\n\nevent: meta\ndata: {"b":2}\n\nid: 8\nevent: salud\ndata: {"c":3}\n\n';

describe("AnalizadorSse", () => {
  it("separa los eventos y deja el id en null cuando no lo trae (el meta de bienvenida)", () => {
    const evs = new AnalizadorSse().alimentar(TEXTO);
    expect(evs).toEqual([
      { id: "7", evento: "estado", datos: '{"a":1}' },
      { id: null, evento: "meta", datos: '{"b":2}' },
      { id: "8", evento: "salud", datos: '{"c":3}' },
    ]);
  });

  it("da lo mismo partido en trozos de cualquier tamaño, incluso byte a byte", () => {
    const esperado = new AnalizadorSse().alimentar(TEXTO);
    for (const tam of [1, 2, 3, 5, 7, 13, 50]) {
      const a = new AnalizadorSse();
      const salida: EventoSse[] = [];
      for (let i = 0; i < TEXTO.length; i += tam) {
        salida.push(...a.alimentar(TEXTO.slice(i, i + tam)));
      }
      expect(salida, `trozos de ${tam}`).toEqual(esperado);
    }
  });

  it("acepta \\r\\n y \\r, incluso con el \\r\\n partido entre dos trozos", () => {
    const a = new AnalizadorSse();
    expect(a.alimentar("event: meta\r\ndata: 1\r")).toEqual([]);
    expect(a.alimentar("\n\r\nevent: salud\rdata: 2\r\r")).toEqual([
      { id: null, evento: "meta", datos: "1" },
      { id: null, evento: "salud", datos: "2" },
    ]);
  });

  it("junta varias líneas data con \\n y quita un solo espacio tras los dos puntos", () => {
    const [ev] = new AnalizadorSse().alimentar("data:  a\ndata:b\ndata\n\n");
    expect(ev?.datos).toBe(" a\nb\n");
  });

  it("ignora comentarios, campos desconocidos y el BOM inicial", () => {
    const evs = new AnalizadorSse().alimentar("﻿: hola\nretry: 3000\nfoo: x\ndata: ok\n\n");
    expect(evs).toEqual([{ id: null, evento: "", datos: "ok" }]);
  });

  it("un bloque con solo id mueve el cursor sin datos; un id con NUL se ignora", () => {
    const a = new AnalizadorSse();
    expect(a.alimentar("id: 99\n\n")).toEqual([{ id: "99", evento: "", datos: "" }]);
    expect(a.alimentar("id: a\0b\n\n")).toEqual([]);
  });

  it("el id es opaco: se devuelve tal cual, sin interpretarlo", () => {
    const [ev] = new AnalizadorSse().alimentar("id: 0007-abc/xyz\ndata: 1\n\n");
    expect(ev?.id).toBe("0007-abc/xyz");
  });
});
