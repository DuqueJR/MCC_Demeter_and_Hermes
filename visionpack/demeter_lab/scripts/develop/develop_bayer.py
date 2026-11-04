# V1 - LINEAL
#   Black adaptativo (p0.5)
#   ↓
#   White adaptativo (p99.8)
#   ↓
#   Demosaic EA
#   ↓
#   WB automático sobre RGB
#   ↓
#   Gamma 2.2
#   ↓
#   PNG

import cv2
import numpy as np
import sys

W = 4608
H = 2592

raw = np.fromfile(sys.argv[1], dtype=np.uint16)
raw = raw.reshape(H, W)

print("min:", raw.min())
print("max:", raw.max())

# eliminar negro residual
black = np.percentile(raw, 0.5)

raw = raw.astype(np.float32)
raw = np.maximum(raw - black, 0)

# normalizar a todo el rango
white = np.percentile(raw, 99.8)

raw = np.clip(raw / white, 0, 1)

# convertir a 16 bits útiles
raw16 = (raw * 65535).astype(np.uint16)

# demosaic BGGR
rgb = cv2.cvtColor(
    raw16,
    cv2.COLOR_BAYER_BG2BGR_EA
)

# white balance simple

b,g,r = cv2.split(rgb)

mb = np.mean(b)
mg = np.mean(g)
mr = np.mean(r)

b = np.clip(b * (mg / mb), 0, 65535)
r = np.clip(r * (mg / mr), 0, 65535)

rgb = cv2.merge([
    b.astype(np.uint16),
    g.astype(np.uint16),
    r.astype(np.uint16)
])

# gamma sRGB aproximada

rgbf = rgb.astype(np.float32) / 65535.0

rgbf = np.power(rgbf, 1/2.2)

rgb8 = np.clip(
    rgbf * 255,
    0,
    255
).astype(np.uint8)

cv2.imwrite(
    sys.argv[2],
    rgb8
)

print("Guardado:", sys.argv[2])
