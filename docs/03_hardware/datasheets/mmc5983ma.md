---
source: "/Users/juanpa/Develop/PersonalProjects/Hermes/docs/Hermes/03_hardware/datasheets/mmc5983ma.pdf"
converted_at: 2026-10-25T01:56:26+00:00
size_bytes: 1183817
tool: tomd
---

±8 Gauss, High Performance
3-axis Magnetic Sensor
MMC5983MA
FEATURES
 Fully integrated 3-axis magnetic sensor and
electronic circuits requiring fewer external
components
 Superior dynamic range and accuracy:
 ±8G FSR
 18bits operation
 0.4mG total RMS noise
 Enables heading accuracy of 0.5º
 Max output data rate of 1000Hz
 Industrial standard low profile package
3.0mm x 3.0mm x 1.0mm
 Degaussing with built-in SET/RESET function FUNCTIONAL BLOCK DIAGRAM
 Eliminates thermal variation induced offset
error (Null field output)
 Clears the residual magnetization resulting It can measure magnetic fields within the full scale
from strong external fields range of 8 Gauss (G), with 0.25mG/0.0625mG per
 On-chip sensitivity compensation LSB resolution at 16bits/18bits operation mode and 0.4
 On-chip temperature sensor mG total RMS noise level, enabling heading accuracy
 Data_Ready Interrupt of 0.5º in electronic compass applications.
 Low power consumption
An integrated SET/RESET function provides for the
 1µA power down current elimination of error due to Null Field output change with
 I2C Slave, FAST(≤400KHz) mode temperature. Temperature information from the
 3.0V single low power supply integrated temperature sensor is available over the I2C
 SPI interface available Interface. The SET/RESET function can be performed
 RoHS compliant for each measurement, periodically, or when the
temperature changes by a predetermined amount as
APPLICATIONS the specific application requires.
 Electronic Compass & Navigation In addition, the SET/RESET function clears the sensors
 Position Sensing of any residual magnetic polarization resulting from
 General Purpose Magnetic Field exposure to strong external magnets.
Measurements The MMC5983MA is packaged in a low profile LGA
package and an operating temperature range from -
DESCRIPTION 40C to +105C.
The MMC5983MA is an AEC-Q100 qualified complete The MMC5983MA provides an I2C digital output with
3-axis magnetic sensor with on-chip signal processing 400 KHz, fast mode operation, and a 10MHz SPI digital
and integrated I2C/SPI bus suitable for use in output.
automotive applications. The device can be connected
directly to a microprocessor, eliminating the need for
A/D converters or timing resources.
Information furnished by MEMSIC is believed to be accurate and reliable.
However, no responsibility is assumed by MEMSIC for its use, or for any
www.memsic.com
infringements of patents or other rights of third parties which may result from
its use. No license is granted by implication or otherwise under any patent or
patent rights of MEMSIC.
MEMSIC MMC5983MA Rev A Page 1 of 20 Formal release date: 4/3/2019

SPECIFICATIONS  (Measurements @ 25C, unless otherwise noted; VDD=3.0V unless otherwise specified)
|                          | Parameter  | Conditions           |      | Min  | Typ  | Max  | Units  |
| ------------------------ | ---------- | -------------------- | ---- | ---- | ---- | ---- | ------ |
| Field Range (Each Axis)  |            | Total applied field  |      |      | 8   |      | G      |
|                          |            |                      | VDD  | 2.8  | 3.0  | 3.6  | V      |
Supply Voltage
|                           |     | VDDIO(I2Cinterface and INT)  |        | 2.8  | 3.0  | 3.6  | V   |
| ------------------------- | --- | ---------------------------- | ------ | ---- | ---- | ---- | --- |
| Supply Voltage Rise Time  |     |                              |        |      |      | 5.0  | ms  |
|                           |     |                              | BW=00  |      | 450  |      | µA  |
Supply Current1,2
|     |     |     | BW=01  |     | 225  |     | µA  |
| --- | --- | --- | ------ | --- | ---- | --- | --- |
(7 measurements/second)
|                           |     |                      | BW=10   |      | 112.5  |       | µA       |
| ------------------------- | --- | -------------------- | ------- | ---- | ------ | ----- | -------- |
|                           |     |                      | BW=11   |      | 32     |       | µA       |
| Power Down Current2       |     |                      |         |      | 1.0    |       | µA       |
| Operating Temperature     |     |                      |         | -40  |        | 105   | C       |
| Storage Temperature       |     |                      |         | -55  |        | 125   | C       |
| Linearity Error2          |     |                      | FS=±8G  |      |        |       |          |
|                           |     |                      |         |      | 0.1    |       | %FS      |
| (Best fit straight line)  |     | Happlied=±4G         |         |      |        |       |          |
| Hysteresis2               |     | 3 sweeps across ±8G  |         |      | 0.01   |       | %FS      |
| Repeatability Error2      |     | 3 sweeps across ±8G  |         |      | 0.1    |       | %FS      |
| Alignment Error           |     |                      |         |      | 1.0   | 3.0  | Degrees  |
| Transverse Sensitivity    |     |                      |         |      | 0.8   |       | %        |
|                           |     |                      | BW=00   |      | 0.4    |       | mG       |
|                           |     |                      | BW=01   |      | 0.6    |       | mG       |
Total RMS Noise2
|                    |     |     | BW=10  |     | 0.8  |     | mG    |
| ------------------ | --- | --- | ------ | --- | ---- | --- | ----- |
|                    |     |     | BW=11  |     | 1.2  |     | mG    |
| Output Resolution  |     |     |        |     | 18   |     | Bits  |

|                        |     |                     | BW=00  |     | 50    |     | Hz       |
| ---------------------- | --- | ------------------- | ------ | --- | ----- | --- | -------- |
|                        |     |                     | BW=01  |     | 100   |     | Hz       |
| Max Output data rate2  |     |                     | BW=10  |     | 225   |     | Hz       |
|                        |     |                     | BW=11  |     | 580   |     | Hz       |
|                        |     | BW=11(CM_Freq=111)  |        |     | 1000  |     | Hz       |
| Heading Accuracy3      |     |                     |        |     | 1.0  |     | Degrees  |
|                        |     |                     |        |     |       |     | %        |
|                        |     |                     | 8 G   |     | 5    |     |          |
Sensitivity Accuracy4,5
|     |     | With16bits operation  |     |     | 4096  |     | Counts/G  |
| --- | --- | --------------------- | --- | --- | ----- | --- | --------- |

|                          |     | With18bits operation    |     |     | 16384  |     | Counts/G  |
| ------------------------ | --- | ----------------------- | --- | --- | ------ | --- | --------- |
| Sensitivity Change Over  |     | -40~105 C              |     |     |        |     |           |
|                          |     |                         |     |     | 5     |     | %         |
| Temperature              |     | Delta from 25 C, 8 G  |     |     |        |     |           |
|                          |     |                         |     |     | 0.5   |     | G         |
Null Field Output5  With16bits operation    32768    Counts
|                                |     | With18bits operation  |     |     | 131072  |     | Counts    |
| ------------------------------ | --- | --------------------- | --- | --- | ------- | --- | --------- |
| Null Field Output Change Over  |     | -40~105 C            |     |     |         |     |           |
|                                |     |                       |     |     | 3      |     | mG        |
| Temperature using SET/RESET    |     | Delta from 25 C      |     |     |         |     |           |
| Temperature Sensor Output      |     |                       |     |     | 0.8     |     | C/Count  |
Disturbing Field6
|                          |     |     |     |     | 10  |         | G   |
| ------------------------ | --- | --- | --- | --- | --- | ------- | --- |
| Maximum Exposed Field    |     |     |     |     |     | 10,000  | G   |
| SET/RESET Repeatability  |     |     |     |     | 1  |         | mG  |
1.  Supply current is proportional to how many measurements performed per second.
2.  Based on 3lots characterization result.
3.  MEMSIC product enables users to utilize heading accuracy to be 1.0 degree typical when using MEMSIC’s proprietary software or algorithm.
4.  Sensitivity of the orthogonal axes is analytically derived from raw data and is subsequently processed by MEMSIC software drivers.
5.  Based on shipment test result.
6.  This is the magnitude of external field that can be tolerated without changing the sensor characteristics. If the disturbing field is exceeded, a SET/RESET
operation is required to restore proper sensor operation.
|     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
MEMSIC MMC5983MA Rev A  Page 2 of 20    Formal release date: 4/3/2019

