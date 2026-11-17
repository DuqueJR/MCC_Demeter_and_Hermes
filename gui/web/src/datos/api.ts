// API de datos de la web: la interfaz CONGELADA entre el área E (UI) y el área D (datos). T-611.
// Aprobación: Juan Pablo y Jerónimo en la sincronización H0 (06 §5: "preguntar").
//
// LADO DE LECTURA (lo que importa el área E): signals de solo lectura. Es lo ÚNICO congelado.
// Los componentes leen `.value` y se re-renderizan solos. No agregar signals sin pasar por el contrato.
// LADO DE ESCRITURA (`alimentar`): interno del área D. T-631 lo amplía (un método por mensaje del
// stream) sin pasar por el contrato; la UI no escribe.
//
// Arranca VACÍO (todo en null, `conexion` en "cargando"): en producción nunca hay datos inventados
// (R-W5) ni datos de otra misión (D-W01). Los ejemplos se cargan solo desde las pruebas con
// `alimentar.snapshot(snapshotEjemplo, ...)`.
//
// Reglas (05): `null` = sin dato; la edad no usa el reloj de pared del celular (05 §0, §4.4).
// Cada página carga UNA misión (D-W01); este módulo guarda el estado de esa única misión.
import { computed, type ReadonlySignal, signal } from "@preact/signals";
import type {
  Backfill,
  Estacion,
  Estado,
  Evento,
  Meta,
  Salud,
  Serie,
  Snapshot,
} from "../contrato/tipos";
import { claveEvento } from "./costura";
import {
  type ConexionServidor,
  calcularEdadMs,
  calcularEstadoPagina,
  type EstadoPagina,
} from "./estado_pagina";
import { serieVacia } from "./serie";

export type { ConexionServidor, EstadoPagina, EstadoPrincipal } from "./estado_pagina";

// ---- Estado interno (escribible solo desde `alimentar`) ----
const _meta = signal<Meta | null>(null);
const _estado = signal<Estado | null>(null);
const _salud = signal<Salud | null>(null);
const _estacion = signal<Estacion | null>(null);
const _eventos = signal<Evento[]>([]);
const _serie = signal<Serie | null>(null);
const _backfill = signal<Backfill | null>(null);
const _vueloCompletoUrl = signal<string | null>(null);
const _conexion = signal<ConexionServidor>("cargando");
/** Instante LOCAL (monotónico, ms) en que llegó el último latido `estacion`. */
const _llegadaLatidoMs = signal(0);
/** Instante LOCAL (monotónico, ms) "de ahora"; lo avanza el cliente con un temporizador. */
const _ahoraMs = signal(0);

// ---- Lectura pública (interfaz congelada) ----

/** Metadatos de la misión (modo, nodo, sitio). `null` hasta el primer snapshot. */
export const meta: ReadonlySignal<Meta | null> = _meta;
/** Último `estado` (NAV): fase, posición, velocidad, actitud, cálculos. `null` si no hay. */
export const estado: ReadonlySignal<Estado | null> = _estado;
/** Último `salud` (STATUS, 1 Hz): fallas, calibración, go/no-go. `null` si no hay. */
export const salud: ReadonlySignal<Salud | null> = _salud;
/** Último latido de la estación terrena (1 Hz). `null` hasta recibir uno. */
export const estacion: ReadonlySignal<Estacion | null> = _estacion;
/** Hechos puntuales en orden de llegada (línea de fases y objetivos). */
export const eventos: ReadonlySignal<Evento[]> = _eventos;
/** Trayectoria en columnas para las gráficas y el mapa. Vacía si la misión no empezó. */
export const serie: ReadonlySignal<Serie> = computed(() => _serie.value ?? serieVacia());
/** Progreso del backfill; `null` si no hay. */
export const backfill: ReadonlySignal<Backfill | null> = _backfill;
/** URL del vuelo de resolución completa (volcado por Wi-Fi), si existe. */
export const vueloCompletoUrl: ReadonlySignal<string | null> = _vueloCompletoUrl;
/** Conexión de este navegador con el servidor (no la del cohete). */
export const conexion: ReadonlySignal<ConexionServidor> = _conexion;

