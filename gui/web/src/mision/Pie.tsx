// Pie (03 §3.11): EIA, CCCD 2026 y un enlace que solo navega a la otra misión.
import { ArrowRight } from "lucide-preact";
import logoEia from "../assets/comun/eia_blanco.png?w=256&format=webp";
import type { Contenido } from "../contenido/tipos";

export function Pie({ contenido }: { contenido: Contenido }) {
  return (
    <footer id="pie" class="pie">
      <img class="pie-logo" src={logoEia} alt="Universidad EIA" width="256" height="144" />
      <p>CCCD 2026 · Santa Fe de Antioquia · 8 de noviembre</p>
      {/* Enlace normal: no precarga nada de la otra misión (D-W01). */}
      <a class="pie-enlace" href={contenido.otra.href}>
        Ver la misión {contenido.otra.nombre}
        <ArrowRight aria-hidden="true" />
      </a>
    </footer>
  );
}