DIGITAL INTERFACE (VIO=3.0V)
| Symbol  |     | Parameter (Units)                            |     |     |     |     |     | Minimum  | Typical  | Maximum  |     |     |
| ------- | --- | -------------------------------------------- | --- | --- | --- | --- | --- | -------- | -------- | -------- | --- | --- |
| VIH     |     | High Level Input Voltage (Volts)             |     |     |     |     |     | 0.7*VIO  |          |          |     |     |
| VIL     |     | Low Level Input Voltage (Volts)              |     |     |     |     |     |          |          | 0.3*VIO  |     |     |
| VHYS    |     | Hysteresis of Schmitt Trigger Input (Volts)  |     |     |     |     |     | 0.2      |          |          |     |     |
| IIL     |     | Input Leakage, All Inputs (uA)               |     |     |     |     |     | -10      |          | 10       |     |     |
| VOH     |     | High Level Output Voltage (Volts)            |     |     |     |     |     | 0.8*VIO  |          |          |     |     |
| VOL     |     | Low Level Output Voltage (Volts)             |     |     |     |     |     |          |          | 0.2*VIO  |     |     |
I2C INTERFACE I/O CHARACTERISTICS (VIO=3.0V)
|                              |     | Parameter  |     |     | Symbol   |     | Test Condition     |     | Min.     | Typ.  | Max.      | Unit  |
| ---------------------------- | --- | ---------- | --- | --- | -------- | --- | ------------------ | --- | -------- | ----- | --------- | ----- |
| Logic Input Low Level        |     |            |     |     | VIL      |     |                    |     | -0.5     |       | 0.3* VIO  | V     |
| Logic Input High Level       |     |            |     |     | VIH      |     |                    |     | 0.7*VIO  |       | VIO       | V     |
| Hysteresis of Schmitt Input  |     |            |     |     | Vhys     |     |                    |     | 0.2      |       |           | V     |
| Logic Output Low Level       |     |            |     |     | VOL      |     |                    |     |          |       | 0.6       | V     |
| Input Leakage Current        |     |            |     |     | Ii       |     | 0.1VIO<Vin<0.9VIO  |     | -10      |       | 10        | µA    |
| SCL Clock Frequency          |     |            |     |     | fSCL     |     |                    |     | 0        |       | 400       | kHz   |
| START Hold Time              |     |            |     |     | tHD;STA  |     |                    |     | 0.6      |       |           | µS    |
| START Setup Time             |     |            |     |     | tSU;STA  |     |                    |     | 0.6      |       |           | µS    |
| LOW period of SCL            |     |            |     |     | tLOW     |     |                    |     | 1.3      |       |           | µS    |
| HIGH period of SCL           |     |            |     |     | tHIGH    |     |                    |     | 0.6      |       |           | µS    |
| Data Hold Time               |     |            |     |     | tHD;DAT  |     |                    |     | 0        |       | 0.9       | µS    |
| Data Setup Time              |     |            |     |     | tSU;DAT  |     |                    |     | 0.1      |       |           | µS    |

| Rise Time  |     |     |     |     | tr  |     | From VIL toVIH  |     |     |     | 0.3  | µS  |
| ---------- | --- | --- | --- | --- | --- | --- | --------------- | --- | --- | --- | ---- | --- |
| Fall Time  |     |     |     |     | tf  |     | From VIH toVIL  |     |     |     | 0.3  | µS  |
Bus Free Time Between STOP and
|     |     |     |     |     | tBUF  |     |     |     | 1.3  |     |     | µS  |
| --- | --- | --- | --- | --- | ----- | --- | --- | --- | ---- | --- | --- | --- |
START
| STOP Setup Time  |     |     |     |     | tSU;STO  |     |     |     | 0.6  |     |     | µS  |
| ---------------- | --- | --- | --- | --- | -------- | --- | --- | --- | ---- | --- | --- | --- |
SDA
|     | t   |         |     |          |     | t   |     |            | t SP   |       |       |     |
| --- | --- | ------- | --- | -------- | --- | --- | --- | ---------- | ------ | ----- | ----- | --- |
|     | f   | t LOW   | t   | t SU;DAT |     | f   |     | t HD;STA   |        | t r   | tBUF  |     |
r
SCL
|     |     | t      |          |     |      | t SU;STA |     |     | t SU;STO |     |     |     |
| --- | --- | ------ | -------- | --- | ---- | -------- | --- | --- | -------- | --- | --- | --- |
|     |     | HD;STA |          |     | t    |          | Sr  |     |          | P   | S   |     |
|     | S   |        | t HD;DAT |     | HIGH |          |     |     |          |     |     |     |

Timing Definition
|     |     |     |     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
MEMSIC MMC5983MA Rev A  Page 3 of 20    Formal release date: 4/3/2019

SPI INTERFACE I/O CHARACTERISTICS (VIO=3.0V)
|            |     |     |         |     |         |     | Unit  |
| ---------- | --- | --- | ------- | --- | ------- | --- | ----- |
|            |     |     |         |     | Value 1 |     |       |
| Parameter  |     |     | Symbol  |     |         |     |       |

|                  |     |     |     | Min.   | Typ.  | Max.  |     |
| ---------------- | --- | --- | --- | ------ | ----- | ----- | --- |
| SPI clock cycle  |     | t   |     | 100    |       |       | ns  |
c(SCK)
| SPI clock frequency  |     | f   |     |     |     | 10  MHz  |     |
| -------------------- | --- | --- | --- | --- | --- | -------- | --- |
c(SCK)
|                       |     |           |     |      |     |     |     |
| --------------------- | --- | --------- | --- | ---- | --- | --- | --- |
| CS setup time         |     | t         |     | 6    |     |     |     |
|                       |     | su(CS)    |     |      |     |     |     |
| CS hold time          |     | t         |     | 8    |     |     |     |
|                       |     | h(CS)     |     |      |     |     |     |
|                       |     |           |     |      |     |     |     |
| SDI input setup time  |     | t su(SI)  |     | 5    |     |     |     |

| SDI input hold time  |     |        t |     | 15    |     |     | ns  |
| -------------------- | --- | -------- | --- | ----- | --- | --- | --- |
h(SI)
| SDO valid output time  |     | t   |     |     |     | 50  |     |
| ---------------------- | --- | --- | --- | --- | --- | --- | --- |
v(SO)
|                       |     |     |     |     |     |     |     |
| --------------------- | --- | --- | --- | --- | --- | --- | --- |
| SDO output hold time  |     | t   |     | 9   |     |     |     |
h(SO)
| SDO output disable time  |     |  t  |     |     |     | 50  |     |
| ------------------------ | --- | --- | --- | --- | --- | --- | --- |
dis(SO)
1.  Values are guaranteed at 10 MHz clock frequency for SPI, based on characterization results, not tested in production.

Timing Definition
|     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- |
MEMSIC MMC5983MA Rev A  Page 4 of 20    Formal release date: 4/3/2019

