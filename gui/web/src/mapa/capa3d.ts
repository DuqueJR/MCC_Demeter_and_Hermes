// La capa personalizada de la vista 3D (T-656, ronda 3): dibuja con WebGL propio, sin otra biblioteca,
//  - la trayectoria a su altura real como una LÍNEA FINA de ancho constante en pantalla, con degradado
//    viejo -> nuevo, y
//  - la plomada: una línea vertical fina y punteada del cohete al suelo.
// Además, en cada cuadro proyecta a píxeles la posición 3D del cohete para que la imagen HTML del cohete
// la siga (`alFotograma`). Va en el chunk diferido del mapa.
//
// Cómo se ubica en el espacio (MapLibre 6.16, `CustomRenderMethodInput.defaultProjectionData`):
// - `mainMatrix` pasa de Mercator (x e y en [0, 1], el norte hacia y = 0) a espacio de recorte. Con
//   `renderingMode: "3d"` la z está en las mismas unidades que x e y: un metro es
//   `metroEnMercator(lat)`. Con terreno, la z es la altura sobre el nivel del mar (la del terreno
//   dibujado, ya con su exageración): el DEM de una tesela va en esas mismas unidades.
// - La altura de un punto del aire es `alturaDeDibujo`: la elevación del terreno en la rampa
//   (`map.queryTerrainElevation`, que ya incluye la exageración) más `alt_agl_m` por la exageración.
// - Mercator tiene x e y de ~0,27 y un metro mide ~2,5e-8: con `float32` (24 bits de mantisa, ~3e-8 de
//   resolución) la línea temblaría un metro. Por eso los vértices van RELATIVOS a la rampa y la matriz
//   lleva la traslación (`matrizRelativa`, en doble precisión).
import type { CustomLayerInterface, Map as MapaGL } from "maplibre-gl";
import {
  ESTILO_3D,
  MAPA_3D_COHETE_ADELANTE_PX,
  MAPA_3D_COHETE_SUAVIZADO_MAX_MS,
  MAPA_3D_COHETE_SUAVIZADO_MS,
  MAPA_3D_LINEA_PX,
  MAPA_3D_PLOMADA_PX,
  MAPA_3D_PLOMADA_RAYA_PX,
} from "./constantes";
import { ID_3D } from "./estilo";
import {
  aMercator,
  anguloConMemoria,
  type BufferLinea,
  type ContextoLinea,
  type Coord,
  colorARgb,
  construirBufferLinea,
  construirBufferPlomada,
  FLOATS_POR_VERTICE,
  matrizRelativa,
  metroEnMercator,
  metrosPorPixel,
  type PuntoAlt,
  proyectarAPixeles,
  suavizarAngulo,
  VERTICES_POR_SEGMENTO,
} from "./geo";

/** El cohete en vivo, para la capa: su posición, su altura sobre la rampa y hacia dónde va (o `null`). */
export interface CoheteVivo {
  lon: number;
  lat: number;
  alt_agl_m: number;
  /** `[este, norte, arriba]` unitario, de `direccionDeVelocidad`; `null` si no hay velocidad fiable. */
  direccion: [number, number, number] | null;
}

/** Lo que la capa dibuja. */
export interface EstadoCapa3d {
  /** El rastro con altura. La línea se rearma solo cuando cambia esta referencia. */
  puntos: readonly PuntoAlt[];
  cohete: CoheteVivo | null;
  /** La rampa: el origen y la referencia de las alturas. */
  rampa: Coord;
}

/** Dónde queda el cohete en la pantalla en este cuadro (lo usa la imagen HTML). */
export interface Fotograma {
  cohete: { x: number; y: number; angulo: number; dentro: boolean } | null;
}

/** Los colores (de tokens) de la capa. */
export interface ColoresCapa3d {
  viejo: string;
  nuevo: string;
  plomada: string;
}

const VERTICE = `#version 300 es
uniform mat4 u_matriz;
uniform vec2 u_pantalla;
uniform float u_ancho;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_otro;
layout(location = 2) in vec4 a_atrib; // lado (-1 o 1), degradado, distancia en m, extremo (0 o 1)
out float v_degradado;
out float v_lado;
out float v_distancia;
void main() {
  vec4 cp = u_matriz * vec4(a_pos, 1.0);
  vec4 co = u_matriz * vec4(a_otro, 1.0);
  v_degradado = a_atrib.y;
  v_distancia = a_atrib.z;
  v_lado = 0.0;
  // Detrás de la cámara no se dibuja.
  if (cp.w <= 0.0 || co.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 mitad = u_pantalla * 0.5;
  vec2 sp = cp.xy / cp.w * mitad;
  vec2 so = co.xy / co.w * mitad;
  vec2 dir = a_atrib.w < 0.5 ? so - sp : sp - so;
  float largo = length(dir);
  dir = largo > 0.0001 ? dir / largo : vec2(0.0, 1.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float semiancho = u_ancho * 0.5 + 1.0; // 1 px de margen para suavizar el borde
  v_lado = a_atrib.x * semiancho;
  vec2 desplazamiento = normal * a_atrib.x * semiancho / mitad;
  gl_Position = vec4(cp.xy + desplazamiento * cp.w, cp.z, cp.w);
}`;

