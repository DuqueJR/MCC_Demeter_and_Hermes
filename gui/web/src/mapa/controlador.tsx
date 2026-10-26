// El mapa (T-632): crea MapLibre, lo conecta a las signals de `datos/api.ts` y lo mantiene al día.
// Este módulo y todo lo que importa (MapLibre, pmtiles) va en el chunk diferido: la página de
// misión NO lo carga hasta que la sección entra en pantalla (04 §2 y §6).
import { effect, type ReadonlySignal, signal } from "@preact/signals";
import {
  addProtocol,
  type GeoJSONSource,
  Map as MapaGL,
  Marker,
  NavigationControl,
  type PositionAnchor,
  removeProtocol,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import urlTrabajador from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Protocol } from "pmtiles";
import { type ComponentChild, render } from "preact";
import { edad, estacion, estado, estadoPagina, meta, serie } from "../datos/api";
import {
  ampliarParaIncluir,
  ampliarParaVista,
  areaPorDefecto,
  encoger,
  mismosLimites,
  zoomMaximo,
  zoomMinimo,
} from "./area";
import { detectarBase } from "./base";
import {
  MAPA_CENTRO_POR_DEFECTO,
  MAPA_ESCALA_MAX_PX,
  MAPA_RELLENO_PX,
  MAPA_ZOOM_AJUSTE_MAX,
  MAPA_ZOOM_CENTRAR,
  MAPA_ZOOM_INICIAL,
} from "./constantes";
import { construirEstilo, FUENTE, leerTokensDelDocumento, type Tokens } from "./estilo";
import {
  agregarPunto,
  type Capas,
  type Coord,
  construirCapas,
  type DecisionLkp,
  decidirLkp,
  type EntradaMapa,
  fueraDeLimites,
  type Limites,
  puntosDeSerie,
} from "./geo";
import {
  ChipDistancia,
  type DatosCohete,
  type DatosLkp,
  MarcadorCohete,
  MarcadorEstacion,
  MarcadorImpacto,
  MarcadorLkp,
  MarcadorRampa,
} from "./marcadores";

/** Diferencia de zoom que no vale la pena aplicar a MapLibre. */
const ZOOM_EPSILON = 1e-6;

/** Textos de MapLibre en español (sus controles y el aviso de gestos cooperativos). */
const TEXTOS_MAPA: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Mostrar la atribución del mapa",
  "AttributionControl.MapFeedback": "Comentarios sobre el mapa",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "Map.Title": "Mapa de la trayectoria del cohete",
  "Marker.Title": "Marcador",
  "Popup.Close": "Cerrar",
  "ScaleControl.Meters": "m",
  "ScaleControl.Kilometers": "km",
  "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda del ratón para acercar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + rueda del ratón para acercar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
};

export interface ControlMapa {
  /** Hay un cohete en vivo o una última posición que mostrar. */
  hayCohete: ReadonlySignal<boolean>;
  /** Tokens con los que se armó el estilo (los del tema de la misión). */
  tokens: Tokens;
  /** Si el mapa tiene base vectorial (el PMTiles existe) o solo las capas de la misión. */
  conBase: boolean;
  centrarEnCohete(): void;
  verTodo(): void;
  /** Gestos cooperativos: activos en la página; se apagan en pantalla completa. */
  cooperativo(activo: boolean): void;
  redimensionar(): void;
  destruir(): void;
}

/** Un marcador del DOM que se crea al primer uso y se quita cuando no hay posición. */
class Marca {
  private marcador: Marker | null = null;
  private readonly mapa: MapaGL;
  private readonly anclaje: PositionAnchor;
  private readonly clase: string;
  private readonly contenido: () => ComponentChild;

  constructor(
    mapa: MapaGL,
    anclaje: PositionAnchor,
    clase: string,
    contenido: () => ComponentChild,
  ) {
    this.mapa = mapa;
    this.anclaje = anclaje;
    this.clase = clase;
    this.contenido = contenido;
  }

