---
id: gui_arquitectura
estado: propuesta (D-W05, D-W06)
actualizado: 2026-10-25
depende_de: [estacion_terrena, gui_contrato_datos, gui_pantallas]
decisiones: [D-025, D-W01, D-W05, D-W06, D-W09]
---
# Arquitectura de la web pública

## 1. Flujo de datos

```
 Cohetes ─LoRa─► Módem V1.2 ─USB─► Servicio de tierra (estacion/)          ← back (T-601, T-602)
                                    │  decodifica, calcula distancia, azimut,
                                    │  elipse, tiempos y LKP
                                    └─ Reenviador (estacion/, T-605a) ──Starlink, HTTPS POST + token──┐
                                                                                                       ▼
                         Relay público (gui/relay/, T-640)  ◄── solo él escribe; nadie puede leer comandos
                           ├─ GET  /api/v1/{mision}/snapshot   (estado + trayectoria + eventos)
                           └─ GET  /api/v1/{mision}/stream     (SSE: mensajes del contrato)
                                                                                                       │
 CDN estático (gui/web/dist): /  /demeter/  /hermes/  + assets + mapa .pmtiles ◄──── navegadores (≤ 500)
```

- **El cálculo pesado lo hace el servicio de tierra** (*Objetivos* §6): distancia, azimut, elevación, elipse y tiempos. La web **solo muestra** lo que le llega, más la interpolación visual. Así la web y el dashboard local muestran los mismos números.
- **Sin el back** (W0–W2), el relay se reemplaza por el **repetidor de desarrollo**. Habla exactamente el mismo contrato, con datos generados de la simulación de OpenRocket (§7).
- **Tres servidores, las mismas rutas de lectura** (`/api/v1/{mision}/snapshot` y `/stream`):
  - el **repetidor** (desarrollo);
  - el **servicio de tierra local** ([C-05](../05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md) §2, en `127.0.0.1`), que además tiene las extensiones `/api/v1/local/` para el dashboard de operación;
  - el **relay** (internet, solo lectura).

  El cliente de datos (`src/datos/`) es el mismo para la web y para el dashboard de operación: solo cambia `VITE_API_BASE`.

## 2. Stack (D-W05)

| Pieza | Elección | Por qué | Alternativa descartada |
| --- | --- | --- | --- |
| Build | **Vite**, en modo multipágina (`index.html`, `demeter/index.html` y `hermes/index.html`) | Cada página es su propio punto de entrada, así que se cumple D-W01 sin trucos. El build es rápido y el servidor de desarrollo está incluido. | Next o Astro: más peso y más conceptos para 12 días |
| Lenguaje | **TypeScript** | El contrato de datos queda tipado: si cambia, el compilador avisa en las dos áreas | JS sin tipos |
| UI | **Preact + @preact/signals** | La API de React, que los agentes dominan, en 4 KB. Las *signals* actualizan solo el número que cambia a 10 Hz, sin volver a dibujar la página: esto es clave en celulares baratos. | React (40 KB y re-renders), Svelte (menos predecible para los agentes), vanilla (lento de construir) |
| Portada | **HTML y CSS puros**, sin JS | Carga instantánea; el hover es CSS | — |
| Mapa | **MapLibre GL JS + un PMTiles propio** de la zona (Protomaps), servido desde el CDN; en el dashboard de operación, además, relieve y curvas de nivel (09 §3.1) | **Sin dependencia de un servidor de tiles de terceros con 500 personas a la vez.** El estilo vectorial se pinta con la paleta de cada tema. **El mismo archivo sirve como mapa offline del dashboard local (T-603)**. Se carga diferido (*lazy*), al acercarse a la sección. | Leaflet + tiles de OSM: la política de uso de OSM no permite ese tráfico y no se puede tematizar |
| Gráficas | **uPlot** | Unos 50 KB, pensado para series de tiempo en vivo y muy rápido en el celular | Chart.js (más pesado y lento con muchos puntos) |
| Tiempo real | **SSE** (`EventSource`) | Va en una sola dirección, **como debe ser una web sin comandos** (GS-14). Reconecta solo, con `Last-Event-ID`, y es HTTP normal (pasa proxies y redes móviles). | WebSocket: es bidireccional, no hace falta y abre la puerta a enviar cosas |
| QR | `uqr` o `qrcode-generator` (unos 10 KB) | El QR se genera en el navegador | Un servicio externo |
| Íconos | `lucide-preact` (importando íconos sueltos; D-W17) | Licencia MIT, *tree-shaking* y componentes nativos de Preact | `lucide` vanilla: obliga a convertir los íconos a mano |
| Imágenes | `vite-imagetools` | Genera AVIF/WebP en varios tamaños durante el build: nadie exporta tamaños a mano | Exportar a mano |
| Pruebas | **Vitest** (lógica de datos, interpolación, estados de la página, parseo del contrato) + **Playwright** (humo a 390×844 y 1440×900, con capturas) | Se prueba lo que puede romperse en vivo | — |
| Validación del contrato | **Ajv** + `ajv-formats`, solo en desarrollo (D-W17) | Valida los JSONL y los mensajes contra `esquema.json` en las pruebas (T-611); no va al navegador | — |
| Calidad | **Biome** (lint y formato en una sola herramienta) | Una sola configuración | ESLint + Prettier |
| Entorno | **Node 22** (`.nvmrc`) y `npm ci` con el lockfile (D-035) | Las dos máquinas (Windows y macOS) instalan exactamente lo mismo | Docker para desarrollar: estorba en Windows y con el USB del firmware |
| Relay | **Python 3.12 + FastAPI + uvicorn**, con SSE por `sse-starlette` | El equipo ya trabaja en Python (estación, Pi y decodificador). Aguanta 500 SSE en una máquina pequeña (§5). | Node: un lenguaje más para mantener |

