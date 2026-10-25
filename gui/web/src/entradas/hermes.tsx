// Entrada provisional de Hermes (T-610). El armazón real es T-622.
import { signal } from "@preact/signals";
import { render } from "preact";

const mision = signal("Hermes");

function App() {
  return (
    <main>
      <h1>{mision}</h1>
      <p>Página en construcción.</p>
    </main>
  );
}

const raiz = document.getElementById("app");
if (raiz) render(<App />, raiz);
