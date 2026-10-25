// Navegación por anclas (03 §2.1): inferior fija en el celular; en el portátil es la fila bajo la barra.
export const ENLACES_NAVEGACION = [
  { href: "#estado", texto: "Estado" },
  { href: "#mapa", texto: "Mapa" },
  { href: "#telemetria", texto: "Datos" },
  { href: "#equipo", texto: "Equipo" },
] as const;

export function Navegacion() {
  return (
    <nav class="navegacion" aria-label="Secciones de la página">
      {ENLACES_NAVEGACION.map((e) => (
        <a key={e.href} href={e.href}>
          {e.texto}
        </a>
      ))}
    </nav>
  );
}
