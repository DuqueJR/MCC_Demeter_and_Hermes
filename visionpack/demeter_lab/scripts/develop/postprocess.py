import cv2
import numpy as np
import sys

W = 4608
H = 2592

INPUT = sys.argv[1]
OUTPUT = sys.argv[2]

print("Cargando RAW RGB888...")

img = np.fromfile(INPUT, dtype=np.uint8)

expected = W * H * 3

if img.size != expected:
    raise RuntimeError(
        f"Tamaño incorrecto: {img.size} bytes, esperado {expected}"
    )

img = img.reshape(H, W, 3)

# RAW PiSP suele salir RGB
img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

print("White balance...")

b, g, r = cv2.split(img)

mb = np.mean(b)
mg = np.mean(g)
mr = np.mean(r)

print(f"B={mb:.2f}")
print(f"G={mg:.2f}")
print(f"R={mr:.2f}")

if mb > 0:
    b = np.clip(b * (mg / mb), 0, 255)

if mr > 0:
    r = np.clip(r * (mg / mr), 0, 255)

img = cv2.merge([
    b.astype(np.uint8),
    g.astype(np.uint8),
    r.astype(np.uint8)
])

print("Autocontraste...")

lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

l, a, b = cv2.split(lab)

clahe = cv2.createCLAHE(
    clipLimit=2.0,
    tileGridSize=(8, 8)
)

l = clahe.apply(l)

lab = cv2.merge([l, a, b])

img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

print("Gamma...")

gamma = 0.8

lut = np.array([
    np.clip(
        (i / 255.0) ** gamma * 255.0,
        0,
        255
    )
    for i in range(256)
], dtype=np.uint8)

img = cv2.LUT(img, lut)

print("Sharpen...")

kernel = np.array([
    [-1,-1,-1],
    [-1, 9,-1],
    [-1,-1,-1]
], dtype=np.float32)

img = cv2.filter2D(
    img,
    -1,
    kernel
)

cv2.imwrite(OUTPUT, img)

print("Guardado:", OUTPUT)
