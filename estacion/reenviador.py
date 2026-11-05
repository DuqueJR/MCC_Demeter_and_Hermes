#!/usr/bin/env python3
"""reenviador.py - T-605a: sube los mensajes web-1 del dashboard al relay publico (POST /api/v1/ingesta).

Contrato: docs/05_plan/dos_sesiones/06_contratos/05_api_backend_tierra.md seccion 6, docs/08_gui/04 seccion 4 y
docs/08_gui/05 seccion 1. Solo biblioteca estandar.

Reglas de diseno (el dashboard de operacion es critico para el vuelo; el reenviador no puede afectarlo):
  - APAGADO POR DEFECTO: sin URL (--web-relay o WEB_RELAY_URL) y sin token (WEB_INGESTA_TOKEN) no hay hilo ni archivos.
  - `publicar()` es lo unico que corre en el hilo del dashboard (dentro de `tr_lock`): un append a una cola en memoria acotada,
    sin disco ni red, que cuenta lo que pierde. Todo lo demas (disco, red, reintentos) es de UN hilo aparte.
  - Solo de salida: no abre puertos ni recibe comandos. Solo mensajes web-1 de los dos cohetes.
  - El token va en la variable de entorno o en estacion/.env (ignorado por git). Nunca en los argumentos ni en los eventos.

Cola en disco (sqlite3): `estacion/cola_web.db` (no se versiona). Sobrevive a reiniciar el dashboard; si pasa de REENV_COLA_MAX
descarta lo mas VIEJO y lo cuenta. Si el disco falla, sigue con una cola solo en memoria.

Orden de envio (decision de T-605a, ver la bitacora): cada lote lleva
  [los mas viejos pendientes, hasta REENV_ATRASO_POR_LOTE] + [los "frescos" (de los ultimos REENV_FRESCO_S), en orden].
Asi, tras una caida de internet, lo que esta pasando ahora llega en el primer lote (latencia baja, WEB_LATENCIA_MAX_S) y el atraso
se vacia en paralelo, de a poco por lote, sin hacer esperar a lo nuevo. Consecuencia para el relay (T-640): le pueden llegar
mensajes mas viejos DESPUES de otros mas nuevos, y algun lote repetido (ver "Requisitos para el relay" en la bitacora).

Un lote que falla por red, timeout o 5xx se reintenta IDENTICO (mismo X-Lote-Id) antes que cualquier otro: el relay puede deduplicar.
"""
import collections
import http.client
import json
import os
import sqlite3
import threading
import time
import urllib.parse
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
RUTA_COLA_DEF = os.path.join(HERE, 'cola_web.db')
RUTA_ENV_DEF = os.path.join(HERE, '.env')
RUTA_INGESTA = '/api/v1/ingesta'
MISIONES = ('demeter', 'hermes')                  # web-1 seccion 0: la unica forma de mision que se reenvia

# De constantes.md
WEB_LATENCIA_MAX_S = 2                            # de punta a punta; aqui solo se mide y se avisa si se pasa

# Propuestos por T-605a (P): no estan en constantes.md todavia
REENV_LOTE_MAX = 100                              # (P) mensajes por POST (~130 KB): el relay debe aceptar al menos esto
REENV_ATRASO_POR_LOTE = 50                        # (P) cuantos viejos viajan en cada lote junto a los frescos
REENV_FRESCO_S = 5                                # (P) un mensaje es "fresco" si se publico hace menos de esto
REENV_CICLO_S = 0.2                               # (P) cada cuanto se vacia la memoria a la cola y se envia (aporta <= esto a la latencia)
REENV_LOTES_POR_CICLO = 20                        # (P) tope de POST seguidos antes de volver a vaciar la memoria
REENV_TIMEOUT_S = 5                               # (P) conectar y cada lectura/escritura de la red
REENV_BACKOFF_INI_S = 0.5                         # (P) primer reintento tras un fallo; se duplica en cada fallo seguido
REENV_BACKOFF_MAX_S = 8                           # (P) tope del retroceso: recuperar la conexion se nota en <= 8 s
REENV_AUTH_REINTENTO_S = 60                       # (P) con 401/403 se reintenta una vez por minuto, sin bucle apretado
REENV_RESUMEN_S = 60                              # (P) mientras este caido, una linea de estado cada tanto en los eventos
REENV_COLA_MAX = 50000                            # (P) mensajes en disco (~65 MB); pasado esto se descarta lo mas viejo
REENV_MEM_MAX = 5000                              # (P) mensajes en memoria esperando al hilo (~5 s de vuelo sobran)
REENV_RECHAZOS_MAX = 20                           # (P) descartes seguidos (400/413/422) antes de creer que el rechazo es de todo


