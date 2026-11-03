#pragma once
#include <stdint.h>
#include "LoRaBoards.h"
class SensorQMI8658 { public:
 enum AccelRange{ACC_RANGE_2G,ACC_RANGE_4G,ACC_RANGE_8G,ACC_RANGE_16G};
 enum GyroRange{GYR_RANGE_16DPS,GYR_RANGE_32DPS,GYR_RANGE_64DPS,GYR_RANGE_128DPS,GYR_RANGE_256DPS,GYR_RANGE_512DPS,GYR_RANGE_1024DPS};
 enum AccelODR{ACC_ODR_500Hz}; enum GyroODR{GYR_ODR_448_4Hz}; enum LPF{LPF_MODE_0};
 enum FifoMode{FIFO_MODE_FIFO}; enum FifoSamples{FIFO_SAMPLES_128}; enum Pin{INTERRUPT_PIN_1,INTERRUPT_PIN_2};
 bool begin(SPIClass&,int); void configAccelerometer(int,int,int); void configGyroscope(int,int,int);
 bool configFIFO(int,int,int,int); void enableINT(int,bool); void enableGyroscope(); void enableAccelerometer(); };
