"""Captura guiada del ChArUco para intrinsecos, con vista en vivo por web y quietud por la IMU de la LilyGo.
Toma una foto cada ~2 s con exposicion fija y foco al infinito. Guarda una foto si:
  - el tablero se movio < 20 px entre dos fotos seguidas (camara),
  - la LilyGo esta quieta segun su TELEM (giro y acelerometro), si hay TELEM, y
  - la pose es nueva (otra zona o >10 grados de inclinacion distinta).
La TELEM se lee del dashboard del PC (/api/state) por un tunel ssh -R 8765 (si no hay, solo camara).
Vista: http://<pi>:8080, con botones para girar la imagen.
Uso: python3 capturar.py CAMARA CARPETA [segundos]"""
import sys, os, time, glob, json, subprocess, shutil, threading, functools, http.server, urllib.request
import collections, cv2, numpy as np

cam, out = int(sys.argv[1]), sys.argv[2]
dur = int(sys.argv[3]) if len(sys.argv) > 3 else 600
LENTE = sys.argv[4] if len(sys.argv) > 4 else "0"   # dioptrias (1/m); 0 = infinito, fijo toda la captura
os.makedirs(out, exist_ok=True)
tmp = os.path.join(out, "tmp"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
web = os.path.join(out, "web"); os.makedirs(web, exist_ok=True)

W, H = 4608, 2592
ESC = 0.25
K = np.array([[3385.7, 0, W / 2], [0, 3385.7, H / 2], [0, 0, 1]])
# A: laptop (calib.io 11x7 5X5). B: tablet (7x5 4X4, cuadros grandes para leerse desenfocado).
# Diccionarios distintos: un tablero no se confunde con el otro. (tablero, detector, esquinas minimas)
TABLEROS = {}
for nombre, tam, cuadro, marca, dic, minimo in (("A", (11, 7), 19.5, 14.0, cv2.aruco.DICT_5X5_100, 12),
                                               ("B", (7, 5), 30.0, 24.0, cv2.aruco.DICT_4X4_50, 12)):
    b = cv2.aruco.CharucoBoard(tam, cuadro, marca, cv2.aruco.getPredefinedDictionary(dic))
    TABLEROS[nombre] = (b, cv2.aruco.CharucoDetector(b), minimo)
GX, GY = 6, 4
cobertura = np.zeros((GY, GX), int)
GIRO_MAX_DPS = 1.5         # sin sesgo. El rolling shutter lee la imagen en ~70 ms: a 1.5 dps
                           # el tablero se tuerce ~1 px; sostenido a mano da 5-20 dps
ACC_SALTO_MG = 20.0

# ---- TELEM de Demeter desde el dashboard (2 Hz) ----
telem = collections.deque(maxlen=400)       # (t_llegada_pc, acc_mg[3], gyro_dps[3])
def leer_telem():
    ultimo = None
    while True:
        try:
            d = json.load(urllib.request.urlopen("http://127.0.0.1:8765/api/state", timeout=1))
            r = next(x for x in d["rockets"] if x["name"] == "Demeter")["telem"]
            if r and r.get("t") != ultimo:
                ultimo = r["t"]
                telem.append((time.time() - r.get("age", 0), np.array(r["acc"], float),
                              np.array(r["gyro"], float) / 10.0))
        except Exception:
            pass
        time.sleep(0.25)
threading.Thread(target=leer_telem, daemon=True).start()

def imu_estado():
    """(quieto o None si no hay TELEM, texto)"""
    ahora = time.time()
    copia = list(telem)                      # el hilo lector la modifica
    rec = [x for x in copia if ahora - x[0] < 2.0]
    if not rec:
        return None, "IMU: sin TELEM (solo camara)"
    # sesgo del giro: mediana de los ultimos minutos con el cohete casi quieto
    tranq = [x[2] for x in copia if np.linalg.norm(x[2]) < 10]
    sesgo = np.median(tranq, axis=0) if len(tranq) >= 6 else np.zeros(3)
    g = max(np.linalg.norm(x[2] - sesgo) for x in rec)
    salto = max((np.linalg.norm(rec[i][1] - rec[i - 1][1]) for i in range(1, len(rec))), default=0.0)
    a = rec[-1][1]
    quieto = bool(g < GIRO_MAX_DPS and salto < ACC_SALTO_MG)
    return quieto, (f"IMU: {'quieta' if quieto else 'MOVIENDOSE'} (giro sin sesgo {g:.1f} dps, "
                    f"salto acel {salto:.0f} mg, |a| {np.linalg.norm(a)/1000:.2f} g)")

# ---- servidor web ----
with open(os.path.join(web, "index.html"), "w") as fh:
    fh.write(f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">
<title>cam{cam} calibracion</title>
<style>body{{background:#111;color:#ddd;font:16px sans-serif;margin:12px}}
button{{font-size:16px;margin:0 6px 8px 0;padding:6px 12px}}
#c{{display:flex;justify-content:center;align-items:center;overflow:hidden}}
#v{{transition:transform .2s}} #e{{margin:6px 0;font-weight:bold}} #i{{color:#9cf;margin-bottom:8px}}
#p{{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-bottom:8px}}
.bar{{width:260px;height:18px;background:#333;border-radius:9px;overflow:hidden}}
.bar div{{height:100%;background:#2a2;transition:width .3s}}
#rosa{{display:grid;grid-template-columns:repeat(3,58px);gap:3px;transition:transform .2s}}
#rosa div{{height:40px;background:#333;border-radius:4px;text-align:center;font-size:11px;padding-top:3px;box-sizing:border-box}}
#rosa div.ok{{background:#1d5e1d}} #rosa div.act{{outline:3px solid #f90}}
#luz{{display:inline-block;width:16px;height:16px;border-radius:8px;background:#555;vertical-align:middle;margin-right:6px}}
#fin{{color:#4f4;font-size:22px;font-weight:bold}}</style>
<div id=p>
 <div>Fotos <span id=nf>0/25</span><div class=bar><div id=bf style=width:0></div></div>
      Zonas <span id=nz>0/24</span><div class=bar><div id=bz style=width:0></div></div>
      Esquinas extremas <span id=nx>0/4</span><div class=bar><div id=bx style=width:0></div></div>
      Inclinaciones <span id=ns>0/8</span><div class=bar><div id=bs style=width:0></div></div>
      <span id=q></span></div>
 <div><div style="font-size:13px;margin-bottom:3px">Inclinaciones (&ge; <span id=im></span> grados), naranja = ahora</div>
      <div id=rosa></div></div>
 <div><span id=luz></span><span id=i></span><div id=fin></div></div>
</div>
<div id=e>esperando...</div>
<div><button onclick=gira(-90)>&#8634; 90</button><button onclick=gira(90)>&#8635; 90</button>
<button onclick=gira(180)>180</button><button onclick=espejo()>espejo</button>
<button onclick="r=0;m=1;aplica()">original</button></div>
<div id=c><img id=v></div>
<script>
const EXT_MIN=30; const ORDEN=['arriba-izq','arriba','arriba-der','izq','frontal','der','abajo-izq','abajo','abajo-der'];
let r=+(localStorage.r||0), m=+(localStorage.m||1);
function aplica(){{ localStorage.r=r; localStorage.m=m; const v=document.getElementById('v');
  const lado=(r%180)!=0, w=document.getElementById('c').clientWidth, h=innerHeight-60;
  v.style.maxWidth=(lado?h:w)+'px'; v.style.maxHeight=(lado?w:h)+'px';
  const tr='rotate('+r+'deg) scaleX('+m+')';
  v.style.transform=tr; document.getElementById('rosa').style.transform=tr;
  document.getElementById('c').style.height=(lado?Math.min(w,v.clientWidth||w)+'px':'auto'); }}
function gira(d){{ r=(r+d+360)%360; aplica(); }}
function espejo(){{ m=-m; aplica(); }}
function barra(id,n,tot){{ document.getElementById('n'+id).textContent=n+'/'+tot;
  document.getElementById('b'+id).style.width=Math.min(100,100*n/tot)+'%'; }}
async function t(){{
  try{{ const s=await (await fetch('estado.json?'+Date.now())).json();
    const e=document.getElementById('e'); e.textContent=s.estado;
    e.style.color=s.estado.startsWith('GUARDADA')?'#4f4':s.estado.startsWith('SIN')?'#f66':'#fc4';
    document.getElementById('i').textContent=s.imu;
    document.getElementById('luz').style.background=s.imu_q===true?'#2d2':s.imu_q===false?'#d22':'#777';
    const dirs=ORDEN.filter(k=>k!='frontal'), hechas=dirs.filter(k=>s.sectores[k]>0).length;
    barra('f',s.guardadas,s.meta); barra('z',s.zonas,s.zonas_tot); barra('s',hechas,8);
    barra('x',s.extremas.filter(x=>x>=EXT_MIN).length,4);
    document.getElementById('im').textContent=s.incl_min;
    document.getElementById('q').textContent='quedan '+Math.floor(s.quedan_s/60)+' min '+(s.quedan_s%60)+' s';
    document.getElementById('rosa').innerHTML=ORDEN.map(k=>'<div class="'+(s.sectores[k]>0?'ok ':'')+
      (s.actual.sector==k?'act':'')+'">'+k+'<br><b>'+s.sectores[k]+'</b>'+
      (s.actual.sector==k?' ('+s.actual.incl+'&deg;)':'')+'</div>').join('');
    document.getElementById('fin').textContent=(hechas==8&&s.guardadas>=s.meta&&s.zonas==s.zonas_tot&&s.extremas.every(x=>x>=EXT_MIN))?'COMPLETO':'';
    const v=document.getElementById('v'); v.onload=aplica; v.src='vista.jpg?'+Date.now(); }}catch(x){{}}
  setTimeout(t,1000);
}} t(); addEventListener('resize',aplica);
</script>""")

class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass
srv = http.server.ThreadingHTTPServer(("", 8080), functools.partial(Silencioso, directory=web))
threading.Thread(target=srv.serve_forever, daemon=True).start()

def escribir_estado(texto):
    imu_q, imu = imu_estado()
    with open(os.path.join(web, "estado_tmp.json"), "w") as fh:
        json.dump({"estado": texto, "imu": imu, "imu_q": imu_q, "guardadas": guardadas, "meta": META_FOTOS,
                   "zonas": int(cobertura.sum()), "zonas_tot": GX * GY, "sectores": sectores,
                   "extremas": [int(x) for x in extremas],
                   "actual": actual, "incl_min": INCL_MIN,
                   "quedan_s": max(0, int(dur - (time.time() - t0)))}, fh)
    os.replace(os.path.join(web, "estado_tmp.json"), os.path.join(web, "estado.json"))

def publicar(g, pts, color, texto):
    v = cv2.cvtColor(cv2.resize(g, None, fx=ESC, fy=ESC, interpolation=cv2.INTER_AREA), cv2.COLOR_GRAY2BGR)
    v = cv2.normalize(v, None, 0, 255, cv2.NORM_MINMAX)
    capa = v.copy()
    cw, ch = v.shape[1] / GX, v.shape[0] / GY
    for y in range(GY):
        for x in range(GX):
            p0, p1 = (int(x * cw), int(y * ch)), (int((x + 1) * cw) - 1, int((y + 1) * ch) - 1)
            if cobertura[y, x]:
                cv2.rectangle(capa, p0, p1, (0, 120, 0), -1)
            cv2.rectangle(v, p0, p1, (80, 80, 80), 1)
    cv2.ellipse(v, (v.shape[1] // 2, v.shape[0] // 2), (int(R_EXT * 1.4142 * W / 2 * ESC), int(R_EXT * 1.4142 * H / 2 * ESC)),
                0, 0, 360, (0, 140, 255), 1)
    v = cv2.addWeighted(capa, 0.35, v, 0.65, 0)
    for p in (pts or {}).values():
        cv2.circle(v, (int(p[0] * ESC), int(p[1] * ESC)), 4, color, -1)
    cv2.imwrite(os.path.join(web, "vista_tmp.jpg"), v)
    os.replace(os.path.join(web, "vista_tmp.jpg"), os.path.join(web, "vista.jpg"))
    escribir_estado(texto)

def detectar(g):
    mejor = None
    for nombre, (b, d, minimo) in TABLEROS.items():
        cc, ci, _, _ = d.detectBoard(g)
        if ci is not None and len(ci) >= minimo and (mejor is None or len(ci) > len(mejor[2])):
            mejor = (nombre, b, ci, cc)
    if mejor is None:
        return None
    nombre, board, ci, cc = mejor
    obj, img = board.matchImagePoints(cc, ci)
    ok, rv, tv = cv2.solvePnP(obj, img, K, None)
    R = cv2.Rodrigues(rv)[0]
    incl = np.degrees(np.arccos(abs(R[2, 2])))
    # las claves llevan el tablero: los ids de A y B se repiten
    return ({(nombre, int(i)): p for i, p in zip(ci.ravel(), cc.reshape(-1, 2))}, incl,
            float(tv.ravel()[2]), sector(R, incl))

# Direccion de la inclinacion en la imagen: hacia donde apunta la normal del tablero
# (en ejes de la imagen: x derecha, y abajo). Frontal si la inclinacion es < INCL_MIN.
INCL_MIN = 25.0
NOMBRES = ["der", "abajo-der", "abajo", "abajo-izq", "izq", "arriba-izq", "arriba", "arriba-der"]
def sector(R, incl):
    if incl < INCL_MIN:
        return "frontal"
    n = R[:, 2] * np.sign(R[2, 2])           # normal hacia la camara
    ang = np.degrees(np.arctan2(-n[1], -n[0])) % 360
    return NOMBRES[int(((ang + 22.5) % 360) // 45)]
sectores = {k: 0 for k in NOMBRES + ["frontal"]}
META_FOTOS = 25

R_EXT = 0.85                      # fraccion del radio de la esquina de la imagen
extremas = [0, 0, 0, 0]
def nuevas_extremas(pts):
    n = [0, 0, 0, 0]
    for p in pts.values():
        dx, dy = (p[0] - W / 2) / (W / 2), (p[1] - H / 2) / (H / 2)
        if dx * dx + dy * dy > R_EXT * R_EXT * 2:     # elipse que pasa por el 85 % de las esquinas
            n[(dy > 0) * 2 + (dx > 0)] += 1
    return n
def marcar(pts):
    for k, x in enumerate(nuevas_extremas(pts)):
        extremas[k] += x
    for p in pts.values():
        cobertura[min(GY - 1, int(p[1] / H * GY)), min(GX - 1, int(p[0] / W * GX))] = 1

def mostrar():
    return " | ".join("".join("#" if c else "." for c in fila) for fila in cobertura)

# ---- retoma lo ya guardado en la carpeta ----
poses, meta = [], {}
ruta_meta = os.path.join(out, "imu_por_foto.json")
if os.path.exists(ruta_meta):
    meta = json.load(open(ruta_meta))
previas = sorted(glob.glob(os.path.join(out, "cal_*.jpg")))
for f in previas:
    r = detectar(cv2.imread(f, cv2.IMREAD_GRAYSCALE))
    if r:
        pts, incl, _, sec = r
        poses.append((np.mean(list(pts.values()), axis=0), incl, sec)); marcar(pts); sectores[sec] += 1
guardadas = max([int(os.path.basename(f)[4:6]) for f in previas], default=0)
print(f"cam{cam}: retoma {len(previas)} fotos; cobertura {mostrar()}", flush=True)

proc = subprocess.Popen(["rpicam-still", "-n", "--camera", str(cam), "--mode", "4608:2592:10",
                         "--width", str(W), "--height", str(H), "--lens-position", LENTE,
                         "--shutter", "10000", "--gain", "1", "--awbgains", "1.8,1.6",
                         "-t", str(dur * 1000), "--timelapse", "2000", "-q", "95",
                         "-o", os.path.join(tmp, "f_%04d.jpg")],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

previo = None
actual = {"sector": None, "incl": None}
vistos = set()
t0 = time.time()
print(f"cam{cam}: capturando {dur} s; vista en http://<pi>:8080", flush=True)
while proc.poll() is None or len(glob.glob(os.path.join(tmp, "*.jpg"))) > len(vistos):
    fotos = sorted(glob.glob(os.path.join(tmp, "*.jpg")))
    listas = fotos if proc.poll() is not None else fotos[:-1]
    nuevas = [f for f in listas if f not in vistos]
    if not nuevas:
        time.sleep(0.2); continue
    vistos.update(nuevas)
    for f in nuevas[-2:]:
        g = cv2.imread(f, cv2.IMREAD_GRAYSCALE)
        if g is None:
            continue
        resto = lambda: (f"guardadas {guardadas} | zonas {cobertura.sum()}/{GX*GY} | "
                         f"quedan {max(0, dur - (time.time()-t0)):.0f} s")
        r = detectar(g)
        if r is None:
            actual.update(sector=None, incl=None)
            publicar(g, None, (0, 0, 255), f"SIN TABLERO | {resto()}")
            previo = None; continue
        pts, incl, z, sec = r
        actual.update(sector=sec, incl=round(incl))
        quieto, mov = False, float("nan")
        if previo is not None:
            comunes = [i for i in pts if i in previo]
            if len(comunes) >= 10:
                mov = np.median([np.linalg.norm(pts[i] - previo[i]) for i in comunes])
                quieto = mov < 20   # 20 px en 2 s: < 1 px durante los ~70 ms de lectura
        imu_q, imu_txt = imu_estado()
        centro = np.mean(list(pts.values()), axis=0)
        distinta = all(np.linalg.norm(centro - c) > 250 or abs(incl - a) > 10 or s != sec for c, a, s in poses)
        aporta = [k for k, x in enumerate(nuevas_extremas(pts)) if x >= 3 and extremas[k] < 30]
        distinta = distinta or bool(aporta)
        info = f"{len(pts)} esquinas, incl {incl:.0f} grados, {z/1000:.2f} m"
        if quieto and imu_q is not False and distinta:
            guardadas += 1
            nombre = f"cal_{guardadas:02d}.jpg"
            shutil.copy(f, os.path.join(out, nombre))
            poses.append((centro, incl, sec)); marcar(pts); sectores[sec] += 1
            if telem:
                tt, a, w = telem[-1]
                meta[nombre] = {"acc_mg": a.tolist(), "gyro_dps": w.tolist(), "edad_s": time.time() - tt}
                json.dump(meta, open(ruta_meta, "w"), indent=1)
            publicar(g, pts, (0, 255, 0), f"GUARDADA {guardadas}: {info} -> lleva el tablero a otra pose | {resto()}")
            print(f"  GUARDADA {guardadas}: {info}, centro ({centro[0]:.0f},{centro[1]:.0f}); {imu_txt}; "
                  f"cobertura {mostrar()}", flush=True)
        else:
            if not quieto:
                motivo = f"TABLERO MOVIENDOSE (mov {mov:.0f} px): sostenlo quieto ~3 s"
            elif imu_q is False:
                motivo = "COHETE MOVIENDOSE (LilyGo): no lo toques"
            else:
                motivo = "POSE REPETIDA: otra zona o inclina mas"
            publicar(g, pts, (0, 220, 255), f"{motivo} | {info} | {resto()}")
            print(f"  {os.path.basename(f)}: {info}, {motivo}; {imu_txt}", flush=True)
        previo = pts
    for f in nuevas:
        if os.path.exists(f):
            os.remove(f)
fin = f"FIN cam{cam}: {guardadas} guardadas; zonas {cobertura.sum()}/{GX*GY}; {time.time()-t0:.0f} s"
escribir_estado(fin)
print(fin + f"; cobertura {mostrar()}", flush=True)
shutil.rmtree(tmp, ignore_errors=True)
time.sleep(5)
srv.shutdown()
