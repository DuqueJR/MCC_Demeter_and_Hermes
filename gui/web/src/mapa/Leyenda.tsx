// Leyenda bajo el mapa (T-632): qué es cada insignia. Con las insignias sueltas no se entiende, y
// con textos al lado de cada una se pisarían cerca de la rampa. Va en el JS inicial (tres íconos).
import { RadioTower, Rocket, Target } from "lucide-preact";

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
    </ul>
  );
}