const FRAGMENTO = `#version 300 es
precision highp float;
uniform vec3 u_viejo;
uniform vec3 u_nuevo;
uniform vec3 u_plomada;
uniform float u_modo; // 0 = línea con degradado, 1 = plomada punteada
uniform float u_ancho;
uniform float u_raya; // largo de la raya y del hueco de la plomada, en metros
uniform float u_opacidad;
in float v_degradado;
in float v_lado;
in float v_distancia;
out vec4 salida;
void main() {
  float cobertura = clamp(u_ancho * 0.5 + 0.5 - abs(v_lado), 0.0, 1.0);
  if (u_modo > 0.5 && u_raya > 0.0 && mod(v_distancia, 2.0 * u_raya) > u_raya) discard;
  vec3 color = u_modo > 0.5 ? u_plomada : mix(u_viejo, u_nuevo, v_degradado);
  float a = cobertura * u_opacidad;
  salida = vec4(color * a, a); // alfa premultiplicado, como espera MapLibre
}`;

function compilar(gl: WebGL2RenderingContext, tipo: number, fuente: string): WebGLShader {
  const sombreador = gl.createShader(tipo);
  if (!sombreador) throw new Error("No se pudo crear el sombreador");
  gl.shaderSource(sombreador, fuente);
  gl.compileShader(sombreador);
  if (!gl.getShaderParameter(sombreador, gl.COMPILE_STATUS)) {
    const registro = gl.getShaderInfoLog(sombreador);
    gl.deleteShader(sombreador);
    throw new Error(`Sombreador de la capa 3D: ${registro}`);
  }
  return sombreador;
}

/** Un búfer de vértices con su VAO (los tres atributos de `FLOATS_POR_VERTICE`). */
interface Geometria {
  buffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  vertices: number;
}

const BYTES_FLOAT = 4;

export class Capa3d implements CustomLayerInterface {
  readonly id = ID_3D.capa;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private readonly colores: { viejo: number[]; nuevo: number[]; plomada: number[] };
  private readonly exageracion: number;
  private readonly alFotograma: (f: Fotograma) => void;
  /** ¿Se suaviza el giro de la imagen? (no, con `prefers-reduced-motion`). */
  private readonly suavizado: () => boolean;
  /** Se llama si la capa no puede arrancar (el shader no compila): el mapa vuelve a 2D. */
  private readonly alFallar: (causa: unknown) => void;
  /** El último ángulo válido (con rumbo fiable) y el que se muestra ahora, con su instante. */
  private anguloUltimo: number | null = null;
  private anguloMostrado: number | null = null;
  private instantePrevio = 0;

  private mapa: MapaGL | null = null;
  private programa: WebGLProgram | null = null;
  private uniformes: Record<string, WebGLUniformLocation | null> = {};
  private linea: Geometria | null = null;
  private plomada: Geometria | null = null;

  private estado: EstadoCapa3d | null = null;
  /** La referencia de los puntos con que está armada la línea. */
  private puntosArmados: readonly PuntoAlt[] | null = null;
  private lineaSucia = false;
  private plomadaSucia = false;
  private bufferLinea: BufferLinea | null = null;
  private bufferPlomada: BufferLinea | null = null;
  /** La altura del suelo bajo el cohete (m sobre la elevación base) con que está armada la plomada. */
  private zSueloArmado = Number.NaN;
  private fotogramas = 0;

  constructor(opciones: {
    colores: ColoresCapa3d;
    exageracion: number;
    alFotograma: (f: Fotograma) => void;
    suavizado?: () => boolean;
    alFallar?: (causa: unknown) => void;
  }) {
    const componentes = (css: string): number[] => colorARgb(css) ?? [1, 1, 1];
    this.colores = {
      viejo: componentes(opciones.colores.viejo),
      nuevo: componentes(opciones.colores.nuevo),
      plomada: componentes(opciones.colores.plomada),
    };
    this.exageracion = opciones.exageracion;
    this.alFotograma = opciones.alFotograma;
    this.suavizado = opciones.suavizado ?? (() => true);
    this.alFallar = opciones.alFallar ?? (() => {});
  }