## 3. Estructura en el repo

```
gui/
├── web/                              ← la web pública (Vite)
│   ├── index.html                    portada (área E)
│   ├── demeter/index.html            entrada de Deméter (E)
│   ├── hermes/index.html             entrada de Hermes (E)
│   ├── src/
│   │   ├── contrato/                 tipos.ts y esquema.json      ← CONGELADO en W0
│   │   ├── tema/                     comun.css, demeter.css, hermes.css, fuentes/   ← CONGELADO en W0 (E)
│   │   ├── portada/                  portada.css (E)
│   │   ├── entradas/                 demeter.tsx, hermes.tsx: componen las secciones de cada misión (E)
│   │   ├── mision/                   layout, barra de misión, secciones y componentes visuales (E)
│   │   ├── contenido/                demeter.ts, hermes.ts: textos, fotos e integrantes (E)
│   │   ├── datos/                    cliente SSE, snapshot, signals, interpolación, estados de la página (D)
│   │   ├── mapa/                     MapLibre, capas y estilos por tema (D)
│   │   ├── graficas/                 uPlot (D)
│   │   └── actitud/                  horizonte y brújula 2D (D)
│   ├── src/assets/{comun,demeter,hermes}/      imágenes originales; vite-imagetools genera AVIF/WebP (E)
│   ├── public/mapas/santa_fe.pmtiles           (D)
│   └── dev/repetidor/                el relay falso de desarrollo (D)
├── relay/                            el relay público en Python (D, en W2)
tools/web_datos/                      OpenRocket CSV → JSONL del contrato (D)
```

- **Aislamiento (D-W01):** `entradas/demeter.tsx` solo importa los contenidos, el tema y las secciones de Deméter, y lo mismo con Hermes. **La prueba de aceptación** revisa el `dist/`: ningún archivo de `/demeter/` referencia `assets/hermes/` ni `hermes.css`, y al revés.
- La sección "Los ojos de Deméter" vive en `mision/secciones/` y **solo** la importa `entradas/demeter.tsx`.

## 4. El relay público (D-W06, propuesta)

- **Ingesta:** `POST /api/v1/ingesta` con `Authorization: Bearer <WEB_INGESTA_TOKEN>`. El token va en una variable de entorno y nunca en el repo. Recibe lotes de mensajes del [contrato](05_contrato_datos_web.md) desde el reenviador.
- **Público, solo GET:**
  - `/api/v1/{mision}/snapshot`: el último estado, la trayectoria decimada y los eventos. Cacheable 1 s. Lo usa quien recién entra.
  - `/api/v1/{mision}/stream`: SSE con los mensajes en vivo, más un latido (`: ping`) cada 15 s.
  - `/api/v1/salud`.
- **No existe ninguna ruta que llegue a un cohete.** El relay ni siquiera conoce el formato de los comandos (GS-14, D-025).
- **Tasa hacia el público:**
  - en vuelo (BOOST a DESCENT), todo lo que llega (unos 9 Hz);
  - en BOOT, PREFLIGHT, ARMED y LANDED, **1 Hz**, para no gastar los datos móviles del público durante una hora de espera en la rampa.

  La interpolación del cliente cubre la diferencia.
- **Memoria:** guarda la misión en curso en RAM y la escribe en un JSONL en disco, para reiniciar sin perder la trayectoria.
- **División de T-605** (para acordar con Jerónimo, PEN-W06):
  - **T-605a, el reenviador** se queda en `estacion/` (back): toma el estado del servicio de tierra y hace POST al relay, con una cola en disco.
  - **T-640, el relay**, y **la web** pasan al plan web.