SPI Read and Write protocol
CS (SPI_CS) is the serial port enable and it is controlled by the SPI master. It goes low at the start of the
transmission and goes back high at the end.
SCK (SPI_SCK) is the serial port clock and it is controlled by the SPI master. It is stopped high when CS is high (no
transmission).
SDI (SPI_SDI) and SDO (SPI_SDO) are respectively the serial port data input and output. Those lines are driven at
the falling edge of SCK and should be captured at the rising edge of SCK.
Both the Read Register and Write Register commands are completed in 16 clocks pulses or in multiple of 8 in case
of multiple byte read/write. Bit duration is the time between two falling edges of SCK. The first bit (bit 0) starts at the
first falling edge of SCK after the falling edge of CS while the last bit (bit 15, bit 23, ...) starts at the last falling edge
of SCK (SPI_CS) just before the rising edge of CS.
bit 0: RW bit. When 0, the data DI(7:0) is written into the device. When 1, the data DO(7:0) from the device is read.
In latter case, the chip will drive SDO at the start of bit 8.
bit 1: Don’t care.
bit 2-7: Address AD(5:0). This is the address field of the indexed register.
bit 8-15: Data DI(7:0) (write mode). This is the data that will be written into the device (MSB first) (MSB first). bit 8-
15: data DO(7:0) (read mode). This is the data that will be read from the device (MSB first).
In multiple read/write commands further blocks of 8 clock periods will be added.
MEMSIC MMC5983MA Rev A Page 5 of 20 Formal release date: 4/3/2019

SPI Read
The SPI Read command is performed with 16 clocks pulses. Multiple byte read command is performed adding blocks
of 8 clocks pulses at the previous one.
bit 0: READ bit. The value is 1.
bit 1: don’t care.
bit 2-7: address AD(5:0). This is the address field of the indexed register.
bit 8-15: data DO(7:0) (read mode). This is the data that will be read from the device (MSB first).
bit 16-... : data DO(...-8). Further data in multiple byte reading.
MEMSIC MMC5983MA Rev A Page 6 of 20 Formal release date: 4/3/2019

SPI Write
The SPI Write command is performed with 16 clocks pulses. Multiple byte write command is performed adding blocks
of 8 clocks pulses at the previous one.
bit 0: WRITE bit. The value is 0.
bit 1: don’t care
bit 2 -7: address AD(5:0). This is the address field of the indexed register.
bit 8-15: data DI(7:0) (write mode). This is the data that will be written inside the device (MSB first).
bit 16-... : data DI(...-8). Further data in multiple byte writing.
MEMSIC MMC5983MA Rev A Page 7 of 20 Formal release date: 4/3/2019

SPI Read in 3-wires mode
The part can be configured as 3-wires SPI read mode, by write “1” to Internal Control Register 3 (0CH), bit 6 before
reading command.
The SPI Read command is performed with 16 clocks pulses:
bit 0: READ bit. The value is 1.
bit 1: don’t care.
bit 2-7: address AD(5:0). This is the address field of the indexed register.
bit 8-15: data DO(7:0) (read mode). This is the data that will be read from the device (MSB first). Multiple write
command is also available in 3-wires mode.
MEMSIC MMC5983MA Rev A Page 8 of 20 Formal release date: 4/3/2019

| ABSOLUTE MAXIMUM RATINGS*     |     |     |     |     | Ordering Guide:  |
| ----------------------------- | --- | --- | --- | --- | ---------------- |
| Supply Voltage -0.5 to +3.6V  |     |     |     |     |                  |
Storage Temperature -55C to +125C
MMC5983MA
Maximum Exposed Field 10000 G
Package type:
*Note: Stresses above those listed under Absolute Maximum
Code  Type
Ratings may cause permanent damage to the device.  This is
LGA16
a stress rating only; the functional operation of the device at  A
RoHS compliant
these or any other conditions above those indicated in the

| operational  | sections      | of  this  specification  | is  not             | implied.   |     |
| ------------ | ------------- | ------------------------ | ------------------- | ---------- | --- |
| Exposure     | to  absolute  | maximum                  | rating  conditions  | for        |     |
extended periods may affect the device’s reliability.  Performance Grade:
Pin Description: LGA Package  Code  Performance Grade
M  Industrial Grade

| Pin  | Name  | Description  |     | I/O  |     |
| ---- | ----- | ------------ | --- | ---- | --- |
I2C address
Serial Clock Line for
| 1   | SCL/SPI_SCK  |     |     | I   |     |
| --- | ------------ | --- | --- | --- | --- |
I2C/SPI bus
Code  7bits address
3  0110000
| 2   | VDD  | Power Supply  |     | P   |     |
| --- | ---- | ------------- | --- | --- | --- |

| 3   | NC  | Not Connected         |     | NC  |     |
| --- | --- | --------------------- | --- | --- | --- |
|     |     | Chip Select line for  |     |     |     |
SPI (active low). Tie
| 4   | SPI_CS  |                  |     | I   |                        |
| --- | ------- | ---------------- | --- | --- | ---------------------- |
|     |         | to VDDIO for IC² |     |     | Marking illustration:  |
Interface

| 5   | SPI_SDO  | SPI Serial Data Out  |     | O   |     |
| --- | -------- | -------------------- | --- | --- | --- |

| 6   | NC   | Not Connected      |     | NC  |     |
| --- | ---- | ------------------ | --- | --- | --- |
| 7   | NC   | Not Connected      |     | NC  |     |
| 8   | NC   | Not Connected      |     | NC  |     |
| 9   | GND  | Connect to Ground  |     | P   |     |
Connect a 10uF
| 10  | CAP  | capacitor for  |     | P   |     |
| --- | ---- | -------------- | --- | --- | --- |
SET/RESET

| 11  | GND  | Connect to Ground  |     | P   |     |
| --- | ---- | ------------------ | --- | --- | --- |

Note: Coordinates shown above indicate polarity after
| 12  | NC  | Not Connected  |     | NC  |     |
| --- | --- | -------------- | --- | --- | --- |
a SET operation.
|     |        | Power supply for I2C  |     |     |     |
| --- | ------ | --------------------- | --- | --- | --- |
| 13  | VDDIO  |                       |     | P   |     |
and INT  The black dot on top-right marks the location of pin one
(1). The 1st line represents the device’s Name. The 2nd
| 14  | NC  | Not Connected  |     | NC  |     |
| --- | --- | -------------- | --- | --- | --- |
line represents the device’s Lot Number.

| 15  | INT  | Interrupt Output   |     | O   |     |
| --- | ---- | ------------------ | --- | --- | --- |
Serial Data Line for
| 16  | SDA/SPI_SDI  |     |     | I/O  |     |
| --- | ------------ | --- | --- | ---- | --- |
I2C/SPI bus
All parts are shipped in tape and reel packaging with
5000pcs per 13” reel.
Caution:
This is an Electro-Static Discharge (ESD) sensitive
device.

MEMSIC MMC5983MA Rev A  Page 9 of 20    Formal release date: 4/3/2019

