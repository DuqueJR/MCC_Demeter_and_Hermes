// Leyenda bajo el mapa (T-632): qué es cada insignia. Con las insignias sueltas no se entiende, y
// con textos al lado de cada una se pisarían cerca de la rampa. Va en el JS inicial (cuatro íconos).
import { Mountain, RadioTower, Rocket, Target } from "lucide-preact";
import { RELIEVE_CURVA_INTERVALO_M } from "./constantes";
import { relieveActivo } from "./estado_relieve";

export function Leyenda() {
  return (
    <ul class="mapa-leyenda" aria-label="Leyenda del mapa">
      <li>
        <Rocket aria-hidden="true" /> Rampa
      </li>
      <li>
        <RadioTower aria-hidden="true" /> Estación
      </li>
      <li>
        <Target aria-hidden="true" /> Impacto estimado
      </li>
      {relieveActivo.value && (
        <li data-leyenda="relieve">
          <Mountain aria-hidden="true" /> Relieve y curvas de nivel cada {RELIEVE_CURVA_INTERVALO_M}{" "}
          m
        </li>
      )}
    </ul>
  );
}
