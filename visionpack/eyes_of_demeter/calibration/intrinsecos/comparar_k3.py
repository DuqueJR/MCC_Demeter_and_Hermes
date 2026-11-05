"""Compara el modelo de distorsion con k3 libre y con k3=0, y mide hasta que radio llegan los datos."""
import sys, glob, os, cv2, numpy as np

TABLEROS = []
for tam, cuadro, marca, dic in (((11, 7), 19.5, 14.0, cv2.aruco.DICT_5X5_100),
                                ((7, 5), 30.0, 24.0, cv2.aruco.DICT_4X4_50)):
    b = cv2.aruco.CharucoBoard(tam, cuadro, marca, cv2.aruco.getPredefinedDictionary(dic))
    TABLEROS.append((b, cv2.aruco.CharucoDetector(b)))

for carpeta in sys.argv[1:]:
    objs, imgs = [], []
    for f in sorted(glob.glob(os.path.join(carpeta, "cal_*.jpg"))):
        g = cv2.imread(f, cv2.IMREAD_GRAYSCALE); size = g.shape[::-1]
        best = (None, None, None)
        for b, d in TABLEROS:
            cc, ci, _, _ = d.detectBoard(g)
            if ci is not None and (best[2] is None or len(ci) > len(best[2])):
                best = (b, cc, ci)
        b, cc, ci = best
        if ci is None or len(ci) < 10:
            continue
        cc = cv2.cornerSubPix(g, cc.astype(np.float32), (7, 7), (-1, -1),
                              (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.001))
        o, i = b.matchImagePoints(cc, ci)
        objs.append(o.astype(np.float32)); imgs.append(i.astype(np.float32))
    todos = np.concatenate([i.reshape(-1, 2) for i in imgs])
    c = np.array(size) / 2
    r_esq = np.linalg.norm(c)
    r = np.linalg.norm(todos - c, axis=1)
    print(f"\n{carpeta}: {len(objs)} fotos, {len(todos)} esquinas; radio max de los datos {r.max()/r_esq*100:.0f} % "
          f"del de la esquina; puntos por encima del 85 %: {(r > 0.85*r_esq).sum()}")
    esq = np.array([[[0, 0]], [[size[0]-1, 0]], [[0, size[1]-1]], [[size[0]-1, size[1]-1]]], np.float32)
    for nombre, extra in (("k1 k2 k3", 0), ("k1 k2 (k3=0)", cv2.CALIB_FIX_K3)):
        K0 = np.array([[3385.7, 0, c[0]], [0, 3385.7, c[1]], [0, 0, 1]])
        flags = cv2.CALIB_USE_INTRINSIC_GUESS | cv2.CALIB_FIX_ASPECT_RATIO | extra
        rms, K, D, *_ = cv2.calibrateCamera(objs, imgs, size, K0, np.zeros(5), flags=flags)
        und = cv2.undistortPoints(esq, K, D, P=K).reshape(-1, 2)
        d_esq = np.linalg.norm(und - esq.reshape(-1, 2), axis=1)
        # desplazamiento por distorsion en el borde de los datos (radio max observado)
        print(f"  {nombre:14s} RMS {rms:.3f}  fx {K[0,0]:.1f}  cx {K[0,2]:.1f} cy {K[1,2]:.1f}  "
              f"D {' '.join(f'{x:.4f}' for x in D.ravel())}  esquinas {' '.join(f'{x:.0f}' for x in d_esq)} px")
