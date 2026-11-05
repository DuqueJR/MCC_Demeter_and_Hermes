"""Calibra intrinsecos con las fotos cal_*.jpg de una carpeta (ChArUco 11x7, 5X5).
Uso: python3 calibrar.py CARPETA [salida.json]"""
import sys, glob, json, os, cv2, numpy as np

carpeta = sys.argv[1]
salida = sys.argv[2] if len(sys.argv) > 2 else os.path.join(carpeta, "intrinsecos.json")
# A: laptop (11x7 5X5); B: tablet (7x5 4X4). Cada foto usa el que mas esquinas da. La escala de cada
# tablero no importa para los intrinsecos: la absorbe la distancia de cada vista.
TABLEROS = []
for tam, cuadro, marca, dic in (((11, 7), 19.5, 14.0, cv2.aruco.DICT_5X5_100),
                                ((7, 5), 30.0, 24.0, cv2.aruco.DICT_4X4_50)):
    b = cv2.aruco.CharucoBoard(tam, cuadro, marca, cv2.aruco.getPredefinedDictionary(dic))
    TABLEROS.append((b, cv2.aruco.CharucoDetector(b)))

objs, imgs, nombres = [], [], []
size = None
for f in sorted(glob.glob(os.path.join(carpeta, "cal_*.jpg"))):
    g = cv2.imread(f, cv2.IMREAD_GRAYSCALE)
    size = g.shape[::-1]
    mejor = (None, None, None)
    for b, d in TABLEROS:
        cc, ci, _, _ = d.detectBoard(g)
        if ci is not None and (mejor[2] is None or len(ci) > len(mejor[2])):
            mejor = (b, cc, ci)
    board, cc, ci = mejor
    if ci is None or len(ci) < 10:
        print(f"{os.path.basename(f)}: pocas esquinas, se omite"); continue
    # refinamiento subpixel sobre la imagen completa
    cc = cv2.cornerSubPix(g, cc.astype(np.float32), (7, 7), (-1, -1),
                          (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.001))
    o, i = board.matchImagePoints(cc, ci)
    objs.append(o.astype(np.float32)); imgs.append(i.astype(np.float32)); nombres.append(os.path.basename(f))

def calibrar(objs, imgs):
    K0 = np.array([[3385.7, 0, size[0] / 2], [0, 3385.7, size[1] / 2], [0, 0, 1]])
    flags = cv2.CALIB_USE_INTRINSIC_GUESS | cv2.CALIB_FIX_ASPECT_RATIO
    return cv2.calibrateCameraExtended(objs, imgs, size, K0.copy(), np.zeros(5), flags=flags)

rms, K, D, rv, tv, sdi, sde, err = calibrar(objs, imgs)
err = err.ravel()
# descarta fotos con error alto (> 2.5x la mediana) y repite una vez
malas = [n for n, e in zip(nombres, err) if e > 2.5 * np.median(err)]
if malas:
    keep = [k for k, n in enumerate(nombres) if n not in malas]
    print("se descartan por error alto:", ", ".join(malas))
    objs = [objs[k] for k in keep]; imgs = [imgs[k] for k in keep]; nombres = [nombres[k] for k in keep]
    rms, K, D, rv, tv, sdi, sde, err = calibrar(objs, imgs)
    err = err.ravel()

for n, e, r in zip(nombres, err, rv):
    R = cv2.Rodrigues(r)[0]
    print(f"  {n}: {e:.3f} px, inclinacion {np.degrees(np.arccos(abs(R[2,2]))):.0f} grados")
sd = sdi.ravel()
print(f"fotos {len(nombres)}, RMS {rms:.3f} px")
print(f"fx {K[0,0]:.1f} +- {sd[0]:.1f}  fy {K[1,1]:.1f}  cx {K[0,2]:.1f} +- {sd[2]:.1f}  cy {K[1,2]:.1f} +- {sd[3]:.1f}")
print("distorsion k1 k2 p1 p2 k3:", " ".join(f"{d:.5f}" for d in D.ravel()),
      " +- ", " ".join(f"{s:.5f}" for s in sd[4:9]))
# desplazamiento maximo por distorsion en la imagen (esquina)
esq = np.array([[[0, 0]], [[size[0] - 1, 0]], [[0, size[1] - 1]], [[size[0] - 1, size[1] - 1]]], np.float32)
und = cv2.undistortPoints(esq, K, D, P=K).reshape(-1, 2)
print("distorsion en las esquinas (px):", " ".join(f"{d:.1f}" for d in np.linalg.norm(und - esq.reshape(-1, 2), axis=1)))
json.dump({"ancho_px": size[0], "alto_px": size[1], "fx_px": K[0, 0], "fy_px": K[1, 1],
           "cx_px": K[0, 2], "cy_px": K[1, 2], "distorsion_k1k2p1p2k3": D.ravel().tolist(),
           "sd_fx_cx_cy": [float(sd[0]), float(sd[2]), float(sd[3])], "rms_px": rms,
           "fotos": nombres, "foco": "infinito (lens-position 0)", "modo": "4608:2592:10",
           "tablero": "ChArUco 11x7 DICT_5X5, cuadro 19.5, marcador 14 (en pantalla)"},
          open(salida, "w"), indent=2)
print("guardado en", salida)
