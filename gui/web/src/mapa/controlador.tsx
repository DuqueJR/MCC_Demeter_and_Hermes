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
  type SkySpecification,
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
import { Capa3d, type CoheteVivo, type Fotograma } from "./capa3d";
import {
  ESTILO_3D,
  ESTILO_MAPA,
  MAPA_3D_COHETE_PX,
  MAPA_3D_EXAGERACION,
  MAPA_3D_PITCH,
  MAPA_3D_PITCH_MAX,
  MAPA_3D_ZOOM_VER_TODO_MENOS,
  MAPA_CENTRO_POR_DEFECTO,
  MAPA_ESCALA_MAX_PX,
  MAPA_MARCADOR_OPACIDAD_TAPADO,
  MAPA_RELLENO_PX,
  MAPA_ZOOM_AJUSTE_MAX,
  MAPA_ZOOM_CENTRAR,
  MAPA_ZOOM_INICIAL,
} from "./constantes";
import { relieveActivo } from "./estado_relieve";
import {
  CAPAS_RELIEVE,
  cielo3d,
  construirEstilo,
  FUENTE,
  fuenteTerreno,
  ID_3D,
  leerTokensDelDocumento,
  leerTokensRelieveDelDocumento,
  type RelieveEstilo,
  type Tokens,
} from "./estilo";
import {
  agregarPunto,
  agregarPuntoAlt,
  type Capas,
  type Coord,
  construirCapas,
  type DecisionLkp,
  decidirLkp,
  direccionDeVelocidad,
  type EntradaMapa,
  fueraDeLimites,
  type Limites,
  limitesConAltura,
  type PuntoAlt,
  puntosAltDeSerie,
  puntosDeSerie,
  unirLimites,
} from "./geo";
import {
  ChipDistancia,
  type DatosCohete,
  type DatosLkp,
  MarcadorCohete,
  MarcadorEstacion,
  MarcadorImpacto,
  MarcadorLkp,
  MarcadorPin,
  MarcadorRampa,
} from "./marcadores";
import { cargarRelieve } from "./relieve";

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
  /** Hay relieve: se puede ofrecer la vista 3D (T-656). Sin él, el botón no aparece. */
  con3d: boolean;
  /** La vista 3D está activa (arranca en 3D si hay relieve, desde T-673; si no, en 2D). */
  modo3d: ReadonlySignal<boolean>;
  alternar3d(): void;
  centrarEnCohete(): void;
  verTodo(): void;
  /** Gestos cooperativos: activos en la página; se apagan en pantalla completa. */
  cooperativo(activo: boolean): void;
  redimensionar(): void;
  destruir(): void;
}

/** Opciones de un `Marca`. */
interface OpcionesMarca {
  /** El marcador gira con el mapa: `rotar(grados)` es un azimut sobre el mapa, no sobre la pantalla. */
  rotacionMapa?: boolean;
}

/** Un marcador del DOM que se crea al primer uso y se quita cuando no hay posición. */
class Marca {
  private marcador: Marker | null = null;
  private readonly mapa: MapaGL;
  private readonly anclaje: PositionAnchor;
  private readonly clase: string;
  private readonly contenido: () => ComponentChild;
  private readonly rotacionMapa: boolean;
  /** En 3D el marcador se tiende sobre el terreno (`pitchAlignment: "map"`); en 2D, como siempre. */
  private plano = false;
  private rotacion = 0;

  constructor(
    mapa: MapaGL,
    anclaje: PositionAnchor,
    clase: string,
    contenido: () => ComponentChild,
    opciones: OpcionesMarca = {},
  ) {
    this.mapa = mapa;
    this.anclaje = anclaje;
    this.clase = clase;
    this.contenido = contenido;
    this.rotacionMapa = opciones.rotacionMapa === true;
  }

  /**
   * Con `rotacionMapa` el marcador mide su inclinación respecto a la pantalla ("viewport") salvo en 3D
   * plano, y NO usa "auto": con la rotación en "map", "auto" lo inclinaría también en 2D.
   */
  private inclinacion(): "auto" | "viewport" | "map" {
    if (this.plano) return "map";
    return this.rotacionMapa ? "viewport" : "auto";
  }

