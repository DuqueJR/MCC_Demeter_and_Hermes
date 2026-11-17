import numpy as np

W=4608
H=2592

raw = np.fromfile(
    "cal_wb_4000k_bayer16.raw",
    dtype=np.uint16
).reshape(H,W)

# BGGR

B  = raw[0::2,0::2]
G1 = raw[0::2,1::2]
G2 = raw[1::2,0::2]
R  = raw[1::2,1::2]

G = ((G1.astype(np.float64)+G2.astype(np.float64))/2)

print("B mean",np.mean(B))
print("G mean",np.mean(G))
print("R mean",np.mean(R))

print()
print("WB gains")

print("R gain",np.mean(G)/np.mean(R))
print("B gain",np.mean(G)/np.mean(B))
