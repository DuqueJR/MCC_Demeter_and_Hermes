// Armazón común de la página de misión (03 §2). Lo reciben las dos entradas con su contenido.
// No importa nada específico de una misión (D-W01): lo propio llega por props.
import type { ComponentChildren } from "preact";
import { Actitud } from "../actitud/Actitud";
import type { Contenido } from "../contenido/tipos";
import { Graficas } from "../graficas/Graficas";
import { SeccionMapa } from "../mapa/SeccionMapa";
import type { Simulacion } from "../simulacion/guion";
import { aterrizado } from "./aterrizado";
import { BannerAlarma } from "./BannerAlarma";
import { BarraMision } from "./BarraMision";
import { Equipo } from "./Equipo";
import { EstadoInicio } from "./EstadoInicio";
import { Inicio } from "./Inicio";
import { Navegacion } from "./Navegacion";
import { Pie } from "./Pie";
import { Recuperacion } from "./Recuperacion";
import { Resumen } from "./Resumen";
import { Salud } from "./Salud";

interface Props {
  contenido: Contenido;
  /** Sección exclusiva de una misión (por ejemplo, Los ojos de Deméter). */
  extra?: ComponentChildren;
  /** La simulación del vuelo de esta misión (T-635, T-637); sin ella no hay botón. */
  simulacion?: Simulacion;
}

export function Pagina({ contenido, extra, simulacion }: Props) {
  // Aterrizado (03 §4): Recuperación sube al inicio del <main>, en el DOM y no solo a la vista,
  // para que el orden de lectura y del teclado coincida con lo que se ve. Debajo va el Resumen del
  // vuelo (T-674). El estado y la telemetría ya no son secciones: el estado va en Inicio y la
  // telemetría, dentro del mapa.
  const enTierra = aterrizado.value;
  return (
    <>
      <header class="cabecera-mision">
        <BarraMision contenido={contenido} />
        <BannerAlarma />
        <Navegacion />
      </header>
      <main class="panel" data-aterrizado={enTierra ? "si" : "no"}>
        {enTierra && <Recuperacion />}
        {enTierra && <Resumen mision={contenido.mision} />}
        <Inicio
          contenido={contenido}
          estado={<EstadoInicio mision={contenido.mision} simulacion={simulacion} />}
        />
        <SeccionMapa coheteMapa={contenido.coheteMapa} />
        {!enTierra && <Recuperacion />}
        <Actitud />
        <Graficas />
        <Salud mision={contenido.mision} />
        {extra}
        <Equipo contenido={contenido} />
      </main>
      <Pie contenido={contenido} />
    </>
  );
}
