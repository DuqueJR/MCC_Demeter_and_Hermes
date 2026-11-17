import { effect } from "@preact/signals";
import { afterEach, describe, expect, it } from "vitest";
import { snapshotEjemplo } from "../src/contrato/ejemplos";
import type { Snapshot } from "../src/contrato/tipos";
import { alimentar, estadoPagina } from "../src/datos/api";
import { aterrizado } from "../src/mision/aterrizado";

const TICS = 50;
const conFase = (fase: "DESCENT" | "LANDED"): Snapshot => ({
  ...snapshotEjemplo,
  estado: snapshotEjemplo.estado && { ...snapshotEjemplo.estado, fase },
});

/** Cuántas veces corre un efecto que lee `leer`, mientras el reloj local avanza `TICS` tics. */
function ejecuciones(leer: () => unknown): number {
  let n = 0;
  const parar = effect(() => {
    leer();
    n++;
  });
  for (let i = 1; i <= TICS; i++) alimentar.reloj(i * 100);
  parar();
  return n;
}

afterEach(() => alimentar.reiniciar());

describe("`aterrizado` (Pagina no se dibuja entera con cada tic del reloj)", () => {
  it("leer `estadoPagina` directo avisa en cada tic: es el problema que se evita", () => {
    alimentar.snapshot(conFase("DESCENT"), 0);
    expect(ejecuciones(() => estadoPagina.value.aterrizado)).toBeGreaterThan(TICS / 2);
  });

  it("el booleano no avisa mientras el reloj avanza y la fase no cambia", () => {
    alimentar.snapshot(conFase("DESCENT"), 0);
    expect(ejecuciones(() => aterrizado.value)).toBe(1); // solo la ejecución inicial
  });

  it("avisa una sola vez cuando la fase pasa a LANDED, y refleja el valor", () => {
    alimentar.snapshot(conFase("DESCENT"), 0);
    let n = 0;
    const vistos: boolean[] = [];
    const parar = effect(() => {
      vistos.push(aterrizado.value);
      n++;
    });
    for (let i = 1; i <= TICS; i++) alimentar.reloj(i * 100);
    const enTierra = conFase("LANDED").estado;
    if (enTierra === null) throw new Error("el ejemplo debe traer estado");
    alimentar.estado(enTierra);
    for (let i = TICS; i <= 2 * TICS; i++) alimentar.reloj(i * 100);
    parar();
    expect(vistos).toEqual([false, true]);
    expect(n).toBe(2);
  });
});