/**
 * Edad del último dato del cohete, en ms: `ultimo_paquete_hace_ms` más el tiempo local desde que
 * llegó ese latido (05 §4.4). `null` si aún no ha llegado ningún paquete del cohete.
 */
export const edad: ReadonlySignal<number | null> = computed(() =>
  calcularEdadMs(
    _estacion.value?.ultimo_paquete_hace_ms ?? null,
    _llegadaLatidoMs.value,
    _ahoraMs.value,
  ),
);

/** Estado de la página (03 §4), calculado con los umbrales `WEB_*` de `constantes.ts`. */
export const estadoPagina: ReadonlySignal<EstadoPagina> = computed(() =>
  calcularEstadoPagina({
    conexion: _conexion.value,
    meta: _meta.value,
    estado: _estado.value,
    estacion: _estacion.value,
    backfill: _backfill.value,
    edadMs: edad.value,
  }),
);

// ---- Escritura (solo el cliente de datos, T-631) ----
export const alimentar = {
  /** Reemplaza todo el estado con un snapshot; `llegadaLocalMs` es el instante local de recepción. */
  snapshot(s: Snapshot, llegadaLocalMs: number): void {
    _meta.value = s.meta;
    _estado.value = s.estado;
    _salud.value = s.salud;
    _estacion.value = s.estacion;
    _eventos.value = s.eventos;
    _serie.value = s.serie;
    _backfill.value = s.backfill;
    _vueloCompletoUrl.value = s.vuelo_completo_url;
    _llegadaLatidoMs.value = llegadaLocalMs;
    _ahoraMs.value = llegadaLocalMs;
  },
  /** Un mensaje `meta` del stream. */
  meta(m: Meta): void {
    _meta.value = m;
  },
  /** Un mensaje `estado` (NAV). La serie la actualiza el cliente con `serie()`. */
  estado(e: Estado): void {
    _estado.value = e;
  },
  /** Un mensaje `salud` (STATUS). */
  salud(s: Salud): void {
    _salud.value = s;
  },
  /**
   * Un latido `estacion`. `llegadaLocalMs` es el instante local (monotónico) en que llegó: de ahí
   * sale la edad del dato (05 §4.4). Nunca el reloj de pared del celular.
   */
  estacion(e: Estacion, llegadaLocalMs: number): void {
    _estacion.value = e;
    _llegadaLatidoMs.value = llegadaLocalMs;
  },
  /** Agrega un evento al final. Devuelve `false` (y no lo agrega) si ya estaba: no se duplican. */
  evento(ev: Evento): boolean {
    const clave = claveEvento(ev);
    if (_eventos.value.some((x) => claveEvento(x) === clave)) return false;
    _eventos.value = [..._eventos.value, ev];
    return true;
  },
  /** Un mensaje `backfill` (progreso). */
  backfill(b: Backfill): void {
    _backfill.value = b;
  },
  /** Reemplaza la serie (la del cliente, que agrega un punto con cada `estado`). */
  serie(s: Serie): void {
    _serie.value = s;
  },
  conexion(c: ConexionServidor): void {
    _conexion.value = c;
  },
  /** Avanza el "ahora" local (monotónico) para que `edad` y `estadoPagina` se actualicen. */
  reloj(ahoraLocalMs: number): void {
    _ahoraMs.value = ahoraLocalMs;
  },
  /** Vuelve al estado inicial vacío (solo pruebas y cambio de misión). */
  reiniciar(): void {
    _meta.value = null;
    _estado.value = null;
    _salud.value = null;
    _estacion.value = null;
    _eventos.value = [];
    _serie.value = null;
    _backfill.value = null;
    _vueloCompletoUrl.value = null;
    _conexion.value = "cargando";
    _llegadaLatidoMs.value = 0;
    _ahoraMs.value = 0;
  },
};
