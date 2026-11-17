import { describe, expect, it } from "vitest";
import { debeIniciarCliente } from "../src/mision/arranque";

describe("cuándo arranca el cliente de datos (T-624)", () => {
  it("en producción siempre arranca, aunque la URL lleve ?ejemplo", () => {
    expect(debeIniciarCliente(false, "")).toBe(true);
    expect(debeIniciarCliente(false, "?ejemplo")).toBe(true);
    expect(debeIniciarCliente(false, "?sin_cliente")).toBe(true);
  });

  it("en desarrollo arranca por defecto", () => {
    expect(debeIniciarCliente(true, "")).toBe(true);
    expect(debeIniciarCliente(true, "?otra=1")).toBe(true);
  });

  it("en desarrollo, ?ejemplo y ?sin_cliente lo apagan (escriben en las mismas signals)", () => {
    expect(debeIniciarCliente(true, "?ejemplo")).toBe(false);
    expect(debeIniciarCliente(true, "?ejemplo=sin_senal")).toBe(false);
    expect(debeIniciarCliente(true, "?sin_cliente")).toBe(false);
    expect(debeIniciarCliente(true, "?x=1&ejemplo")).toBe(false);
  });
});