def leer_env(ruta):
    """Lee un archivo `.env` (CLAVE=VALOR, # comentarios). Sin archivo o con error, {}."""
    out = {}
    try:
        with open(ruta, encoding='utf-8') as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith('#') or '=' not in linea:
                    continue
                k, v = linea.split('=', 1)
                out[k.strip()] = v.strip().strip('"\'')
    except OSError:
        pass
    return out


def configurar(url=None, ruta_cola=None, evento=print, entorno=None, ruta_env=RUTA_ENV_DEF, modo=''):
    """Un `Reenviador` (SIN iniciar) si hay URL y token; si no, None. No toca disco ni red.
    La URL sale del argumento o de WEB_RELAY_URL; el token, de WEB_INGESTA_TOKEN. El entorno gana al `.env`.
    `modo` ('demo' o 'reproduccion') solo sirve para avisar de que se subirian datos que no son del vuelo."""
    env = leer_env(ruta_env)
    env.update(os.environ if entorno is None else entorno)
    url = url or env.get('WEB_RELAY_URL') or ''
    token = (env.get('WEB_INGESTA_TOKEN') or '').strip()
    if not url:
        return None                                     # apagado: sin hilo, sin archivos, sin mensajes
    if not token:
        evento('web: reenviador apagado: falta WEB_INGESTA_TOKEN (variable de entorno o estacion/.env)')
        return None
    try:
        r = Reenviador(url, token, ruta_cola or RUTA_COLA_DEF, evento)
    except ValueError as e:
        evento(f'web: reenviador apagado: {e}')
        return None
    if modo:
        evento(f'web: AVISO: se reenvian al relay datos de {modo}, que no son del vuelo (meta.modo seguira diciendo "vivo")')
    return r


class _Cola:
    """La cola en sqlite. Un solo hilo la usa (el del reenviador). `ruta` ':memory:' = sin disco."""
    def __init__(self, ruta, maximo):
        if ruta != ':memory:':
            os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
        self.db = sqlite3.connect(ruta, timeout=2.0)
        if ruta != ':memory:':
            self.db.execute('PRAGMA journal_mode=WAL')
            self.db.execute('PRAGMA synchronous=NORMAL')
        with self.db:
            self.db.execute('CREATE TABLE IF NOT EXISTS cola (id INTEGER PRIMARY KEY AUTOINCREMENT, t REAL NOT NULL, '
                            'mision TEXT NOT NULL, tipo TEXT NOT NULL, datos TEXT NOT NULL)')
            self.db.execute('CREATE INDEX IF NOT EXISTS ix_cola_t ON cola(t)')
        self.maximo = maximo
        self.n = self.db.execute('SELECT COUNT(*) FROM cola').fetchone()[0]

    def agregar(self, items):
        """items = [(t, mision, tipo, datos)]. Devuelve cuantos viejos descarto por estar llena."""
        with self.db:
            self.db.executemany('INSERT INTO cola (t, mision, tipo, datos) VALUES (?,?,?,?)', items)
        self.n += len(items)
        exceso = self.n - self.maximo
        if exceso <= 0:
            return 0
        with self.db:
            self.db.execute('DELETE FROM cola WHERE id IN (SELECT id FROM cola ORDER BY id LIMIT ?)', (exceso,))
        self.n -= exceso
        return exceso

    def componer(self, t_corte, lote_max, atraso_max):
        """[(id, t, mision, tipo, datos)] en orden: los viejos (hasta `atraso_max`) y despues los frescos (t >= t_corte)."""
        primero = self.db.execute('SELECT MIN(id) FROM cola WHERE t >= ?', (t_corte,)).fetchone()[0]
        if primero is None:                              # nada fresco: todo el lote puede ser atraso
            return self.db.execute('SELECT id, t, mision, tipo, datos FROM cola ORDER BY id LIMIT ?', (lote_max,)).fetchall()
        viejos = self.db.execute('SELECT id, t, mision, tipo, datos FROM cola WHERE id < ? ORDER BY id LIMIT ?',
                                 (primero, min(atraso_max, lote_max - 1))).fetchall()
        frescos = self.db.execute('SELECT id, t, mision, tipo, datos FROM cola WHERE id >= ? ORDER BY id LIMIT ?',
                                  (primero, lote_max - len(viejos))).fetchall()
        return viejos + frescos

    def borrar(self, ids):
        with self.db:
            self.db.executemany('DELETE FROM cola WHERE id = ?', [(i,) for i in ids])
        self.n = self.db.execute('SELECT COUNT(*) FROM cola').fetchone()[0]

    def cerrar(self):
        try:
            self.db.close()
        except sqlite3.Error:
            pass