  /** Segmentos de la línea armados (para las pruebas). */
  segmentos(): number {
    return this.bufferLinea?.segmentos ?? 0;
  }

  /** Cuadros que dibujó la capa (para las pruebas). */
  cuadros(): number {
    return this.fotogramas;
  }

  /**
   * Un dato nuevo. Solo marca qué hay que rearmar: la línea, si cambió la referencia de los puntos; la
   * plomada, siempre (es un segmento). El dibujo y la subida de los búferes ocurren en `render`.
   */
  poner(estado: EstadoCapa3d | null): void {
    this.estado = estado;
    if (estado && estado.puntos !== this.puntosArmados) this.lineaSucia = true;
    this.plomadaSucia = true;
    this.mapa?.triggerRepaint();
  }

  onAdd(mapa: MapaGL, gl: WebGL2RenderingContext): void {
    try {
      this.armar(mapa, gl);
    } catch (e) {
      // Un shader que no compila no rompe el mapa: la capa queda inerte y se avisa para volver a 2D.
      this.programa = null;
      this.linea = this.plomada = null;
      this.alFallar(e);
    }
  }

  private armar(mapa: MapaGL, gl: WebGL2RenderingContext): void {
    this.mapa = mapa;
    const programa = gl.createProgram();
    if (!programa) throw new Error("No se pudo crear el programa de la capa 3D");
    gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERTICE));
    gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO));
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      throw new Error(`Programa de la capa 3D: ${gl.getProgramInfoLog(programa)}`);
    }
    this.programa = programa;
    for (const nombre of [
      "u_matriz",
      "u_pantalla",
      "u_ancho",
      "u_viejo",
      "u_nuevo",
      "u_plomada",
      "u_modo",
      "u_raya",
      "u_opacidad",
    ]) {
      this.uniformes[nombre] = gl.getUniformLocation(programa, nombre);
    }
    this.linea = this.crearGeometria(gl);
    this.plomada = this.crearGeometria(gl);
    // Si ya había un estado cuando se agregó la capa, hay que armarlo todo.
    this.lineaSucia = true;
    this.plomadaSucia = true;
  }

  onRemove(_mapa: MapaGL, gl: WebGL2RenderingContext): void {
    for (const g of [this.linea, this.plomada]) {
      if (!g) continue;
      gl.deleteBuffer(g.buffer);
      gl.deleteVertexArray(g.vao);
    }
    if (this.programa) gl.deleteProgram(this.programa);
    this.linea = this.plomada = this.programa = null;
    this.mapa = null;
    this.alFotograma({ cohete: null });
  }

  private crearGeometria(gl: WebGL2RenderingContext): Geometria {
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!buffer || !vao) throw new Error("No se pudo crear la geometría de la capa 3D");
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const paso = FLOATS_POR_VERTICE * BYTES_FLOAT;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, paso, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, paso, 3 * BYTES_FLOAT);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, paso, 6 * BYTES_FLOAT);
    gl.bindVertexArray(null);
    return { buffer, vao, vertices: 0 };
  }

  private subir(gl: WebGL2RenderingContext, g: Geometria, b: BufferLinea | null): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, g.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, b?.datos ?? new Float32Array(0), gl.DYNAMIC_DRAW);
    g.vertices = b ? b.segmentos * VERTICES_POR_SEGMENTO : 0;
  }

  private dibujar(
    gl: WebGL2RenderingContext,
    g: Geometria,
    modo: 0 | 1,
    ancho: number,
    opacidad: number,
    raya: number,
  ): void {
    if (g.vertices === 0) return;
    const u = this.uniformes;
    gl.uniform1f(u.u_modo ?? null, modo);
    gl.uniform1f(u.u_ancho ?? null, ancho);
    gl.uniform1f(u.u_opacidad ?? null, opacidad);
    gl.uniform1f(u.u_raya ?? null, raya);
    gl.bindVertexArray(g.vao);
    gl.drawArrays(gl.TRIANGLES, 0, g.vertices);
    gl.bindVertexArray(null);
  }

  render(
    gl: WebGL2RenderingContext,
    opciones: Parameters<NonNullable<CustomLayerInterface["render"]>>[1],
  ): void {
    const mapa = this.mapa;
    const estado = this.estado;
    this.fotogramas++;
    if (!mapa || !estado || !this.programa || !this.linea || !this.plomada) {
      this.alFotograma({ cohete: null });
      return;
    }
    const lat = estado.rampa[1];
    const origen = aMercator(estado.rampa[0], lat);
    const metro = metroEnMercator(lat);
    // La elevación del terreno en la rampa (con la exageración) es la base de todas las alturas.
    const elevBase = mapa.queryTerrainElevation(estado.rampa) ?? 0;
    const contexto: ContextoLinea = { origen, metroMercator: metro, exageracion: this.exageracion };

    // Solo se rearman los búferes cuando llegó un dato (o cambió el suelo bajo el cohete).
    if (this.lineaSucia) {
      this.bufferLinea = construirBufferLinea(estado.puntos, contexto);
      this.puntosArmados = estado.puntos;
      this.subir(gl, this.linea, this.bufferLinea);
      this.lineaSucia = false;
    }
    const cohete = estado.cohete;
    const zSuelo = cohete
      ? (mapa.queryTerrainElevation([cohete.lon, cohete.lat]) ?? elevBase) - elevBase
      : 0;
    if (this.plomadaSucia || zSuelo !== this.zSueloArmado) {
      this.bufferPlomada = cohete
        ? construirBufferPlomada([cohete.lon, cohete.lat], cohete.alt_agl_m, zSuelo, contexto)
        : null;
      this.zSueloArmado = zSuelo;
      this.subir(gl, this.plomada, this.bufferPlomada);
      this.plomadaSucia = false;
    }

    const matriz = matrizRelativa(opciones.defaultProjectionData.mainMatrix, [
      origen.x,
      origen.y,
      elevBase * metro,
    ]);
    const lienzo = mapa.getCanvas();
    const [ancho, alto] = [lienzo.clientWidth, lienzo.clientHeight];

    gl.useProgram(this.programa);
    const u = this.uniformes;
    gl.uniformMatrix4fv(u.u_matriz ?? null, false, Float32Array.from(matriz));
    gl.uniform2f(u.u_pantalla ?? null, ancho, alto);
    gl.uniform3fv(u.u_viejo ?? null, this.colores.viejo);
    gl.uniform3fv(u.u_nuevo ?? null, this.colores.nuevo);
    gl.uniform3fv(u.u_plomada ?? null, this.colores.plomada);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const mPorPx = metrosPorPixel(mapa.getZoom(), lat);
    this.dibujar(gl, this.linea, 0, MAPA_3D_LINEA_PX, ESTILO_3D.opacidadLinea, 0);
    this.dibujar(
      gl,
      this.plomada,
      1,
      MAPA_3D_PLOMADA_PX,
      ESTILO_3D.opacidadPlomada,
      MAPA_3D_PLOMADA_RAYA_PX * mPorPx,
    );
    gl.depthMask(true);

    // El cohete: su posición 3D a píxeles, y un punto "adelante" para saber hacia dónde apunta.
    if (!cohete) {
      this.anguloMostrado = null; // al reaparecer, sin giro desde el ángulo viejo
      this.alFotograma({ cohete: null });
      return;
    }
    const z = cohete.alt_agl_m * this.exageracion * metro;
    const mc = aMercator(cohete.lon, cohete.lat);
    const p: [number, number, number] = [mc.x - origen.x, mc.y - origen.y, z];
    const p0 = proyectarAPixeles(matriz, p, ancho, alto);
    if (!p0) {
      this.anguloMostrado = null; // al reaparecer, sin giro desde el ángulo viejo
      this.alFotograma({ cohete: null });
      return;
    }
    let p1 = null;
    if (cohete.direccion) {
      const paso = MAPA_3D_COHETE_ADELANTE_PX * mPorPx * metro;
      const [e, n, arriba] = cohete.direccion;
      // Mercator crece hacia el sur: el norte es -y.
      p1 = proyectarAPixeles(
        matriz,
        [p[0] + e * paso, p[1] - n * paso, p[2] + arriba * paso],
        ancho,
        alto,
      );
    }
    // La nariz sigue siempre el movimiento en pantalla (también al bajar); sin rumbo fiable, el último válido.
    const rumbo = anguloConMemoria(p0, p1, this.anguloUltimo);
    if (rumbo.fiable) this.anguloUltimo = rumbo.angulo;
    const ahora = performance.now();
    const dt = ahora - this.instantePrevio;
    this.instantePrevio = ahora;
    let angulo = rumbo.angulo;
    if (this.anguloMostrado !== null && dt < MAPA_3D_COHETE_SUAVIZADO_MAX_MS && this.suavizado()) {
      angulo = suavizarAngulo(this.anguloMostrado, rumbo.angulo, dt, MAPA_3D_COHETE_SUAVIZADO_MS);
      // Mientras falte camino, se sigue pidiendo cuadros (si no, el giro se quedaría a medias).
      if (angulo !== rumbo.angulo) mapa.triggerRepaint();
    }
    this.anguloMostrado = angulo;
    this.alFotograma({ cohete: { x: p0.x, y: p0.y, angulo, dentro: p0.dentro } });
  }
}
