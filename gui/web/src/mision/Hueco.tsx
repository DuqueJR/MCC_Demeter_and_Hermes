// Hueco de una sección de datos: solo el título y el ancla de navegación, sin lógica.
// La llenan otras tareas (T-624 a T-626 y las de área D). Aquí no se calcula nada.
export function Hueco({ id, titulo }: { id: string; titulo: string }) {
  return (
    <section id={id} class="seccion hueco" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      <p class="hueco-nota">Esta sección se activa con los datos del vuelo.</p>
    </section>
  );
}