  /** Tiende el marcador sobre el terreno (3D) o lo vuelve a poner de frente a la pantalla (2D). */
  tender(plano: boolean): void {
    this.plano = plano;
    this.marcador?.setPitchAlignment(this.inclinacion());
  }

  /** El rumbo del marcador, en grados desde el norte (solo con `rotacionMapa`). */
  rotar(grados: number): void {
    this.rotacion = grados;
    this.marcador?.setRotation(grados);
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
      // Con el terreno en 3D, un marcador detrás de un cerro se atenúa por defecto: aquí nunca (GS-03).
      this.marcador = new Marker({
        element: elemento,
        anchor: this.anclaje,
        opacityWhenCovered: MAPA_MARCADOR_OPACIDAD_TAPADO,
        ...(this.rotacionMapa ? { rotationAlignment: "map" as const } : {}),
        pitchAlignment: this.inclinacion(),
        rotation: this.rotacion,
      })
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

/** Lo que la misión le da al mapa (viene de su contenido, para que el mapa no importe nada de una misión). */
export interface OpcionesMapa {
  /** La miniatura del cohete de la misión (URL), para la vista 3D. Sin ella no se dibuja la imagen. */
  coheteMapa?: string;
}

export async function crearMapa(
  contenedor: HTMLElement,
  opciones: OpcionesMapa = {},
): Promise<ControlMapa> {
  // MapLibre busca su worker junto a su propio archivo, que el empaquetado no conserva: se le dice
  // dónde quedó (el archivo se emite como recurso aparte y solo se pide al dibujar el mapa).
  setWorkerUrl(urlTrabajador);
  const tokens = leerTokensDelDocumento();
  const protocolo = new Protocol();
  addProtocol("pmtiles", protocolo.tile);
  // La base y el relieve se piden a la vez (ninguno retrasa al otro); los dos son opcionales.
  const [detectada, datosRelieve] = await Promise.all([detectarBase(protocolo), cargarRelieve()]);
  const base = detectada?.base ?? null;
  const cobertura = detectada?.cobertura ?? null;
  // Sin los datos o sin los tokens del tema, no hay relieve y el estilo es el de siempre.
  const tokensRelieve = datosRelieve ? leerTokensRelieveDelDocumento() : null;
  const relieve: RelieveEstilo | null =
    datosRelieve && tokensRelieve ? { relieve: datosRelieve, tokens: tokensRelieve } : null;
  if (datosRelieve && !tokensRelieve) {
    console.warn("Sin relieve en el mapa: el tema no define los tokens --relieve-*");
  }

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
    style: construirEstilo(tokens, base, relieve),
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
    // En 2D no se rota con el ratón. `pitchWithRotate` solo decide si, al activar `dragRotate` en 3D
    // (T-656), el arrastre también inclina; mientras `dragRotate` esté apagado no hace nada.
    dragRotate: false,
    pitchWithRotate: true,
    locale: TEXTOS_MAPA,
    attributionControl: { compact: true },
  });
  mapa.touchZoomRotate.disableRotation();
  // Para volver a 2D con los mismos gestos (el máximo de inclinación sube mientras dura el 3D).
  const maxPitch2d = mapa.getMaxPitch();
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
  // Solo en 3D (ronda 3): el impacto es un pin de pie, y a su pie un anillo suave tendido sobre el terreno.
  const impactoPin = new Marca(mapa, "bottom", "marcador-impacto-pin", () => <MarcadorPin />);
  const anillo = new Marca(mapa, "center", "marcador-anillo", () => (
    <span class="impacto-anillo" />
  ));
  const chip = new Marca(mapa, "center", "marcador-chip", () => (
    <ChipDistancia texto={textoChip} />
  ));
  // El cohete gira con el mapa (su flecha es un rumbo sobre el mapa, no sobre la pantalla).
  const cohete = new Marca(
    mapa,
    "center",
    "marcador-cohete",
    () => <MarcadorCohete datos={datosCohete} />,
    { rotacionMapa: true },
  );
  const lkpMarca = new Marca(mapa, "bottom", "marcador-lkp", () => (
    <MarcadorLkp datos={datosLkp} />
  ));

