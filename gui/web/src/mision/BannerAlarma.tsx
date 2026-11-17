// Banner de alarma de descenso rápido (03 §4, D-W18, T-624): rojo, fijo bajo la barra de misión,
// mientras `alarmas.descenso_rapido` esté activa y `WEB_ALARMA_SOSTENER_S` más.
// La web NO recalcula la alarma (la calcula el servicio de tierra): solo la lee de `estado.alarmas`.
import { computed, effect } from "@preact/signals";
import { OctagonX } from "lucide-preact";
import { useEffect, useMemo } from "preact/hooks";
import { edad, estado } from "../datos/api";
import { SostenedorAlarma } from "./alarma";
import { hace, numero } from "./formato";
import { datoViejo } from "./vista_telemetria";

const DECIMALES_VELOCIDAD_BANNER = 1;

/** Lo que dice el contrato ahora mismo. Solo cambia al activarse o apagarse la alarma. */
const alarmaActiva = computed(() => estado.value?.alarmas.descenso_rapido === true);

export function BannerAlarma() {
  const sostenedor = useMemo(() => new SostenedorAlarma(), []);
  useEffect(() => {
    const dejarDeVigilar = effect(() => sostenedor.actualizar(alarmaActiva.value));
    return () => {
      dejarDeVigilar();
      sostenedor.detener();
    };
  }, [sostenedor]);

  if (!sostenedor.visible.value) return null;

  const sosteniendo = sostenedor.sosteniendo.value;
  const vel = estado.value?.vel ?? null;
  // Se cae cuando la velocidad vertical es negativa: se muestra como magnitud.
  const cae = vel === null ? null : Math.max(0, -vel.u_ms);
  const edadMs = edad.value;

  return (
    <div class="banner banner-alarma" role="status" aria-live="polite" data-alarma="descenso">
      <OctagonX aria-hidden="true" />
      <span class="banner-texto">
        <strong>Descenso rápido</strong>
        {sosteniendo ? (
          <span> · la alarma terminó</span>
        ) : (
          cae !== null && <span> · {numero(cae, DECIMALES_VELOCIDAD_BANNER)} m/s</span>
        )}
        {!sosteniendo && datoViejo(edadMs) && edadMs !== null && (
          <span class="banner-edad"> · última lectura {hace(edadMs)}</span>
        )}
      </span>
    </div>
  );
}
