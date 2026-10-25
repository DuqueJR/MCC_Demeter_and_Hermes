import { describe, expect, it } from "vitest";
import { estadoEjemplo, eventoEjemplo, eventoFaseEjemplo } from "../src/contrato/ejemplos";
import { indicadorDe, tMasSegundos } from "../src/mision/BarraMision";
import { hace, numero, tMas } from "../src/mision/formato";

describe("formato (02 §5)", () => {
  it("usa coma decimal y signo menos tipográfico", () => {
    expect(numero(9.2, 1)).toBe("9,2");
    expect(numero(312.4)).toBe("312");
    expect(numero(-14.9, 1)).toBe("−14,9");
  });

  it("T+ en mm:ss y h:mm:ss; sin despegue no inventa un tiempo", () => {
    expect(tMas(42)).toBe("T+ 00:42");
    expect(tMas(75.9)).toBe("T+ 01:15");
    expect(tMas(3725)).toBe("T+ 1:02:05");
    expect(tMas(null)).toBe("T+ --:--");
  });

  it("antigüedad en segundos y minutos", () => {
    expect(hace(38_400)).toBe("hace 38 s");
    expect(hace(125_000)).toBe("hace 2 min");
  });
});

describe("barra de misión", () => {
  it("T+ parte del último evento con T+ y avanza con el reloj del cohete", () => {
    const evs = [eventoEjemplo, eventoFaseEjemplo];
    const t = tMasSegundos(estadoEjemplo, evs);
    expect(t).toBeCloseTo(15.64 + (estadoEjemplo.t_ms - eventoFaseEjemplo.t_ms) / 1000, 6);
    expect(tMasSegundos(estadoEjemplo, [])).toBeNull();
    expect(tMasSegundos(null, evs)).toBeNull();
  });

  it("cada estado principal tiene su color de estado y una palabra", () => {
    expect(indicadorDe("en_vivo")).toMatchObject({ clase: "ok", texto: "EN VIVO" });
    expect(indicadorDe("senal_debil")).toMatchObject({ clase: "aviso", texto: "Señal débil" });
    expect(indicadorDe("sin_senal")).toMatchObject({ clase: "alarma", texto: "Sin señal" });
    expect(indicadorDe("sin_servidor")).toMatchObject({ clase: "sin-dato", texto: "Sin servidor" });
    expect(indicadorDe("sin_transmision")).toMatchObject({ texto: "Sin transmisión" });
    expect(indicadorDe("cargando")).toMatchObject({ texto: "Cargando" });
  });
});