  // ---- Estado del controlador
  const hayCohete = signal(false);
  let decision: DecisionLkp | null = null;
  let rastro: Coord[] = [];
  /** Los mismos puntos del rastro, con su altura (solo se usan en la vista 3D, T-656). */
  let rastroAlt: PuntoAlt[] = [];
  let serieAnterior: EntradaMapa["serie"] | null = null;
  let rastroPublicado: Coord[] | null = null;
  /** Lo que se dibuja en el aire en 3D (T-656): el cohete a su altura, la rampa y el impacto estimado. */
  let coheteVivo: CoheteVivo | null = null;
  let rampaPos: Coord | null = null;
  let impactoPos: Coord | null = null;
  /** La capa personalizada (la línea y la plomada) y la imagen del cohete: solo existen en 3D. */
  let capa3d: Capa3d | null = null;
  let imagenCohete: HTMLImageElement | null = null;
  let capas: Capas | null = null;
  let interactuo = false; // el usuario movió el mapa: no se le quita la vista
  let ajustado = false; // ya se encuadró alguna vez lo que hay
  let sitioAplicado = meta.peek() !== null;
  let estiloListo = false;
  /** La vista 3D está activa (T-656). Desde T-673 arranca en 3D si hay relieve y el 3D no falla. */
  const modo3d = signal(false);
  /** La cámara de 2D al entrar en 3D, para dejarla igual al volver si nadie la movió en 3D. */
  let camara2d: { center: Coord; zoom: number } | null = null;
  let movidaEn3d = false;
  /** Cuenta los cambios de modo: un cierre que llega tarde (fin de la animación) no pisa un 3D nuevo. */
  let generacion3d = 0;

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
  /**
   * Lo dibujado, incluida la parte alta de la trayectoria en 3D (T-656): con la cámara inclinada asoma
   * por arriba, así que "Ver todo" y el área navegable deben abarcarla. En 2D es solo `dibujado`.
   */
  const cajaDibujada = (): Limites | null =>
    modo3d.value ? unirLimites(dibujado, limitesConAltura(rastroAlt, MAPA_3D_PITCH)) : dibujado;
  /** "Ver todo" en 3D: el mismo encuadre con la inclinación y el norte arriba, algo más alejado. */
  const ajustarA3d = (l: Limites) => {
    const camara = mapa.cameraForBounds(
      [
        [l[0], l[1]],
        [l[2], l[3]],
      ],
      { padding: MAPA_RELLENO_PX, maxZoom: MAPA_ZOOM_AJUSTE_MAX },
    );
    if (!camara) return;
    mapa.easeTo({
      center: camara.center,
      zoom: (camara.zoom ?? mapa.getZoom()) - MAPA_3D_ZOOM_VER_TODO_MENOS,
      pitch: MAPA_3D_PITCH,
      bearing: 0,
      duration: duracion(),
    });
  };
  const encuadrar = (l: Limites) => (modo3d.value ? ajustarA3d(cajaDibujada() ?? l) : ajustarA(l));
  const visibles = (): Limites => {
    const b = mapa.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  };
  const destinoDe = (c: Capas): Coord | null =>
    c.marcadores.lkp?.pos ?? c.marcadores.cohete?.pos ?? null;