THEORY OF OPERATION
IDS_IPS/ADS
The Anisotropic Magneto-Resistive (AMR) sensors are
OIDDV
special resistors made of permalloy thin film deposited  2 .7 K 2 .7 K
TNI CN
| on  | a silicon  | wafer. During manufacturing, a strong  |     |     |     |     |     |     |     |     |     |     |     |     |
| --- | ---------- | -------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
magnetic field is applied to the film to orient its magnetic
|          |     |          |       |             |     |               |     |     |     |     | 1 6 1 5 | 1 4 1 3 |     |     |
| -------- | --- | -------- | ----- | ----------- | --- | ------------- | --- | --- | --- | --- | ------- | ------- | --- | --- |
| domains  |     | in  the  | same  | direction,  |     | establishing  | a   |     |     |     |         |         |     |     |
magnetization  vector.  Subsequently,  an  external  1 1 2 N C
|     |     |     |     |     |     |     |     | P2 o w e3 r.6 | S C L /S | P I_ S C K |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | ------------- | -------- | ---------- | --- | --- | --- | --- |
magnetic field applied perpendicularly to the sides of
.8 ~ V G N D
the film causes the magnetization to rotate and change  V D D 2 1 1
angle. This effect causes the film’s resistance to vary
|     |     |     |     |     |     |     |     |     |     | 3   |     |     | 1 0 C A P |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --------- | --- |
with the intensity of the applied magnetic field. The  N C 1 0 u F
1 u F
| MEMSIC  |     | AMR  | sensor  | is  | incorporated  |     | into  a  |     |     |     |     |     |         |     |
| ------- | --- | ---- | ------- | --- | ------------- | --- | -------- | --- | --- | --- | --- | --- | ------- | --- |
|         |     |      |         |     |               |     |          |     |     | 4   |     |     | 9 G N D |     |
Wheatstone bridge configuration to maximize Signal to  S P I_ C S
Noise ratio. A change in magnetic field produces a
|     |     |     |     |     |     |     |     |     |     |     | 5 6 | 7 8 |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
proportional change in differential voltage across the
|     |     |     |     |     |     |     |     |     |     |     | ODS_IPS CN | CN CN |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---------- | ----- | --- | --- |
Wheatstone bridge.
However, the influence of a strong magnetic field (more
than 10 G) in any direction could upset, or flip, the
| polarity                                                 |     | of  the  | film,  | thus  changing  |     | the  | sensor  |     |     |     |     |     |     |     |
| -------------------------------------------------------- | --- | -------- | ------ | --------------- | --- | ---- | ------- | --- | --- | --- | --- | --- | --- | --- |
| characteristics. A strong restoring magnetic field must  |     |          |        |                 |     |      |         |     |     |     |     |     |     |     |
be applied momentarily to restore, or set, the sensor
<Top View>
characteristics. The MEMSIC magnetic sensor has an  I2C Single Supply Connection
| on-chip  |     | magnetically  | coupled  |     | strap:  | a  SET/RESET  |     |     |     |     |     |     |     |     |
| -------- | --- | ------------- | -------- | --- | ------- | ------------- | --- | --- | --- | --- | --- | --- | --- | --- |
strap pulsed with a high current, to provide the restoring
magnetic field
IDS_IPS/ADS
VIO
OIDDV
| EXTERNAL CIRCUITRY CONNECTION  |     |     |     |     |     |     |     |     |     |     |     |     | 2.8~3.6V |     |
| ------------------------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | -------- | --- |
TNI CN
| The MMC5983MA  |     |     | was designed for  |     |     | flexible  | power  |     |     |     |       |     |     |     |
| -------------- | --- | --- | ----------------- | --- | --- | --------- | ------ | --- | --- | --- | ----- | --- | --- | --- |
|                |     |     |                   |     |     |           |        |     |     | 16  | 15 14 | 13  |     |     |
connections to support existing and new designs. It can
operate from a single 2.8V to 3.6V supply or from dual
|     |     |     |     |     |     |     |     |     | SCL/SPI_SCK | 1   |     |     | 12 NC |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ----------- | --- | --- | --- | ----- | --- |
supplies using a 2.8V to 3.6V VDD supply and a 2.8V
|                                                        |     |     |     |     |     |     |     | Power | VDD |     |     |     | GND |     |
| ------------------------------------------------------ | --- | --- | --- | --- | --- | --- | --- | ----- | --- | --- | --- | --- | --- | --- |
| to 3.6V VDDIO supply. The circuit connection diagrams  |     |     |     |     |     |     |     |       |     | 2   |     |     | 11  |     |
2.8~3.6V
below illustrate power supply connection options.
|     |     |     |     |     |     |     |     |     |     | NC 3 |     |     | 10 CAP |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | --- | --- | ------ | --- |
10uF
|     |     |     |     |     |     | V2 IO |     | 1uF |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | ----- | --- | --- | --- | --- | --- | --- | --- | --- |
DI
|     |     |     |     | S   |     | .8 ~ | 3 .6 V |     | SPI_CS | 4   |     |     | 9 GND |     |
| --- | --- | --- | --- | --- | --- | ---- | ------ | --- | ------ | --- | --- | --- | ----- | --- |
PI _
|     |     |      | 2 .7 K | S   | O   |     |     |     |     |     |     |     |     |     |
| --- | --- | ---- | ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|     | 2   | .7 K |        | A/  | DI  |     |     |     |     |     |     |     |     |     |
|     |     |      |        | D T | C D |     |     |     |     |     |     |     |     |     |
|     |     |      |        | S N | N V |     |     |     |     | 5   | 6 7 | 8   |     |     |
I
ODS_IPS
|     |          |            | 1   | 6 1 5 1 | 4 1 3 |       |     |     |     |     | CN CN | CN  |     |     |
| --- | -------- | ---------- | --- | ------- | ----- | ----- | --- | --- | --- | --- | ----- | --- | --- | --- |
|     |          |            | 1   |         |       | 1 2 N | C   |     |     |     |       |     |     |     |
|     | S C L /S | P I_ S C K |     |         |       |       |     |     |     |     |       |     |     |     |
| P2  | o w e r  | V D D      |     |         |       | G     | N D |     |     |     |       |     |     |     |
|     |          |            | 2   |         |       | 1 1   |     |     |     |     |       |     |     |     |
.8 ~ 3 .6 V
|     |       |            |     |     |     | C   | A P     |     |                             | <Top View>  |     |     |     |     |
| --- | ----- | ---------- | --- | --- | --- | --- | ------- | --- | --------------------------- | ----------- | --- | --- | --- | --- |
|     |       | N C        | 3   |     |     | 1 0 |         |     |                             |             |     |     |     |     |
|     | 1 u F |            |     |     |     |     | 1 0 u F |     | SPI Dual Supply Connection  |             |     |     |     |     |
|     |       |            |     |     |     | G   | N D     |     |                             |             |     |     |     |     |
|     |       |            | 4   |     |     | 9   |         |     |                             |             |     |     |     |     |
|     |       | S P I_ C S |     |     |     |     |         |     |                             |             |     |     |     |     |

|     |     |     | 5   | 6   | 7 8 |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|     |     |     | O   | C   | C C |     |     |     |     |     |     |     |     |     |
|     |     |     | D   | N   | N N |     |     |     |     |     |     |     |     |     |
_ S
PI
S

<Top View>
I2C Dual Supply Connection
MEMSIC MMC5983MA Rev A  Page 10 of 20    Formal release date: 4/3/2019

MEMSIC MMC5983MA Rev A Page 11 of 20 Formal release date: 4/3/2019
S P
V D
N
I_ C
D
C
S
1
2
3
4
1 6
5
1 5
6
1 4
7
1 3
8
1 2
1 1
1 0
9
N
G
C
G
C
N
A
N
D
P
D
DI
S
_ PI
S O
A/ DI
S D I N T N C V D
O C C C D N N N
S
_ PI
S
P2 o w
.8 ~
e3 r.6
V
1 u F
S C L /S P I_ S C K
1 0 u F
PIN DESCRIPTIONS
CAP– This is the supply input for SET/RESET coil.
MEMSIC recommends a minimum 10 uF low ESR
capacitor placed in close proximity to the CAP pin.
GND– This is the ground pin for the magnetic sensor.
SDA/SPI_SDI – This pin is the I2C/SPI serial data line,
and operates in I2C FAST (400 KHz)/SPI mode.
SCL/SPI_SCK– This pin is the I2C/SPI serial clock line,
and operates in FAST (400 KHz)/SPI mode.
SPI_CS – This pin is chip select line for SPI (active
low). Tie to VDDIO for IC² Interface .
SPI_SDO – This pin the SPI serial data out line.
VDD–This pin is the power supply of the ASIC.
VDDIO–This pin is the power supply of the digital
interface of the ASIC.
INT– This pin is Interrupt output. Active High. It is held
as hi-Z until an interrupt function is enabled.
Note: VDD and CAP pins are shorted together inside
the device.
<Top View>
SPI Single Supply Connection

