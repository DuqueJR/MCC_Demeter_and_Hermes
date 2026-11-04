#!/bin/bash

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LAB_ROOT="/home/admin/demeter_lab"
DATA_ROOT="$LAB_ROOT/data"

RAW_PISP="$DATA_ROOT/raw/test_20261008_211221.pisp"
RAW_BAYER="$DATA_ROOT/raw/test_20261008_211221_bayer16.raw"

IMG_V1="$DATA_ROOT/rendered/test_${TIMESTAMP}_v1.png"
IMG_V2="$DATA_ROOT/rendered/test_${TIMESTAMP}_v2.png"
IMG_V3="$DATA_ROOT/rendered/test_${TIMESTAMP}_v3.png"
IMG_V4="$DATA_ROOT/rendered/test_${TIMESTAMP}_v4.png"


echo
echo "====================================="
echo " DEMETER IMAGE PIPELINE TEST "
echo "====================================="
echo

echo "[1/7] PAUSADO PARA PRUEBAS:Capturando imagen..."

#rpicam-raw \
#-o "$RAW_PISP" \
#--mode 4608:2592:10:P \
#-t 1000

#echo
#echo "[2/7] Descomprimiendo COMP1 -> BAYER16..."

cd ~/libpisp

./build/src/examples/praw2rgb \
"$RAW_PISP" \
"$RAW_BAYER" \
--input-format 4608:2592:4608:PISP_COMP1 \
--output-format 4608:2592:9216:BAYER16

echo
echo "[3/7] Revelando V1..."

python3 \
"$LAB_ROOT/scripts/develop/develop_bayer.py" \
"$RAW_BAYER" \
"$IMG_V1"

echo
echo "[4/7] Revelando V2..."

python3 \
"$LAB_ROOT/scripts/develop/develop_bayerV2_corregido.py" \
"$RAW_BAYER" \
"$IMG_V2"

echo
echo "[5/7] Revelando V3..."

python3 \
"$LAB_ROOT/scripts/develop/develop_bayerV3_corregido.py" \
"$RAW_BAYER" \
"$IMG_V3"

echo
echo "[6/7] Revelando V4..."

python3 \
"$LAB_ROOT/scripts/develop/develop_bayerV4.py" \
"$RAW_BAYER" \
"$IMG_V4"

echo
echo "[7/7] Resultados"

echo
echo "RAW capturado:"
echo "$RAW_PISP"

echo
echo "BAYER16:"
echo "$RAW_BAYER"

echo
echo "PNG V1:"
echo "$IMG_V1"

echo
echo "PNG V2:"
echo "$IMG_V2"

echo
echo "PNG V3:"
echo "$IMG_V3"

echo
echo "PNG V4:"
echo "$IMG_V4"

echo
echo "Tamaños"

ls -lh \
"$RAW_PISP" \
"$RAW_BAYER" \
"$IMG_V1" \
"$IMG_V2" \
"$IMG_V3" \
"$IMG_V4" 

echo
echo "COMPLETADO"