  // ---- Límites del mapa (T-634)
  /** La pose de la cámara y el modo (T-656), para las pruebas: se republica al terminar cada movimiento. */
  const publicarPose = () => {
    contenedor.setAttribute("data-mapa-3d", String(modo3d.value));
    contenedor.dataset.mapaPitch = mapa.getPitch().toFixed(1);
    contenedor.dataset.mapaBearing = mapa.getBearing().toFixed(1);
    contenedor.dataset.mapaTerreno = mapa.getTerrain() ? "activo" : "no";
  };
  /** Anota en el lienzo lo que las pruebas necesitan leer (como `data-mapa-reposos`). */
  const publicarVista = () => {
    publicarPose();
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
    const caja = cajaDibujada();
    const incluida = ampliarParaIncluir(areaBase(), caja);
    return ampliarParaVista(
      incluida,
      caja,
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
      rastroAlt = puntosAltDeSerie(entrada.serie);
    }
    decision = decidirLkp(entrada, decision);
    // Lo que llega por el stream entre dos snapshots también alarga la trayectoria.
    const pos = entrada.estado?.pos;
    if (!decision.activo && pos) {
      rastro = agregarPunto(rastro, [pos.lon, pos.lat]);
      rastroAlt = agregarPuntoAlt(rastroAlt, {
        lon: pos.lon,
        lat: pos.lat,
        alt_agl_m: pos.alt_agl_m,
      });
    }

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
    impactoPos = m.impacto;
    ponerImpacto();
    if (m.chip) textoChip.value = m.chip.texto;
    chip.poner(m.chip?.pos ?? null);
    if (m.cohete) datosCohete.value = { rumbo: m.cohete.rumbo, atenuado: m.cohete.atenuado };
    cohete.rotar(m.cohete?.rumbo ?? 0);
    cohete.poner(m.cohete?.pos ?? null);
    if (m.cohete?.rumbo != null) contenedor.dataset.mapaRumbo = m.cohete.rumbo.toFixed(1);
    else delete contenedor.dataset.mapaRumbo;
    // En 3D el cohete va a su altura real, salvo ya aterrizado o en LKP (ahí manda el marcador del suelo).
    const alt = entrada.estado?.pos?.alt_agl_m ?? null;
    coheteVivo =
      m.cohete && alt !== null && entrada.estado?.fase !== "LANDED"
        ? {
            lon: m.cohete.pos[0],
            lat: m.cohete.pos[1],
            alt_agl_m: alt,
            direccion: direccionDeVelocidad(entrada.estado?.vel ?? null),
          }
        : null;
    rampaPos = m.rampa ?? (rastroAlt[0] ? [rastroAlt[0].lon, rastroAlt[0].lat] : null);
    publicar3d(); // la línea y la plomada de la vista 3D, con los mismos datos y en el mismo momento
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
        encuadrar(capas.limites);
      }
    }
  };

  // Un gesto del usuario (no un movimiento hecho por nosotros) detiene el encuadre automático.
  const alMoverUsuario = (e: { originalEvent?: unknown }) => {
    if (!e.originalEvent) return;
    interactuo = true;
    if (modo3d.value) movidaEn3d = true;
  };
  mapa.on("dragstart", alMoverUsuario);
  mapa.on("zoomstart", alMoverUsuario);
  mapa.on("resize", aplicarLimites);
  mapa.on("moveend", publicarVista);

  // ---- Vista 3D opcional (T-656, D-W23)
  // Solo existe si hay relieve (las teselas del DEM). Todo lo del 3D se agrega al entrar y se quita al
  // salir: con el 3D apagado el estilo, los gestos y las capas son exactamente los de antes.

  /** Los diagnósticos del dibujo en 3D para las pruebas (qué salió dibujado); solo existen en 3D. */
  const publicarModo3d = () => {
    publicarPose();
    if (modo3d.value && capa3d) {
      contenedor.dataset.mapaCapa3d = mapa.getLayer(ID_3D.capa)?.type ?? "";
      contenedor.dataset.mapaLineaSegmentos = String(capa3d.segmentos());
      contenedor.dataset.mapaCuadros3d = String(capa3d.cuadros());
      contenedor.dataset.mapaCapasExtrusion = String(
        mapa.getStyle().layers.filter((l) => l.type === "fill-extrusion").length,
      );
      // La caída estimada (GS-10) apoyada en el terreno: lo que salió dibujado de la elipse.
      contenedor.dataset.mapaElipseDibujada = String(
        mapa.queryRenderedFeatures({ layers: ["elipse-relleno", "elipse-borde"] }).length,
      );
    } else {
      for (const clave of [
        "mapaCapa3d",
        "mapaLineaSegmentos",
        "mapaCuadros3d",
        "mapaCapasExtrusion",
        "mapaElipseDibujada",
      ]) {
        delete contenedor.dataset[clave];
      }
    }
  };

  /** Le da a la capa personalizada lo que hay ahora (solo en 3D). Ella rearma la línea solo si cambió el rastro. */
  function publicar3d(): void {
    if (!modo3d.value || !capa3d) return;
    capa3d.poner(rampaPos ? { puntos: rastroAlt, cohete: coheteVivo, rampa: rampaPos } : null);
  }

  /** En 3D el impacto es un pin de pie con un anillo en el suelo; en 2D, la diana de siempre. */
  function ponerImpacto(): void {
    const en3d = modo3d.value;
    impacto.poner(en3d ? null : impactoPos);
    impactoPin.poner(en3d ? impactoPos : null);
    anillo.poner(en3d ? impactoPos : null);
  }

  /** Cada cuadro la capa dice dónde queda el cohete en pantalla: se mueve y se gira la imagen. */
  const alFotograma = (f: Fotograma) => {
    const img = imagenCohete;
    if (!img) return;
    const c = f.cohete;
    if (c === null || !c.dentro) {
      if (!img.hidden) img.hidden = true;
      return;
    }
    if (img.hidden) img.hidden = false;
    img.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) translate(-50%, -50%) rotate(${c.angulo.toFixed(1)}deg)`;
    img.dataset.angulo = c.angulo.toFixed(1);
    img.dataset.x = c.x.toFixed(1);
    img.dataset.y = c.y.toFixed(1);
  };

  /** La imagen del cohete de la misión, sobre el lienzo (HTML, no del estilo). `null` si la misión no la dio. */
  const crearImagenCohete = (): HTMLImageElement | null => {
    if (!opciones.coheteMapa) return null;
    const img = document.createElement("img");
    img.className = "mapa-cohete-3d";
    img.src = opciones.coheteMapa;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.draggable = false;
    img.width = MAPA_3D_COHETE_PX;
    img.height = MAPA_3D_COHETE_PX;
    img.hidden = true;
    mapa.getCanvasContainer().append(img);
    return img;
  };

  /** Los marcadores que se tienden sobre el terreno en 3D (el chip y el LKP llevan texto y quedan de frente). */
  const marcasPlanas = [rampa, estacionMarca, cohete, anillo];

  /** Un gesto del usuario con el mapa inclinado o girado también detiene el encuadre automático. */
  const eventos3d = ["rotatestart", "pitchstart"] as const;

  /**
   * Entra en 3D. `inicial` es el arranque del mapa (T-673): sin animación (el 3D es la primera vista, no
   * un cambio) y sin recordar la cámara de 2D, porque no hubo una vista 2D que restaurar: al pulsar "Vista
   * 2D" el mapa solo se aplana donde está.
   */
  const activar3d = (inicial = false) => {
    if (!relieve || !estiloListo || modo3d.value) return;
    modo3d.value = true;
    generacion3d++;
    const c = mapa.getCenter();
    camara2d = inicial ? null : { center: [c.lng, c.lat], zoom: mapa.getZoom() };
    movidaEn3d = false;
    mapa.addSource(ID_3D.fuenteTerreno, fuenteTerreno(relieve.relieve));
    // La línea de la trayectoria y la plomada, en una capa personalizada; y la imagen del cohete encima.
    capa3d = new Capa3d({
      colores: { viejo: tokens.linea, nuevo: tokens.acento, plomada: tokens.texto2 },
      exageracion: MAPA_3D_EXAGERACION,
      alFotograma,
      suavizado: () => !sinMovimiento(),
      alFallar: alFallar3d,
    });
    mapa.addLayer(capa3d);
    imagenCohete = crearImagenCohete();
    // La caída estimada, con el borde fino y suave (la elipse real es pequeña) y un relleno algo más visible.
    mapa.setPaintProperty("elipse-borde", "line-width", ESTILO_3D.anchoElipse);
    mapa.setPaintProperty("elipse-relleno", "fill-opacity", ESTILO_3D.opacidadElipse);
    for (const m of marcasPlanas) m.tender(true);
    ponerImpacto();
    mapa.setTerrain({ source: ID_3D.fuenteTerreno, exaggeration: MAPA_3D_EXAGERACION });
    mapa.setSky(cielo3d(tokens));
    mapa.setMaxPitch(MAPA_3D_PITCH_MAX);
    mapa.dragRotate.enable();
    mapa.touchZoomRotate.enableRotation();
    for (const e of eventos3d) mapa.on(e, alMoverUsuario);
    publicar3d();
    aplicarLimites(); // el área incluye la parte alta de la trayectoria
    if (inicial) mapa.jumpTo({ pitch: MAPA_3D_PITCH });
    else if (!interactuo && capas?.limites && destinoDe(capas))
      ajustarA3d(cajaDibujada() ?? capas.limites);
    else mapa.easeTo({ pitch: MAPA_3D_PITCH, duration: duracion() });
    publicarModo3d();
  };

  /**
   * Si algo del 3D falla (la capa WebGL no compila, o una excepción al entrar), se vuelve a 2D sin
   * ruido: un aviso en consola y nada más. Lo avisa la capa (`alFallar`) o el `try` del arranque.
   */
  const alFallar3d = (causa: unknown) => {
    console.warn("Sin vista 3D en el mapa:", causa instanceof Error ? causa.message : causa);
    // Después de lo que esté en curso (la capa avisa desde dentro de `addLayer`).
    setTimeout(() => {
      try {
        desactivar3d(true);
      } catch {
        // El mapa ya se destruyó: no hay nada que deshacer.
      }
    }, 0);
  };

  const desactivar3d = (inmediato = false) => {
    if (!modo3d.value) return;
    modo3d.value = false;
    const generacion = ++generacion3d;
    // Los gestos vuelven a ser los de 2D de inmediato (sin rotar con el ratón ni con los dedos).
    mapa.dragRotate.disable();
    mapa.touchZoomRotate.disableRotation();
    for (const e of eventos3d) mapa.off(e, alMoverUsuario);
    // El terreno, el cielo y los prismas se quitan cuando la cámara ya está plana: así no hay un salto.
    const limpiar = () => {
      if (generacion !== generacion3d || modo3d.value) return;
      mapa.setTerrain(null);
      // Sin argumento, MapLibre quita el cielo (en runtime acepta `undefined`; el tipo no lo dice).
      mapa.setSky(undefined as unknown as SkySpecification);
      if (mapa.getLayer(ID_3D.capa)) mapa.removeLayer(ID_3D.capa);
      capa3d = null;
      imagenCohete?.remove();
      imagenCohete = null;
      if (mapa.getSource(ID_3D.fuenteTerreno)) mapa.removeSource(ID_3D.fuenteTerreno);
      mapa.setPaintProperty("elipse-borde", "line-width", ESTILO_MAPA.anchoElipse);
      mapa.setPaintProperty("elipse-relleno", "fill-opacity", ESTILO_MAPA.opacidadElipse);
      for (const m of marcasPlanas) m.tender(false);
      ponerImpacto();
      mapa.setMaxPitch(maxPitch2d);
      aplicarLimites();
      publicarModo3d();
    };
    const ms = inmediato ? 0 : duracion();
    // Si nadie movió la cámara en 3D (ni con gestos ni con los botones), 2D queda como estaba al entrar.
    const vuelta = camara2d && !movidaEn3d ? camara2d : null;
    mapa.easeTo({
      pitch: 0,
      bearing: 0,
      ...(vuelta ? { center: vuelta.center, zoom: vuelta.zoom } : {}),
      duration: ms,
    });
    // Sin animación (movimiento reducido) no hay un `moveend` posterior que esperar: se limpia ya.
    if (ms === 0) limpiar();
    else mapa.once("moveend", limpiar);
    aplicarLimites();
    publicarModo3d();
  };

  // Contador de "reposos" (MapLibre terminó de dibujar): las pruebas esperan a que suba para
  // capturar el mapa ya dibujado, sin dormir un tiempo fijo.
  mapa.on("idle", () => {
    contenedor.dataset.mapaReposos = String(Number(contenedor.dataset.mapaReposos ?? 0) + 1);
    // Para las pruebas (T-638): cuántas capas `base-*` tiene el estilo y cuántos elementos de ellas
    // salieron dibujados (teselas del PMTiles ya leídas y decodificadas).
    const capasBase = mapa
      .getStyle()
      .layers.map((l) => l.id)
      .filter((id) => id.startsWith("base-"));
    contenedor.dataset.mapaCapasBase = String(capasBase.length);
    contenedor.dataset.mapaBaseDibujada = String(
      capasBase.length > 0 ? mapa.queryRenderedFeatures({ layers: capasBase }).length : 0,
    );
    // Ídem para el relieve (T-649): cuántas capas `relieve-*` hay, si sus teselas ya se cargaron y
    // cuántas curvas de nivel salieron dibujadas.
    const capasRelieve = mapa
      .getStyle()
      .layers.map((l) => l.id)
      .filter((id) => id.startsWith("relieve-"));
    const capasCurvas = capasRelieve.filter((id) => id !== CAPAS_RELIEVE.sombreado);
    contenedor.dataset.mapaCapasRelieve = String(capasRelieve.length);
    contenedor.dataset.mapaRelieveCargado =
      relieve && mapa.isSourceLoaded(FUENTE.relieve) ? "1" : "0";
    contenedor.dataset.mapaCurvasDibujadas = String(
      capasCurvas.length > 0 ? mapa.queryRenderedFeatures({ layers: capasCurvas }).length : 0,
    );
    publicarModo3d();
  });
  if (relieve) {
    // Que una tesela del relieve no llegue es un aviso, no un error del mapa: el resto sigue igual.
    // MapLibre, sin ningún oyente, escribe todos los errores con `console.error`: aquí se conserva
    // para los que no son del relieve.
    let relieveAvisado = false;
    mapa.on("error", (e) => {
      const fuenteId = (e as { sourceId?: string }).sourceId;
      if (fuenteId !== FUENTE.relieve && fuenteId !== FUENTE.curvas) return console.error(e.error);
      if (relieveAvisado) return;
      relieveAvisado = true;
      console.warn("Relieve del mapa:", e.error?.message ?? e.error);
    });
  }

  let detener: (() => void) | null = null;
  // Se conecta en cuanto el estilo está listo, NO al evento `load`: ese espera a que lleguen las
  // teselas visibles y, con mala red, retrasaría el LKP y el cohete, que no dependen de ellas.
  mapa.once("style.load", () => {
    estiloListo = true;
    // El mapa arranca en 3D si hay relieve (T-673), antes de conectar los datos, para que el primer
    // encuadre ya sea el de 3D. Si algo falla, se queda en 2D como antes.
    if (relieve) {
      try {
        activar3d(true);
      } catch (e) {
        alFallar3d(e);
      }
    }
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
  contenedor.dataset.mapaRelieve = relieve ? "activo" : "sin-relieve";
  contenedor.setAttribute("data-mapa-3d", "false");
  relieveActivo.value = relieve !== null;

  return {
    hayCohete,
    tokens,
    conBase: base !== null,
    con3d: relieve !== null,
    modo3d,
    alternar3d: () => (modo3d.value ? desactivar3d() : activar3d()),
    centrarEnCohete() {
      const destino = capas && destinoDe(capas);
      if (!destino) return;
      interactuo = true;
      if (modo3d.value) movidaEn3d = true;
      mapa.easeTo({
        center: destino,
        zoom: Math.min(mapa.getMaxZoom(), Math.max(mapa.getZoom(), MAPA_ZOOM_CENTRAR)),
        duration: duracion(),
      });
    },
    verTodo() {
      interactuo = false;
      if (modo3d.value) movidaEn3d = true;
      if (capas?.limites) encuadrar(capas.limites);
    },
    cooperativo(activo) {
      if (activo) mapa.cooperativeGestures.enable();
      else mapa.cooperativeGestures.disable();
    },
    redimensionar: () => mapa.resize(),
    destruir() {
      detener?.();
      relieveActivo.value = false;
      imagenCohete?.remove();
      for (const m of [rampa, estacionMarca, impacto, impactoPin, anillo, chip, cohete, lkpMarca]) {
        m.quitar();
      }
      mapa.remove();
      removeProtocol("pmtiles");
    },
  };
}