HARDWARE DESIGN CONSIDERATIONS  The I2C (or Inter IC bus) is an industry standard bi-
  Provide adequate separation distance to devices  directional two-wire interface bus. A master I2C device
|       |          |            |          |     |               | can  operate  | READ/WRITE  |     | and  | control  up  to  128  |
| ----- | -------- | ---------- | -------- | --- | ------------- | ------------- | ----------- | --- | ---- | --------------------- |
| that  | contain  | permanent  | magnets  |     | or  generate  |               |             |     |      |                       |
devices by device addressing. The MEMSIC magnetic
| magnetic  |     | fields  (e.g.  | speakers,  | coils,  | inductors)  |     |     |     |     |     |
| --------- | --- | -------------- | ---------- | ------- | ----------- | --- | --- | --- | --- | --- |
The combined magnetic field to be measured and  sensor  operates  only  in  a  slave  mode,  i.e.  only
responding to calls by a Master device to its address.
interference magnetic field should be less than the
full scale range of the MMC5983MA.
I2C BUS CHARACTERISTICS
  Provide adequate separation distance to current
| carrying  | traces.  | Do  | not  route  | current  | carrying  |     |     |     |     |     |
| --------- | -------- | --- | ----------- | -------- | --------- | --- | --- | --- | --- | --- |
VDD
| traces under the sensor or on the other side of the  |     |     |     |     |     |     |     |     |     |     |
| ---------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

PCB opposite to the device.

|     |     |     |     |     |     |     |     | Rp  | Rp  |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  Do not cover the sensor with magnetized material

or materials that may become magnetized, (e.g.,
  SDA (Serial Data Line)
shield box, LCD, battery, iron bearing materials).

  Do not place the device opposite to magnetized  SCL (Serial Clock Line)

| materials  |     | or  materials  | that  | may  | become  |     |     |     |     |     |
| ---------- | --- | -------------- | ----- | ---- | ------- | --- | --- | --- | --- | --- |

| magnetized located on the other side of the PCB.   |        |             |           |         |         |     |     |           |     |           |
| -------------------------------------------------- | ------ | ----------- | --------- | ------- | ------- | --- | --- | --------- | --- | --------- |
| Please                                             | refer  | to  MEMSIC  | magnetic  | sensor  | layout  |     |     |           |     |           |
|                                                    |        |             |           |         |         |     |     |           |     |           |
| guideline.                                         |        |             |           |         |         |     |     |           |     |           |
|                                                    |        |             |           |         |         |     |     | DEVICE 1  |     | DEVICE 2  |

POWER CONSUMPTION
| The power consumed by the device is proportional to  |     |     |     |     |     |     |     |     |     |     |
| ---------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
the number of measurements taken per second. For  The two wires in the I2C bus are called SDA (serial data
example, when BW<1:0> = 00, which is 16-bit mode  line) and SCL (serial clock line). In order for a data
with 10ms per measurement, MMC5983MA consumes  transfer to start, the bus has to be free, which is defined
450 µA (typical) at 3.0 V with 7 measurements per  by both wires in a HIGH output state. Due to the open-
second. If only 2 measurements are performed per  drain / pull-up resistor structure and wired Boolean
second, the current will be 450 * 2 / 7 = 128 µA.  “AND” operation, any device on the bus can pull lines
low and overwrite a HIGH signal. The data on the SDA
I2C INTERFACE DESCRIPTION  line has to be stable during the HIGH period of the SCL
line. In other words, valid data can only change when
A slave mode I2C circuit has been implemented into the
MEMSIC magnetic sensor as a standard interface for  the SCL line is LOW.
| customer applications. The A/D converter functionality  |     |     |     |     |     |     |     |     |     |     |
| ------------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Note:  Rp selection guide: 2.7K ohm for an I2C bus less
| has  been  | added  | to  the  | MEMSIC  | sensor,  | thereby  |     |     |     |     |     |
| ---------- | ------ | -------- | ------- | -------- | -------- | --- | --- | --- | --- | --- |
than 10 cm length, and 10K ohm for a bus length less
| increasing                                       | ease-of-use,  |     | and  | lowering  | power  |             |     |     |     |     |
| ------------------------------------------------ | ------------- | --- | ---- | --------- | ------ | ----------- | --- | --- | --- | --- |
| consumption, footprint and total solution cost.  |               |     |      |           |        | than 5 cm.  |     |     |     |     |

MEMSIC MMC5983MA Rev A  Page 12 of 20    Formal release date: 4/3/2019

REGISTER MAP
| Register Name       |     | Address  |     | Description                      |     |     |     |     |
| ------------------- | --- | -------- | --- | -------------------------------- | --- | --- | --- | --- |
| Xout0               |     | 00H      |     | Xout [17:10]                     |     |     |     |     |
| Xout1               |     | 01H      |     | Xout [9:2]                       |     |     |     |     |
| Yout0               |     | 02H      |     | Yout [17:10]                     |     |     |     |     |
| Yout1               |     | 03H      |     | Yout [9:2]                       |     |     |     |     |
| Zout0               |     | 04H      |     | Zout [17:10]                     |     |     |     |     |
| Zout1               |     | 05H      |     | Zout [9:2]                       |     |     |     |     |
| XYZout2             |     | 06H      |     | Xout[1:0], Yout[1:0], Zout[1:0]  |     |     |     |     |
| Tout                |     | 07H      |     | Temperature output               |     |     |     |     |
| Status              |     | 08H      |     | Device status                    |     |     |     |     |
| Internal control 0  |     | 09H      |     | Control register 0               |     |     |     |     |
| Internal control 1  |     | 0AH      |     | Control register 1               |     |     |     |     |
| Internal control 2  |     | 0BH      |     | Control register 2               |     |     |     |     |
| Internal control 3  |     | 0CH      |     | Control register 3               |     |     |     |     |
| Product ID 1        |     | 2FH      |     | Product ID                       |     |     |     |     |

Register Details
Xout0, Xout1, XYZout2
| Xout0      | 7   | 6   | 5   | 4            | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | ------------ | --- | --- | --- | --- |
| Addr: 00H  |     |     |     | Xout[17:10]  |     |     |     |     |
| Mode       |     |     |     | R            |     |     |     |     |

| Xout1      | 7   | 6   | 5   | 4          | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | ---------- | --- | --- | --- | --- |
| Addr: 01H  |     |     |     | Xout[9:2]  |     |     |     |     |
| Mode       |     |     |     | R          |     |     |     |     |

| XYZout2    | 7          | 6   | 5          | 4   | 3          | 2   | 1   | 0   |
| ---------- | ---------- | --- | ---------- | --- | ---------- | --- | --- | --- |
| Addr: 06H  | Xout[1:0]  |     | Yout[1:0]  |     | Zout[1:0]  |     | 0   | 0   |
| Mode       |            |     |            | R   |            |     |     |     |

X-axis output, unsigned format.
X-axis output  Data
| 16bits operation mode  |     |     | Xout[17:2]  |     |     |     |     |     |
| ---------------------- | --- | --- | ----------- | --- | --- | --- | --- | --- |
| 18bits operation mode  |     |     | Xout[17:0]  |     |     |     |     |     |

Yout0, Yout1, XYZout2
| Yout0      | 7   | 6   | 5   | 4            | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | ------------ | --- | --- | --- | --- |
| Addr: 02H  |     |     |     | Yout[17:10]  |     |     |     |     |
| Mode       |     |     |     | R            |     |     |     |     |

