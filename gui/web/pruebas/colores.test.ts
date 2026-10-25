import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sin tipos; se usa también como script de Node
import { buscarColoresSueltos } from "../scripts/colores.mjs";

type Violacion = { archivo: string; linea: number; texto: string; motivo: string };
const buscar = buscarColoresSueltos as (raiz: string) => Violacion[];

const raizTemporal = mkdtempSync(join(tmpdir(), "colores-"));
afterAll(() => rmSync(raizTemporal, { recursive: true, force: true }));

function webFalsa(nombre: string, archivos: Record<string, string>): string {
  const raiz = join(raizTemporal, nombre);
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}

describe("regla contra colores sueltos (02 §6)", () => {
  it("el código real de gui/web no tiene colores literales fuera de src/tema/", () => {
    expect(buscar(resolve(import.meta.dirname, ".."))).toEqual([]);
  });

  it("pasa con tokens, y los literales dentro de src/tema/ están permitidos", () => {
    const raiz = webFalsa("limpio", {
      "src/tema/hermes.css": ":root{--fondo:#14112a}",
      "src/componentes/Tarjeta.css": ".t{background:var(--superficie);color:var(--texto)}",
      "src/componentes/Tarjeta.tsx": 'export const t = <div class="t">#1 en altura</div>;',
    });
    expect(buscar(raiz)).toEqual([]);
  });

  it("FALLA con un hexadecimal en un .css", () => {
    const raiz = webFalsa("falso-hex", { "src/componentes/Tarjeta.css": ".t{color:#ff0000}" });
    expect(buscar(raiz)).toMatchObject([{ archivo: "src/componentes/Tarjeta.css", linea: 1 }]);
  });

  it("FALLA con rgb(), hsl() y oklch() en .css y .ts", () => {
    const raiz = webFalsa("falso-funciones", {
      "src/a.css": ".a{color:rgb(1,2,3)}\n.b{background:hsla(0 0% 0% / .5)}",
      "src/grafica.ts": 'export const trazo = "oklch(70% 0.1 200)";',
    });
    expect(buscar(raiz).map((v) => `${v.archivo}:${v.linea}`)).toEqual([
      "src/a.css:1",
      "src/a.css:2",
      "src/grafica.ts:1",
    ]);
  });

  it("FALLA con un hexadecimal en un .tsx y con un nombre de color en un .css", () => {
    const raiz = webFalsa("falso-tsx", {
      "src/Barra.tsx": 'export const B = () => <div style={{ color: "#fff" }} />;',
      "dev/pagina.css": ".x{ border: 1px solid white; }",
    });
    expect(
      buscar(raiz)
        .map((v) => v.archivo)
        .sort(),
    ).toEqual(["dev/pagina.css", "src/Barra.tsx"]);
  });

  it("no se deja engañar por comentarios, 'transparent' ni 'currentColor'", () => {
    const raiz = webFalsa("comentarios", {
      "src/a.css": "/* antes: #ff0000 */ .a{background:transparent;color:currentColor}",
      "src/b.ts": "// era #fff\nexport const x = 1;",
    });
    expect(buscar(raiz)).toEqual([]);
  });
});
