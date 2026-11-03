#!/usr/bin/env python3
"""tbget.py - Descarga los logs de un cohete por USB, sin sacar la SD. Solo lee.
Uso:  python tbget.py COM3 list                 lista archivos
      python tbget.py COM3 get                  baja los logs que falten en la carpeta actual
      python tbget.py COM3 get 46 47            baja esos indices (o nombres completos: NOMBRE.BIN)
      python tbget.py COM3 get --ultimos 2      baja los 2 logs mas recientes
      python tbget.py COM3 reset                reinicia la placa
Opciones: --dir CARPETA  --completo (incluye los ceros finales)
          --reset (al terminar reinicia la placa)  --analizar (corre tblog y guarda NOMBRE.BIN.txt)
          --csv (ademas deja cada fuente en un CSV, en la carpeta NOMBRE_csv)
Cierra antes el monitor serie de ese puerto. Desde el primer comando la placa queda en modo descarga, sin logger;
sale con reset, o sola tras 2 minutos sin comandos.
Requiere pyserial:  python -m pip install pyserial
"""
import sys, os, re, time, struct, argparse, binascii, subprocess

CHUNK = 4096
RETRIES = 8
RX_BUFFER = 1 << 20


def crc16(data):
    return binascii.crc_hqx(data, 0xFFFF)              # CCITT-FALSE, en C: en Python puro limita la descarga


class Device:
    def __init__(self, port):
        self.s = port
        self.buf = bytearray()

    def _fill(self, deadline):
        n = self.s.in_waiting
        d = self.s.read(n if n else 1)
        if d:
            self.buf += d
        return time.time() < deadline

    def line(self, timeout):
        deadline = time.time() + timeout
        while True:
            i = self.buf.find(b'\n')
            if i >= 0:
                out = bytes(self.buf[:i])
                del self.buf[:i + 1]
                return out.decode(errors='replace').strip()
            if not self._fill(deadline):
                return None

    def send(self, text):
        self.s.write(text.encode() + b'\n')
        self.s.flush()

    def enter(self):
        """Pasa la placa a modo descarga. Sirve tambien si ya estaba en ese modo."""
        for _ in range(8):
            self.send('TBDL')
            self.send('PING')
            deadline = time.time() + 2.5
            while time.time() < deadline:
                ln = self.line(deadline - time.time())
                if ln is None:
                    break
                if ln == 'TBDL OK':
                    self.drain(0.3)
                    return True
                if ln == 'TBDL ERROR':
                    raise SystemExit('la placa no pudo detener el logger')
        return False

    def drain(self, quiet):
        last = time.time()
        while time.time() - last < quiet:
            if self.s.in_waiting:
                self.s.read(self.s.in_waiting)
                last = time.time()
            else:
                time.sleep(0.01)
        self.buf = bytearray()

    def list(self):
        """Nombres y tamanos, sin mirar el contenido."""
        self.send('LIST')
        out = []
        while True:
            ln = self.line(60)
            if ln is None:
                raise SystemExit('sin respuesta a LIST')
            if ln == 'END':
                return out
            p = ln.split(' ')
            if len(p) == 3 and p[0] == 'F':
                out.append((p[1], int(p[2])))

    def used(self, name):
        """Bytes con datos, sin los ceros finales de la preasignacion."""
        for _ in range(4):
            self.send(f'USED {name}')
            deadline = time.time() + 8
            while time.time() < deadline:
                ln = self.line(deadline - time.time())
                p = ln.split(' ') if ln else []
                if len(p) == 4 and p[0] == 'F' and p[1] == name:
                    return int(p[3])
        raise TimeoutError(f'{name}: la placa no respondio a USED')

    def _frame(self, timeout):
        """Devuelve (off, status, datos), o None si no llego una trama valida."""
        deadline = time.time() + timeout
        while len(self.buf) < 9 or self.buf[:2] != b'\xA5\x5A':
            i = self.buf.find(b'\xA5\x5A')
            if i > 0:
                del self.buf[:i]
            elif i < 0:
                self.buf = self.buf[-1:] if self.buf[-1:] == b'\xA5' else bytearray()
            if len(self.buf) >= 9 and self.buf[:2] == b'\xA5\x5A':
                break
            if not self._fill(deadline):
                return None
        n, off, status = struct.unpack_from('<HIB', self.buf, 2)
        if n > CHUNK:
            del self.buf[:2]
            return None
        while len(self.buf) < 11 + n:
            if not self._fill(deadline):
                return None
        ok = crc16(memoryview(self.buf)[:9 + n]) == struct.unpack_from('<H', self.buf, 9 + n)[0]
        data = bytes(self.buf[9:9 + n])
        del self.buf[:11 + n]
        return (off, status, data) if ok else None

    def fetch(self, name, off, total, sink):
        """Pide de off a total y entrega cada trama a sink(datos). Si una falla, corta el envio y sigue desde ahi."""
        fails = 0
        while off < total:
            self.send(f'SEND {name} {off} {total - off}')
            while True:
                r = self._frame(3.0)
                if r is None or r[0] != off or r[1] == 2:
                    fails += 1
                    break
                if r[1] == 1:
                    return off
                sink(r[2])
                off += len(r[2])
                fails = 0
            if fails >= RETRIES:
                raise SystemExit(f'\n{name}: fallo repetido leyendo en {off}; lo bajado queda en .part y se retoma en la siguiente corrida')
            self.send('')                              # cualquier byte corta el envio
            self.drain(0.2)
        return off


def fmt(n):
    return f'{n / 1048576:.1f} MB'