| Yout1      | 7   | 6   | 5   | 4          | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | ---------- | --- | --- | --- | --- |
| Addr: 03H  |     |     |     | Yout[9:2]  |     |     |     |     |
| Mode       |     |     |     | R          |     |     |     |     |

| XYZout2    | 7          | 6   | 5          | 4   | 3          | 2   | 1   | 0   |
| ---------- | ---------- | --- | ---------- | --- | ---------- | --- | --- | --- |
| Addr: 06H  | Xout[1:0]  |     | Yout[1:0]  |     | Zout[1:0]  |     | 0   | 0   |
| Mode       |            |     |            | R   |            |     |     |     |

Y-axis output, unsigned format.
Y-axis output  Data
| 16bits operation mode  |     |     | Yout[17:2]  |     |     |     |     |     |
| ---------------------- | --- | --- | ----------- | --- | --- | --- | --- | --- |
| 18bits operation mode  |     |     | Yout[17:0]  |     |     |     |     |     |

MEMSIC MMC5983MA Rev A  Page 13 of 20    Formal release date: 4/3/2019

Zout0, Zout1, XYZout2
| Zout0      |     | 7   | 6   | 5   | 4            | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | --- | ------------ | --- | --- | --- | --- |
| Addr: 04H  |     |     |     |     | Zout[17:10]  |     |     |     |     |
| Mode       |     |     |     |     | R            |     |     |     |     |

| Zout1      |     | 7   | 6   | 5   | 4          | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | --- | ---------- | --- | --- | --- | --- |
| Addr: 05H  |     |     |     |     | Zout[9:2]  |     |     |     |     |
| Mode       |     |     |     |     | R          |     |     |     |     |

| XYZout2    |     | 7          | 6   | 5          | 4   | 3          | 2   | 1   | 0   |
| ---------- | --- | ---------- | --- | ---------- | --- | ---------- | --- | --- | --- |
| Addr: 06H  |     | Xout[1:0]  |     | Yout[1:0]  |     | Zout[1:0]  |     | 0   | 0   |
| Mode       |     |            |     |            | R   |            |     |     |     |

Z-axis output, unsigned format.
| Z-axis output          |     |     |     |     | Data        |     |     |     |     |
| ---------------------- | --- | --- | --- | --- | ----------- | --- | --- | --- | --- |
| 16bits operation mode  |     |     |     |     | Zout[17:2]  |     |     |     |     |
| 18bits operation mode  |     |     |     |     | Zout[17:0]  |     |     |     |     |

Tout
| Tout       |     | 7   | 6   | 5   | 4          | 3   | 2   | 1   | 0   |
| ---------- | --- | --- | --- | --- | ---------- | --- | --- | --- | --- |
| Addr: 07H  |     |     |     |     | Tout[7:0]  |     |     |     |     |
| Mode       |     |     |     |     | R          |     |     |     |     |
  Temperature output, unsigned format. The range is -75~125°C, about 0.8°C/LSB, 00000000 stands for  -75°C
Status
| Device Status  |     | 7   | 6         | 5   | 4        | 3         | 2   | 1       | 0       |
| -------------- | --- | --- | --------- | --- | -------- | --------- | --- | ------- | ------- |
|                |     |     |           |     | OTP_Re   |           |     | Meas_T_ | Meas_M  |
| Addr: 08H      |     |     | Reserved  |     |          | Reserved  |     |         |         |
|                |     |     |           |     | ad_Done  |           |     | Done    | _ Done  |
| Reset Value    |     | 0   | 0         | 0   | 0        | 0         | 0   | 0       | 0       |
| Mode           |     |     |           |     | R/W      |           |     |         |         |

| Bit Name  | Description  |     |     |     |     |     |     |     |     |
| --------- | ------------ | --- | --- | --- | --- | --- | --- | --- | --- |
Indicates a measurement event of magnetic field is completed.  This bit should be checked before
reading the output. When the new measurement command is occurred, this bit turns to “0”. When
Meas_M_Done
the measurement is finished, this bit will remain “1” till next measurement. Writing 1 into this bit
will clear the corresponding interrupt.
Indicates a measurement event of temperature is completed. When the new measurement
Meas_T_Done  command is occurred, this bit turns to “0”. When the measurement is finished, this bit will remain
“1” till next measurement. Writing 1 into this bit will clear the corresponding interrupt.
OTP_Rd_Done  Indicates the chip was able to successfully read its memory.
Internal Control 0
Control
|     |     | 7   | 6   | 5   | 4   | 3   | 2   | 1   | 0   |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Register 0
INT_mea
|            |           |     | OTP   | Auto_SR |        |      |         |       |       |
| ---------- | --------- | --- | ----- | ------- | ------ | ---- | ------- | ----- | ----- |
| Addr: 09H  | Reserved  |     |       |         | Reset  | Set  | s_done_ | TM_T  | TM_M  |
|            |           |     | Read  | _en     |        |      |         |       |       |
en
| Reset Value  |     | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mode         |     | W   | W   | W   | W   | W   | W   | W   | W   |

| Bit Name  | Description   |     |     |     |     |     |     |     |     |
| --------- | ------------- | --- | --- | --- | --- | --- | --- | --- | --- |
Take magnetic field measurement, set ‘1’ will initiate measurement. This bit will be automatically
TM_M
reset to 0 at the end of each measurement.
Take Temperature measurement, set ‘1’ will initiate measurement. This bit will be automatically
TM_T
reset to 0 at the end of each measurement. This bit and TM_M cannot be high at the same time.
MEMSIC MMC5983MA Rev A  Page 14 of 20    Formal release date: 4/3/2019

INT_meas_do Writing “1” will enable the interrupt for completed measurements. Once a measurement is finished,
ne_en  either magnetic field or temperature, an interrupt will be sent to the host.
Writing “1”will cause the chip to do the Set operation, which will allow large set current to flow
Set
through the sensor coils for 500ns. This bit is self-cleared at the end of Set operation.
Writing “1” will cause the chip to do the Reset operation, which will allow large reset current to flow
Reset
through the sensor coils for 500ns. This bit is self-cleared at the end of Reset operation.
| Auto_SR_en  | Writing “1” will enable the feature of automatic set/reset.  |     |     |     |     |     |     |     |     |     |
| ----------- | ------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Writing “1” will let the device to read the OTP data again. This bit will be automatically reset to 0
OTP Read
after the shadow registers for OTP are refreshed.
Internal Control 1
| Control  | 7   | 6   |     | 5   | 4   | 3   | 2   |     | 1   | 0   |
| -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Register 1
|     | SW_  |     | Reserved  |     | YZ-inhibit  |     | X-inhibit  |     | BW1  | BW0  |
| --- | ---- | --- | --------- | --- | ----------- | --- | ---------- | --- | ---- | ---- |
Addr: 0AH
RST
| Reset Value  | 0   | 0   |     | 0   | 0   | 0   | 0   |     | 0   | 0   |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mode         | W   | W   |     | W   | W   | W   | W   |     | W   | W   |

| Bit Name  |     |     |     |     | Description  |     |     |     |     |     |
| --------- | --- | --- | --- | --- | ------------ | --- | --- | --- | --- | --- |
Output resolution
|     | BW1  BW0  |     | Measurement Time  |     | Bandwidth  |     |     |     |     |     |
| --- | --------- | --- | ----------------- | --- | ---------- | --- | --- | --- | --- | --- |
|     | 0  0      |     | 8ms               |     | 100Hz      |     |     |     |     |     |
|     | 0  1      |     | 4ms               |     | 200Hz      |     |     |     |     |     |
BW0&
|     | 1  0  |     | 2ms  |     | 400Hz  |     |     |     |     |     |
| --- | ----- | --- | ---- | --- | ------ | --- | --- | --- | --- | --- |
BW1
|     | 1  1  |     | 0.5ms  |     | 800Hz  |     |     |     |     |     |
| --- | ----- | --- | ------ | --- | ------ | --- | --- | --- | --- | --- |
Note: X/Y/Z channel measurements are taken in parallel.
These bandwidth selection bits adjust the length of the decimation filter. They control the duration
of each measurement.

