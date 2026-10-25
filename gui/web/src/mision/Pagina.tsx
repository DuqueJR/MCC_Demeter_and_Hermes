// Armazón común de la página de misión (03 §2). Lo reciben las dos entradas con su contenido.
// No importa nada específico de una misión (D-W01): lo propio llega por props.
import type { ComponentChildren } from "preact";
import type { Contenido } from "../contenido/tipos";
import { SeccionMapa } from "../mapa/SeccionMapa";
import { BarraMision } from "./BarraMision";
import { Equipo } from "./Equipo";
import { Hueco } from "./Hueco";
import { Inicio } from "./Inicio";
import { Navegacion } from "./Navegacion";
import { Pie } from "./Pie";

interface Props {
  contenido: Contenido;
  /** Sección exclusiva de una misión (por ejemplo, Los ojos de Deméter). */
  extra?: ComponentChildren;
}

export function Pagina({ contenido, extra }: Props) {
  return (
    <>
      <header class="cabecera-mision">
        <BarraMision contenido={contenido} />
        <Navegacion />
      </header>
      <main class="panel">
        <Inicio contenido={contenido} />
        <Hueco id="estado" titulo="Estado de la misión" />
        <Hueco id="telemetria" titulo="Telemetría" />
        <SeccionMapa />
        <Hueco id="recuperacion" titulo="Recuperación" />
        <Hueco id="actitud" titulo="Actitud" />
        <Hueco id="graficas" titulo="Gráficas" />
        <Hueco id="salud" titulo="Salud del cohete" />
        {extra}
        <Equipo contenido={contenido} />
      </main>
      <Pie contenido={contenido} />
    </>
  );
}