  poner(coord: Coord | null): void {
    if (coord === null) {
      this.quitar();
    } else if (this.marcador) {
      this.marcador.setLngLat(coord);
    } else {
      const elemento = document.createElement("div");
      elemento.className = `mapa-marcador ${this.clase}`;
      render(this.contenido(), elemento);
      this.marcador = new Marker({ element: elemento, anchor: this.anclaje })
        .setLngLat(coord)
        .addTo(this.mapa);
    }
  }

  quitar(): void {
    if (!this.marcador) return;
    render(null, this.marcador.getElement());
    this.marcador.remove();
    this.marcador = null;
  }
}

const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function crearMapa(contenedor: HTMLElement): Promise<ControlMapa> {
  // MapLibre busca su worker junto a su propio archivo, que el empaquetado no conserva: se le dice
  // dónde quedó (el archivo se emite como recurso aparte y solo se pide al dibujar el mapa).
  setWorkerUrl(urlTrabajador);
  const tokens = leerTokensDelDocumento();
  const protocolo = new Protocol();
  addProtocol("pmtiles", protocolo.tile);
  const detectada = await detectarBase(protocolo);
  const base = detectada?.base ?? null;
  const cobertura = detectada?.cobertura ?? null;

  const centro = meta.peek()?.sitio ?? MAPA_CENTRO_POR_DEFECTO;
  // El área navegable (T-634): con PMTiles, el recuadro de su cabecera metido un poco hacia
  // adentro; sin él, un área alrededor de la rampa. Se amplía si lo dibujado cae afuera (GS-03).
  // El zoom máximo también sale de la cabecera (`area.ts`).
  let sitioDelArea = centro;
  const areaBase = () => (cobertura ? encoger(cobertura.limites) : areaPorDefecto(sitioDelArea));
  let limitesAplicados = areaBase();
  /** La caja de todo lo dibujado (LKP, cohete, trayectoria, estación, rampa, elipse). */
  let dibujado: Limites | null = null;
  const zoomMax = zoomMaximo(cobertura);
  const zoomMinPara = (l: Limites) =>
    Math.min(zoomMinimo(l, contenedor.clientWidth, contenedor.clientHeight), zoomMax);
  const mapa = new MapaGL({
    container: contenedor,
    style: construirEstilo(tokens, base),
    center: [centro.lon, centro.lat],
    zoom: MAPA_ZOOM_INICIAL,
    maxZoom: zoomMax,
    minZoom: zoomMinPara(limitesAplicados),
    maxBounds: [
      [limitesAplicados[0], limitesAplicados[1]],
      [limitesAplicados[2], limitesAplicados[3]],
    ],
    // En el celular el mapa no captura el desplazamiento de la página: un dedo desplaza la página y
    // dos dedos mueven el mapa (03 §3.4). En el portátil, Ctrl + rueda acerca.
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    locale: TEXTOS_MAPA,
    attributionControl: { compact: true },
  });
  mapa.touchZoomRotate.disableRotation();
  mapa.addControl(new NavigationControl({ showCompass: false }), "top-left");
  mapa.addControl(
    new ScaleControl({ maxWidth: MAPA_ESCALA_MAX_PX, unit: "metric" }),
    "bottom-left",
  );

  // ---- Marcadores
  const datosCohete = signal<DatosCohete>({ rumbo: null, atenuado: false });
  const datosLkp = signal<DatosLkp>({ alt_agl_m: null, edadMs: null });
  const textoChip = signal("");
  const rampa = new Marca(mapa, "center", "marcador-rampa", () => <MarcadorRampa />);
  const estacionMarca = new Marca(mapa, "center", "marcador-estacion", () => <MarcadorEstacion />);
  const impacto = new Marca(mapa, "center", "marcador-impacto", () => <MarcadorImpacto />);
  const chip = new Marca(mapa, "center", "marcador-chip", () => (
    <ChipDistancia texto={textoChip} />
  ));
  const cohete = new Marca(mapa, "center", "marcador-cohete", () => (
    <MarcadorCohete datos={datosCohete} />
  ));
  const lkpMarca = new Marca(mapa, "bottom", "marcador-lkp", () => (
    <MarcadorLkp datos={datosLkp} />
  ));

  // ---- Estado del controlador
  const hayCohete = signal(false);
  let decision: DecisionLkp | null = null;
  let rastro: Coord[] = [];
  let serieAnterior: EntradaMapa["serie"] | null = null;
  let rastroPublicado: Coord[] | null = null;
  let capas: Capas | null = null;
  let interactuo = false; // el usuario movió el mapa: no se le quita la vista
  let ajustado = false; // ya se encuadró alguna vez lo que hay
  let sitioAplicado = meta.peek() !== null;

  const duracion = () => (sinMovimiento() ? 0 : tokens.duracionMs);
  const ponerDatos = (id: string, datos: Capas["trayectoria"] | Capas["elipse"] | Capas["linea"]) =>
    (mapa.getSource(id) as GeoJSONSource | undefined)?.setData(datos);

  const ajustarA = (l: Limites) =>
    mapa.fitBounds(
      [
        [l[0], l[1]],
        [l[2], l[3]],
      ],
      { padding: MAPA_RELLENO_PX, maxZoom: MAPA_ZOOM_AJUSTE_MAX, duration: duracion() },
    );
  const visibles = (): Limites => {
    const b = mapa.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  };
  const destinoDe = (c: Capas): Coord | null =>
    c.marcadores.lkp?.pos ?? c.marcadores.cohete?.pos ?? null;

  // ---- Límites del mapa (T-634)
  /** Anota en el lienzo lo que las pruebas necesitan leer (como `data-mapa-reposos`). */
  const publicarVista = () => {
    const v = visibles();
    contenedor.dataset.mapaLimites = limitesAplicados.join(",");
    contenedor.dataset.mapaVista = v.join(",");
    contenedor.dataset.mapaZoom = mapa.getZoom().toFixed(3);
    contenedor.dataset.mapaZoomMin = mapa.getMinZoom().toFixed(3);
    contenedor.dataset.mapaZoomMax = mapa.getMaxZoom().toFixed(3);
    const c = mapa.getCenter();
    contenedor.dataset.mapaCentro = `${c.lng},${c.lat}`;
  };
  /**
   * El área navegable ahora: la base, ampliada para incluir todo lo dibujado (GS-03) y para que
   * "Ver todo" pueda mostrarlo entero en este contenedor. Depende del tamaño del contenedor.
   */
  const calcularArea = (): Limites => {
    const incluida = ampliarParaIncluir(areaBase(), dibujado);
    return ampliarParaVista(
      incluida,
      dibujado,
      contenedor.clientWidth,
      contenedor.clientHeight,
      MAPA_RELLENO_PX,
    );
  };
  /**
   * Aplica el área y el zoom mínimo a MapLibre. Solo lo toca si cambiaron (los datos llegan a
   * ~9 Hz y casi nunca mueven el área); el zoom mínimo depende del tamaño del contenedor, por eso
   * también se llama al redimensionar y al entrar o salir de pantalla completa.
   */
  const aplicarLimites = () => {
    if (contenedor.clientWidth === 0 || contenedor.clientHeight === 0) return;
    const l = calcularArea();
    if (!mismosLimites(l, limitesAplicados)) {
      limitesAplicados = l;
      mapa.setMaxBounds([
        [l[0], l[1]],
        [l[2], l[3]],
      ]);
    }
    const z = zoomMinPara(limitesAplicados);
    if (Math.abs(z - mapa.getMinZoom()) > ZOOM_EPSILON) mapa.setMinZoom(z);
    publicarVista();
  };

  const actualizar = (entrada: EntradaMapa) => {
    if (entrada.serie !== serieAnterior) {
      serieAnterior = entrada.serie;
      rastro = puntosDeSerie(entrada.serie);
    }
    decision = decidirLkp(entrada, decision);
    // Lo que llega por el stream entre dos snapshots también alarga la trayectoria.
    const pos = entrada.estado?.pos;
    if (!decision.activo && pos) rastro = agregarPunto(rastro, [pos.lon, pos.lat]);

    capas = construirCapas(entrada, decision, rastro);
    // Sin PMTiles el área sigue a la rampa, que puede llegar después del mapa.
    if (entrada.sitio) sitioDelArea = entrada.sitio;
    dibujado = capas.limites;
    aplicarLimites();
    const m = capas.marcadores;
    if (rastro !== rastroPublicado) {
      rastroPublicado = rastro;
      ponerDatos(FUENTE.trayectoria, capas.trayectoria);
    }
    ponerDatos(FUENTE.elipse, capas.elipse);
    ponerDatos(FUENTE.linea, capas.linea);

    rampa.poner(m.rampa);
    estacionMarca.poner(m.estacion);
    impacto.poner(m.impacto);
    if (m.chip) textoChip.value = m.chip.texto;
    chip.poner(m.chip?.pos ?? null);
    if (m.cohete) datosCohete.value = { rumbo: m.cohete.rumbo, atenuado: m.cohete.atenuado };
    cohete.poner(m.cohete?.pos ?? null);
    if (m.lkp) datosLkp.value = { alt_agl_m: m.lkp.alt_agl_m, edadMs: m.lkp.edadMs };
    lkpMarca.poner(m.lkp?.pos ?? null);
    const destino = destinoDe(capas);
    hayCohete.value = destino !== null;

    if (entrada.sitio && !sitioAplicado) {
      sitioAplicado = true;
      if (!interactuo) mapa.jumpTo({ center: [entrada.sitio.lon, entrada.sitio.lat] });
    }
    // Encuadra lo que hay la primera vez y cada vez que el cohete sale de la vista, salvo que el
    // usuario ya haya movido el mapa.
    if (!interactuo && capas.limites && destino) {
      if (!ajustado || fueraDeLimites(visibles(), destino)) {
        ajustado = true;
        ajustarA(capas.limites);
      }
    }
  };

  // Un gesto del usuario (no un movimiento hecho por nosotros) detiene el encuadre automático.
  const alMoverUsuario = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent) interactuo = true;
  };
  mapa.on("dragstart", alMoverUsuario);
  mapa.on("zoomstart", alMoverUsuario);
  mapa.on("resize", aplicarLimites);
  mapa.on("moveend", publicarVista);

  // Contador de "reposos" (MapLibre terminó de dibujar): las pruebas esperan a que suba para
  // capturar el mapa ya dibujado, sin dormir un tiempo fijo.
  mapa.on("idle", () => {
    contenedor.dataset.mapaReposos = String(Number(contenedor.dataset.mapaReposos ?? 0) + 1);
  });

  let detener: (() => void) | null = null;
  // Se conecta en cuanto el estilo está listo, NO al evento `load`: ese espera a que lleguen las
  // teselas visibles y, con mala red, retrasaría el LKP y el cohete, que no dependen de ellas.
  mapa.once("style.load", () => {
    detener = effect(() => {
      actualizar({
        sitio: meta.value?.sitio ?? null,
        estado: estado.value,
        estacion: estacion.value,
        serie: serie.value,
        principal: estadoPagina.value.principal,
        edadMs: edad.value,
      });
    });
    contenedor.dataset.mapaListo = "1";
  });
  contenedor.dataset.mapaBase = base ? "vectorial" : "sin-base";

  return {
    hayCohete,
    tokens,
    conBase: base !== null,
    centrarEnCohete() {
      const destino = capas && destinoDe(capas);
      if (!destino) return;
      interactuo = true;
      mapa.easeTo({
        center: destino,
        zoom: Math.min(mapa.getMaxZoom(), Math.max(mapa.getZoom(), MAPA_ZOOM_CENTRAR)),
        duration: duracion(),
      });
    },
    verTodo() {
      interactuo = false;
      if (capas?.limites) ajustarA(capas.limites);
    },
    cooperativo(activo) {
      if (activo) mapa.cooperativeGestures.enable();
      else mapa.cooperativeGestures.disable();
    },
    redimensionar: () => mapa.resize(),
    destruir() {
      detener?.();
      for (const m of [rampa, estacionMarca, impacto, chip, cohete, lkpMarca]) m.quitar();
      mapa.remove();
      removeProtocol("pmtiles");
    },
  };
}