def download(dev, name, total, outdir):
    final = os.path.join(outdir, name)
    part = final + '.part'
    off = 0
    if os.path.exists(part):
        off = min(os.path.getsize(part) // CHUNK * CHUNK, total)   # solo bloques completos
    t0 = time.time()
    start = off
    done = [off, 0.0]
    with open(part, 'r+b' if off else 'wb') as f:
        f.seek(off)
        f.truncate()

        def sink(data):
            f.write(data)
            done[0] += len(data)
            now = time.time()
            if now - done[1] >= 0.25:                  # imprimir en cada trama frena: la consola de Windows es lenta
                done[1] = now
                print(f'\r{name}: {fmt(done[0])} de {fmt(total)}  {(done[0] - start) / 1024 / max(now - t0, 0.001):.0f} kB/s ', end='', flush=True)

        off = dev.fetch(name, off, total, sink)
    if off != total:
        raise SystemExit(f'\n{name}: termino en {off} de {total} bytes')
    os.replace(part, final)
    dt = max(time.time() - t0, 0.001)
    print(f'\r{name}: {fmt(off)} en {dt:.1f} s  ({(off - start) / 1024 / dt:.0f} kB/s)      ')


def index_of(name):
    m = re.search(r'(\d+)\.BIN$', name)
    return int(m.group(1)) if m else -1


def is_log(name):
    return not name.startswith('RES_')                 # las reservas son solo ceros


def select(files, a):
    """Devuelve los (nombre, tamano) pedidos, en orden de indice."""
    logs = sorted((f for f in files if is_log(f[0])), key=lambda f: index_of(f[0]))
    if not a.nombres:
        return logs[-a.ultimos:] if a.ultimos else logs
    out = []
    for q in a.nombres:
        hits = [f for f in files if f[0] == q] or ([f for f in logs if index_of(f[0]) == int(q)] if q.isdigit() else [])
        if not hits:
            raise SystemExit(f'{q}: no esta en la SD')
        out += [h for h in hits if h not in out]
    return out


def analyze(path, csv=False):
    tblog = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tblog.py')
    r = subprocess.run([sys.executable, tblog, path] + (['--csv'] if csv else []), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    print(r.stdout)
    with open(path + '.txt', 'w', encoding='utf-8') as f:
        f.write(r.stdout)


def get(dev, files, a):
    os.makedirs(a.dir, exist_ok=True)
    t0 = time.time()
    bajados = 0
    elegidos = []
    for n, s in select(files, a):
        final = os.path.join(a.dir, n)
        # Un archivo terminado no cambia: .part solo se renombra al completarse, y cada arranque registra en otro archivo
        if os.path.exists(final) and (not a.completo or os.path.getsize(final) == s):
            print(f'{n}: ya esta')
            if a.nombres or a.ultimos:                 # pedido a proposito: se analiza; en un "get" general, solo lo nuevo
                elegidos.append(final)
            continue
        print(f'{n}: buscando el fin de los datos...', flush=True)
        try:
            total = s if a.completo else dev.used(n)
        except TimeoutError as e:
            raise SystemExit(str(e))
        if total == 0:
            continue
        download(dev, n, total, a.dir)
        bajados += total
        elegidos.append(final)
    dt = max(time.time() - t0, 0.001)
    print(f'bajados {fmt(bajados)} en {dt:.1f} s ({bajados / 1024 / dt:.0f} kB/s en total)')
    if a.reset:
        reset(dev)
    if a.analizar or a.csv:
        for p in elegidos:
            print(f'=== {os.path.basename(p)}')
            analyze(p, a.csv)


def reset(dev):
    dev.send('RESET')
    print('placa reiniciada')


def run(dev, a):
    print('entrando en modo descarga...', flush=True)
    if not dev.enter():
        raise SystemExit('la placa no responde: revisa el puerto, y que el firmware tenga el modo de descarga')
    if a.accion == 'reset':
        reset(dev)
        return
    print('leyendo la lista de archivos...', flush=True)
    files = dev.list()
    if a.accion == 'list':
        print(f'{"archivo":<40} {"tamano":>10} {"con datos":>10}')
        for n, s in files:
            try:
                usado = fmt(dev.used(n))
            except TimeoutError:
                usado = '?'
            print(f'{n:<40} {fmt(s):>10} {usado:>10}')
        if a.reset:
            reset(dev)
    else:
        get(dev, files, a)
    if not a.reset:
        print('la placa sigue en modo descarga: al terminar usa "reset" (o se reinicia sola en 2 minutos sin comandos)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('puerto')
    ap.add_argument('accion', choices=['list', 'get', 'reset'])
    ap.add_argument('nombres', nargs='*')
    ap.add_argument('--dir', default='.')
    ap.add_argument('--completo', action='store_true')
    ap.add_argument('--ultimos', type=int, default=0)
    ap.add_argument('--reset', action='store_true')
    ap.add_argument('--analizar', action='store_true')
    ap.add_argument('--csv', action='store_true')
    a = ap.parse_args()
    import serial
    s = serial.Serial()
    s.port = a.puerto
    s.baudrate = 115200
    s.timeout = 0.05
    s.dtr = False                                      # sin esto, abrir el puerto puede reiniciar la placa
    s.rts = False
    for intento in range(30):                          # quien soltaba el puerto puede tardar en liberarlo
        try:
            s.open()
            break
        except serial.SerialException:
            if intento == 29:
                raise SystemExit(f'{a.puerto}: el puerto sigue ocupado. Cierra lo que lo este usando (otro monitor serie o dashboard).')
            time.sleep(0.2)
    if hasattr(s, 'set_buffer_size'):                  # solo en Windows; con el envio continuo no debe llenarse
        s.set_buffer_size(rx_size=RX_BUFFER)
    try:
        run(Device(s), a)
    finally:
        s.close()


if __name__ == '__main__':
    main()
