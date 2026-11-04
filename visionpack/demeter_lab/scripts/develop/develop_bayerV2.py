
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
black = 4096 

raw = raw.astype(np.float32)
raw = np.maximum(raw - black, 0)

# normalizar a todo el rango
white = 27968 

raw = np.clip(raw / white, 0, 1)

# BGGR

B_GAIN = 1.9664531739516786
R_GAIN = 1.4532785075748944

raw_bggr = raw.copy()

# B
raw_bggr[0::2,0::2] *= B_GAIN

# R
raw_bggr[1::2,1::2] *= R_GAIN

raw_bggr = np.clip(raw_bggr,0,1)

raw16 = (raw_bggr * 65535).astype(np.uint16)

rgb = cv2.cvtColor(
    raw16,
    cv2.COLOR_BAYER_BG2BGR_EA
)


# gamma sRGB aproximada

rgbf = rgb.astype(np.float32) / 65535.0

rgbf /= 65535.0

rgbf = np.clip(rgbf,0,1)

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
