// Armazón común de la página de misión (03 §2). Lo reciben las dos entradas con su contenido.
// No importa nada específico de una misión (D-W01): lo propio llega por props.
import type { ComponentChildren } from "preact";
import { Actitud } from "../actitud/Actitud";
import type { Contenido } from "../contenido/tipos";
import { SeccionMapa } from "../mapa/SeccionMapa";
import { BannerAlarma } from "./BannerAlarma";
import { BarraMision } from "./BarraMision";
import { Equipo } from "./Equipo";
import { EstadoMision } from "./EstadoMision";
import { Hueco } from "./Hueco";
import { Inicio } from "./Inicio";
import { Navegacion } from "./Navegacion";
import { Pie } from "./Pie";
import { Telemetria } from "./Telemetria";

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
        <BannerAlarma />
        <Navegacion />
      </header>
      <main class="panel">
        <Inicio contenido={contenido} />
        <EstadoMision mision={contenido.mision} />
        <Telemetria />
        <SeccionMapa />
        <Hueco id="recuperacion" titulo="Recuperación" />
        <Actitud />
        <Hueco id="graficas" titulo="Gráficas" />
        <Hueco id="salud" titulo="Salud del cohete" />
        {extra}
        <Equipo contenido={contenido} />
      </main>
      <Pie contenido={contenido} />
    </>
  );
}
