import { describe, expect, it } from "vitest";
import { estadoEjemplo, eventoEjemplo, eventoFaseEjemplo } from "../src/contrato/ejemplos";
import type { Evento } from "../src/contrato/tipos";
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
  const despegue: Evento = {
    tipo: "despegue",
    t_ms: 1_000_000,
    utc_ms: null,
    t_mas_s: 0,
    valor: null,
    fase: null,
    activa: null,
  };

  it("T+ = (t_ms del estado - t_ms del despegue) / 1000, con el reloj del cohete", () => {
    const est = { ...estadoEjemplo, t_ms: 1_042_500 };
    expect(tMasSegundos(est, [despegue])).toBeCloseTo(42.5, 6);
    // Con otros eventos después, sigue contando desde el despegue (no desde el último evento).
    expect(tMasSegundos(est, [despegue, eventoEjemplo, eventoFaseEjemplo])).toBeCloseTo(42.5, 6);
  });

  it("sin evento despegue usa un evento con T+ (mismo instante de despegue); sin ninguno, null", () => {
    // eventoEjemplo: T+ 11,54 s en t_ms 1245900 -> despegue en t_ms 1234360.
    const est = { ...estadoEjemplo, t_ms: 1_234_360 + 20_000 };
    expect(tMasSegundos(est, [eventoEjemplo, eventoFaseEjemplo])).toBeCloseTo(20, 6);
    expect(tMasSegundos(estadoEjemplo, [])).toBeNull();
    expect(tMasSegundos(null, [despegue])).toBeNull();
  });

  it("antes del despegue (T+ negativo) no inventa un tiempo", () => {
    expect(tMasSegundos({ ...estadoEjemplo, t_ms: 900_000 }, [despegue])).toBeNull();
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