class Reenviador:
    def __init__(self, url, token, ruta_cola=RUTA_COLA_DEF, evento=None, *, ciclo_s=REENV_CICLO_S, timeout_s=REENV_TIMEOUT_S,
                 lote_max=REENV_LOTE_MAX, atraso_por_lote=REENV_ATRASO_POR_LOTE, fresco_s=REENV_FRESCO_S, cola_max=REENV_COLA_MAX,
                 mem_max=REENV_MEM_MAX, backoff_ini_s=REENV_BACKOFF_INI_S, backoff_max_s=REENV_BACKOFF_MAX_S,
                 auth_reintento_s=REENV_AUTH_REINTENTO_S, resumen_s=REENV_RESUMEN_S):
        u = urllib.parse.urlsplit(url.strip())
        if u.scheme not in ('http', 'https') or not u.hostname:
            raise ValueError('la URL del relay debe ser http(s)://host[:puerto][/ruta]')
        if not token or not token.isprintable() or any(c.isspace() for c in token):
            raise ValueError('WEB_INGESTA_TOKEN no es valido (vacio, con espacios o con caracteres de control)')
        self._https = u.scheme == 'https'
        self._host, self._puerto = u.hostname, u.port
        base = u.path.rstrip('/')
        self._ruta = base if base.endswith(RUTA_INGESTA) else base + RUTA_INGESTA
        self._destino = f'{u.scheme}://{u.netloc.rsplit("@", 1)[-1]}'          # para los eventos: sin credenciales ni ruta
        self._token = token
        self._ruta_cola = ruta_cola
        self._evento = evento or (lambda texto: None)
        self._ciclo_s, self._timeout_s = ciclo_s, timeout_s
        self._lote_max, self._atraso, self._fresco_s = max(1, lote_max), atraso_por_lote, fresco_s
        self._cola_max, self._mem_max = cola_max, mem_max
        self._b_ini, self._b_max, self._auth_s, self._resumen_s = backoff_ini_s, backoff_max_s, auth_reintento_s, resumen_s

        self._lk = threading.Lock()                       # protege SOLO `_mem` y `_perd_mem`; nunca se mantiene durante E/S
        self._mem = collections.deque()
        self._perd_mem = 0
        self._parar = threading.Event()
        self._hilo = None
        # Del hilo del reenviador (los contadores se leen desde fuera sin candado: son enteros)
        self._cola = None
        self._con = None
        self._inst = uuid.uuid4().hex[:8]
        self._n_lote = 0
        self._lote_fijo = None                            # el lote que fallo por red: se reintenta identico
        self._tope = self._lote_max                       # baja a la mitad con 413/400 y vuelve a subir con cada exito
        self._estado = None                               # None (aun nada), 'conectado', 'caido' o 'auth'
        self._fallos = 0
        self._no_antes = 0.0                              # time.monotonic() antes del cual no se intenta enviar
        self._prox_resumen = 0.0
        self._prox_disco = 0.0
        self._hubo_exito = False
        self._rechazos_seguidos = 0
        self.enviados = self.descartados = self.perdidos_cola = 0
        self.lat_ult_s = None                             # edad del mensaje mas viejo del ultimo lote entregado
        self.ultimo_error = ''

    # -- API para el dashboard -----------------------------------------------------------------------------------------
    def publicar(self, mision, tipo, datos):
        """`datos` = el JSON ya serializado del mensaje. Corre en el hilo del dashboard: solo memoria, sin E/S y sin excepciones."""
        try:
            if mision not in MISIONES:
                return
            item = (time.time(), mision, tipo, datos)
            with self._lk:
                if len(self._mem) >= self._mem_max:
                    self._mem.popleft()
                    self._perd_mem += 1
                self._mem.append(item)
        except Exception:
            pass

    def iniciar(self):
        self._hilo = threading.Thread(target=self._bucle, name='reenviador', daemon=True)
        self._hilo.start()
        destino = self._destino
        aviso = ' (el token viaja SIN cifrar)' if not self._https and self._host not in ('127.0.0.1', 'localhost', '::1') else ''
        self._ev(f'web: reenviador activo hacia {destino}{aviso}; cola en {self._ruta_cola}')
        return self

    def detener(self, esperar_s=3.0):
        self._parar.set()
        if self._hilo is not None:
            self._hilo.join(esperar_s)

    def estado(self):
        return dict(estado=self._estado or 'iniciando', en_cola=self._contar(), perdidos=self.perdidos, enviados=self.enviados,
                    descartados=self.descartados, lat_ult_s=self.lat_ult_s, ultimo_error=self.ultimo_error)

    @property
    def perdidos(self):
        return self._perd_mem + self.perdidos_cola + self.descartados

    # -- el hilo ---------------------------------------------------------------------------------------------------------
    def _bucle(self):
        try:
            while not self._parar.is_set():
                try:
                    self._ciclo()
                except Exception as e:                    # un error aqui jamas debe matar al hilo ni salir al dashboard
                    self.ultimo_error = self._motivo(e)
                self._parar.wait(self._ciclo_s)
        finally:
            try:
                self._guardar(self._vaciar_memoria())    # lo que quedo en memoria al apagar, a disco
            except Exception:
                pass
            self._cerrar_con()
            if self._cola is not None:
                self._cola.cerrar()

    def _ciclo(self):
        self._asegurar_cola()
        self._guardar(self._vaciar_memoria())
        ahora = time.monotonic()
        if self._estado in ('caido', 'auth') and ahora >= self._prox_resumen:
            self._prox_resumen = ahora + self._resumen_s
            self._ev(f'web: reenviador {"SIN CONEXION" if self._estado == "caido" else "RECHAZADO (token)"}: '
                     f'{self._contar()} en cola, {self.perdidos} perdidos')
        if ahora < self._no_antes:
            return
        for _ in range(REENV_LOTES_POR_CICLO):
            if self._parar.is_set():
                return
            lote = self._lote_fijo or self._componer()
            if not lote:
                return
            if not self._intentar(lote):
                return
            self._guardar(self._vaciar_memoria())

    def _vaciar_memoria(self):
        with self._lk:
            items = list(self._mem)
            self._mem.clear()
        return items

    def _asegurar_cola(self):
        if self._cola is not None:
            return
        ahora = time.monotonic()
        if ahora < self._prox_disco:
            return
        try:
            self._cola = _Cola(self._ruta_cola, self._cola_max)
            if self._cola.n:
                self._ev(f'web: reenviador: {self._cola.n} mensajes pendientes de antes en la cola')
        except (sqlite3.Error, OSError) as e:
            self._ev(f'web: reenviador SIN DISCO ({self._motivo(e)}): la cola queda solo en memoria')
            self._cola = _Cola(':memory:', self._cola_max)
            self._prox_disco = ahora + 3600                # no se vuelve a probar con el disco en esta sesion

    def _guardar(self, items):
        if not items:
            return
        try:
            self.perdidos_cola += self._cola.agregar(items)
        except sqlite3.Error as e:                          # disco lleno, archivo bloqueado...: se sigue en memoria
            self._ev(f'web: reenviador: fallo el disco ({self._motivo(e)}); la cola sigue solo en memoria')
            self._cola.cerrar()
            self._cola = _Cola(':memory:', self._cola_max)
            self._prox_disco = time.monotonic() + 3600
            self.perdidos_cola += self._cola.agregar(items)

    def _contar(self):
        return (self._cola.n if self._cola is not None else 0) + len(self._mem)

    def _componer(self):
        filas = self._cola.componer(time.time() - self._fresco_s, self._tope, self._atraso)
        if not filas:
            return None
        self._n_lote += 1
        return (f'{self._inst}-{self._n_lote}', filas)

    @staticmethod
    def _cuerpo(filas):
        # `datos` ya es JSON valido (lo serializo el dashboard con allow_nan=False): se incrusta sin reconvertirlo
        msgs = ','.join('{"tipo":%s,"mision":%s,"datos":%s}' % (json.dumps(f[3]), json.dumps(f[2]), f[4]) for f in filas)
        return ('{"mensajes":[' + msgs + ']}').encode('utf-8')

    # -- red -------------------------------------------------------------------------------------------------------------
    def _intentar(self, lote):
        """Un POST. True = se puede seguir con el siguiente lote sin esperar; False = esperar (hay retroceso)."""
        lote_id, filas = lote
        try:
            codigo = self._post(self._cuerpo(filas), lote_id)
        except Exception as e:                              # red caida, timeout, DNS, TLS, 'conexion cerrada'...
            self._lote_fijo = lote                          # no se sabe si llego: se reintenta identico (X-Lote-Id)
            self._fallo(self._motivo(e))
            return False
        if 200 <= codigo < 300:
            self._exito(lote_id, filas)
            return True
        self._lote_fijo = None
        if codigo in (401, 403):
            self._auth(codigo)
            return False
        if codigo in (400, 413, 422) and self._rechazos_seguidos < REENV_RECHAZOS_MAX and (len(filas) > 1 or self._hubo_exito):
            self._rechazo(filas, codigo)
            return True
        self._lote_fijo = lote                              # 5xx, 408, 429, 3xx, 404...: transitorio o mal configurado; no se tira nada
        self._fallo(f'HTTP {codigo}')
        return False

    def _post(self, cuerpo, lote_id):
        cab = {'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + self._token,
               'X-Lote-Id': lote_id, 'User-Agent': 'hermes-demeter-reenviador/1'}
        for intento in (0, 1):
            reusada = self._con is not None
            if not reusada:
                clase = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
                self._con = clase(self._host, self._puerto, timeout=self._timeout_s)
            try:
                self._con.request('POST', self._ruta, body=cuerpo, headers=cab)
                r = self._con.getresponse()
                r.read(65536)
                if r.will_close or not r.isclosed():
                    self._cerrar_con()
                return r.status
            except (OSError, http.client.HTTPException):
                self._cerrar_con()
                if reusada and intento == 0:                # la conexion de antes estaba vieja: una vez mas con una nueva
                    continue
                raise

    def _cerrar_con(self):
        if self._con is not None:
            try:
                self._con.close()
            except Exception:
                pass
            self._con = None

    # -- resultados --------------------------------------------------------------------------------------------------------
    def _exito(self, lote_id, filas):
        ahora = time.time()
        try:
            self._cola.borrar([f[0] for f in filas])
        except sqlite3.Error as e:
            self._ev(f'web: reenviador: no se pudo borrar de la cola ({self._motivo(e)})')
            self._cola.cerrar()
            self._cola = _Cola(':memory:', self._cola_max)
        self.enviados += len(filas)
        self.lat_ult_s = round(ahora - min(f[1] for f in filas), 2)
        self._lote_fijo = None
        self._fallos = 0
        self._hubo_exito = True
        self._rechazos_seguidos = 0
        self._tope = min(self._lote_max, self._tope * 2)
        self.ultimo_error = ''
        if self._estado != 'conectado':
            antes = self._estado
            self._estado = 'conectado'
            self._ev(f'web: reenviador CONECTADO al relay{" (recuperado)" if antes else ""}: {self._contar()} en cola, {self.perdidos} perdidos')

    def _fallo(self, motivo):
        self._fallos += 1
        self.ultimo_error = motivo
        self._no_antes = time.monotonic() + min(self._b_max, self._b_ini * 2 ** (self._fallos - 1))
        if self._estado != 'caido':
            self._estado = 'caido'
            self._prox_resumen = time.monotonic() + self._resumen_s
            self._ev(f'web: reenviador SIN CONEXION con el relay ({motivo}): los mensajes quedan en cola ({self._contar()}, {self.perdidos} perdidos)')

    def _auth(self, codigo):
        self.ultimo_error = f'HTTP {codigo}'
        self._no_antes = time.monotonic() + self._auth_s
        if self._estado != 'auth':
            self._estado = 'auth'
            self._prox_resumen = time.monotonic() + self._resumen_s
            self._ev(f'web: el relay rechazo el token (HTTP {codigo}): revisa WEB_INGESTA_TOKEN; reintento cada {self._auth_s:g} s ({self._contar()} en cola)')

    def _rechazo(self, filas, codigo):
        """El relay rechaza el lote (400/413/422): se parte a la mitad hasta dar con el mensaje malo, que se descarta y se cuenta."""
        self.ultimo_error = f'HTTP {codigo}'
        if len(filas) > 1:
            self._tope = max(1, len(filas) // 2)
            return
        self._rechazos_seguidos += 1
        try:
            self._cola.borrar([filas[0][0]])
        except sqlite3.Error:
            pass
        self.descartados += 1
        self._ev(f'web: el relay rechazo un mensaje ({filas[0][3]} de {filas[0][2]}, HTTP {codigo}); se descarta ({self.descartados} descartados)')

    # -- utilidades ----------------------------------------------------------------------------------------------------------
    def _motivo(self, e):
        return f'{type(e).__name__}: {e}'.replace(self._token, '***')[:120]

    def _ev(self, texto):
        try:
            self._evento(texto.replace(self._token, '***'))
        except Exception:
            pass