## 5. 500 personas a la vez (D-W09: < 2 s de punta a punta)

| Recurso | Cálculo | Conclusión |
| --- | --- | --- |
| Páginas y assets | Estáticos, en un CDN | El CDN aguanta esto sin esfuerzo |
| Mapa | Un PMTiles en el CDN, con lecturas por rango | Sin servidor de tiles; se cachea en el borde |
| SSE en vuelo | 500 clientes × 9 msg/s × ~350 B ≈ **1,6 MB/s** de salida durante unos 90 s | Lo maneja una VM de 1 vCPU. FastAPI hace el fan-out en memoria, con una cola por cliente y descarte del más viejo si alguien va lento. |
| SSE en espera | 500 × 1 msg/s | Despreciable |
| Snapshot | 500 personas que entran casi a la vez al despegue | Respuesta cacheada 1 s: unas 500 peticiones baratas |
| Subida desde el campo | 1 conexión de Starlink, de unos 2 KB/s | Despreciable |

- **Prueba de carga** (en T-643): 600 clientes SSE simulados durante 5 min con un vuelo repetido. Se mide la latencia del mensaje (marca de tiempo del relay contra la del cliente) en p95 < 1 s en el relay.
- **Si el relay se cae**, la web muestra "Reconectando…" y el dashboard local **no se entera** (estacion_terrena §2.2).

## 6. Presupuestos de rendimiento (en celular, 4G lento)

| Página | Peso inicial | LCP | Notas |
| --- | --- | --- | --- |
| Portada | < 500 KB (fondos AVIF de unos 150 KB cada uno a 1080 px; parches WebP de 512 px de unos 60 KB) | < 2 s | Sin JS. Con `<picture>` y `srcset`. |
| Misión, sin el mapa | JS < 90 KB gz, CSS < 20 KB, fuentes < 80 KB | < 2,5 s | Preact + signals + uPlot + el código propio |
| Mapa (diferido) | **Medido en T-632:** unos 300 KB gz el chunk (MapLibre, `pmtiles` y el código del mapa) y 148 KB gz el worker, más los tiles visibles. Antes se estimaba en unos 230 KB | Cuando el usuario llega a la sección | En la red móvil del evento, la página es útil sin el mapa. El JS inicial de la misión con el mapa integrado pesa 16,7 KB gz |

- Las imágenes de las fotos van en AVIF/WebP, con `loading="lazy"` y medidas fijas (sin saltos de diseño).
- Lighthouse móvil ≥ 90 en rendimiento y en accesibilidad (criterio de T-644).

## 7. Desarrollo sin el back (D-W07)

1. `tools/web_datos/` convierte `datos/simulaciones/openrocket/*.csv` en un **JSONL de mensajes del contrato**, a 9 Hz y 1 Hz. Agrega los campos que calcula la estación (distancia, azimut, elipse) con fórmulas simples **marcadas como simuladas**.
   - **Hermes** no tiene simulación (PEN-W04): se usa un vuelo sintético con la forma de Deméter escalada al G80 y **se marca como sintético**.
2. `gui/web/dev/repetidor/` sirve ese JSONL con **las mismas rutas del relay** (`snapshot` y `stream`), en tiempo real y en bucle. Tiene escenarios para probar los estados: vuelo nominal, pérdida de señal en el descenso (LKP), descenso rápido (alarma), backfill y servidor caído.
3. La web lee `VITE_API_BASE`. En W3 solo cambia esa variable para apuntar al relay real.
4. **El mismo JSONL es el modo "Ver la simulación del vuelo"** de la web pública (03 §4).

## 8. Seguridad y privacidad

- Ningún comando desde internet (GS-14): no hay WebSocket bidireccional ni ruta de escritura pública.
- El token de ingesta va en una variable de entorno, y se rota después del evento.
- CORS: el relay solo acepta los orígenes de la web. Límite de conexiones SSE por IP (por ejemplo, 10).
- **Fotos e integrantes:** antes de publicarlos se confirma que cada persona acepta salir en la web (va con PEN-W02).

## 9. Hosting (PEN-W05, se decide en W3)

El diseño no depende del proveedor. Necesitamos:
1. un **CDN estático**, por ejemplo Cloudflare Pages, Netlify o GitHub Pages;
2. **una VM o un contenedor siempre encendido** para el relay, con TLS (por ejemplo, Caddy delante), en un subdominio `api.` **sin proxy que guarde en búfer el SSE**.

Se prueba de punta a punta por Starlink antes del congelamiento (P-08).