Writing “1” will disable X channel.
X-inhibit

Writing “1” to the two bits will disable Y and Z channel.
Y/Z-inhibit
Writing “1”will cause the part to reset, similar to power-up. It will clear all registers and also re-
SW_RST
read OTP as part of its startup routine. The power on time is 10mS.
Internal Control 2

| Control  | 7   | 6   |     | 5   | 4   | 3   | 2   |     | 1   | 0   |
| -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Register 2
|     | En_prd_s |     | Prd_set[2:0]  |     |     | Cmm_en  |     | Cm_freq[2:0]  |     |     |
| --- | -------- | --- | ------------- | --- | --- | ------- | --- | ------------- | --- | --- |
Addr: 0BH
et
| Reset Value  | 0   | 0   |     | 0   | 0   | 0   | 0   |     | 0   | 0   |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mode         | W   | W   |     | W   | W   | W   | W   |     | W   | W   |
MEMSIC MMC5983MA Rev A  Page 15 of 20    Formal release date: 4/3/2019

| Bit Name  |     |     |     | Description  |     |     |     |     |
| --------- | --- | --- | --- | ------------ | --- | --- | --- | --- |
These bits determine how often the chip will take measurements in Continuous
Measurement Mode. The frequency is based on the assumption that BW[1:0] = 00.

|     | CM_Freq [2:0]  |     | Frequency (Typical)                   |     |     |     |     |     |
| --- | -------------- | --- | ------------------------------------- | --- | --- | --- | --- | --- |
|     | 000            |     | Continuous Measurement Mode is off.   |     |     |     |     |     |

|     | 001  |     | 1Hz  |     |     |     |     |     |
| --- | ---- | --- | ---- | --- | --- | --- | --- | --- |
CM_Freq[2:0]
|     | 010          |     | 10 Hz    |     |     |     |     |     |
| --- | ------------ | --- | -------- | --- | --- | --- | --- | --- |
|     | 011          |     | 20Hz     |     |     |     |     |     |
|     | 100          |     | 50 Hz    |     |     |     |     |     |
|     | 101          |     | 100 Hz   |     |     |     |     |     |
|     | 110 (BW=01)  |     | 200Hz    |     |     |     |     |     |
|     | 111 (BW=11)  |     | 1000 Hz  |     |     |     |     |     |
Writing “1” will enable the continuous mode. In order to enter the continuous mode,
Cmm_en
CM_Freq[2:0] cannot be 000.
These bits determine how often the chip will do a set operation. The device will perform a
SET automatically per the setting in below table.

|     | Prd_set [2:0]  |     | Times of measurement  |     |     |     |     |     |
| --- | -------------- | --- | --------------------- | --- | --- | --- | --- | --- |

|     | 000  |     | 1   |     |     |     |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- | --- |
|     | 001  |     | 25  |     |     |     |     |     |

| Prd_set[2:0]  | 010  |     | 75   |     |     |     |     |     |
| ------------- | ---- | --- | ---- | --- | --- | --- | --- | --- |
|               | 011  |     | 100  |     |     |     |     |     |
|               | 100  |     | 250  |     |     |     |     |     |

|     | 101  |     | 500   |     |     |     |     |     |
| --- | ---- | --- | ----- | --- | --- | --- | --- | --- |
|     | 110  |     | 1000  |     |     |     |     |     |

|     | 111  |     | 2000  |     |     |     |     |     |
| --- | ---- | --- | ----- | --- | --- | --- | --- | --- |

Writing “1” will enable the feature of periodic set. This feature needs to work with both
En_prd_set
Auto_SR_en and Cmm_en bits set to 1.
Internal Control 3
Control
|     | 7   | 6   | 5   | 4   | 3   | 2   | 1   | 0   |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
Register 3
Addr: 0CH  reserved  Spi_3w  reserved  St_enm  St_enp  reserved
| Reset Value  | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| ------------ | --- | --- | --- | --- | --- | --- | --- | --- |
| Mode         | W   | W   | W   | W   | W   | W   | W   | W   |

| Bit Name  Description   |     |     |     |     |     |     |     |     |
| ----------------------- | --- | --- | --- | --- | --- | --- | --- | --- |
Writing “1” will apply an extra current flowing from the positive end to the negative end of an
internal coil and result in an extra magnetic field. This feature can be used to check whether the
St_enp
sensor has been saturated.

Writing “1” will apply an extra current flowing from the negative end to the positive end of an
internal coil and result in an extra magnetic field. This feature can be used to check whether the
St_enm
sensor has been saturated.

Spi_3w  Writing a 1 into this location will put the device into 3-wire SPI mode.
Product ID1
| Product ID 1  | 7   | 6   | 5   | 4                 | 3   | 2   | 1   | 0   |
| ------------- | --- | --- | --- | ----------------- | --- | --- | --- | --- |
| Addr: 2FH     |     |     |     | Product ID1[7:0]  |     |     |     |     |
| Reset Value   | 0   | 0   | 1   | 1                 | 0   | 0   | 0   | 0   |
| Mode          | R   | R   | R   | R                 | R   | R   | R   | R   |
MEMSIC MMC5983MA Rev A  Page 16 of 20    Formal release date: 4/3/2019

4thcycle: The Master device sends a START command
DATA TRANSFER followed by the MEMSIC device’s seven bit address,
and finally the eighth bit set low to indicate a WRITE.
A data transfer is started with a “START” condition and
An Acknowledge should be send by the MEMSIC
ended with a “STOP” condition. A “START” condition is
device in response.
defined by a HIGH to LOW transition on the SDA line
while SCL line is HIGH. A “STOP” condition is defined 5thcycle: The Master device sends the MEMSIC
by a LOW to HIGH transition on the SDA line while the device’s Status Register [00001000] as the address to
SCL line is held HIGH. All data transfer in I2C system read.
are 8-bits long. Each byte has to be followed by an
6thcycle: The Master device sends a START command
acknowledge bit. Each data transfer involves a total of
followed by the MEMSIC device’s seven bit address,
9 clock cycles. Data is transferred starting with the most
and finally the eighth bit set high to indicate a
significant bit (MSB).
READ. An Acknowledge should be send by the
After a START condition, the Master device calls a MEMSIC device in response.
specific slave device by sending its 7-bit address with
7th cycle: The Master device cycles the SCL line. This
the 8th bit (LSB) indicating that either a READ or WRITE
causes the Status Register data to appear on SDA line.
operation will follow, [1] for READ and [0] for WRITE.
Continuously read the Status Register until the
The MEMSIC device 7-bit device address is [0110000].
Meas_M_Done bit (bit 0) is set to ‘1’.or check INT pin
The initial addressing of the slave is always followed by status. This indicates that data for the x, y, and z
the master writing the number of the slave register to sensors is available to be read.
be read or written, so this initial addressing always
8thcycle: The Master device sends a START command
indicates a WRITE operation by sending [01100000].
followed by the MEMSIC device’s seven bit address,
After being addressed, the MEMSIC device being
and finally the eighth bit set low to indicate a WRITE.
called should respond by an “Acknowledge” signal by
An Acknowledge should be send by the MEMSIC
pulling SDA line LOW. Subsequent communication
device in response.
bytes can either be
a) The data to be written to the device register, or 9thcycle: The Master device sends a [00000000] (Xout
LSB register address) as the register address to read.
b) Another START condition followed by the device
address indicating a READ operation [01100001], 10thcycle: The Master device calls the MEMSIC
and then the master reads the register data. device’s address with a READ (8th SCL cycle SDA line
high). An Acknowledge should be send by the MEMSIC
Multiple data bytes can be written or read to numerically
device in response.
sequential registers without the need of another START
condition. Data transfer is terminated by a STOP 11thcycle: Master device continues to cycle the SCL
condition or another START condition. Two detailed line, and each consecutive byte of data from the X, Y
examples of communicating with the MEMSIC device and Z registers should appear on the SDA line. The
are listed below for the actions of acquiring a magnetic internal memory address pointer automatically moves
field measurement and magnetizing the sensor. to the next byte. The Master device acknowledges
each. Thus:
EXAMPLE MEASUREMENT
12thcycle: Xout[17:10].
1st cycle: A START condition is established by the
13thcycle: Xout[9:2].
Master device followed by a call to the slave address
[0110000] with the eighth bit held low to indicate a 14thcycle: Yout[17:10].
WRITE request.
15thcycle: Yout[9:2].
2nd cycle: After an acknowledge signal is received by
16thcycle: Zout[17:10].
the Master device (MEMSIC device pulls SDA line low
during 9th SCL pulse), the Master device sends the 17thcycle: Zout[9:2].
address of Control Register 0 or [00001001] as the
18th cycle: Xout[1:0], Yout[1:0], Zout[1:0] for 18bits
target register to be written. The MEMSIC device
mode.
should acknowledge receipt of the address (9th SCL
pulse, SDA pulled low). Master ends communications by NOT sending an
‘Acknowledge’ and also follows with a ‘STOP’
3rdcycle: The Master device writes to the Internal
command.
Control Register 0 the code [00000001] (TM_M high) to
initiate data acquisition. The MEMSIC device should
send an Acknowledge and internally initiate a
measurement (collect x, y and z data). A STOP
condition indicates the end of the write operation.
MEMSIC MMC5983MA Rev A Page 17 of 20 Formal release date: 4/3/2019

