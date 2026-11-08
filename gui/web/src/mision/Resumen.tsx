// "Resumen del vuelo" (T-674): solo cuando el cohete aterrizó. Junta lo que durante el vuelo se ve
// por partes: la línea de fases completa con sus T+, los objetivos con su hora y dato, y la telemetría
// final. Va justo debajo de Recuperación (que en LANDED sube al inicio de la página) y reutiliza las
// mismas piezas y la misma lógica que el vuelo: `ObjetivosFases.tsx`, `Telemetria.tsx`,
// `linea_fases.ts` y `objetivos.ts`; no recalcula nada.
import type { Mision } from "../contrato/tipos";
import { estado, eventos } from "../datos/api";
import "./estado.css";
import { construirPasos } from "./linea_fases";
import { LineaFases, ListaObjetivos } from "./ObjetivosFases";
import { calcularObjetivos } from "./objetivos";
import { DatosTelemetria } from "./Telemetria";

export function Resumen({ mision }: { mision: Mision }) {
  const est = estado.value;
  const evs = eventos.value;
  return (
    <section id="resumen" class="seccion" aria-labelledby="resumen-titulo">
      <h2 id="resumen-titulo">Resumen del vuelo</h2>
      <div class="resumen-cuerpo">
        <div class="resumen-bloque" data-resumen="fases">
          <h3 class="subtitulo">Fases del vuelo</h3>
          <LineaFases pasos={construirPasos(est, evs)} />
        </div>
        <div class="resumen-bloque" data-resumen="objetivos">
          <h3 class="subtitulo">Objetivos de la misión</h3>
          <ListaObjetivos objetivos={calcularObjetivos(est, evs, mision)} />
        </div>
        <div class="resumen-bloque" data-resumen="telemetria">
          <h3 class="subtitulo">Telemetría final</h3>
          <DatosTelemetria />
        </div>
      </div>
    </section>
  );
}