| EXAMPLE OF SET  |     |     | USING SET AND RESET TO REMOVE BRIDGE  |     |     |     |     |     |     |
| --------------- | --- | --- | ------------------------------------- | --- | --- | --- | --- | --- | --- |
OFFSET
1st cycle: A START condition is established by the
Master Device followed by a call to the slave address  The  integrated  SET  and  RESET  functions  of  the
[0110000] with the eighth bit held low to indicate a  MMC5893VA enables the user to remove the error
WRITE request.   associated with bridge Offset change as a function of
temperature, thereby enabling more precise heading
2nd cycle: After an acknowledge signal is received by
|     |     |     | measurements  |     | over  a  | wider  | temperature  |     | than  |
| --- | --- | --- | ------------- | --- | -------- | ------ | ------------ | --- | ----- |
the Master device (The MEMSIC device pulls the SDA
|     |     |     | competitive  | technologies.  |     | The  | SET  | and  | RESET  |
| --- | --- | --- | ------------ | -------------- | --- | ---- | ---- | ---- | ------ |
line low during the 9th SCL pulse), the Master device
|                    |                  |                     | functions  | effectively  | alternately  |     | flip  | the  | magnetic  |
| ------------------ | ---------------- | ------------------- | ---------- | ------------ | ------------ | --- | ----- | ---- | --------- |
| sends  [00001001]  | as  the  target  | address  (Internal  |            |              |              |     |       |      |           |
sensing polarity of the sensing elements of the device.
| Control  Register  | 0).  The  MEMSIC  | device  should  |     |     |     |     |     |     |     |
| ------------------ | ----------------- | --------------- | --- | --- | --- | --- | --- | --- | --- |
acknowledge receipt of the address (9th SCL pulse).   1)  The most accurate magnetic field measurements
can be obtained by using the protocol described
3rd cycle: The Master device writes to the MEMSIC
as follows: Perform SET. This sets the internal
device’s Internal Control 0 register the code [00001000]
|     |     |     | magnetization  |     | of  the  | sensing  |     | resistors  | in  the  |
| --- | --- | --- | -------------- | --- | -------- | -------- | --- | ---------- | -------- |
(SET bit) to initiate a SET action. The MEMSIC device
direction of the SET field.
should send an Acknowledge.
|     |     |     | 2)  Perform  | MEASUREMENT.  |     |     |   This  | measurement  |     |
| --- | --- | --- | ------------ | ------------- | --- | --- | ------- | ------------ | --- |
EXAMPLE OF RESET   will contain not only the sensors response to the
external magnetic field, H, but also the Offset; in
1st cycle: A START condition is established by the
other words,
Master device followed by a call to the slave address
[0110000] with the eighth bit held low to indicate a  Output1 = +H + Offset.
WRITE request
|     |     |     | 3)  Perform  | RESET.  |     | This  | resets  | the  | internal  |
| --- | --- | --- | ------------ | ------- | --- | ----- | ------- | ---- | --------- |
2nd cycle: After an acknowledge signal is received by  magnetization  of  the  sensing  resistors  in  the
the Master device (The MEMSIC device pulls the SDA  direction of the RESET field, which is opposite to
line low during the 9th SCL pulse), the Master device  the SET field (180o opposed).
| sends  [00001001]  | as  the  target   | address  (Internal  |              |               |            |          |         |              |          |
| ------------------ | ----------------- | ------------------- | ------------ | ------------- | ---------- | -------- | ------- | ------------ | -------- |
|                    |                   |                     | 4)  Perform  | MEASUREMENT.  |            |          |   This  | measurement  |          |
| Control  Register  | 0).  The  MEMSIC  | device  should      |              |               |            |          |         |              |          |
|                    |                   |                     | will         | contain       | both  the  | sensors  |         | response     | to  the  |
acknowledge receipt of the address (9th SCL pulse).
external field and also the Offset.  In other words,
3rd cycle: The Master device writes to the MEMSIC  Output2 = -H + Offset.
device’s Internal Control 0 register the code [00010000]
(RESET bit) to initiate a RESET action. The MEMSIC  5)  Finally,  calculate  H  by  subtracting  the  two
measurements and dividing by 2. This procedure
device should send an Acknowledge.
|     |     |     | effectively  |     | eliminates  | the  | Offset  |     | from  the  |
| --- | --- | --- | ------------ | --- | ----------- | ---- | ------- | --- | ---------- |
At this point, the MEMSIC AMR sensors have been
measurement and therefore any changes in the
conditioned  for  optimum  performance  and  data  Offset over temperature.
measurements can commence.
Note: To calculate and store the offset; add the two
Note: The RESET action can be skipped for most
measurements and divide by 2. This calculated offset
| applications  |     |     | value  can    | be  | subtracted  |     | from      |     | subsequent  |
| ------------- | --- | --- | ------------- | --- | ----------- | --- | --------- | --- | ----------- |
|               |     |     | measurements  |     | to  obtain  | H   | directly  |     | from  each  |

measurement.

MEMSIC MMC5983MA Rev A  Page 18 of 20    Formal release date: 4/3/2019

SOLDERING RECOMMENDATIONS
MEMSIC magnetic sensor is capable of withstanding an MSL3 / 260Cº solder reflow. Following is the reflow profile:
Note:
 This is the reflow profile for Pb free process
 The peak temperature on the sensor surface should be limited under 260℃ for no more than 10 seconds.
 Reflow conditions recommended by solder paste should be followed to get the best SMT quality.
 Maximum 3 SMT cycles
 Second and third reflow cycle should be applied after device has cooled down to 25℃ (room temperature)
 If the part is mounted manually, please ensure the temperature does not exceed 260℃ for 10 seconds.
MEMSIC MMC5983MA Rev A Page 19 of 20 Formal release date: 4/3/2019

PACKAGE DRAWING (LGA package)
LAND PATTERN
MEMSIC MMC5983MA Rev A Page 20 of 20 Formal release date: 4/3/2019