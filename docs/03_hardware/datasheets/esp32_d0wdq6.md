---
source: "/Users/juanpa/Develop/PersonalProjects/Hermes/docs/Hermes/03_hardware/datasheets/esp32_d0wdq6.pdf"
converted_at: 2026-10-25T01:51:49+00:00
size_bytes: 989523
tool: tomd
---

| ESP32 | Series |     |     |
| ----- | ------ | --- | --- |
Datasheet
|               | Version      | 5.3         |        |
| ------------- | ------------ | ----------- | ------ |
| 2.4 GHz Wi-Fi | + Bluetooth® | + Bluetooth | LE SoC |
Including:
ESP32-D0WD-V3
ESP32-U4WDH
ESP32-S0WD–NotRecommendedforNewDesigns(NRND)
ESP32-D0WD–NotRecommendedforNewDesigns(NRND)
ESP32-D0WDQ6–NotRecommendedforNewDesigns(NRND)
ESP32-D0WDQ6-V3–NotRecommendedforNewDesigns(NRND)
ESP32-D0WDR2-V3–EndofLife(EOL),upgradedtoESP32-D0WDRH2-V3
www.espressif.com

| Product Overview |     |     |     |     |
| ---------------- | --- | --- | --- | --- |
ESP32isasingle2.4GHzWi-Fi-and-BluetoothcombochipdesignedwiththeTSMClow-power40nm
technology. ItisdesignedtoachievethebestpowerandRFperformance,showingrobustness,versatilityand
reliabilityinawidevarietyofapplicationsandpowerscenarios.
Fordetailsonpartnumbersandorderinginformation,pleaserefertoSection1ESP32SeriesComparison. For
detailsonchiprevisions,pleaserefertoESP32ChipRevisionv3.0UserGuideand
ESP32SeriesSoCErrata.
ThefunctionalblockdiagramoftheSoCisshownbelow.
In-Package
|     | Flash or PSRAM | Bluetooth  |     | RF  |
| --- | -------------- | ---------- | --- | --- |
Bluetooth
link
|     |     |            | baseband | receive |
| --- | --- | ---------- | -------- | ------- |
|     | SPI | controller |          |         |
hctiwS
Clock  nulaB
|     | I2C |            |        | generator |
| --- | --- | ---------- | ------ | --------- |
|     | I2S |            | Wi-Fi  |           |
|     |     | Wi-Fi MAC  |        | RF        |
baseband
transmit
SDIO
UART
Cryptographic hardware
Core and memory
|     | TWAI® |                            |     | acceleration |
| --- | ----- | -------------------------- | --- | ------------ |
|     | ETH   | 2 (or 1) x Xtensa® 32-bit  |     |              |
LX6 Microprocessors
SHA RSA
RMT
|     | PWM | ROM | SRAM | AES RNG |
| --- | --- | --- | ---- | ------- |
Touch sensor
RTC
DAC
|     | ADC |     | ULP  | Recovery  |
| --- | --- | --- | ---- | --------- |
PMU
|     |     |     | coprocessor | memory |
| --- | --- | --- | ----------- | ------ |
Timers
ESP32FunctionalBlockDiagram
| EspressifSystems |     |     | 2   | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

Features
Wi-Fi
• 802.11b/g/n
• 802.11n(2.4GHz),upto150Mbps
• WMM
• TX/RXA-MPDU,RXA-MSDU
• ImmediateBlockACK
• Defragmentation
• AutomaticBeaconmonitoring(hardwareTSF)
• FourvirtualWi-Fiinterfaces
• SimultaneoussupportforInfrastructureStation,SoftAP,andPromiscuousmodes
NotethatwhenESP32isinStationmode,performingascan,theSoftAPchannelwillbechanged.
• Antennadiversity
Bluetooth®
• CompliantwithBluetoothv4.2BR/EDRandBluetoothLEspecifications
• Class-1,class-2andclass-3transmitterwithoutexternalpoweramplifier
• EnhancedPowerControl
• +9dBmtransmittingpower
• NZIFreceiverwith–94dBmBluetoothLEsensitivity
• AdaptiveFrequencyHopping(AFH)
• StandardHCIbasedonSDIO/SPI/UART
• High-speedUARTHCI,upto4Mbps
• Bluetooth4.2BR/EDRandBluetoothLEdualmodecontroller
• SynchronousConnection-Oriented/Extended(SCO/eSCO)
• CVSDandSBCforaudiocodec
• BluetoothPiconetandScatternet
• Multi-connectionsinClassicBluetoothandBluetoothLE
• Simultaneousadvertisingandscanning
CPUandMemory
• Xtensa® single-/dual-core32-bitLX6microprocessor(s)
• CoreMark® score:
– 1coreat240MHz: 539.98CoreMark;2.25CoreMark/MHz
EspressifSystems 3 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

– 2coresat240MHz: 1079.96CoreMark;4.50CoreMark/MHz
• 448KBROM
• 520KBSRAM
• 16KBSRAMinRTC
• QSPIsupportsmultipleflash/SRAMchips
ClocksandTimers
• Internal8MHzoscillatorwithcalibration
• InternalRCoscillatorwithcalibration
• External2MHz~60MHzcrystaloscillator(40MHzonlyforWi-Fi/Bluetoothfunctionality)
• External32kHzcrystaloscillatorforRTCwithcalibration
• Twotimergroups,including2×64-bittimersand1×mainwatchdogineachgroup
• OneRTCtimer
• RTCwatchdog
AdvancedPeripheralInterfaces
• 34programmableGPIOs
– FivestrappingGPIOs
– Sixinput-onlyGPIOs
– SixGPIOsneededforin-packageflash(ESP32-U4WDH)andin-packagePSRAM
(ESP32-D0WDRH2-V3)
• 12-bitSARADCupto18channels
• Two8-bitDAC
• 10touchsensors
• FourSPIinterfaces
• TwoI2Sinterfaces
• TwoI2Cinterfaces
• ThreeUARTinterfaces
• Onehost(SD/eMMC/SDIO)
• Oneslave(SDIO/SPI)
• Pulsecountcontroller
• EthernetMACinterfacewithdedicatedDMAandIEEE1588support
• TWAI®,compatiblewithISO11898-1(CANSpecification2.0)
• RMT(TX/RX)
EspressifSystems 4 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

•
MotorPWM
• LEDPWMupto16channels
PowerManagement
• Fine-resolutionpowercontrolthroughaselectionofclockfrequency,dutycycle,Wi-Fioperatingmodes,
andindividualpowercontrolofinternalcomponents
•
Fivepowermodesdesignedfortypicalscenarios: Active,Modem-sleep,Light-sleep,Deep-sleep,
Hibernation
•
PowerconsumptioninDeep-sleepmodeis10µA
• Ultra-Low-Power(ULP)coprocessors
•
RTCmemoryremainspoweredoninDeep-sleepmode
Security
•
Secureboot
•
Flashencryption
• 1024-bitOTP,upto768-bitforcustomers
• Cryptographichardwareacceleration:
– AES
– Hash(SHA-2)
– RSA
– RandomNumberGenerator(RNG)
Applications
Withlowpowerconsumption,ESP32isanidealchoiceforIoTdevicesinthefollowingareas:
| • SmartHome            | • AudioDevices                    |                          |
| ---------------------- | --------------------------------- | ------------------------ |
| • IndustrialAutomation | • GenericLow-powerIoTSensorHubs   |                          |
| •                      | •                                 |                          |
| HealthCare             | GenericLow-powerIoTDataLoggers    |                          |
| •                      | •                                 |                          |
| ConsumerElectronics    | CamerasforVideoStreaming          |                          |
| • SmartAgriculture     | • SpeechRecognition               |                          |
| •                      | •                                 |                          |
| POSMachines            | ImageRecognition                  |                          |
| •                      | •                                 |                          |
| ServiceRobot           | SDIOWi-Fi+BluetoothNetworkingCard |                          |
| EspressifSystems       | 5                                 | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

Contents
Note:
CheckthelinkortheQRcodetomakesurethatyouusethelatestversionofthisdocument:
https://www.espressif.com/documentation/esp32_datasheet_en.pdf
Contents
| Product | Overview |     |     |     |
| ------- | -------- | --- | --- | --- |
2
Features 3
Applications 5
| 1 ESP32 | Series | Comparison |     |     |
| ------- | ------ | ---------- | --- | --- |
11
1.1 Nomenclature 11
1.2 Comparison 11
2 Pins
12
2.1 PinLayout 12
2.2 PinOverview 14
2.3 IOPins 17
| 2.3.1 RestrictionsforGPIOsandRTC_GPIOs |     |     |     | 17  |
| -------------------------------------- | --- | --- | --- | --- |
2.4 AnalogPins 17
2.5 PowerSupply 17
| 2.5.1 PowerPins            |     |     |     | 17  |
| -------------------------- | --- | --- | --- | --- |
| 2.5.2 PowerScheme          |     |     |     | 18  |
| 2.5.3 ChipPower-upandReset |     |     |     | 19  |
2.6 PinMappingBetweenChipandFlash/PSRAM 20
| 3 Boot | Configurations |     |     |     |
| ------ | -------------- | --- | --- | --- |
22
3.1 ChipBootModeControl 23
3.2 InternalLDO(VDD_SDIO)VoltageControl 24
3.3 U0TXDPrintingControl 25
3.4 TimingControlofSDIOSlave 25
3.5 JTAGSignalSourceControl 25
| 4 Functional | Description |     |     |     |
| ------------ | ----------- | --- | --- | --- |
26
4.1 CPUandMemory 26
| 4.1.1 CPU                     |     |     |     | 26  |
| ----------------------------- | --- | --- | --- | --- |
| 4.1.2 InternalMemory          |     |     |     | 26  |
| 4.1.3 ExternalFlashandRAM     |     |     |     | 27  |
| 4.1.4 AddressMappingStructure |     |     |     | 27  |
| 4.1.5 Cache                   |     |     |     | 29  |
4.2 SystemClocks 29
| 4.2.1 CPUClock   |     |     |     | 29                       |
| ---------------- | --- | --- | --- | ------------------------ |
| EspressifSystems |     |     | 6   | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

Contents
| 4.2.2 RTCClock                                       |                 |     |     | 29  |
| ---------------------------------------------------- | --------------- | --- | --- | --- |
| 4.2.3 AudioPLLClock                                  |                 |     |     | 30  |
| 4.3 RTCandLow-powerManagement                        |                 |     |     | 30  |
| 4.3.1 PowerManagementUnit(PMU)                       |                 |     |     | 30  |
| 4.3.2 Ultra-Low-PowerCoprocessor                     |                 |     |     | 31  |
| 4.4 TimersandWatchdogs                               |                 |     |     | 31  |
| 4.4.1 GeneralPurposeTimers                           |                 |     |     | 31  |
| 4.4.2 WatchdogTimers                                 |                 |     |     | 31  |
| 4.5 CryptographicHardwareAccelerators                |                 |     |     | 32  |
| 4.6 RadioandWi-Fi                                    |                 |     |     | 32  |
| 4.6.1 2.4GHzReceiver                                 |                 |     |     | 32  |
| 4.6.2 2.4GHzTransmitter                              |                 |     |     | 33  |
| 4.6.3 ClockGenerator                                 |                 |     |     | 33  |
| 4.6.4 Wi-FiRadioandBaseband                          |                 |     |     | 33  |
| 4.6.5 Wi-FiMAC                                       |                 |     |     | 34  |
| 4.7 Bluetooth                                        |                 |     |     | 34  |
| 4.7.1 BluetoothRadioandBaseband                      |                 |     |     | 34  |
| 4.7.2 BluetoothInterface                             |                 |     |     | 34  |
| 4.7.3 BluetoothStack                                 |                 |     |     | 35  |
| 4.7.4 BluetoothLinkController                        |                 |     |     | 35  |
| 4.8 DigitalPeripherals                               |                 |     |     | 36  |
| 4.8.1 GeneralPurposeInput/OutputInterface(GPIO)      |                 |     |     | 36  |
| 4.8.2 SerialPeripheralInterface(SPI)                 |                 |     |     | 36  |
| 4.8.3 UniversalAsynchronousReceiverTransmitter(UART) |                 |     |     | 36  |
| 4.8.4 I2CInterface                                   |                 |     |     | 37  |
| 4.8.5 I2SInterface                                   |                 |     |     | 38  |
| 4.8.6 RemoteControlPeripheral                        |                 |     |     | 38  |
| 4.8.7 PulseCounterController(PCNT)                   |                 |     |     | 38  |
| 4.8.8 LEDPWMController                               |                 |     |     | 39  |
| 4.8.9 MotorControlPWM                                |                 |     |     | 39  |
| 4.8.10 SD/SDIO/MMCHostController                     |                 |     |     | 40  |
| 4.8.11 SDIO/SPISlaveController                       |                 |     |     | 41  |
| 4.8.12 TWAI®                                         | Controller      |     |     | 42  |
| 4.8.13 EthernetMACInterface                          |                 |     |     | 42  |
| 4.9 AnalogPeripherals                                |                 |     |     | 43  |
| 4.9.1 Analog-to-DigitalConverter(ADC)                |                 |     |     | 43  |
| 4.9.2 Digital-to-AnalogConverter(DAC)                |                 |     |     | 44  |
| 4.9.3 TouchSensor                                    |                 |     |     | 44  |
| 4.10 PeripheralPinConfigurations                     |                 |     |     | 46  |
| 5 Electrical                                         | Characteristics |     |     |     |
51
| 5.1 AbsoluteMaximumRatings                |     |     |                          | 51  |
| ----------------------------------------- | --- | --- | ------------------------ | --- |
| 5.2 RecommendedPowerSupplyCharacteristics |     |     |                          | 51  |
| 5.3 DCCharacteristics(3.3V,25°C)          |     |     |                          | 52  |
| 5.4 RFCurrentConsumptioninActiveMode      |     |     |                          | 52  |
| 5.5 Reliability                           |     |     |                          | 53  |
| EspressifSystems                          |     | 7   | ESP32SeriesDatasheetv5.3 |     |
SubmitDocumentationFeedback

Contents
5.6 Wi-FiRadio 53
5.7 BluetoothRadio 54
| 5.7.1 | Receiver–BasicDataRate       |     |     | 54  |
| ----- | ---------------------------- | --- | --- | --- |
| 5.7.2 | Transmitter–BasicDataRate    |     |     | 54  |
| 5.7.3 | Receiver–EnhancedDataRate    |     |     | 55  |
| 5.7.4 | Transmitter–EnhancedDataRate |     |     | 55  |
5.8 BluetoothLERadio 56
| 5.8.1 | Receiver    |     |     | 56  |
| ----- | ----------- | --- | --- | --- |
| 5.8.2 | Transmitter |     |     | 58  |
6 Packaging
59
| Related | Documentation | and Resources |     |     |
| ------- | ------------- | ------------- | --- | --- |
60
–ESP32
| Appendix | A   | Pin Lists |     |     |
| -------- | --- | --------- | --- | --- |
61
A.1. NotesonESP32PinLists 61
A.2. GPIO_Matrix 63
A.3. Ethernet_MAC 68
A.4. IO_MUX 68
| Revision | History |     |     |     |
| -------- | ------- | --- | --- | --- |
70
| EspressifSystems |     |     | 8   | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

ListofTables
List of Tables
1-1 ESP32SeriesComparison 11
2-1 PinOverview 14
2-2 AnalogPins 17
2-3 PowerPins 18
2-4 DescriptionofTimingParametersforPower-upandReset 19
2-5 Pin-to-PinMappingBetweenChipandIn-PackageFlash/PSRAM 20
2-6 Pin-to-PinMappingBetweenChipandOff-PackageFlash/PSRAM 20
3-1 DefaultConfigurationofStrappingPins 22
3-2 DescriptionofTimingParametersfortheStrappingPins 23
3-3 ChipBootModeControl 23
3-4 U0TXDPrintingControl 25
3-5 TimingControlofSDIOSlave 25
4-1 MemoryandPeripheralMapping 28
4-2 PowerConsumptionbyPowerModes 30
4-3 ADCCharacteristics 43
4-4 ADCCalibrationResults 44
4-5 Capacitive-SensingGPIOsAvailableonESP32 45
4-6 PeripheralPinConfigurations 46
5-1 AbsoluteMaximumRatings 51
5-2 RecommendedPowerSupplyCharacteristics 51
5-3 DCCharacteristics(3.3V,25°C) 52
5-4 CurrentConsumptionDependingonRFModes 52
5-5 ReliabilityQualifications 53
5-6 Wi-FiRadioCharacteristics 53
5-7 ReceiverCharacteristics–BasicDataRate 54
5-8 TransmitterCharacteristics–BasicDataRate 54
5-9 ReceiverCharacteristics–EnhancedDataRate 55
5-10 TransmitterCharacteristics–EnhancedDataRate 56
5-11 ReceiverCharacteristics–BluetoothLE 56
5-12 TransmitterCharacteristics–BluetoothLE 58
6-1 NotesonESP32PinLists 61
6-2 GPIO_Matrix 63
6-3 Ethernet_MAC 68
EspressifSystems 9 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

ListofFigures
List of Figures
1-1 ESP32SeriesNomenclature 11
2-1 ESP32PinLayout(QFN6*6,TopView) 12
2-2 ESP32PinLayout(QFN5*5,TopView) 13
2-3 ESP32PowerScheme 18
2-4 VisualizationofTimingParametersforPower-upandReset 19
3-1 VisualizationofTimingParametersfortheStrappingPins 23
3-2 ChipBootFlow 24
4-1 AddressMappingStructure 27
6-1 QFN48(6×6mm)Package 59
6-2 QFN48(5×5mm)Package 59
EspressifSystems 10 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

1 ESP32SeriesComparison
| 1 ESP32 | Series | Comparison |     |     |     |     |     |     |
| ------- | ------ | ---------- | --- | --- | --- | --- | --- | --- |
1.1 Nomenclature
|     | ESP32 | D   | 0 WD R2 | H Q6 | V3  |     |     |     |
| --- | ----- | --- | ------- | ---- | --- | --- | --- | --- |
Chip revision v3.0 or newer
Package
Q6: QFN 6*6
N/A: QFN 5*5
High temperature
In-package PSRAM
R2: 2 MB PSRAM
Connection
WD: Wi-Fi b/g/n + Bluetooth/Bluetooth LE dual mode
In-package flash
0: No in-package flash
2: 2 MB flash
4: 4 MB flash
Core
D/U: Dual core
S: Single core
Chip Series
|     |     | Figure1-1. | ESP32SeriesNomenclature |     |     |     |     |     |
| --- | --- | ---------- | ----------------------- | --- | --- | --- | --- | --- |
1.2 Comparison
|               |     |     | Table1-1. | ESP32SeriesComparison |             |     |         |           |
| ------------- | --- | --- | --------- | --------------------- | ----------- | --- | ------- | --------- |
|               |     |     |           |                       | In-Package  |     |         | VDD_SDIO  |
| PartNumber1   |     |     |           | ChipRevision2         |             |     |         |           |
|               |     |     | Core      |                       | Flash/PSRAM |     | Package | Voltage   |
| ESP32-D0WD-V3 |     |     | Dualcore  | v3.0/v3.14            | —           |     | QFN5*5  | 1.8V/3.3V |
ESP32-D0WDR2-V3(EOL)
v3.0/v3.14
|     |     |     | Dualcore |     | 2MBPSRAM |     | QFN5*5 | 3.3V |
| --- | --- | --- | -------- | --- | -------- | --- | ------ | ---- |
UpgradedtoESP32-D0WDRH2-V37
|             |     |     | Dualcore3 | v3.0/v3.14 | 4MBflash6 |     |        |      |
| ----------- | --- | --- | --------- | ---------- | --------- | --- | ------ | ---- |
| ESP32-U4WDH |     |     |           |            |           |     | QFN5*5 | 3.3V |
v3.0/v3.14
| ESP32-D0WDQ6-V3(NRND) |     |     | Dualcore   |            | —   |     | QFN6*6 | 1.8V/3.3V |
| --------------------- | --- | --- | ---------- | ---------- | --- | --- | ------ | --------- |
| ESP32-D0WD(NRND)      |     |     | Dualcore   | v1.0/v1.15 | —   |     | QFN5*5 | 1.8V/3.3V |
| ESP32-D0WDQ6(NRND)    |     |     | Dualcore   | v1.0/v1.15 | —   |     | QFN6*6 | 1.8V/3.3V |
| ESP32-S0WD(NRND)      |     |     | Singlecore | v1.0/v1.15 | —   |     | QFN5*5 | 1.8V/3.3V |
1AllabovechipssupportWi-Fib/g/n+Bluetooth/BluetoothLEDualModeconnection.
Fordetailsonchipmarkingand
packing,seeSection6Packaging.
2DifferencesbetweenESP32chiprevisionsandhowtodistinguishthemaredescribedinESP32SeriesSoCErrata.
3ESP32-U4WDHwillbeproducedasdual-coreinsteadofsinglecore.
SeePCN-2021-021fordetails.
4Thechipswillbeproducedwithchiprevisionv3.1inside. SeePCN20220901fordetails.
5Thechipswillbeproducedwithchiprevisionv1.1inside. SeePCN20220901fordetails.
6Thein-packageflashsupports:
-Morethan100,000program/erasecycles
-Morethan20yearsdataretentiontime
7ESP32-D0WDR2-V3isendoflifeandupgradedtoESP32-D0WDRH2-V3.
SeePCN20251001fordetails.
| EspressifSystems |     |     |     | 11  |     | ESP32SeriesDatasheetv5.3 |     |     |
| ---------------- | --- | --- | --- | --- | --- | ------------------------ | --- | --- |
SubmitDocumentationFeedback

2 Pins
2 Pins
2.1 Pin Layout
UPC_3P3DDV
|             |                | P_LATX N_LATX | 12OIPG DXT0U DXR0U | 22OIPG 91OIPG |              |
| ----------- | -------------- | ------------- | ------------------ | ------------- | ------------ |
|             | 1PAC 2PAC ADDV | ADDV          |                    |               |              |
|             | 84 74 64       | 54 44 34      | 24 14 04           | 93 83 73      |              |
| VDDA        | 1              |               |                    |               | 36 GPIO23    |
| LNA_IN      | 2              |               |                    |               | 35 GPIO18    |
| VDD3P3      | 3              |               |                    |               | 34 GPIO5     |
| VDD3P3      | 4              |               |                    |               | 33 SD_DATA_1 |
| SENSOR_VP   | 5              |               |                    |               | 32 SD_DATA_0 |
| SENSOR_CAPP | 6              |               |                    |               | 31 SD_CLK    |
ESP32
49 GND
| SENSOR_CAPN      | 7                    |                                |                      |                          | 30 SD_CMD    |
| ---------------- | -------------------- | ------------------------------ | -------------------- | ------------------------ | ------------ |
| SENSOR_VN        | 8                    |                                |                      |                          | 29 SD_DATA_3 |
| CHIP_PU          | 9                    |                                |                      |                          | 28 SD_DATA_2 |
| VDET_1           | 10                   |                                |                      |                          | 27 GPIO17    |
| VDET_2           | 11                   |                                |                      |                          | 26 VDD_SDIO  |
| 32K_XP           | 12                   |                                |                      |                          | 25 GPIO16    |
|                  | 31 41 51             | 61 71 81                       | 91 02 12             | 22 32 42                 |              |
|                  | NX_K23 52OIPG 62OIPG | 72OIPG SMTM IDTM               | CTR_3P3DDV KCTM ODTM | 2OIPG 0OIPG 4OIPG        |              |
|                  | Figure2-1.           | ESP32PinLayout(QFN6*6,TopView) |                      |                          |              |
| EspressifSystems |                      |                                | 12                   | ESP32SeriesDatasheetv5.3 |              |
SubmitDocumentationFeedback

2 Pins
|     |     |      | P_LATX N_LATX | 12OIPG DXT0U | DXR0U 22OIPG |     |
| --- | --- | ---- | ------------- | ------------ | ------------ | --- |
|     |     | 2PAC | ADDV          | ADDV         |              |     |
1PAC
|             |     | 84 74 | 64 54 44 | 34 24 14 | 04 93 |               |
| ----------- | --- | ----- | -------- | -------- | ----- | ------------- |
| VDDA        | 1   |       |          |          |       | 38 GPIO19     |
| LNA_IN      | 2   |       |          |          |       | 37 VDD3P3_CPU |
| VDD3P3      | 3   |       |          |          |       | 36 GPIO23     |
| VDD3P3      | 4   |       |          |          |       | 35 GPIO18     |
| SENSOR_VP   | 5   |       |          |          |       | 34 GPIO5      |
| SENSOR_CAPP | 6   |       |          |          |       | 33 SD_DATA_1  |
| SENSOR_CAPN | 7   |       |          |          |       | 32 SD_DATA_0  |
ESP32
49 GND
| SENSOR_VN        | 8          |                                |                      |                 |                          | 31 SD_CLK    |
| ---------------- | ---------- | ------------------------------ | -------------------- | --------------- | ------------------------ | ------------ |
| CHIP_PU          | 9          |                                |                      |                 |                          | 30 SD_CMD    |
| VDET_1           | 10         |                                |                      |                 |                          | 29 SD_DATA_3 |
| VDET_2           | 11         |                                |                      |                 |                          | 28 SD_DATA_2 |
| 32K_XP           | 12         |                                |                      |                 |                          | 27 GPIO17    |
| 32K_XN           | 13         |                                |                      |                 |                          | 26 VDD_SDIO  |
| GPIO25           | 14         |                                |                      |                 |                          | 25 GPIO16    |
|                  |            | 51 61                          | 71 81 91             | 02 12 22        | 32 42                    |              |
|                  |            | 62OIPG 72OIPG                  | SMTM IDTM CTR_3P3DDV | KCTM ODTM 2OIPG | 0OIPG 4OIPG              |              |
|                  | Figure2-2. | ESP32PinLayout(QFN5*5,TopView) |                      |                 |                          |              |
| EspressifSystems |            |                                | 13                   |                 | ESP32SeriesDatasheetv5.3 |              |
SubmitDocumentationFeedback

EspressifSystems 2
| 2.2 Pin Overview |     |     |     |     |     |
| ---------------- | --- | --- | --- | --- | --- |
Pins
Table2-1. PinOverview
| Name | No. Type | Function |     |     |     |
| ---- | -------- | -------- | --- | --- | --- |
Analog
Analogpowersupply(2.3V∼3.6V)
| VDDA   | 1 P   |                              |     |     |     |
| ------ | ----- | ---------------------------- | --- | --- | --- |
| LNA_IN | 2 I/O | RFinputandoutput             |     |     |     |
| VDD3P3 | 3 P   | Analogpowersupply(2.3V∼3.6V) |     |     |     |
| VDD3P3 | 4 P   | Analogpowersupply(2.3V∼3.6V) |     |     |     |
VDD3P3_RTC
SubmitDocumentationFeedback
| SENSOR_VP   | 5 I | GPIO36, ADC1_CH0,       | RTC_GPIO0 |     |     |
| ----------- | --- | ----------------------- | --------- | --- | --- |
| SENSOR_CAPP | 6 I | GPIO37, ADC1_CH1,       | RTC_GPIO1 |     |     |
| SENSOR_CAPN | 7 I | GPIO38, ADC1_CH2,       | RTC_GPIO2 |     |     |
| SENSOR_VN   | 8 I | GPIO39, ADC1_CH3,       | RTC_GPIO3 |     |     |
| 14          |     | High: On;enablesthechip |           |     |     |
| CHIP_PU     | 9 I |                         |           |     |     |
Low: Off;thechipshutsdown
Note: DonotleavetheCHIP_PUpinfloating.
| VDET_1 | 10 I | GPIO34, ADC1_CH6, | RTC_GPIO4 |     |     |
| ------ | ---- | ----------------- | --------- | --- | --- |
| VDET_2 | 11 I | GPIO35, ADC1_CH7, | RTC_GPIO5 |     |     |
32K_XP 12 I/O GPIO32, ADC1_CH4, RTC_GPIO9, TOUCH9, 32K_XP(32.768kHzcrystaloscillatorinput)
32K_XN 13 I/O GPIO33, ADC1_CH5, RTC_GPIO8, TOUCH8, 32K_XN(32.768kHzcrystaloscillatoroutput)
ESP32SeriesDatasheetv5.3 GPIO25 14 I/O GPIO25, ADC2_CH8, RTC_GPIO6, DAC_1, EMAC_RXD0
| GPIO26 | 15 I/O | GPIO26, ADC2_CH9, | RTC_GPIO7,  | DAC_2,  | EMAC_RXD1  |
| ------ | ------ | ----------------- | ----------- | ------- | ---------- |
| GPIO27 | 16 I/O | GPIO27, ADC2_CH7, | RTC_GPIO17, | TOUCH7, | EMAC_RX_DV |
MTMS 17 I/O GPIO14, ADC2_CH6, RTC_GPIO16, TOUCH6, EMAC_TXD2, HSPICLK, HS2_CLK, SD_CLK, MTMS
MTDI 18 I/O GPIO12, ADC2_CH5, RTC_GPIO15, TOUCH5, EMAC_TXD3, HSPIQ, HS2_DATA2, SD_DATA2, MTDI
InputpowersupplyforRTCIO(2.3V∼3.6V)
| VDD3P3_RTC | 19 P |     |     |     |     |
| ---------- | ---- | --- | --- | --- | --- |
MTCK 20 I/O GPIO13, ADC2_CH4, RTC_GPIO14, TOUCH4, EMAC_RX_ER, HSPID, HS2_DATA3, SD_DATA3, MTCK
MTDO 21 I/O GPIO15, ADC2_CH3, RTC_GPIO13, TOUCH3, EMAC_RXD3, HSPICS0, HS2_CMD, SD_CMD, MTDO

EspressifSystems 2
|     | Name | No. Type | Function |     |     |     |
| --- | ---- | -------- | -------- | --- | --- | --- |
Pins
GPIO2 22 I/O GPIO2, ADC2_CH2, RTC_GPIO12, TOUCH2, HSPIWP, HS2_DATA0, SD_DATA0
GPIO0 23 I/O GPIO0, ADC2_CH1, RTC_GPIO11, TOUCH1, EMAC_TX_CLK, CLK_OUT1,
GPIO4 24 I/O GPIO4, ADC2_CH0, RTC_GPIO10, TOUCH0, EMAC_TX_ER, HSPIHD, HS2_DATA1, SD_DATA1
VDD_SDIO
|     | GPIO16    | 25 I/O | GPIO16, HS1_DATA4, | U2RXD,                           | EMAC_CLK_OUT     |        |
| --- | --------- | ------ | ------------------ | -------------------------------- | ---------------- | ------ |
|     | VDD_SDIO  | 26 P   | Outputpowersupply: | 1.8VorthesamevoltageasVDD3P3_RTC |                  |        |
|     | GPIO17    | 27 I/O | GPIO17, HS1_DATA5, | U2TXD,                           | EMAC_CLK_OUT_180 |        |
|     | SD_DATA_2 | 28 I/O | GPIO9, HS1_DATA2,  | U1RXD,                           | SD_DATA2,        | SPIHD  |
|     | SD_DATA_3 | 29 I/O | GPIO10, HS1_DATA3, | U1TXD,                           | SD_DATA3,        | SPIWP  |
|     | SD_CMD    | 30 I/O | GPIO11, HS1_CMD,   | U1RTS,                           | SD_CMD,          | SPICS0 |
SubmitDocumentationFeedback
|     | SD_CLK    | 31 I/O | GPIO6, HS1_CLK,   | U1CTS, | SD_CLK,   | SPICLK |
| --- | --------- | ------ | ----------------- | ------ | --------- | ------ |
|     | SD_DATA_0 | 32 I/O | GPIO7, HS1_DATA0, | U2RTS, | SD_DATA0, | SPIQ   |
|     | SD_DATA_1 | 33 I/O | GPIO8, HS1_DATA1, | U2CTS, | SD_DATA1, | SPID   |
VDD3P3_CPU
15
|                          | GPIO5      | 34 I/O | GPIO5, HS1_DATA6,                   | VSPICS0,  | EMAC_RX_CLK |     |
| ------------------------ | ---------- | ------ | ----------------------------------- | --------- | ----------- | --- |
|                          | GPIO18     | 35 I/O | GPIO18, HS1_DATA7,                  | VSPICLK   |             |     |
|                          | GPIO23     | 36 I/O | GPIO23, HS1_STROBE,                 | VSPID     |             |     |
|                          | VDD3P3_CPU | 37 P   | InputpowersupplyforCPUIO(1.8V∼3.6V) |           |             |     |
|                          | GPIO19     | 38 I/O | GPIO19, U0CTS,                      | VSPIQ,    | EMAC_TXD0   |     |
|                          | GPIO22     | 39 I/O | GPIO22, U0RTS,                      | VSPIWP,   | EMAC_TXD1   |     |
|                          | U0RXD      | 40 I/O | GPIO3, U0RXD,                       | CLK_OUT2  |             |     |
| ESP32SeriesDatasheetv5.3 | U0TXD      | 41 I/O | GPIO1, U0TXD,                       | CLK_OUT3, | EMAC_RXD2   |     |
|                          | GPIO21     | 42 I/O | GPIO21,                             | VSPIHD,   | EMAC_TX_EN  |     |
Analog
Analogpowersupply(2.3V∼3.6V)
|     | VDDA   | 43 P |                              |     |     |     |
| --- | ------ | ---- | ---------------------------- | --- | --- | --- |
|     | XTAL_N | 44 O | Externalcrystaloutput        |     |     |     |
|     | XTAL_P | 45 I | Externalcrystalinput         |     |     |     |
|     | VDDA   | 46 P | Analogpowersupply(2.3V∼3.6V) |     |     |     |
Connectstoa3.3nF(10%)capacitorand20kΩresistorinparalleltoCAP1
|     | CAP2 | 47 I |     |     |     |     |
| --- | ---- | ---- | --- | --- | --- | --- |

EspressifSystems 2
| Name | No. Type | Function |     |     |     |     |     |
| ---- | -------- | -------- | --- | --- | --- | --- | --- |
Pins
| CAP1 | 48 I | Connectstoa10nFseriescapacitortoground |     |     |     |     |     |
| ---- | ---- | -------------------------------------- | --- | --- | --- | --- | --- |
| GND  | 49 P | Ground                                 |     |     |     |     |     |
NotesforTable2-1PinOverview:
1. Functionnames:
|     | CLK_OUT… | clockoutput |     |     |     |     |     |
| --- | -------- | ------------ | --- | --- | --- | --- | --- |

SPICLK
|     | HSPICLK | SPIclocksignal |     |     |     |     |     |
| --- | ------- | -------------- | --- | --- | --- | --- | --- |

VSPICLK
SubmitDocumentationFeedback
|     | HS…_CLK | SDIOMasterclocksignal  |     |     |     |     |     |
| --- | ------- | ---------------------- | --- | --- | --- | --- | --- |
|     | SD_CLK  | } SDIOSlaveclocksignal |     |     |     |     |     |
EMAC_TX_CLK
EMACclocksignal
| EMAC_RX_CLK |     | }   |     |     |     |     |     |
| ----------- | --- | --- | --- | --- | --- | --- | --- |
16
U…_RTS
UART0/1/2hardwareflowcontrolsignals
U…_CTS
}
U…_RXD
UART0/1/2receive/transmitsignals
U…_TXD

|     | MTMS |  |     |     |     |     |     |
| --- | ---- | ----- | --- | --- | --- | --- | --- |
MTDI
JTAGinterfacesignals

MTCK
ESP32SeriesDatasheetv5.3
MTDO
|     | GPIO… | General-purpose | input/output | with signals | routed via | the GPIO matrix. | For |
| --- | ----- | --------------- | ------------ | ------------ | ---------- | ---------------- | --- |
moredetailsontheGPIOmatrix,seeESP32TechnicalReferenceManual>
ChapterIOMUXandGPIOMatrix。
2. Regardinghighlightedcells,seeSection2.3.1RestrictionsforGPIOsandRTC_GPIOs.
3. ForaquickreferenceguidetousingtheIO_MUX,EthernetMAC,andGPIOMatrixpinsofESP32,pleaserefertoAppendixESP32PinLists.

2 Pins
2.3 IO Pins
| 2.3.1 Restrictions | for GPIOs | and RTC_GPIOs |     |     |
| ------------------ | --------- | ------------- | --- | --- |
AllIOpinsoftheESP32haveGPIOandsomehaveRTC_GPIOpinfunctions. However,theseIOpinsare
multifunctionalandcanbeconfiguredfordifferentpurposesbasedontherequirements. SomeIOshave
restrictionsforusage. Itisessentialtoconsidertheirmultiplexednatureandthelimitationswhenusingthese
IOpins.
InTable2-1PinOverviewsomepinfunctionsarehighlighted,specically:
•
GPIO –Inputonlypins,outputisnotsupportedduetolackofpull-up/pull-downresistors.
• GPIO –allocatedforcommunicationwithin-packageflash/PSRAMandNOTrecommendedforother
uses. Fordetails,seeSection2.6PinMappingBetweenChipandFlash/PSRAM.
•
GPIO –haveoneofthefollowingimportantfunctions:
– Strappingpins–needtobeatcertainlogiclevelsatstartup. SeeSection3BootConfigurations.
– JTAGinterface–oftenusedfordebugging.
– UARTinterface–oftenusedfordebugging.
SeealsoAppendixA.1–NotesonESP32PinLists.
| 2.4 Analog Pins |      |           |            |     |
| --------------- | ---- | --------- | ---------- | --- |
|                 |      | Table2-2. | AnalogPins |     |
| Pin Pin         | Pin  | Pin       |            |     |
| No. Name        | Type | Function  |            |     |
2 LNA_IN I/O LowNoiseAmplifier(LNA)inputsignal,PowerAmplifier(PA)outputsignal
High: on,enablesthechip(Poweredup).
| 9 CHIP_PU | I   | Low: off,thechippowersoff(powereddown). |     |     |
| --------- | --- | --------------------------------------- | --- | --- |
Note: DonotleavetheCHIP_PUpinfloating.
44 XTAL_N — Externalclockinput/outputconnectedtochip’scrystaloroscillator.
| 45 XTAL_P        | —   | P/Nmeansdifferentialclockpositive/negative. |     |     |
| ---------------- | --- | ------------------------------------------- | --- | --- |
| 2.5 Power Supply |     |                                             |     |     |
| 2.5.1 Power Pins |     |                                             |     |     |
ESP32’sdigitalpinsaredividedintothreedifferentpowerdomains:
• VDD3P3_RTC
• VDD3P3_CPU
•
VDD_SDIO
| EspressifSystems |     |     | 17  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

2 Pins
Table2-3. PowerPins
Pin Pin PowerSupply
| No. Name        | Direction    | PowerDomain/Other               | IOPins    |
| --------------- | ------------ | ------------------------------- | --------- |
| 1 VDDA          | Input        | Analogpowerdomain               |           |
| 3 VDD3P3        | Input        | Analogpowerdomain               |           |
| 4 VDD3P3        | Input        | Analogpowerdomain               |           |
| 19 VDD3P3_RTC1  | Input        | RTCandpartofDigitalpowerdomains | RTCIO     |
| 26 VDD3P3_SDIO2 | Input/Output | Analogpowerdomain               |           |
| 37 VDD3P3_CPU3  | Input        | Digitalpowerdomain              | DigitalIO |
| 43 VDDA         | Input        | Analogpowerdomain               |           |
| 46 VDDA         | Input        | Analogpowerdomain               |           |
| 49 GND          | –            | Externalgroundconnection        |           |
1VDD3P3_RTCisalsotheinputpowersupplyforRTCandCPU.
2VDD_SDIOconnectstotheoutputofaninternalLDOwhoseinputisVDD3P3_RTC.When
VDD_SDIO is connected to the same PCB net together with VDD3P3_RTC, the internal
LDOisdisabledautomatically.
3VDD3P3_CPUisalsotheinputpowersupplyforCPU.
2.5.2 Power Scheme
ThepowerschemeisshowninFigure2-3ESP32PowerScheme.
|     |     | VDD3P3_RTC | VDD3P3_CPU |
| --- | --- | ---------- | ---------- |
R = 6 Ω
|     | 1.8 V LDO | LDO 1.1 V | LDO 1.1 V |
| --- | --------- | --------- | --------- |
VDD_SDIO
3.3 V/1.8 V
SDIO RTC
CPU
Domain Domain
Domain
|                  | Figure2-3. | ESP32PowerScheme |                          |
| ---------------- | ---------- | ---------------- | ------------------------ |
| EspressifSystems |            | 18               | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

2 Pins
TheinternalLDOcanbeconfiguredashaving1.8V,orthesamevoltageasVDD3P3_RTC.Itcanbepowered
offviasoftwaretominimizethecurrentofflash/SRAMduringtheDeep-sleepmode.
2.5.3 Chip Power-up and Reset
Oncethepowerissuppliedtothechip,itspowerrailsneedashorttimetostabilize. Afterthat,CHIP_PU–the
pinusedforpower-upandreset–ispulledhightoactivatethechip. ForinformationonCHIP_PUaswellas
power-upandresettiming,seeFigure2-4andTable2-4.
tSTBL tRST
VDD3P3_RTCMin
VDD
V
IL_nRST
CHIP_PU
Figure2-4. VisualizationofTimingParametersforPower-upandReset
Table2-4. DescriptionofTimingParametersforPower-upandReset
Parameter Description Min(µs)
Time reserved for the 3.3 V rails to stabilize before the CHIP_PU
t 50
STBL
pinispulledhightoactivatethechip
Time reserved for CHIP_PU to stay below V to reset the
IL_nRST
t 50
RST
chip(seeTable5-3)
• InscenarioswhereESP32ispoweredupanddownrepeatedlybyswitchingthepowerrails,whilethere
isalargecapacitorontheVDD33railandCHIP_PUandVDD33areconnected,simplyswitchingoffthe
CHIP_PUpowerrailandimmediatelyswitchingitbackonmaycauseanincompletepowerdischarge
cycleandfailuretoresetthechipadequately.
Anadditionaldischargecircuitmayberequiredtoacceleratethedischargeofthelargecapacitoronrail
VDD33,whichwillensureproperpower-on-resetwhentheESP32ispoweredupagain.
• WhenabatteryisusedasthepowersupplyfortheESP32seriesofchipsandmodules,asupplyvoltage
supervisorisrecommended,sothatabootfailureduetolowvoltageisavoided. Usersare
recommendedtopullCHIP_PUlowifthepowersupplyforESP32isbelow2.3V.
Notesonpowersupply:
• TheoperatingvoltageofESP32rangesfrom2.3Vto3.6V.Whenusingasingle-powersupply,the
recommendedvoltageofthepowersupplyis3.3V,anditsrecommendedoutputcurrentis500mAor
more.
• PSRAMandflashbotharepoweredbyVDD_SDIO.Ifthechiphasanin-packageflash,thevoltageof
VDD_SDIOisdeterminedbytheoperatingvoltageofthein-packageflash. Ifthechipalsoconnectsto
anexternalPSRAM,theoperatingvoltageofexternalPSRAMmustmatchthatofthein-packageflash.
Thisalsoappliesifthechiphasanin-packagePSRAMbutalsoconnectstoanexternalflash.
EspressifSystems 19 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

2 Pins
•
WhenVDD_SDIO1.8Visusedasthepowersupplyforexternalflash/PSRAM,a2kΩgroundingresistor
shouldbeaddedtoVDD_SDIO.Forthecircuitdesign,pleasereferto
ESP32HardwareDesignGuidelines.
• Whenthethreedigitalpowersuppliesareusedtodriveperipherals,e.g.,3.3Vflash,theyshouldcomply
withtheperipherals’specifications.
| 2.6 Pin | Mapping | Between | Chip and | Flash/PSRAM |     |
| ------- | ------- | ------- | -------- | ----------- | --- |
Table2-5liststhepin-to-pinmappingbetweenthechipandthein-packageflash/PSRAM.Thechippinslisted
herearenotrecommendedforotherusage.
ForthedataportconnectionbetweenESP32andoff-packageflash/PSRAMpleaserefertoTable2-6.
Table2-5. Pin-to-PinMappingBetweenChipandIn-PackageFlash/PSRAM
|     |     | ESP32-U4WDH |     | In-PackageFlash(4MB) |     |
| --- | --- | ----------- | --- | -------------------- | --- |
SD_DATA_1 IO0/DI
GPIO17 IO1/DO
|     |     | SD_DATA_0 |     | IO2/WP#   |     |
| --- | --- | --------- | --- | --------- | --- |
|     |     | SD_CMD    |     | IO3/HOLD# |     |
SD_CLK CLK
GPIO16 CS#
GND VSS
VDD_SDIO1 VDD
|     |     | ESP32-D0WDRH2-V3 |     | In-PackagePSRAM(2MB) |     |
| --- | --- | ---------------- | --- | -------------------- | --- |
SD_DATA_1 SIO0/SI
SD_DATA_0 SIO1/SO
SD_DATA_3 SIO2
SD_DATA_2 SIO3
SD_CLK SCLK
GPIO162
CE#
GND VSS
VDD_SDIO1 VDD
Table2-6. Pin-to-PinMappingBetweenChipandOff-PackageFlash/PSRAM
|     |     | ChipPin         |     | Off-PackageFlash |     |
| --- | --- | --------------- | --- | ---------------- | --- |
|     |     | SD_DATA_1/SPID  |     | IO0/DI           |     |
|     |     | SD_DATA_0/SPIQ  |     | IO1/DO           |     |
|     |     | SD_DATA_3/SPIWP |     | IO2/WP#          |     |
|     |     | SD_DATA_2/SPIHD |     | IO3/HOLD#        |     |
SD_CLK CLK
SD_CMD CS#
GND VSS
VDD_SDIO VDD
Cont’donnextpage
| EspressifSystems |     |     |     | 20  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

2 Pins
Table2-6–cont’dfrompreviouspage
ChipPin Off-PackagePSRAM
ChipPin Off-PackagePSRAM
SD_DATA_1 SIO0/SI
SD_DATA_0 SIO1/SO
SD_DATA_3 SIO2
SD_DATA_2 SIO3
SD_CLK/GPIO173 SCLK
GPIO162 CE#
GND VSS
VDD_SDIO VDD
Note:
1. Asthein-packageflash(ESP32-U4WDH)andthein-packagePSRAM(ESP32-D0WDRH2-V3)operateat3.3V,
VDD_SDIOmustbepoweredbyVDD3P3_RTCviaa6Ωresistor. SeeFigure2-3ESP32PowerScheme.
2. If GPIO16 is used to connect to PSRAM’s CE# signal, please add a pull-up resistor at the GPIO16 pin. See
ESP32-WROVER-EDatasheet>FigureSchematicsofESP32-WROVER-E.
3. SD_CLKandGPIO17pinsareavailabletoconnecttotheSCLKsignalofexternalPSRAM.
• IfSD_CLKpinisselected,oneGPIO(i.e.,GPIO17)willbesaved. ThesavedGPIOcanbeusedforother
purposes. Thisconnectionhaspassedinternaltests,butrelevantcertificationhasnotbeencompleted.
• OrGPIO17pinisusedtoconnecttotheSCLKsignal. Thisconnectionhaspassedrelevantcertification,
seecertificatesforESP32-WROVER-E.
Pleaseselecttheproperpinforyourspecificapplications.
EspressifSystems 21 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

3 BootConfigurations
3 Boot Configurations
ThechipallowsforconfiguringthefollowingbootparametersthroughstrappingpinsandeFusebitsat
power-uporahardwarereset,withoutmicrocontrollerinteraction.
•
Chipbootmode
| – Strappingpin: GPIO0andGPIO2 |     |     |     |
| ----------------------------- | --- | --- | --- |
• InternalLDO(VDD_SDIO)Voltage
| – Strappingpin: MTDI                           |     |     |     |
| ---------------------------------------------- | --- | --- | --- |
| – eFusebit: EFUSE_SDIO_FORCEandEFUSE_SDIO_TIEH |     |     |     |
• U0TXDprinting
| – Strappingpin: MTDO |     |     |     |
| -------------------- | --- | --- | --- |
•
TimingofSDIOSlave
| – Strappingpin: MTDOandGPIO5 |     |     |     |
| ---------------------------- | --- | --- | --- |
• JTAGsignalsource
| – eFusebit: EFUSE_DISABLE_JTAG |     |     |     |
| ------------------------------ | --- | --- | --- |
ThedefaultvaluesofalltheaboveeFusebitsare0,whichmeansthattheyarenotburnt. GiventhateFuseis
one-timeprogrammable,onceaneFusebitisprogrammedto1,itcanneverberevertedto0. Forhowto
programeFusebits,pleaserefertoESP32TechnicalReferenceManual>ChaptereFuseController.
Thedefaultvaluesofthestrappingpins,namelythelogiclevels,aredeterminedbypins’internalweak
pull-up/pull-downresistorsatresetifthepinsarenotconnectedtoanycircuit,orconnectedtoanexternal
high-impedancecircuit.
|     | Table3-1. DefaultConfigurationofStrappingPins |                      |          |
| --- | --------------------------------------------- | -------------------- | -------- |
|     | StrappingPin                                  | DefaultConfiguration | BitValue |
|     | GPIO0                                         | Pull-up              | 1        |
|     | GPIO2                                         | Pull-down            | 0        |
|     | MTDI                                          | Pull-down            | 0        |
|     | MTDO                                          | Pull-up              | 1        |
|     | GPIO5                                         | Pull-up              | 1        |
Tochangethebitvalues,thestrappingpinsshouldbeconnectedtoexternalpull-down/pull-upresistances. If
theESP32isusedasadevicebyahostMCU,thestrappingpinvoltagelevelscanalsobecontrolledbythe
hostMCU.
Allstrappingpinshavelatches. Atsystemreset,thelatchessamplethebitvaluesoftheirrespectivestrapping
pinsandstorethemuntilthechipispowereddownorshutdown. Thestatesoflatchescannotbechangedin
anyotherway. Itmakesthestrappingpinvaluesavailableduringtheentirechipoperation,andthepinsare
freeduptobeusedasregularIOpinsafterreset.
Thetimingofsignalsconnectedtothestrappingpinsshouldadheretothesetuptimeandholdtime
specificationsinTable3-2andFigure3-1.
| EspressifSystems |     | 22  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

3 BootConfigurations
|     | Table3-2.             | DescriptionofTimingParametersfortheStrappingPins |     |     |     |         |
| --- | --------------------- | ------------------------------------------------ | --- | --- | --- | ------- |
|     | Parameter Description |                                                  |     |     |     | Min(ms) |
Setuptimeisthetimereservedforthepowerrailstostabilizebe-
|     | t   |     |     |     |     | 0   |
| --- | --- | --- | --- | --- | --- | --- |
SU foretheCHIP_PUpinispulledhightoactivatethechip.
|     | Hold | time is the time reserved | for the chip | to read | the strapping |     |
| --- | ---- | ------------------------- | ------------ | ------- | ------------- | --- |
t H pin values after CHIP_PU is already high and before these pins 1
startoperatingasregularIOpins.
tSU tH
V
IH_nRST
CHIP_PU
V
IH
Strapping pin
|          | Figure3-1. | VisualizationofTimingParametersfortheStrappingPins |     |     |     |     |
| -------- | ---------- | -------------------------------------------------- | --- | --- | --- | --- |
| 3.1 Chip | Boot Mode  | Control                                            |     |     |     |     |
GPIO0andGPIO2controlthebootmodeaftertheresetisreleased. SeeTable3-3ChipBootMode
Control.
|     |     | Table3-3. ChipBootModeControl |       |            |     |     |
| --- | --- | ----------------------------- | ----- | ---------- | --- | --- |
|     |     | BootMode                      | GPIO0 | GPIO2      |     |     |
|     |     | SPIBootMode                   |       | 1 Anyvalue |     |     |
JointDownloadBootMode2
0 0
1Boldmarksthedefaultvalueandconfiguration.
2JointDownloadBootmodesupportsthefollowing
downloadmethods:
•SDIODownloadBoot
•UARTDownloadBoot
InJointDownloadBootmode,thedetailedbootflowofthechipisputbelow3-2.
| EspressifSystems |     |     | 23  |     | ESP32SeriesDatasheetv5.3 |     |
| ---------------- | --- | --- | --- | --- | ------------------------ | --- |
SubmitDocumentationFeedback

3 BootConfigurations
Figure3-2. ChipBootFlow
uart_download_discontrolsbootmodebehaviors:
ItpermanentlydisablesDownloadBootmodewhenuart_download_disissetto1(validonlyforESP32chip
revisionsv3.0andhigher).
3.2 Internal LDO (VDD_SDIO) Voltage Control
TherequiredVDD_SPIvoltageforthechipsoftheESP32SeriescanbefoundinTable1-1Comparison.
MTDIisusedtoselecttheVDD_SDIOpowersupplyvoltageatreset:
• MTDI=0(bydefault),VDD_SDIOpinispowereddirectlyfromVDD3P3_RTC.Typicallythisvoltageis3.3
V.Formoreinformation,seeSection2.5.2PowerScheme.
• MTDI=1,VDD_SDIOpinispoweredfrominternal1.8VLDO.
ThisfunctionalitycanbeoverriddenbysettingEFUSE_SDIO_FORCEto1,inwhichcasetheEFUSE_SDIO_TIEH
determinestheVDD_SDIOvoltage:
• EFUSE_SDIO_TIEH=0,VDD_SDIOconnectsto1.8VLDO.
• EFUSE_SDIO_TIEH=1,VDD_SDIOconnectstoVDD3P3_RTC.
EspressifSystems 24 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

3 BootConfigurations
| 3.3 U0TXD | Printing | Control |     |     |     |
| --------- | -------- | ------- | --- | --- | --- |
Duringbooting,thestrappingpinMTDOcanbeusedtocontroltheU0TXDPrinting,asTable3-4shows.
|     |     |     | Table3-4. U0TXDPrintingControl |     |     |
| --- | --- | --- | ------------------------------ | --- | --- |
U0TXDPrintingControl MTDO
Enabled1 1
Disabled 0
1Boldmarksthedefaultvalueand
configuration.
| 3.4 Timing | Control | of SDIO | Slave |     |     |
| ---------- | ------- | ------- | ----- | --- | --- |
ThestrappingpinMTDOandGPIO5canbeusedtocontrolthetimingofSDIOslave,seeTable3-5Timing
ControlofSDIOSlave.
|     |                                       | Table3-5. | TimingControlofSDIOSlave |      |       |
| --- | ------------------------------------- | --------- | ------------------------ | ---- | ----- |
|     | Edgebehavior                          |           |                          | MTDO | GPIO5 |
|     | Fallingedgesampling,fallingedgeoutput |           |                          | 0    | 0     |
|     | Fallingedgesampling,risingedgeoutput  |           |                          | 0    | 1     |
|     | Risingedgesampling,fallingedgeoutput  |           |                          | 1    | 0     |
|     | Risingedgesampling,risingedgeoutput   |           |                          | 1    | 1     |
1Boldmarksthedefaultvalueandconfiguration.
| 3.5 JTAG | Signal | Source Control |     |     |     |
| -------- | ------ | -------------- | --- | --- | --- |
IfEFUSE_DISABLE_JTAGissetto1,thesourceofJTAGsignalscanbedisabled.
| EspressifSystems |     |     |     | 25  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

4 FunctionalDescription
4 Functional Description
4.1 CPU and Memory
4.1.1 CPU
ESP32containsoneortwolow-powerXtensa® 32-bitLX6microprocessor(s)withthefollowing
features:
• 7-stagepipelinetosupporttheclockfrequencyofupto240MHz(160MHzforESP32-S0WD(NRND))
• 16/24-bitInstructionSetprovideshighcode-density
• SupportforFloatingPointUnit
• SupportforDSPinstructions,suchasa32-bitmultiplier,a32-bitdivider,anda40-bitMAC
• Supportfor32interruptvectorsfromabout70interruptsources
Thesingle-/dual-CPUinterfacesinclude:
• XtensaRAM/ROMInterfaceforinstructionsanddata
• XtensaLocalMemoryInterfaceforfastperipheralregisteraccess
• Externalandinternalinterruptsources
• JTAGfordebugging
ForinformationabouttheXtensa® InstructionSetArchitecture,pleasereferto
Xtensa® InstructionSetArchitecture(ISA)Summary.
4.1.2 Internal Memory
ESP32’sinternalmemoryincludes:
• 448KBofROMforbootingandcorefunctions
• 520KBofon-chipSRAMfordataandinstructions
• 8KBofSRAMinRTC,whichiscalledRTCFASTMemoryandcanbeusedfordatastorage;itisaccessed
bythemainCPUduringRTCBootfromtheDeep-sleepmode.
• 8KBofSRAMinRTC,whichiscalledRTCSLOWMemoryandcanbeaccessedbytheULPcoprocessor
duringtheDeep-sleepmode.
• 1KbitofeFuse: 256bitsareusedforthesystem(MACaddressandchipconfiguration)andthe
remaining768bitsarereservedforcustomerapplications,includingflash-encryptionandchip-ID.
• In-packageflashorPSRAM
Note:
ProductsintheESP32seriesdifferfromeachother,intermsoftheirsupportforin-packageflashorPSRAMandthe
sizeofthem. Fordetails,pleaserefertoSection1ESP32SeriesComparison.
EspressifSystems 26 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.1.3 External Flash and RAM
ESP32supportsmultipleexternalQSPIflashandexternalRAM(SRAM)chips. Moredetailscanbefoundin
ESP32TechnicalReferenceManual>ChapterSPIController. ESP32alsosupportshardware
encryption/decryptionbasedonAEStoprotectdevelopers’programsanddatainflash.
ESP32canaccesstheexternalQSPIflashandSRAMthroughhigh-speedcaches.
• Upto16MBofexternalflashcanbemappedintoCPUinstructionmemoryspaceandread-onlymemory
spacesimultaneously.
– WhenexternalflashismappedintoCPUinstructionmemoryspace,upto11MB+248KBcanbe
mappedatatime. Notethatifmorethan3MB+248KBaremapped,cacheperformancewillbe
reducedduetospeculativereadsbytheCPU.
– Whenexternalflashismappedintoread-onlydatamemoryspace,upto4MBcanbemappedata
time. 8-bit,16-bitand32-bitreadsaresupported.
• ExternalRAMcanbemappedintoCPUdatamemoryspace. SRAMupto8MBissupportedandupto4
MBcanbemappedatatime. 8-bit,16-bitand32-bitreadsandwritesaresupported.
Note:
AfterESP32isinitialized,firmwarecancustomizethemappingofexternalRAMorflashintotheCPUaddressspace.
4.1.4 Address Mapping Structure
ThestructureofaddressmappingisshowninFigure4-1. Thememoryandperipheralmappingisshownin
Table4-1.
Figure4-1. AddressMappingStructure
EspressifSystems 27 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
|          | Table4-1. MemoryandPeripheralMapping |              |             |       |
| -------- | ------------------------------------ | ------------ | ----------- | ----- |
| Category | Target                               | StartAddress | EndAddress  | Size  |
|          | InternalROM0                         | 0×4000_0000  | 0×4005_FFFF | 384KB |
|          | InternalROM1                         | 0×3FF9_0000  | 0×3FF9_FFFF | 64KB  |
|          | InternalSRAM0                        | 0×4007_0000  | 0×4009_FFFF | 192KB |
|          |                                      | 0×3FFE_0000  | 0×3FFF_FFFF |       |
| Embedded | InternalSRAM1                        |              |             | 128KB |
|          |                                      | 0×400A_0000  | 0×400B_FFFF |       |
Memory
|          | InternalSRAM2 | 0×3FFA_E000 | 0×3FFD_FFFF | 200KB      |
| -------- | ------------- | ----------- | ----------- | ---------- |
|          |               | 0×3FF8_0000 | 0×3FF8_1FFF |            |
|          | RTCFASTMemory |             |             | 8KB        |
|          |               | 0×400C_0000 | 0×400C_1FFF |            |
|          | RTCSLOWMemory | 0×5000_0000 | 0×5000_1FFF | 8KB        |
|          |               | 0×3F40_0000 | 0×3F7F_FFFF | 4MB        |
| External | ExternalFlash |             |             |            |
|          |               | 0×400C_2000 | 0×40BF_FFFF | 11MB+248KB |
Memory
|                  | ExternalRAM     | 0×3F80_0000 | 0×3FBF_FFFF | 4MB                      |
| ---------------- | --------------- | ----------- | ----------- | ------------------------ |
|                  | DPortRegister   | 0×3FF0_0000 | 0×3FF0_0FFF | 4KB                      |
|                  | AESAccelerator  | 0×3FF0_1000 | 0×3FF0_1FFF | 4KB                      |
|                  | RSAAccelerator  | 0×3FF0_2000 | 0×3FF0_2FFF | 4KB                      |
|                  | SHAAccelerator  | 0×3FF0_3000 | 0×3FF0_3FFF | 4KB                      |
|                  | SecureBoot      | 0×3FF0_4000 | 0×3FF0_4FFF | 4KB                      |
|                  | CacheMMUTable   | 0×3FF1_0000 | 0×3FF1_3FFF | 16KB                     |
|                  | PIDController   | 0×3FF1_F000 | 0×3FF1_FFFF | 4KB                      |
|                  | UART0           | 0×3FF4_0000 | 0×3FF4_0FFF | 4KB                      |
|                  | SPI1            | 0×3FF4_2000 | 0×3FF4_2FFF | 4KB                      |
|                  | SPI0            | 0×3FF4_3000 | 0×3FF4_3FFF | 4KB                      |
|                  | GPIO            | 0×3FF4_4000 | 0×3FF4_4FFF | 4KB                      |
|                  | RTC             | 0×3FF4_8000 | 0×3FF4_8FFF | 4KB                      |
|                  | IOMUX           | 0×3FF4_9000 | 0×3FF4_9FFF | 4KB                      |
|                  | SDIOSlave       | 0×3FF4_B000 | 0×3FF4_BFFF | 4KB                      |
|                  | UDMA1           | 0×3FF4_C000 | 0×3FF4_CFFF | 4KB                      |
| Peripheral       | I2S0            | 0×3FF4_F000 | 0×3FF4_FFFF | 4KB                      |
|                  | UART1           | 0×3FF5_0000 | 0×3FF5_0FFF | 4KB                      |
|                  | I2C0            | 0×3FF5_3000 | 0×3FF5_3FFF | 4KB                      |
|                  | UDMA0           | 0×3FF5_4000 | 0×3FF5_4FFF | 4KB                      |
|                  | SDIOSlave       | 0×3FF5_5000 | 0×3FF5_5FFF | 4KB                      |
|                  | RMT             | 0×3FF5_6000 | 0×3FF5_6FFF | 4KB                      |
|                  | PCNT            | 0×3FF5_7000 | 0×3FF5_7FFF | 4KB                      |
|                  | SDIOSlave       | 0×3FF5_8000 | 0×3FF5_8FFF | 4KB                      |
|                  | LEDPWM          | 0×3FF5_9000 | 0×3FF5_9FFF | 4KB                      |
|                  | eFuseController | 0×3FF5_A000 | 0×3FF5_AFFF | 4KB                      |
|                  | FlashEncryption | 0×3FF5_B000 | 0×3FF5_BFFF | 4KB                      |
|                  | PWM0            | 0×3FF5_E000 | 0×3FF5_EFFF | 4KB                      |
|                  | TIMG0           | 0×3FF5_F000 | 0×3FF5_FFFF | 4KB                      |
|                  | TIMG1           | 0×3FF6_0000 | 0×3FF6_0FFF | 4KB                      |
|                  | SPI2            | 0×3FF6_4000 | 0×3FF6_4FFF | 4KB                      |
|                  | SPI3            | 0×3FF6_5000 | 0×3FF6_5FFF | 4KB                      |
| EspressifSystems |                 | 28          |             | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

4 FunctionalDescription
| Category | Target | StartAddress | EndAddress  | Size |
| -------- | ------ | ------------ | ----------- | ---- |
|          | SYSCON | 0×3FF6_6000  | 0×3FF6_6FFF | 4KB  |
|          | I2C1   | 0×3FF6_7000  | 0×3FF6_7FFF | 4KB  |
|          | SDMMC  | 0×3FF6_8000  | 0×3FF6_8FFF | 4KB  |
|          | EMAC   | 0×3FF6_9000  | 0×3FF6_AFFF | 8KB  |
|          | TWAI   | 0×3FF6_B000  | 0×3FF6_BFFF | 4KB  |
Peripheral
|     | PWM1  | 0×3FF6_C000 | 0×3FF6_CFFF | 4KB |
| --- | ----- | ----------- | ----------- | --- |
|     | I2S1  | 0×3FF6_D000 | 0×3FF6_DFFF | 4KB |
|     | UART2 | 0×3FF6_E000 | 0×3FF6_EFFF | 4KB |
|     | PWM2  | 0×3FF6_F000 | 0×3FF6_FFFF | 4KB |
|     | PWM3  | 0×3FF7_0000 | 0×3FF7_0FFF | 4KB |
|     | RNG   | 0×3FF7_5000 | 0×3FF7_5FFF | 4KB |
4.1.5 Cache
ESP32usesatwo-wayset-associativecache. EachofthetwoCPUshas32KBofcachefeaturingablock
sizeof32bytesforaccessingexternalstorage.
Fordetails,seeESP32TechnicalReferenceManual>ChapterSystemandMemory >SectionCache.
| 4.2 System Clocks |     |     |     |     |
| ----------------- | --- | --- | --- | --- |
4.2.1 CPU Clock
Uponreset,anexternalcrystalclocksourceisselectedasthedefaultCPUclock. Theexternalcrystalclock
sourcealsoconnectstoaPLLtogenerateahigh-frequencyclock(typically160MHz).
Inaddition,ESP32hasaninternal8MHzoscillator. Theapplicationcanselecttheclocksourcefromthe
externalcrystalclocksource,thePLLclockortheinternal8MHzoscillator. Theselectedclocksourcedrives
theCPUclockdirectly,orafterdivision,dependingontheapplication.
4.2.2 RTC Clock
TheRTCclockhasfivepossiblesources:
• Externallow-speed(32kHz)crystalclock
•
Externalcrystalclockdividedby4
•
InternalRCoscillator(typicallyabout150kHz,andadjustable)
• Internal8MHzoscillator
•
Internal31.25kHzclock(derivedfromtheinternal8MHzoscillatordividedby256)
WhenthechipisinthenormalpowermodeandneedsfasterCPUaccessing,theapplicationcanchoosethe
externalhigh-speedcrystalclockdividedby4ortheinternal8MHzoscillator. Whenthechipoperatesinthe
low-powermode,theapplicationchoosestheexternallow-speed(32kHz)crystalclock,theinternalRCclock
ortheinternal31.25kHzclock.
| EspressifSystems |     | 29  |     | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

4 FunctionalDescription
| 4.2.3 Audio | PLL | Clock |     |     |     |     |
| ----------- | --- | ----- | --- | --- | --- | --- |
Theaudioclockisgeneratedbytheultra-low-noisefractional-NPLL.
Fordetails,seeESP32TechnicalReferenceManual>ChapterResetandClock.
| 4.3 RTC     | and        | Low-power | Management |     |     |     |
| ----------- | ---------- | --------- | ---------- | --- | --- | --- |
| 4.3.1 Power | Management |           | Unit (PMU) |     |     |     |
Withtheuseofadvancedpower-managementtechnologies,ESP32canswitchbetweendifferentpower
modes.
•
Powermodes
– Activemode: Thechipradioispoweredup. Thechipcanreceive,transmit,orlisten.
– Modem-sleepmode: TheCPUisoperationalandtheclockisconfigurable. TheWi-Fi/Bluetooth
basebandandradioaredisabled.
– Light-sleepmode: TheCPUispaused. TheRTCmemoryandRTCperipherals,aswellastheULP
coprocessorarerunning. Anywake-upevents(MAC,SDIOhost,RTCtimer,orexternalinterrupts)
willwakeupthechip.
– Deep-sleepmode: OnlytheRTCmemoryandRTCperipheralsarepoweredup. Wi-FiandBluetooth
connectiondataarestoredintheRTCmemory. TheULPcoprocessorisfunctional.
– Hibernationmode: Theinternal8MHzoscillatorandULPcoprocessoraredisabled. TheRTC
recoverymemoryispowereddown. OnlyoneRTCtimerontheslowclockandcertainRTCGPIOs
areactive. TheRTCtimerortheRTCGPIOscanwakeupthechipfromtheHibernationmode.
|           |     |     | Table4-2. PowerConsumptionbyPowerModes |             |     |                  |
| --------- | --- | --- | -------------------------------------- | ----------- | --- | ---------------- |
| Powermode |     |     |                                        | Description |     | PowerConsumption |
Wi-FiTxpacket
Pleasereferto
| Active(RFworking) |     |     |     | Wi-Fi/BTTxpacket |     |     |
| ----------------- | --- | --- | --- | ---------------- | --- | --- |
Table5-4fordetails.
Wi-Fi/BTRxandlistening
|     |     |     |     | *   | Dual-corechip(s) | 30mA~68mA |
| --- | --- | --- | --- | --- | ---------------- | --------- |
240MHz
|             |     |                                              |                               |              | Single-corechip(s) | N/A          |
| ----------- | --- | -------------------------------------------- | ----------------------------- | ------------ | ------------------ | ------------ |
|             |     | TheCPUis                                     |                               | *            | Dual-corechip(s)   | 27mA~44mA    |
| Modem-sleep |     |                                              | 160MHz                        |              |                    |              |
|             |     | poweredup.                                   |                               |              | Single-corechip(s) | 27mA~34mA    |
|             |     |                                              |                               |              | Dual-corechip(s)   | 20mA~31mA    |
|             |     |                                              | Normalspeed:                  | 80MHz        |                    |              |
|             |     |                                              |                               |              | Single-corechip(s) | 20mA~25mA    |
| Light-sleep |     |                                              |                               | -            |                    | 0.8mA        |
|             |     |                                              | TheULPcoprocessorispoweredup. |              |                    | 150µA        |
| Deep-sleep  |     |                                              | ULPsensor-monitoredpattern    |              |                    | 100µA@1%duty |
|             |     |                                              | RTCtimer+RTCmemory            |              |                    | 10µA         |
| Hibernation |     |                                              |                               | RTCtimeronly |                    | 5µA          |
| Poweroff    |     | CHIP_PUissettolowlevel,thechipispowereddown. |                               |              |                    | 1µA          |
•
*AmongtheESP32seriesofSoCs,ESP32-D0WD-V3,ESP32-D0WDRH2-V3,ESP32-U4WDH,ESP32-D0WD
(NRND),ESP32-D0WDQ6(NRND),andESP32-D0WDQ6-V3(NRND)haveamaximumCPUfrequencyof240MHz,
| EspressifSystems |     |     |     | 30  |     | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

4 FunctionalDescription
ESP32-S0WD(NRND)hasamaximumCPUfrequencyof160MHz.
• WhenWi-Fiisenabled,thechipswitchesbetweenActiveandModem-sleepmodes. Therefore,powerconsumption
changesaccordingly.
• InModem-sleepmode,theCPUfrequencychangesautomatically. ThefrequencydependsontheCPUloadand
theperipheralsused.
• DuringDeep-sleep,whentheULPcoprocessorispoweredon,peripheralssuchasGPIOandRTCI2Careableto
operate.
• WhenthesystemworksintheULPsensor-monitoredpattern,theULPcoprocessorworkswiththeULPsensor
periodicallyandtheADCworkswithadutycycleof1%,sothepowerconsumptionis100µA.
4.3.2 Ultra-Low-Power Coprocessor
TheULPcoprocessorandRTCmemoryremainpoweredonduringtheDeep-sleepmode. Hence,the
developercanstoreaprogramfortheULPcoprocessorintheRTCslowmemorytoaccesstheperipheral
devices,internaltimersandinternalsensorsduringtheDeep-sleepmode. Thisisusefulfordesigning
applicationswheretheCPUneedstobewokenupbyanexternalevent,oratimer,oracombinationofthe
two,whilemaintainingminimalpowerconsumption.
Fordetails,seeESP32TechnicalReferenceManual>ChapterULPCoprocessor.
4.4 Timers and Watchdogs
4.4.1 General Purpose Timers
Therearefourgeneral-purposetimersembeddedinthechip. Theyareall64-bitgenerictimerswhichare
basedon16-bitprescalersand64-bitauto-reload-capableup/down-timers.
Thetimersfeature:
• A16-bitclockprescaler,from2to65536
• A64-bittimer
• Configurableup/downtimer: incrementingordecrementing
• Haltandresumeoftime-basecounter
• Auto-reloadatalarming
• Software-controlledinstantreload
• Levelandedgeinterruptgeneration
Fordetails,seeESP32TechnicalReferenceManual>ChapterTimerGroup.
4.4.2 Watchdog Timers
Thechiphasthreewatchdogtimers: oneineachofthetwotimermodules(calledtheMainWatchdogTimer,
orMWDT)andoneintheRTCmodule(calledtheRTCWatchdogTimer,orRWDT).Thesewatchdogtimersare
intendedtorecoverfromanunforeseenfaultcausingtheapplicationprogramtoabandonitsnormal
sequence. Awatchdogtimerhasfourstages. Eachstagemaytriggeroneofthreeorfourpossibleactions
upontheexpiryofitsprogrammedtimeperiod,unlessthewatchdogisfedordisabled. Theactionsare:
EspressifSystems 31 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
interrupt,CPUreset,corereset,andsystemreset. OnlytheRWDTcantriggerthesystemreset,andisableto
resettheentirechip,includingtheRTCitself. Atimeoutvaluecanbesetforeachstageindividually.
DuringflashboottheRWDTandthefirstMWDTstartautomaticallyinordertodetect,andrecoverfrom,
bootingproblems.
Thewatchdogshavethefollowingfeatures:
• Fourstages,eachofwhichcanbeconfiguredordisabledseparately
• Aprogrammabletimeperiodforeachstage
• Oneofthreeorfourpossibleactions(interrupt,CPUreset,corereset,andsystemreset)upontheexpiry
ofeachstage
• 32-bitexpirycounter
• WriteprotectionthatpreventstheRWDTandMWDTconfigurationfrombeinginadvertentlyaltered
• SPIflashbootprotection
IfthebootprocessfromanSPIflashdoesnotcompletewithinapredeterminedtimeperiod,the
watchdogwillreboottheentiresystem.
Fordetails,seeESP32TechnicalReferenceManual>ChapterWatchdogTimers.
4.5 Cryptographic Hardware Accelerators
ESP32isequippedwithhardwareacceleratorsofgeneralalgorithms,suchasAES(FIPSPUB197),SHA(FIPS
PUB180-4),andRSA.Thechipalsosupportsindependentarithmetic,suchaslarge-numbermodular
multiplicationandlarge-numbermultiplication. ThemaximumoperationlengthforRSA,large-numbermodular
multiplication,andlarge-numbermultiplicationis4096bits.
Thehardwareacceleratorsgreatlyimproveoperationspeedandreducesoftwarecomplexity. Theyalso
supportcodeencryptionanddynamicdecryption,whichensuresthatcodeintheflashwillnotbe
hacked.
4.6 Radio and Wi-Fi
Theradiomoduleconsistsofthefollowingblocks:
• 2.4GHzreceiver
• 2.4GHztransmitter
• Biasandregulators
• Balunandtransmit-receiveswitch
• Clockgenerator
4.6.1 2.4 GHz Receiver
The2.4GHzreceiverdemodulatesthe2.4GHzRFsignaltoquadraturebasebandsignalsandconvertsthem
tothedigitaldomainwithtwohigh-resolution,high-speedADCs. Toadapttovaryingsignalchannel
conditions,RFfilters,AutomaticGainControl(AGC),DCoffsetcancelationcircuitsandbasebandfiltersare
integratedinthechip.
EspressifSystems 32 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.6.2 2.4 GHz Transmitter
The2.4GHztransmittermodulatesthequadraturebasebandsignalstothe2.4GHzRFsignal,anddrivesthe
antennawithahigh-poweredComplementaryMetalOxideSemiconductor(CMOS)poweramplifier. Theuseof
digitalcalibrationfurtherimprovesthelinearityofthepoweramplifier,enablingstate-of-the-artperformancein
deliveringupto+20.5dBmofpowerforan802.11btransmissionand+18dBmforan802.11ntransmission.
Additionalcalibrationsareintegratedtocancelanyradioimperfections,suchas:
• Carrierleakage
• I/Qphasematching
• Basebandnonlinearities
• RFnonlinearities
• Antennamatching
Thesebuilt-incalibrationroutinesreducetheamountoftimerequiredforproducttesting,andrenderthe
testingequipmentunnecessary.
4.6.3 Clock Generator
Theclockgeneratorproducesquadratureclocksignalsof2.4GHzforboththereceiverandthetransmitter. All
componentsoftheclockgeneratorareintegratedintothechip,includingallinductors,varactors,filters,
regulatorsanddividers.
Theclockgeneratorhasbuilt-incalibrationandself-testcircuits. Quadratureclockphasesandphasenoise
areoptimizedon-chipwithpatentedcalibrationalgorithmswhichensurethebestperformanceofthereceiver
andthetransmitter.
4.6.4 Wi-Fi Radio and Baseband
ESP32implementsaTCP/IPandfull802.11b/g/nWi-FiMACprotocol. ItsupportstheBasicServiceSet(BSS)
STAandSoftAPoperationsundertheDistributedControlFunction(DCF).Powermanagementishandledwith
minimalhostinteractiontominimizetheactive-dutyperiod.
TheESP32Wi-FiRadioandBasebandsupportthefollowingfeatures:
• 802.11b/g/n
• 802.11nMCS0-7inboth20MHzand40MHzbandwidth
• 802.11nMCS32(RX)
• 802.11n0.4µsguard-interval
• upto150Mbpsofdatarate
• ReceivingSTBC2×1
• Upto20.5dBmoftransmittingpower
• Adjustabletransmittingpower
• Antennadiversity
ESP32supportsantennadiversitywithanexternalRFswitch. OneormoreGPIOscontroltheRFswitch
andselectsthebestantennatominimizetheeffectsofchannelfading.
EspressifSystems 33 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.6.5 Wi-Fi MAC
TheESP32Wi-FiMACapplieslow-levelprotocolfunctionsautomatically. Theyareasfollows:
• FourvirtualWi-Fiinterfaces
• SimultaneousInfrastructureBSSStationmode/SoftAPmode/Promiscuousmode
• RTSprotection,CTSprotection,ImmediateBlockACK
• Defragmentation
• TX/RXA-MPDU,RXA-MSDU
• TXOP
• WMM
• CCMP(CBC-MAC,countermode),TKIP(MIC,RC4),WAPI(SMS4),WEP(RC4)andCRC
• Automaticbeaconmonitoring(hardwareTSF)
4.7 Bluetooth
ThechipintegratesaBluetoothlinkcontrollerandBluetoothbaseband,whichcarryoutthebaseband
protocolsandotherlow-levellinkroutines,suchasmodulation/demodulation,packetprocessing,bitstream
processing,frequencyhopping,etc.
4.7.1 Bluetooth Radio and Baseband
TheBluetoothRadioandBasebandsupportthefollowingfeatures:
• Class-1,class-2andclass-3transmitoutputpowers,andadynamiccontrolrangeofupto21dB
• π/4DQPSKand8DPSKmodulation
• HighperformanceinNZIFreceiversensitivitywithaminimumsensitivityof-94dBm
• Class-1operationwithoutexternalPA
• InternalSRAMallowsfull-speeddata-transfer,mixedvoiceanddata,andfullpiconetoperation
• Logicforforwarderrorcorrection,headererrorcontrol,accesscodecorrelation,CRC,demodulation,
encryptionbitstreamgeneration,whiteningandtransmitpulseshaping
• ACL,SCO,eSCO,andAFH
• A-law,µ-law,andCVSDdigitalaudioCODECinPCMinterface
• SBCaudioCODEC
• Powermanagementforlow-powerapplications
• SMPwith128-bitAES
4.7.2 Bluetooth Interface
• ProvidesUARTHCIinterface,upto4Mbps
• ProvidesSDIO/SPIHCIinterface
• ProvidesPCM/I2Saudiointerface
EspressifSystems 34 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.7.3 Bluetooth Stack
TheBluetoothstackofthechipiscompliantwiththeBluetoothv4.2BR/EDRandBluetoothLEspecifications.
4.7.4 Bluetooth Link Controller
Thelinkcontrolleroperatesinthreemajorstates: standby,connectionandsniff. Itenablesmultiple
connections,andotheroperations,suchasinquiry,page,andsecuresimple-pairing,andthereforeenables
PiconetandScatternet. Belowarethefeatures:
• ClassicBluetooth
– DeviceDiscovery(inquiry,andinquiryscan)
– Connectionestablishment(page,andpagescan)
– Multi-connections
– Asynchronousdatareceptionandtransmission
– Synchronouslinks(SCO/eSCO)
– Master/SlaveSwitch
– AdaptiveFrequencyHoppingandChannelassessment
– Broadcastencryption
– Authenticationandencryption
– SecureSimple-Pairing
– Multi-pointandscatternetmanagement
– Sniffmode
– ConnectionlessSlaveBroadcast(transmitterandreceiver)
– EnhancedPowerControl
– Ping
• BluetoothLowEnergy
– Advertising
– Scanning
– Simultaneousadvertisingandscanning
– Multipleconnections
– Asynchronousdatareceptionandtransmission
– AdaptiveFrequencyHoppingandChannelassessment
– Connectionparameterupdate
– DataLengthExtension
– LinkLayerEncryption
– LEPing
EspressifSystems 35 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.8 Digital Peripherals
4.8.1 General Purpose Input / Output Interface (GPIO)
ESP32has34GPIOpinswhichcanbeassignedvariousfunctionsbyprogrammingtheappropriateregisters.
ThereareseveralkindsofGPIOs: digital-only,analog-enabled,capacitive-touch-enabled,etc. Analog-enabled
GPIOsandCapacitive-touch-enabledGPIOscanbeconfiguredasdigitalGPIOs.
MostofthedigitalGPIOscanbeconfiguredasinternalpull-uporpull-down,orsettohighimpedance. When
configuredasaninput,theinputvaluecanbereadthroughtheregister. Theinputcanalsobesetto
edge-triggerorlevel-triggertogenerateCPUinterrupts. MostofthedigitalIOpinsarebi-directional,
non-invertingandtristate,includinginputandoutputbufferswithtristatecontrol. Thesepinscanbe
multiplexedwithotherfunctions,suchastheSDIO,UART,SPI,etc. (Moredetailscanbefoundinthe
Appendix,TableIO_MUX. )Forlow-poweroperations,theGPIOscanbesettoholdtheirstates.
Fordetails,seeSection4.10PeripheralPinConfigurations,AppendixA–ESP32PinListsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.2 Serial Peripheral Interface (SPI)
ESP32integratesfourSPIcontrollerswhichcanbeusedtocommunicatewithexternaldevicesthatusethe
SPIprotocol. ControllerSPI0isusedasabufferforaccessingexternalmemory. ControllerSPI1canbeused
asamaster. ControllersSPI2andSPI3canbeconfiguredaseitheramasteroraslave.
SPI1,SPI2,andSPI3usesignalbusesprefixedwithSPI,HSPI,andVSPI,respectively.
FeaturesofGeneralPurposeSPI(GP-SPI)
• Programmabledatatransferlength,inmultiplesof1byte
• Four-linefull-duplex/half-duplexcommunicationandthree-linehalf-duplexcommunicationsupport
• Mastermodeandslavemode
• ProgrammableCPOLandCPHA
• Programmableclock
Fordetails,seeESP32TechnicalReferenceManual>ChapterSPIController.
PinAssignment
ForSPI,thepinsaremultiplexedwithGPIO6~GPIO11viatheIOMUX.ForHSPI,thepinsaremultiplexedwith
GPIO2,GPIO4,GPIO12~GPIO15viatheIOMUX.ForVSPI,thepinsaremultiplexedwithGPIO5,GPIO18~
GPIO19,GPIO21~GPIO23viatheIOMUX.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.3 Universal Asynchronous Receiver Transmitter (UART)
ESP32hasthreeUARTinterfacesthatfacilitatethetransmissionandreceptionofasynchronousserialdata
betweenthechipandexternalUARTdevices.
EspressifSystems 36 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• Programmablebaudratesupto5MBaud
• RAMsharedbyTXFIFOsandRXFIFOs
• Supportsinputbaudrateself-check
• Supportforvariouslengthsofdatabitsandstopbits
• Paritybitsupport
• Asynchronouscommunication(RS232andRS485)andIrDAsupport
• SupportsDMAtocommunicatedatainhighspeed
• SupportsUARTwake-up
• Supportsbothsoftwareandhardwareflowcontrol
Fordetails,seeESP32TechnicalReferenceManual>ChapterUARTController.
PinAssignment
ThepinsforUARTcanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.4 I2C Interface
ESP32hastwoI2CbusinterfaceswhichcanserveasI2Cmasterorslave,dependingontheuser’s
configuration.
FeatureList
• Standardmode(100Kbit/s)
• Fastmode(400Kbit/s)
• Upto5MHz,yetconstrainedbySDApull-upstrength
• Supportfor7-bitand10-bitaddressing,aswellasdualaddressmode
• SupportscontinuousdatatransmissionwithdisabledSerialClockLine(SCL)
• Supportsprogrammabledigitalnoisefilter
UserscanprogramcommandregisterstocontrolI2Cinterfaces,sothattheyhavemoreflexibility.
Fordetails,seeESP32TechnicalReferenceManual>ChapterI2CController.
PinAssignment
ForregularI2C,thepinsusedcanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
EspressifSystems 37 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
4.8.5 I2S Interface
TheI2SControllerintheESP32chipprovidesaflexiblecommunicationinterfaceforstreamingdigitaldatain
multimediaapplications,particularlydigitalaudioapplications.
FeatureList
• Mastermodeandslavemode
• Full-duplexandhalf-duplexcommunications
• Avarietyofaudiostandardssupported
• Configurablehigh-precisionoutputclock
• SupportsPDMsignalinputandoutput
• Configurabledatatransmitandreceivemodes
Fordetails,seeESP32TechnicalReferenceManual>ChapterI2SController.
PinAssignment
ThepinsfortheI2SControllercanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.6 Remote Control Peripheral
TheRemoteControlPeripheral(RMT)controlsthetransmissionandreceptionofinfraredremotecontrol
signals.
FeatureList
• Eightchannelsforsendingandreceivinginfraredremotecontrolsignals
• Independenttransmissionandreceptioncapabilitiesforeachchannel
• Clockdividercounter,statemachine,andreceiverforeachRXchannel
• Supportsvariousinfraredprotocols
Fordetails,seeESP32TechnicalReferenceManual>ChapterRemoteControlPeripheral.
PinAssignment
ThepinsfortheRemoteControlPeripheralcanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.7 Pulse Counter Controller (PCNT)
Thepulsecountercontroller(PCNT)isdesignedtocountinputpulsesbytrackingrisingandfallingedgesof
theinputpulsesignal.
EspressifSystems 38 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• Eightindependentpulsecounterunits
• Eachpulsecounterunithasa16-bitsignedcounterregisterandtwochannels
• Countermodes: increment,decrement,ordisable
• Glitchfilteringforinputpulsesignalsandcontrolsignals
• Selectionbetweencountingonrisingorfallingedgesoftheinputpulsesignal
Fordetails,seeESP32TechnicalReferenceManual>ChapterPulseCountController.
PinAssignment
ThepinsforthePulseCountControllercanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.8 LED PWM Controller
TheLEDPWMController(LEDC)isdesignedtogeneratePWMsignalsforLEDcontrol.
FeatureList
• SixteenindependentPWMgenerators
• MaximumPWMdutycycleresolutionof20bits
• Eightindependenttimerswith20-bitcounters,configurablefractionalclockdividersandcounter
overflowvalues
• AdjustablephaseofPWMsignaloutput
• PWMdutycycledithering
• Automaticdutycyclefading
Fordetails,seeESP32TechnicalReferenceManual>ChapterLEDPWMController.
PinAssignment
ThepinsfortheLEDPWMControllercanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.9 Motor Control PWM
ThePulseWidthModulation(PWM)controllercanbeusedfordrivingdigitalmotorsandsmartlights. The
controllerconsistsofPWMtimers,thePWMoperatorandadedicatedcapturesub-module. Eachtimer
providestiminginsynchronousorindependentform,andeachPWMoperatorgeneratesawaveformforone
PWMchannel. Thededicatedcapturesub-modulecanaccuratelycaptureeventswithexternaltiming.
EspressifSystems 39 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• ThreePWMtimersforprecisetimingandfrequencycontrol
– EveryPWMtimerhasadedicated8-bitclockprescaler
– The16-bitcounterinthePWMtimercanworkincount-upmode,count-downmode,or
count-up-downmode
– AhardwaresynccantriggerareloadonthePWMtimerwithaphaseregister. Itwillalsotriggerthe
prescaler’restart,sothatthetimer’sclockcanalsobesynced,withselectablehardware
synchronizationsource
• ThreePWMoperatorsforgeneratingwaveformpairs
– SixPWMoutputstooperateinseveraltopologies
– Configurabledeadtimeonrisingandfallingedges;eachsetupindependently
– ModulatingofPWMoutputbyhigh-frequencycarriersignals,usefulwhengatedriversareinsulated
withatransformer
• FaultDetectionmodule
– Programmablefaulthandlinginbothcycle-by-cyclemodeandone-shotmode
– AfaultconditioncanforcethePWMoutputtoeitherhighorlowlogiclevels
• Capturemoduleforhardware-basedsignalprocessing
– Speedmeasurementofrotatingmachinery
– Measurementofelapsedtimebetweenpositionsensorpulses
– Periodanddutycyclemeasurementofpulsetrainsignals
– Decodingcurrentorvoltageamplitudederivedfromduty-cycle-encodedsignalsofcurrent/voltage
sensors
– Threeindividualcapturechannels,eachofwhichwitha32-bittime-stampregister
– Selectionofedgepolarityandprescalingofinputcapturesignals
– ThecapturetimercansyncwithaPWMtimerorexternalsignals
Fordetails,seeESP32TechnicalReferenceManual>ChapterMotorControlPWM.
PinAssignment
ThepinsfortheMotorControlPWMcanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.10 SD/SDIO/MMC Host Controller
AnSD/SDIO/MMChostcontrollerisavailableonESP32.
EspressifSystems 40 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• Supportstwoexternalcards
• SupportsSDMemoryCardstandard: version3.0andversion3.01)
• SupportsSDIOVersion3.0
• SupportsConsumerElectronicsAdvancedTransportArchitecture(CE-ATAVersion1.1)
• SupportsMultimediaCards(MMCversion4.41,eMMCversion4.5andversion4.51)
Thecontrollerallowsupto80MHzclockoutputinthreedifferentdata-busmodes: 1-bit,4-bit,and8-bit
modes. ItsupportstwoSD/SDIO/MMC4.41cardsina4-bitdata-busmode. ItalsosupportsoneSDcard
operatingat1.8V.
Fordetails,seeESP32TechnicalReferenceManual>ChapterSD/MMCHostController.
PinAssignment
ThepinsforSD/SDIO/MMCHostControlleraremultiplexedwithGPIO2,GPIO4,GPIO6~GPIO15viaIO
MUX.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.11 SDIO/SPI Slave Controller
ESP32integratesanSDdeviceinterfacethatconformstotheindustry-standardSDIOCardSpecification
Version2.0,andallowsahostcontrollertoaccesstheSoC,usingtheSDIObusinterfaceandprotocol. ESP32
actsastheslaveontheSDIObus. ThehostcanaccesstheSDIO-interfaceregistersdirectlyandcanaccess
sharedmemoryviaaDMAengine,thusmaximizingperformancewithoutengagingtheprocessorcores.
FeatureList
TheSDIO/SPIslavecontrollersupportsthefollowingfeatures:
• SPI,1-bitSDIO,and4-bitSDIOtransfermodesoverthefullclockrangefrom0to50MHz
• Configurablesamplinganddrivingclockedge
• Specialregistersfordirectaccessbyhost
• Interruptstohostforinitiatingdatatransfer
• AutomaticloadingofSDIObusdataandautomaticdiscardingofpaddingdata
• Blocksizeofupto512bytes
• Interruptvectorsbetweenthehostandtheslave,allowingbothtointerrupteachother
• SupportsDMAfordatatransfer
Fordetails,seeESP32TechnicalReferenceManual>ChapterSDIOSlaveController.
EspressifSystems 41 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
PinAssignment
ThepinsforSDIO/SPISlaveControlleraremultiplexedwithGPIO2,GPIO4,GPIO6~GPIO15viaIOMUX.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.12 TWAI® Controller
TheTwo-wireAutomotiveInterface(TWAI®)isamulti-master,multi-castcommunicationprotocoldesignedfor
automotiveapplications. TheTWAIcontrollerfacilitatesthecommunicationbasedonthisprotocol.
FeatureList
• CompatiblewithISO11898-1protocol(CANSpecification2.0)
• Standardframeformat(11-bitID)andextendedframeformat(29-bitID)
• Bitrates:
– From25Kbit/sto1Mbit/sinchiprevisionv0.0/v1.0/v1.1
– From12.5Kbit/sto1Mbit/sinchiprevisionv3.0/v3.1
• Multiplemodesofoperation: Normal,ListenOnly,andSelf-Test
• 64-bytereceiveFIFO
• Specialtransmissions: single-shottransmissionsandselfreception
• Acceptancefilter(singleanddualfiltermodes)
• Errordetectionandhandling: errorcounters,configurableerrorinterruptthreshold,errorcodecapture,
arbitrationlostcapture
Fordetails,seeESP32TechnicalReferenceManual>ChapterTwo-wireAutomotiveInterface(TWAI).
PinAssignment
ThepinsfortheTwo-wireAutomotiveInterfacecanbechosenfromanyGPIOsviatheGPIOMatrix.
Formoreinformationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.8.13 Ethernet MAC Interface
AnIEEE-802.3-2008-compliantMediaAccessController(MAC)isprovidedforEthernetLANcommunications.
ESP32requiresanexternalphysicalinterfacedevice(PHY)toconnecttothephysicalLANbus(twisted-pair,
fiber,etc.). ThePHYisconnectedtoESP32through17signalsofMIIorninesignalsofRMII.
FeatureList
• 10Mbpsand100Mbpsrates
• DedicatedDMAcontrollerallowinghigh-speedtransferbetweenthededicatedSRAMandEthernetMAC
• TaggedMACframe(VLANsupport)
EspressifSystems 42 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
• Half-duplex(CSMA/CD)andfull-duplexoperation
• MACcontrolsublayer(controlframes)
• 32-bitCRCgenerationandremoval
• Severaladdress-filteringmodesforphysicalandmulticastaddress(multicastandgroupaddresses)
• 32-bitstatuscodeforeachtransmittedorreceivedframe
• InternalFIFOstobuffertransmitandreceiveframes. ThetransmitFIFOandthereceiveFIFOareboth512
words(32-bit)
• HardwarePTP(PrecisionTimeProtocol)inaccordancewithIEEE15882008(PTPV2)
• 25MHz/50MHzclockoutput
Fordetails,seeESP32TechnicalReferenceManual>ChapterEthernetMediaAccessController(MAC).
PinAssignment
ForinformationaboutthepinassignmentofEthernetMACInterface,seeSection4.10PeripheralPin
ConfigurationsandESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.9 Analog Peripherals
4.9.1 Analog-to-Digital Converter (ADC)
ESP32integratestwo12-bitSARADCsandsupportsmeasurementson18channels(analog-enabledpins).
TheULPcoprocessorinESP32isalsodesignedtomeasurevoltage,whileoperatinginthesleepmode,which
enableslow-powerconsumption. TheCPUcanbewokenupbyathresholdsettingand/orviaother
triggers.
Table4-3describestheADCcharacteristics.
Table4-3. ADCCharacteristics
Parameter Description Min Max Unit
RTCcontroller;ADCconnectedtoan
DNL(Differentialnonlinearity) –7 7 LSB
external100nFcapacitor;DCsignalinput;
ambienttemperatureat25°C;
INL(Integralnonlinearity) –12 12 LSB
Wi-Fi&Bluetoothoff
RTCcontroller — 200 ksps
Samplingrate
DIGcontroller — 2 Msps
Notes:
• Whenatten=3andthemeasurementresultisabove3000(voltageatapprox. 2450mV),theADC
accuracywillbeworsethandescribedinthetableabove.
• TogetbetterDNLresults,userscantakemultiplesamplingtestswithafilter,orcalculatetheaverage
value.
EspressifSystems 43 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
• TheinputvoltagerangeofGPIOpinswithinVDD3P3_RTCdomainshouldstrictlyfollowtheDC
characteristicsprovidedinTable5-3. Otherwise,measurementerrorsmaybeintroduced,andchip
performancemaybeaffected.
Bydefault,thereare±6%differencesinmeasuredresultsbetweenchips. ESP-IDFprovidescoupleof
calibrationmethodsforADC1. ResultsaftercalibrationusingeFuseVrefvalueareshowninTable4-4. For
higheraccuracy,usersmayapplyothercalibrationmethodsprovidedinESP-IDF,orimplementtheir
own.
Table4-4. ADCCalibrationResults
Parameter Description Min Max Unit
Atten=0,effectivemeasurementrangeof100∼950mV –23 23 mV
Atten=1,effectivemeasurementrangeof100∼1250mV –30 30 mV
Totalerror
Atten=2,effectivemeasurementrangeof150∼1750mV –40 40 mV
Atten=3,effectivemeasurementrangeof150∼2450mV –60 60 mV
Fordetails,seeESP32TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
PinAssignment
Withappropriatesettings,theADCscanbeconfiguredtomeasurevoltageon18pinsmaximum. Fordetailed
informationaboutthepinassignment,seeSection4.10PeripheralPinConfigurationsand
ESP32TechnicalReferenceManual>ChapterIO_MUXandGPIOMatrix.
4.9.2 Digital-to-Analog Converter (DAC)
Two8-bitDACchannelscanbeusedtoconverttwodigitalsignalsintotwoanalogvoltagesignaloutputs. The
designstructureiscomposedofintegratedresistorstringsandabuffer. ThisdualDACsupportspowersupply
asinputvoltagereference. ThetwoDACchannelscanalsosupportindependentconversions.
Fordetails,seeESP32TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
PinAssignment
TheDACcanbeconfiguredbyGPIO25andGPIO26. Fordetailedinformationaboutthepinassignment,see
Section4.10PeripheralPinConfigurationsandESP32TechnicalReferenceManual>ChapterIO_MUXand
GPIOMatrix.
4.9.3 Touch Sensor
ESP32has10capacitive-sensingGPIOs,whichdetectvariationsinducedbytouchingorapproachingthe
GPIOswithafingerorotherobjects. Thelow-noisenatureofthedesignandthehighsensitivityofthecircuit
allowrelativelysmallpadstobeused. Arraysofpadscanalsobeused,sothatalargerareaormorepoints
canbedetected.
EspressifSystems 44 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
PinAssignment
The10capacitive-sensingGPIOsarelistedinTable4-5.
Table4-5. Capacitive-SensingGPIOsAvailableonESP32
Capacitive-SensingSignalName PinName
T0 GPIO4
T1 GPIO0
T2 GPIO2
T3 MTDO
T4 MTCK
T5 MTDI
T6 MTMS
T7 GPIO27
T8 32K_XN
T9 32K_XP
Fordetails,seeESP32TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
Note:
ESP32TouchSensorhasnotpassedtheConductedSusceptibility(CS)testfornow,andthushaslimitedapplication
scenarios.
EspressifSystems 45 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

4 FunctionalDescription
| 4.10 Peripheral | Pin Configurations |     |     |     |
| --------------- | ------------------ | --- | --- | --- |
Table4-6. PeripheralPinConfigurations
| Interface        | Signal   | Pin         | Function                 |                          |
| ---------------- | -------- | ----------- | ------------------------ | ------------------------ |
|                  | ADC1_CH0 | SENSOR_VP   |                          |                          |
|                  | ADC1_CH1 | SENSOR_CAPP |                          |                          |
|                  | ADC1_CH2 | SENSOR_CAPN |                          |                          |
|                  | ADC1_CH3 | SENSOR_VN   |                          |                          |
|                  | ADC1_CH4 | 32K_XP      |                          |                          |
|                  | ADC1_CH5 | 32K_XN      |                          |                          |
|                  | ADC1_CH6 | VDET_1      |                          |                          |
|                  | ADC1_CH7 | VDET_2      |                          |                          |
|                  | ADC2_CH0 | GPIO4       |                          |                          |
| ADC              |          |             | Two12-bitSARADCs         |                          |
|                  | ADC2_CH1 | GPIO0       |                          |                          |
|                  | ADC2_CH2 | GPIO2       |                          |                          |
|                  | ADC2_CH3 | MTDO        |                          |                          |
|                  | ADC2_CH4 | MTCK        |                          |                          |
|                  | ADC2_CH5 | MTDI        |                          |                          |
|                  | ADC2_CH6 | MTMS        |                          |                          |
|                  | ADC2_CH7 | GPIO27      |                          |                          |
|                  | ADC2_CH8 | GPIO25      |                          |                          |
|                  | ADC2_CH9 | GPIO26      |                          |                          |
|                  | DAC_1    | GPIO25      |                          |                          |
| DAC              |          |             | Two8-bitDACs             |                          |
|                  | DAC_2    | GPIO26      |                          |                          |
|                  | TOUCH0   | GPIO4       |                          |                          |
|                  | TOUCH1   | GPIO0       |                          |                          |
|                  | TOUCH2   | GPIO2       |                          |                          |
|                  | TOUCH3   | MTDO        |                          |                          |
|                  | TOUCH4   | MTCK        |                          |                          |
| TouchSensor      |          |             | Capacitivetouchsensors   |                          |
|                  | TOUCH5   | MTDI        |                          |                          |
|                  | TOUCH6   | MTMS        |                          |                          |
|                  | TOUCH7   | GPIO27      |                          |                          |
|                  | TOUCH8   | 32K_XN      |                          |                          |
|                  | TOUCH9   | 32K_XP      |                          |                          |
|                  | MTDI     | MTDI        |                          |                          |
|                  | MTCK     | MTCK        |                          |                          |
| JTAG             |          |             | JTAGforsoftwaredebugging |                          |
|                  | MTMS     | MTMS        |                          |                          |
|                  | MTDO     | MTDO        |                          |                          |
| EspressifSystems |          | 46          |                          | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

4 FunctionalDescription
| Interface       | Signal    | Pin   | Function |     |
| --------------- | --------- | ----- | -------- | --- |
|                 | HS2_CLK   | MTMS  |          |     |
|                 | HS2_CMD   | MTDO  |          |     |
| SD/SDIO/MMCHost | HS2_DATA0 | GPIO2 |          |     |
SupportsSDmemorycardV3.01standard
| Controller | HS2_DATA1 | GPIO4 |     |     |
| ---------- | --------- | ----- | --- | --- |
|            | HS2_DATA2 | MTDI  |     |     |
|            | HS2_DATA3 | MTCK  |     |     |
PWM0_OUT0~2
PWM1_OUT_IN0~2
Threechannelsof16-bittimersgenerate
PWM0_FLT_IN0~2
|     |     |     | PWMwaveforms. | Eachchannelhasapair |
| --- | --- | --- | ------------- | ------------------- |
PWM1_FLT_IN0~2
| MotorPWM |     | AnyGPIOPins | ofoutputsignals,threefaultdetection |     |
| -------- | --- | ----------- | ----------------------------------- | --- |
PWM0_CAP_IN0~2
signals,threeevent-capturesignals,and
PWM1_CAP_IN0~2
threesyncsignals.
PWM0_SYNC_IN0~2
PWM1_SYNC_IN0~2
|     | SD_CLK | MTMS |     |     |
| --- | ------ | ---- | --- | --- |
|     | SD_CMD | MTDO |     |     |
SDIOinterfacethatconformstothe
| SDIO/SPISlave | SD_DATA0 | GPIO2 |     |     |
| ------------- | -------- | ----- | --- | --- |
industrystandardSDIO2.0card
| Controller | SD_DATA1 | GPIO4 |     |     |
| ---------- | -------- | ----- | --- | --- |
specification
|     | SD_DATA2 | MTDI |     |     |
| --- | -------- | ---- | --- | --- |
|     | SD_DATA3 | MTCK |     |     |
U0RXD_in
U0CTS_in
U0DSR_in
U0TXD_out
U0RTS_out
U0DTR_out
|      | U1RXD_in |             | ThreeUARTdeviceswithhardware |     |
| ---- | -------- | ----------- | ---------------------------- | --- |
| UART |          | AnyGPIOPins |                              |     |
|      | U1CTS_in |             | flow-controlandDMA           |     |
U1TXD_out
U1RTS_out
U2RXD_in
U2CTS_in
U2TXD_out
U2RTS_out
I2CEXT0_SCL_in
I2CEXT0_SDA_in
I2CEXT1_SCL_in
I2CEXT1_SDA_in
| I2C |     | AnyGPIOPins | TwoI2Cdevicesinslaveormastermode |     |
| --- | --- | ----------- | -------------------------------- | --- |
I2CEXT0_SCL_out
I2CEXT0_SDA_out
I2CEXT1_SCL_out
I2CEXT1_SDA_out
| EspressifSystems |     | 47  |     | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

4 FunctionalDescription
| Interface | Signal             | Pin | Function                    |     |     |
| --------- | ------------------ | --- | --------------------------- | --- | --- |
|           | ledc_hs_sig_out0~7 |     | 16independentchannels@80MHz |     |     |
AnyGPIOPins
LEDPWM
|     | ledc_ls_sig_out0~7 |     | clock/RTCCLK.Dutyaccuracy: |     | 16bits. |
| --- | ------------------ | --- | -------------------------- | --- | ------- |
I2S0I_DATA_in0~15
I2S0O_BCK_in
I2S0O_WS_in
I2S0I_BCK_in
I2S0I_WS_in
I2S0I_H_SYNC
I2S0I_V_SYNC
I2S0I_H_ENABLE
I2S0O_BCK_out
I2S0O_WS_out
Stereoinputandoutputfrom/totheaudio
I2S0I_BCK_out
codec;parallelLCDdataoutput;parallel
I2S0I_WS_out
cameradatainput.
I2S0O_DATA_out0~23
| I2S |     | AnyGPIOPins |     |     |     |
| --- | --- | ----------- | --- | --- | --- |
I2S1I_DATA_in0~15
|     | I2S1O_BCK_in   |     | Note: I2S0_CLKandI2S1_CLKcanonly  |                     |     |
| --- | -------------- | --- | --------------------------------- | ------------------- | --- |
|     | I2S1O_WS_in    |     | bemappedtoGPIO0,U0RXD(GPIO3),or   |                     |     |
|     | I2S1I_BCK_in   |     | U0TXD(GPIO1)viaIOMUXbyselecting   |                     |     |
|     | I2S1I_WS_in    |     | GPIOfunctionsCLK_OUT1,CLK_OUT2,   |                     |     |
|     | I2S1I_H_SYNC   |     | andCLK_OUT3.                      | Formoreinformation, |     |
|     | I2S1I_V_SYNC   |     | seeESP32TechnicalReferenceManual> |                     |     |
|     | I2S1I_H_ENABLE |     | ChapterIO_MUXandGPIOMatrix>Table  |                     |     |
|     | I2S1O_BCK_out  |     | IOMUXPadSummary.                  |                     |     |
I2S1O_WS_out
I2S1I_BCK_out
I2S1I_WS_out
I2S1O_DATA_out0~23
|     | I2S0_CLK       | GPIO0,U0RXD, |                                    |     |     |
| --- | -------------- | ------------ | ---------------------------------- | --- | --- |
|     | I2S1_CLK       | orU0TXD      |                                    |     |     |
|     | RMT_SIG_IN0~7  |              | EightchannelsforanIRtransmitterand |     |     |
| RMT |                | AnyGPIOPins  |                                    |     |     |
|     | RMT_SIG_OUT0~7 |              | receiverofvariouswaveforms         |     |     |
HSPIQ_in/_out
StandardSPIconsistsofclock,
HSPID_in/_out
chip-select,MOSIandMISO.TheseSPIs
HSPICLK_in/_out
canbeconnectedtoLCDandother
HSPI_CS0_in/_out
|     |     |     | externaldevices. | Theysupportthe |     |
| --- | --- | --- | ---------------- | -------------- | --- |
HSPI_CS1_out
followingfeatures:
| GeneralPurpose | HSPI_CS2_out  |             |                            |     |     |
| -------------- | ------------- | ----------- | -------------------------- | --- | --- |
|                |               | AnyGPIOPins | • Bothmasterandslavemodes; |     |     |
| SPI            | VSPIQ_in/_out |             |                            |     |     |
• Foursub-modesoftheSPItransfer
VSPID_in/_out
format;
VSPICLK_in/_out
• ConfigurableSPIfrequency;
VSPI_CS0_in/_out
• Upto64bytesofFIFOandDMA.
VSPI_CS1_out
VSPI_CS2_out
| EspressifSystems |     | 48  |     | ESP32SeriesDatasheetv5.3 |     |
| ---------------- | --- | --- | --- | ------------------------ | --- |
SubmitDocumentationFeedback

4 FunctionalDescription
| Interface | Signal  | Pin       | Function |     |
| --------- | ------- | --------- | -------- | --- |
|           | SPIHD   | SD_DATA_2 |          |     |
|           | SPIWP   | SD_DATA_3 |          |     |
|           | SPICS0  | SD_CMD    |          |     |
|           | SPICLK  | SD_CLK    |          |     |
|           | SPIQ    | SD_DATA_0 |          |     |
|           | SPID    | SD_DATA_1 |          |     |
|           | HSPICLK | MTMS      |          |     |
|           | HSPICS0 | MTDO      |          |     |
SupportsStandardSPI,DualSPI,and
|              | HSPIQ | MTDI |                                |     |
| ------------ | ----- | ---- | ------------------------------ | --- |
| ParallelQSPI |       |      | QuadSPIthatcanbeconnectedtothe |     |
|              | HSPID | MTCK |                                |     |
externalflashandSRAM
|                  | HSPIHD           | GPIO4       |                                  |                          |
| ---------------- | ---------------- | ----------- | -------------------------------- | ------------------------ |
|                  | HSPIWP           | GPIO2       |                                  |                          |
|                  | VSPICLK          | GPIO18      |                                  |                          |
|                  | VSPICS0          | GPIO5       |                                  |                          |
|                  | VSPIQ            | GPIO19      |                                  |                          |
|                  | VSPID            | GPIO23      |                                  |                          |
|                  | VSPIHD           | GPIO21      |                                  |                          |
|                  | VSPIWP           | GPIO22      |                                  |                          |
|                  | EMAC_TX_CLK      | GPIO0       |                                  |                          |
|                  | EMAC_RX_CLK      | GPIO5       |                                  |                          |
|                  | EMAC_TX_EN       | GPIO21      |                                  |                          |
|                  | EMAC_TXD0        | GPIO19      |                                  |                          |
|                  | EMAC_TXD1        | GPIO22      |                                  |                          |
|                  | EMAC_TXD2        | MTMS        |                                  |                          |
|                  | EMAC_TXD3        | MTDI        |                                  |                          |
|                  | EMAC_RX_ER       | MTCK        |                                  |                          |
|                  | EMAC_RX_DV       | GPIO27      |                                  |                          |
|                  | EMAC_RXD0        | GPIO25      |                                  |                          |
| EMAC             | EMAC_RXD1        | GPIO26      | EthernetMACwithMII/RMIIinterface |                          |
|                  | EMAC_RXD2        | U0TXD       |                                  |                          |
|                  | EMAC_RXD3        | MTDO        |                                  |                          |
|                  | EMAC_CLK_OUT     | GPIO16      |                                  |                          |
|                  | EMAC_CLK_OUT_180 | GPIO17      |                                  |                          |
|                  | EMAC_TX_ER       | GPIO4       |                                  |                          |
|                  | EMAC_MDC_out     | AnyGPIOPins |                                  |                          |
|                  | EMAC_MDI_in      | AnyGPIOPins |                                  |                          |
|                  | EMAC_MDO_out     | AnyGPIOPins |                                  |                          |
|                  | EMAC_CRS_out     | AnyGPIOPins |                                  |                          |
|                  | EMAC_COL_out     | AnyGPIOPins |                                  |                          |
| EspressifSystems |                  | 49          |                                  | ESP32SeriesDatasheetv5.3 |
SubmitDocumentationFeedback

4 FunctionalDescription
Interface Signal Pin Function
pcnt_sig_ch0_in0
pcnt_sig_ch1_in0
pcnt_ctrl_ch0_in0
pcnt_ctrl_ch1_in0
pcnt_sig_ch0_in1
pcnt_sig_ch1_in1
pcnt_ctrl_ch0_in1
pcnt_ctrl_ch1_in1
pcnt_sig_ch0_in2
pcnt_sig_ch1_in2
pcnt_ctrl_ch0_in2
pcnt_ctrl_ch1_in2
pcnt_sig_ch0_in3
pcnt_sig_ch1_in3
pcnt_ctrl_ch0_in3
Operatinginsevendifferentmodes,the
pcnt_ctrl_ch1_in3
PulseCounter AnyGPIOPins pulsecountercapturespulseandcounts
pcnt_sig_ch0_in4
pulseedges.
pcnt_sig_ch1_in4
pcnt_ctrl_ch0_in4
pcnt_ctrl_ch1_in4
pcnt_sig_ch0_in5
pcnt_sig_ch1_in5
pcnt_ctrl_ch0_in5
pcnt_ctrl_ch1_in5
pcnt_sig_ch0_in6
pcnt_sig_ch1_in6
pcnt_ctrl_ch0_in6
pcnt_ctrl_ch1_in6
pcnt_sig_ch0_in7
pcnt_sig_ch1_in7
pcnt_ctrl_ch0_in7
pcnt_ctrl_ch1_in7
twai_rx
twai_tx CompatiblewithISO11898-1protocol
TWAI AnyGPIOPins
twai_bus_off_on (CANSpecification2.0)
twai_clkout
EspressifSystems 50 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| 5 Electrical | Characteristics |     |         |     |     |     |     |
| ------------ | --------------- | --- | ------- | --- | --- | --- | --- |
| 5.1 Absolute | Maximum         |     | Ratings |     |     |     |     |
StressesabovethoselistedinTable5-1AbsoluteMaximumRatingsmaycausepermanentdamagetothe
device. Thesearestressratingsonlyandnormaloperationofthedeviceattheseoranyotherconditions
beyondthoseindicatedinSection5.2RecommendedPowerSupplyCharacteristicsisnotimplied. Exposure
toabsolute-maximum-ratedconditionsforextendedperiodsmayaffectdevicereliability.
|           |     |     | Table5-1. AbsoluteMaximumRatings |     |     |     |      |
| --------- | --- | --- | -------------------------------- | --- | --- | --- | ---- |
| Parameter |     |     | Description                      |     | Min | Max | Unit |
VDDA,VDD3P3,VDD3P3_RTC,
|     |     |     | Allowedinputvoltage |     | –0.3 | 3.6 | V   |
| --- | --- | --- | ------------------- | --- | ---- | --- | --- |
VDD3P3_CPU,VDD_SDIO
1
| I output |     |     | CumulativeIOoutputcurrent |     | —   | 1200 | mA  |
| -------- | --- | --- | ------------------------- | --- | --- | ---- | --- |
| T STORE  |     |     | Storagetemperature        |     | –40 | 150  | °C  |
1TheproductprovedtobefullyfunctionalafterallitsIOpinswerepulledhighwhilebeingconnected
togroundfor24consecutivehoursatambienttemperatureof25°C.
| 5.2 Recommended         |     | Power     | Supply                                | Characteristics         |     |     |          |
| ----------------------- | --- | --------- | ------------------------------------- | ----------------------- | --- | --- | -------- |
|                         |     | Table5-2. | RecommendedPowerSupplyCharacteristics |                         |     |     |          |
| Parameter               |     |           | Description                           |                         | Min | Typ | Max Unit |
| VDDA,VDD3P3_RTC,VDD3P3, |     |           | Voltage                               | applied to power supply |     |     |          |
2.3/3.0note2
|                         |     |     |                                |     |     | 3.3     | 3.6 V |
| ----------------------- | --- | --- | ------------------------------ | --- | --- | ------- | ----- |
| VDD_SDIO(3.3Vmode)note1 |     |     | pinsperpowerdomain             |     |     |         |       |
| VDD3P3_CPU              |     |     | Voltageappliedtopowersupplypin |     |     | 1.8 3.3 | 3.6 V |
Currentdeliveredbyexternalpower
| I   |     |     |     |     |     | 0.5 | — — A |
| --- | --- | --- | --- | --- | --- | --- | ----- |
VDD
supply
| Tnote3 |     |     | Operatingtemperature |     |     | –40 | — 125 °C |
| ------ | --- | --- | -------------------- | --- | --- | --- | -------- |
•
1. VDD_SDIOworksasthepowersupplyfortherelatedIO,andalsoforanexternaldevice. Pleaserefertothe
AppendixIO_MUXofthisdatasheetformoredetails.
•
VDD_SDIOcanbesourcedinternallybytheESP32fromtheVDD3P3_RTCpowerdomain:
– WhenVDD_SDIOoperatesat3.3V,itisdrivendirectlybyVDD3P3_RTCthrougha6Ωresistor,therefore,
therewillbesomevoltagedropfromVDD3P3_RTC.
– WhenVDD_SDIOoperatesat1.8V,itcanbegeneratedfromESP32’sinternalLDO.Themaximumcurrent
thisLDOcanofferis40mA,andtheoutputvoltagerangeis1.65V~2.0V.
• VDD_SDIOcanalsobedrivenbyanexternalpowersupply.
• PleaserefertoSection2.5.2PowerScheme,formoreinformation.
2. • Chipswitha3.3VflashorPSRAMin-package: thisminimumvoltageis3.0V;
| • ChipswithnoflashorPSRAMin-package: |     |     |     | thisminimumvoltageis2.3V; |     |     |     |
| ------------------------------------ | --- | --- | --- | ------------------------- | --- | --- | --- |
•
Formoreinformation,seeSection1ESP32SeriesComparison.
3. TheoperatingtemperatureofESP32-U4WDHandESP32-D0WDRH2-V3rangesfrom–40°Cto85°C,duetothe
in-packageflashorPSRAM.Forotherchipsthathavenoin-packageflashorPSRAM,theiroperatingtemperatureis
–40°C~125°C.
| EspressifSystems |     |     |     | 51  | ESP32SeriesDatasheetv5.3 |     |     |
| ---------------- | --- | --- | --- | --- | ------------------------ | --- | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| 5.3 | DC        | Characteristics        |     | (3.3        | V, 25                        | °C) |           |      |     |           |      |      |
| --- | --------- | ---------------------- | --- | ----------- | ---------------------------- | --- | --------- | ---- | --- | --------- | ---- | ---- |
|     |           |                        |     | Table5-3.   | DCCharacteristics(3.3V,25°C) |     |           |      |     |           |      |      |
|     | Parameter |                        |     | Description |                              |     |           | Min  | Typ |           | Max  | Unit |
|     | C IN      | Pincapacitance         |     |             |                              |     |           | —    |     | 2         | —    | pF   |
|     |           |                        |     |             |                              |     | 0.75×VDD1 |      |     | VDD1      |      |      |
|     | V IH      | High-levelinputvoltage |     |             |                              |     |           |      | —   |           | +0.3 | V    |
|     | V         | Low-levelinputvoltage  |     |             |                              |     |           | –0.3 | —   | 0.25×VDD1 |      | V    |
IL
|     | I   | High-levelinputcurrent |     |     |     |     |     | —   | —   |     | 50  | nA  |
| --- | --- | ---------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
IH
|     | I   | Low-levelinputcurrent |     |     |     |     |     | —   | —   |     | 50  | nA  |
| --- | --- | --------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
IL
|     | V   | High-leveloutputvoltage |     |     |     |     | 0.8×VDD1 |     | —   |     | —   | V   |
| --- | --- | ----------------------- | --- | --- | --- | --- | -------- | --- | --- | --- | --- | --- |
OH
0.1×VDD1
|     | V OL | Low-leveloutputvoltage |     |     |     |     |     | —   | —   |     |     | V   |
| --- | ---- | ---------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
VDD3P3_CPU
|     |     | High-levelsourcecurrent |     |     |               |     |     | —   | 40  |     | —   | mA  |
| --- | --- | ----------------------- | --- | --- | ------------- | --- | --- | --- | --- | --- | --- | --- |
|     |     |                         |     |     | powerdomain1, | 2   |     |     |     |     |     |     |
(VDD1
=3.3V,
VDD3P3_RTC
|     | I OH | V OH | >=2.64V, |     |               |     |     | —   | 40  |     | —   | mA  |
| --- | ---- | ---- | -------- | --- | ------------- | --- | --- | --- | --- | --- | --- | --- |
|     |      |      |          |     | powerdomain1, | 2   |     |     |     |     |     |     |
outputdrivestrengthset
|     |     |               |     |     | VDD_SDIO | power |     |     |     |     |     |     |
| --- | --- | ------------- | --- | --- | -------- | ----- | --- | --- | --- | --- | --- | --- |
|     |     | tothemaximum) |     |     |          |       |     | —   | 20  |     | —   | mA  |
|     |     |               |     |     | domain1, | 3     |     |     |     |     |     |     |
Low-levelsinkcurrent
(VDD1
|     | I OL |     | =3.3V,V | OL =0.495V, |     |     |     | —   | 28  |     | —   | mA  |
| --- | ---- | --- | ------- | ----------- | --- | --- | --- | --- | --- | --- | --- | --- |
outputdrivestrengthsettothemaximum)
|     | R   | Resistanceofinternalpull-upresistor |     |     |     |     |     | —   | 45  |     | —   | kΩ  |
| --- | --- | ----------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
PU
|     | R   | Resistanceofinternalpull-downresistor |     |     |     |     |     | —   | 45  |     | —   | kΩ  |
| --- | --- | ------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
PD
Chipresetreleasevoltage(CHIP_PUvoltage
|     |           |     |     |     |     |     | 0.75×VDD1 |     |     | VDD1 |      |     |
| --- | --------- | --- | --- | --- | --- | --- | --------- | --- | --- | ---- | ---- | --- |
|     | V IH_nRST |     |     |     |     |     |           |     | —   |      | +0.3 | V   |
iswithinthespecifiedrange)
Low-levelinputvoltageofCHIP_PU
|     | V   |     |     |     |     |     |     | —   | —   |     | 0.6 | V   |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
IL_nRST
toshutdownthechip
1. PleaseseeTableIO_MUXforIO’spowerdomain. VDDistheI/Ovoltageforaparticularpowerdomainofpins.
2. ForVDD3P3_CPUandVDD3P3_RTCpowerdomain,per-pincurrentsourcedinthesamedomainisgradually
reducedfromaround40mAtoaround29mA,VOH>=2.64V,asthenumberofcurrent-sourcepinsincreases.
3. ForVDD_SDIOpowerdomain,per-pincurrentsourcedinthesamedomainisgraduallyreducedfromaround30mA
toaround10mA,VOH>=2.64V,asthenumberofcurrent-sourcepinsincreases.
| 5.4 | RF  | Current | Consumption |     | in Active | Mode |     |     |     |     |     |     |
| --- | --- | ------- | ----------- | --- | --------- | ---- | --- | --- | --- | --- | --- | --- |
Thecurrentconsumptionmeasurementsaretakenwitha3.3Vsupplyat25°Cofambienttemperatureatthe
RFport. Alltransmitters’measurementsarebasedona50%dutycycle.
|                  |                                         |     | Table5-4. | CurrentConsumptionDependingonRFModes |     |     |     |     |                          |     |          |     |
| ---------------- | --------------------------------------- | --- | --------- | ------------------------------------ | --- | --- | --- | --- | ------------------------ | --- | -------- | --- |
|                  | WorkMode                                |     |           |                                      |     |     |     | Min |                          | Typ | Max Unit |     |
|                  | Transmit802.11b,DSSS1Mbps,POUT=+19.5dBm |     |           |                                      |     |     |     | —   |                          | 240 | —        | mA  |
|                  | Transmit802.11g,OFDM54Mbps,POUT=+16dBm  |     |           |                                      |     |     |     | —   |                          | 190 | —        | mA  |
|                  | Transmit802.11n,OFDMMCS7,POUT=+14dBm    |     |           |                                      |     |     |     | —   |                          | 180 | —        | mA  |
|                  | Receive802.11b/g/n                      |     |           |                                      |     |     |     | —   | 95~100                   |     | —        | mA  |
| EspressifSystems |                                         |     |           |                                      |     | 52  |     |     | ESP32SeriesDatasheetv5.3 |     |          |     |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
|     | WorkMode                 |     |     |     |     |     | Min | Typ    |     | Max Unit |
| --- | ------------------------ | --- | --- | --- | --- | --- | --- | ------ | --- | -------- |
|     | TransmitBT/BLE,POUT=0dBm |     |     |     |     |     | —   |        | 130 | — mA     |
|     | ReceiveBT/BLE            |     |     |     |     |     | —   | 95~100 |     | — mA     |
5.5 Reliability
|     |                        |                 | Table5-5. | ReliabilityQualifications |     |     |     |     |              |     |
| --- | ---------------------- | --------------- | --------- | ------------------------- | --- | --- | --- | --- | ------------ | --- |
|     | TestItem               | TestConditions  |           |                           |     |     |     |     | TestStandard |     |
|     | HTOL (High Temperature |                 |           |                           |     |     |     |     |              |     |
|     |                        | 125°C,1000hours |           |                           |     |     |     |     | JESD22-A108  |     |
OperatingLife)
|     | ESD(Electro-Static | HBM(HumanBodyMode)1 |     |     | ±2000V |     |     |     | JS-001 |     |
| --- | ------------------ | ------------------- | --- | --- | ------ | --- | --- | --- | ------ | --- |
CDM(ChargeDeviceMode)2
|     | DischargeSensitivity) |     |     |     | ±500V |     |     |     | JS-002 |     |
| --- | --------------------- | --- | --- | --- | ----- | --- | --- | --- | ------ | --- |
Currenttrigger±200mA
|     | Latchup |     |     |     |     |     |     |     | JESD78 |     |
| --- | ------- | --- | --- | --- | --- | --- | --- | --- | ------ | --- |
Voltagetrigger1.5×VDD
max
|     |     | Bake24hours@125°C |     |     |     |     |     |     | J-STD-020, |     |
| --- | --- | ----------------- | --- | --- | --- | --- | --- | --- | ---------- | --- |
Preconditioning Moisturesoak(level3: 192hours@30°C,60%RH) JESD47,
|     |     | IR  | reflow solder: | 260 + | 0 °C, | 20 seconds, |     | three | JESD22-A113 |     |
| --- | --- | --- | -------------- | ----- | ----- | ----------- | --- | ----- | ----------- | --- |
times
TCT(TemperatureCycling
|     |     | –65°C/150°C,500cycles |     |     |     |     |     |     | JESD22-A104 |     |
| --- | --- | --------------------- | --- | --- | --- | --- | --- | --- | ----------- | --- |
Test)
|     | AutoclaveTest        | 121°C,100%RH,96hours |     |     |     |     |     |     | JESD22-A102 |     |
| --- | -------------------- | -------------------- | --- | --- | --- | --- | --- | --- | ----------- | --- |
|     | uHAST (Highly Accel- |                      |     |     |     |     |     |     |             |     |
|     |                      | 130°C,85%RH,96hours  |     |     |     |     |     |     | JESD22-A118 |     |
|     | erated Stress Test,  |                      |     |     |     |     |     |     |             |     |
unbiased)
|     | HTSL (High Temperature |                 |     |     |     |     |     |     |             |     |
| --- | ---------------------- | --------------- | --- | --- | --- | --- | --- | --- | ----------- | --- |
|     |                        | 150°C,1000hours |     |     |     |     |     |     | JESD22-A103 |     |
StorageLife)
1. JEDECdocumentJEP155statesthat500VHBMallowssafemanufacturingwithastandardESDcontrolprocess.
2. JEDECdocumentJEP157statesthat250VCDMallowssafemanufacturingwithastandardESDcontrolprocess.
5.6 Wi-Fi Radio
|     |                              | Table5-6. | Wi-FiRadioCharacteristics |     |     |      |         |     |      |      |
| --- | ---------------------------- | --------- | ------------------------- | --- | --- | ---- | ------- | --- | ---- | ---- |
|     | Parameter                    |           | Description               |     |     | Min  |         | Typ | Max  | Unit |
|     | Operatingfrequencyrangenote1 |           | —                         |     |     | 2412 |         | —   | 2484 | MHz  |
|     | Outputimpedancenote2         |           |                           |     |     |      |         |     |      | Ω    |
|     |                              |           | -                         |     |     |      | - note2 |     | —    |      |
|     |                              |           | 11n,MCS7                  |     |     |      | 12      | 13  | 14   | dBm  |
TXpowernote3
|     |     |     | 11bmode    |     |     | 18.5 |     | 19.5 | 20.5 | dBm |
| --- | --- | --- | ---------- | --- | --- | ---- | --- | ---- | ---- | --- |
|     |     |     | 11b,1Mbps  |     |     |      | —   | –98  | —    | dBm |
|     |     |     | 11b,11Mbps |     |     |      | —   | –88  | —    | dBm |
|     |     |     | 11g,6Mbps  |     |     |      | —   | –93  | —    | dBm |
|     |     |     | 11g,54Mbps |     |     |      | —   | –75  | —    | dBm |
Sensitivity
| EspressifSystems |     |     |     | 53  |     |     |     | ESP32SeriesDatasheetv5.3 |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --- | ------------------------ | --- | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
|     | Parameter |     |     | Description   |     | Min | Typ | Max | Unit  |
| --- | --------- | --- | --- | ------------- | --- | --- | --- | --- | ----- |
|     |           |     |     | 11n,HT20,MCS0 |     | —   | –93 |     | — dBm |
|     |           |     |     | 11n,HT20,MCS7 |     | —   | –73 |     | — dBm |
|     |           |     |     | 11n,HT40,MCS0 |     | —   | –90 |     | — dBm |
–70
|     |     |     |     | 11n,HT40,MCS7 |     | —   |     |     | — dBm |
| --- | --- | --- | --- | ------------- | --- | --- | --- | --- | ----- |
|     |     |     |     | 11g,6Mbps     |     | —   | 27  |     | — dB  |
|     |     |     |     | 11g,54Mbps    |     | —   |     | 13  | — dB  |
Adjacentchannelrejection
|     |     |     |     | 11n,HT20,MCS0 |     | —   | 27  |     | — dB |
| --- | --- | --- | --- | ------------- | --- | --- | --- | --- | ---- |
|     |     |     |     | 11n,HT20,MCS7 |     | —   |     | 12  | — dB |
1. Deviceshouldoperateinthefrequencyrangeallocatedbyregionalregulatoryauthorities. Targetoperating
frequencyrangeisconfigurablebysoftware.
2. ThetypicalvalueoftheWi-FiradiooutputimpedanceisdifferentbetweenchipsindifferentQFNpackages. For
chipsinaQFN6×6package,thevalueis30+j10Ω. ForchipsinaQFN5×5package,thevalueis35+j10Ω.
3. TargetTXpowerisconfigurablebasedondeviceorcertificationrequirements.
| 5.7   | Bluetooth | Radio       |      |     |     |     |     |     |     |
| ----- | --------- | ----------- | ---- | --- | --- | --- | --- | --- | --- |
| 5.7.1 | Receiver  | –Basic Data | Rate |     |     |     |     |     |     |
Table5-7. ReceiverCharacteristics–BasicDataRate
|     | Parameter                     |     |     |     | Description |     | Min | Typ | Max Unit |
| --- | ----------------------------- | --- | --- | --- | ----------- | --- | --- | --- | -------- |
|     | Sensitivity@0.1%BER           |     |     |     | —           |     | –90 | –89 | –88 dBm  |
|     | Maximumreceivedsignal@0.1%BER |     |     |     | —           |     | 0   | —   | — dBm    |
|     | Co-channelC/I                 |     |     |     | —           |     | —   | +7  | — dB     |
|     |                               |     |     |     | F=F0+1MHz   |     | —   | —   | –6 dB    |
|     |                               |     |     |     | F=F0–1MHz   |     | —   | —   | –6 dB    |
|     |                               |     |     |     | F=F0+2MHz   |     | —   | —   | –25 dB   |
AdjacentchannelselectivityC/I
|     |     |     |     |     | F=F0–2MHz |     | —   | —   | –33 dB |
| --- | --- | --- | --- | --- | --------- | --- | --- | --- | ------ |
|     |     |     |     |     | F=F0+3MHz |     | —   | —   | –25 dB |
|     |     |     |     |     | F=F0–3MHz |     | —   | —   | –45 dB |
–10
|     |     |     |     |     | 30MHz~2000MHz   |     |     | —   | — dBm |
| --- | --- | --- | --- | --- | --------------- | --- | --- | --- | ----- |
|     |     |     |     |     | 2000MHz~2400MHz |     | –27 | —   | — dBm |
Out-of-bandblockingperformance
|       |                 |           |      |                                          | 2500MHz~3000MHz |     | –27 | —   | — dBm    |
| ----- | --------------- | --------- | ---- | ---------------------------------------- | --------------- | --- | --- | --- | -------- |
|       |                 |           |      |                                          | 3000MHz~12.5GHz |     | –10 | —   | — dBm    |
|       | Intermodulation |           |      |                                          | —               |     | –36 | —   | — dBm    |
| 5.7.2 | Transmitter     | –Basic    | Data | Rate                                     |                 |     |     |     |          |
|       |                 | Table5-8. |      | TransmitterCharacteristics–BasicDataRate |                 |     |     |     |          |
|       | Parameter       |           |      |                                          | Description     |     | Min | Typ | Max Unit |
RFtransmitpowernote1
|                  |                 |     |     |     | —   |     | —                        | 0   | — dBm |
| ---------------- | --------------- | --- | --- | --- | --- | --- | ------------------------ | --- | ----- |
|                  | Gaincontrolstep |     |     |     | —   |     | —                        | 3   | — dB  |
| EspressifSystems |                 |     |     |     | 54  |     | ESP32SeriesDatasheetv5.3 |     |       |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| Parameter                    |     |     | Description | Min Typ | Max Unit |
| ---------------------------- | --- | --- | ----------- | ------- | -------- |
| RFpowercontrolrange          |     |     | —           | –12 —   | +9 dBm   |
| +20dBbandwidth               |     |     | —           | — 0.9   | — MHz    |
|                              |     |     | F=F0±2MHz   | — –47   | — dBm    |
| Adjacentchanneltransmitpower |     |     | F=F0±3MHz   | — –55   | — dBm    |
|                              |     |     | F=F0±>3MHz  | — –60   | — dBm    |
| ∆f1                          |     |     | —           | — —     | 155 kHz  |
avg
| ∆f2 |     |     | —   | 133.7 — | — kHz |
| --- | --- | --- | --- | ------- | ----- |
max
| ∆f2 /∆f1   |     |     | —   | — 0.92 | — —        |
| ---------- | --- | --- | --- | ------ | ---------- |
| avg        | avg |     |     |        |            |
| ICFT       |     |     | —   | — –7   | — kHz      |
| Driftrate  |     |     | —   | — 0.7  | — kHz/50µs |
| Drift(DH1) |     |     | —   | —      | 6 — kHz    |
| Drift(DH5) |     |     | —   | —      | 6 — kHz    |
1. Thereareintotaleightpowerlevelsfromlevel0tolevel7,withtransmitpowerrangingfrom–12dBmto9dBm.
Whenthepowerlevelrisesby1,thetransmitpowerincreasesby3dB.Powerlevel4isusedbydefaultandthe
correspondingtransmitpoweris0dBm.
| 5.7.3 Receiver | –Enhanced | Data Rate                                |             |         |          |
| -------------- | --------- | ---------------------------------------- | ----------- | ------- | -------- |
|                | Table5-9. | ReceiverCharacteristics–EnhancedDataRate |             |         |          |
| Parameter      |           |                                          | Description | Min Typ | Max Unit |
π/4DQPSK
| Sensitivity@0.01%BER           |     |     | —         | –90 –89 | –88 dBm |
| ------------------------------ | --- | --- | --------- | ------- | ------- |
| Maximumreceivedsignal@0.01%BER |     |     | —         | —       | 0 — dBm |
| Co-channelC/I                  |     |     | —         | —       | 11 — dB |
|                                |     |     | F=F0+1MHz | —       | –7 — dB |
|                                |     |     | F=F0–1MHz |         | –7      |
|                                |     |     |           | —       | — dB    |
|                                |     |     | F=F0+2MHz | — –25   | — dB    |
AdjacentchannelselectivityC/I
|     |     |     | F=F0–2MHz | — –35 | — dB |
| --- | --- | --- | --------- | ----- | ---- |
|     |     |     | F=F0+3MHz | — –25 | — dB |
|     |     |     | F=F0–3MHz | — –45 | — dB |
8DPSK
| Sensitivity@0.01%BER |     |     | —   | –84 –83 | –82 dBm |
| -------------------- | --- | --- | --- | ------- | ------- |
–5
| Maximumreceivedsignal@0.01%BER |     |     | —         | —     | — dBm   |
| ------------------------------ | --- | --- | --------- | ----- | ------- |
| C/Ic-channel                   |     |     | —         | —     | 18 — dB |
|                                |     |     | F=F0+1MHz | —     | 2 — dB  |
|                                |     |     | F=F0–1MHz | —     | 2 — dB  |
|                                |     |     | F=F0+2MHz | — –25 | — dB    |
AdjacentchannelselectivityC/I
|                   |           |           | F=F0–2MHz | — –25                    | — dB |
| ----------------- | --------- | --------- | --------- | ------------------------ | ---- |
|                   |           |           | F=F0+3MHz | — –25                    | — dB |
|                   |           |           | F=F0–3MHz | — –38                    | — dB |
| 5.7.4 Transmitter | –Enhanced | Data Rate |           |                          |      |
| EspressifSystems  |           |           | 55        | ESP32SeriesDatasheetv5.3 |      |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
Table5-10. TransmitterCharacteristics–EnhancedDataRate
| Parameter                              | Description |     | Min Typ | Max Unit |
| -------------------------------------- | ----------- | --- | ------- | -------- |
| RFtransmitpower(seenoteunderTable5-10) | —           |     | —       | 0 — dBm  |
| Gaincontrolstep                        | —           |     | —       | 3 — dB   |
| RFpowercontrolrange                    | —           |     | –12 —   | +9 dBm   |
| π/4DQPSKmaxw0                          | —           |     | — –0.72 | — kHz    |
| π/4DQPSKmaxwi                          | —           |     | — –6    | — kHz    |
| π/4DQPSKmax|wi+w0|                     | —           |     | — –7.42 | — kHz    |
| 8DPSKmaxw0                             | —           |     | — 0.7   | — kHz    |
| 8DPSKmaxwi                             | —           |     | — –9.6  | — kHz    |
| 8DPSKmax|wi+w0|                        | —           |     | — –10   | — kHz    |
|                                        | RMSDEVM     |     | — 4.28  | — %      |
| π/4DQPSKmodulationaccuracy             | 99%DEVM     |     | — 100   | — %      |
|                                        | PeakDEVM    |     | — 13.3  | — %      |
|                                        | RMSDEVM     |     | — 5.8   | — %      |
| 8DPSKmodulationaccuracy                | 99%DEVM     |     | — 100   | — %      |
|                                        | PeakDEVM    |     | — 14    | — %      |
|                                        | F=F0±1MHz   |     | — –46   | — dBm    |
|                                        | F=F0±2MHz   |     | — –40   | — dBm    |
In-bandspuriousemissions
|                            | F=F0±3MHz    |     | — –46 | — dBm   |
| -------------------------- | ------------ | --- | ----- | ------- |
|                            | F=F0+/–>3MHz |     | — —   | –53 dBm |
| EDRdifferentialphasecoding | —            |     | — 100 | — %     |
5.8 Bluetooth LE Radio
5.8.1 Receiver
Table5-11. ReceiverCharacteristics–BluetoothLE
| Parameter                      | Description |     | Min Typ | Max Unit |
| ------------------------------ | ----------- | --- | ------- | -------- |
| Sensitivity@30.8%PER           | —           |     | –94 –93 | –92 dBm  |
| Maximumreceivedsignal@30.8%PER | —           |     | 0       | — — dBm  |
| Co-channelC/I                  | —           |     | — +10   | — dB     |
|                                | F=F0+1MHz   |     | —       | –5 — dB  |
|                                | F=F0–1MHz   |     | —       | –5 — dB  |
|                                | F=F0+2MHz   |     | — –25   | — dB     |
AdjacentchannelselectivityC/I
|     | F=F0–2MHz     |        | — –35 | — dB    |
| --- | ------------- | ------ | ----- | ------- |
|     | F=F0+3MHz     |        | — –25 | — dB    |
|     | F=F0–3MHz     |        | — –45 | — dB    |
|     | 30MHz~2000MHz |        | –10   | — — dBm |
|     | 2000 MHz      | ~ 2400 | –27   | — — dBm |
Out-of-bandblockingperformance
MHz
|     | 2500 MHz | ~ 3000 | –27 | — — dBm |
| --- | -------- | ------ | --- | ------- |
MHz
| EspressifSystems | 56  |     | ESP32SeriesDatasheetv5.3 |     |
| ---------------- | --- | --- | ------------------------ | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| Parameter        | Description     | Min Typ                  | Max Unit |
| ---------------- | --------------- | ------------------------ | -------- |
|                  | 3000MHz~12.5GHz | –10 —                    | — dBm    |
| Intermodulation  | —               | –36 —                    | — dBm    |
| EspressifSystems | 57              | ESP32SeriesDatasheetv5.3 |          |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
5.8.2 Transmitter
Table5-12. TransmitterCharacteristics–BluetoothLE
| Parameter                             | Description | Min Typ | Max Unit |
| ------------------------------------- | ----------- | ------- | -------- |
| RFtransmitpower(seenoteunderTable5-8) | —           | —       | 0 — dBm  |
| Gaincontrolstep                       | —           | —       | 3 — dB   |
| RFpowercontrolrange                   | —           | –12 —   | +9 dBm   |
|                                       | F=F0±2MHz   | — –52   | — dBm    |
| Adjacentchanneltransmitpower          | F=F0±3MHz   | — –58   | — dBm    |
|                                       | F=F0±>3MHz  | — –60   | — dBm    |
| ∆f1                                   | —           | — —     | 265 kHz  |
avg
| ∆f2 max  | —   | 247 —  | — kHz |
| -------- | --- | ------ | ----- |
| ∆f2 /∆f1 | —   | — 0.92 | — —   |
avg avg
| ICFT             | —   | — –10                    | — kHz      |
| ---------------- | --- | ------------------------ | ---------- |
| Driftrate        | —   | — 0.7                    | — kHz/50µs |
| Drift            | —   | —                        | 2 — kHz    |
| EspressifSystems | 58  | ESP32SeriesDatasheetv5.3 |            |
SubmitDocumentationFeedback

6 Packaging
6 Packaging
• Forinformationabouttape,reel,andchipmarking,pleaserefertoESP32ChipPackagingInformation.
• Thepinsofthechiparenumberedinanti-clockwiseorderstartingfromPin1inthetopview. Forpin
numbersandpinnames,seealsopinlayoutfiguresinSection2.1PinLayout.
Pin 1
|     | Pin 2 |     |     |     |     | Pin 1 |     |     |
| --- | ----- | --- | --- | --- | --- | ----- | --- | --- |
|     | Pin 3 |     |     |     |     | Pin 2 |     |     |
Pin 3
Figure6-1. QFN48(6×6mm)Package
|     |                      | D         |     |     | D2  |                 |                  |                     |
| --- | -------------------- | --------- | --- | --- | --- | --------------- | ---------------- | ------------------- |
|     |                      |           |     | L   |     | PI N   # 1  ID  | D im e n         | sio n a l  R ef .   |
|     | P I N  # 1  D D T    |           |     |     |     | C 0 .3 5 0      |                  |                     |
|     | B Y   MA R K I N G   |           |     |     |     |                 | REF.  M in .     | N o rn .   M ax.    |
|     |                      |           |     |     |     |                 | A   0 . 8 0 0    | 0. 8 50  0 . 9 0 0  |
|     | i n  1               |           |     | L   |     |                 |                  |                     |
|     | P n  2               |           |     |     |     |                 | A 1   0. 0 0 0   | - - 0 . 05 0        |
|     |                      |           |     | L   |     |                 | A3  0.203 Ref.   |                     |
|     |                      | 48L  SLP  |     |     | +   |                 | 4.950            | 5.000  5.050        |
D
|     |     |            | E   |      |     | E2  | E  4.950   | 5.000  5.050  |
| --- | --- | ---------- | --- | ---- | --- | --- | ---------- | ------------- |
|     |     | (5x5r1r1)  |     | e_f  |     |     |            |               |
|     |     |            |     |      |     |     | 02  3.650  | 3.700  3.750  |
|     |     |            |     |      |     |     | E2  3.650  | 3.700  3.750  |
|     |     |            |     |      |     |     | b  0.130   | 0.180  0.230  |
|     |     |            |     |      |     |     | b1  0.070  | 0.120  0.170  |
0 a.a.a. C
|     |             |     |     |     |      |     | L  0.300      | 0.350  0.400  |
| --- | ----------- | --- | --- | --- | ---- | --- | ------------- | ------------- |
|     |             |     |     |     | bl   |     | e  0.350 BSC  |               |
|     | 0 a.a.a. C  |     |     |     | 48X  |     |               |               |
Tol. of Form&Position
|     |     |            |     |         |       |     | aaa  | 0.10  |
| --- | --- | ---------- | --- | ------- | ----- | --- | ---- | ----- |
|     |     | TOP  VIEw  |     | BOTTOM  | VIEw  |     |      |       |
|     |     |            |     |         |       |     | bbb  | 0.10  |
|     |     |            |     |         |       |     | CCC  | 0.10  |
|     |     |            |     |         |       |     | ddd  | 0.05  |
eee
0.08
|     | 1//lccclCI  |     |     |     |     |     | fff  | 0.10  |
| --- | ----------- | --- | --- | --- | --- | --- | ---- | ----- |
Notes
|     |     | SIDE  VIEw  |     |     | 1. A l l   D IM E N S I O N S   A R | E   □ IN   M I L L I M E T E | R S ,  JEDEC M□-220,  |     |
| --- | --- | ----------- | --- | --- | ----------------------------------- | ---------------------------- | --------------------- | --- |
|     |     |             |     |     | 2 ,  D I M E N S IO N I N G   A N D |   T L E R A N C I N G   P    | E R                   |     |
Figure6-2. QFN48(5×5mm)Package
| EspressifSystems |     |     |     | 59  |     |     | ESP32SeriesDatasheetv5.3 |     |
| ---------------- | --- | --- | --- | --- | --- | --- | ------------------------ | --- |
SubmitDocumentationFeedback

RelatedDocumentationandResources
Related Documentation and Resources
Related Documentation
• ESP32TechnicalReferenceManual–DetailedinformationonhowtousetheESP32memoryandperipherals.
• ESP32HardwareDesignGuidelines–GuidelinesonhowtointegratetheESP32intoyourhardwareproduct.
• ESP32ECOandWorkaroundsforBugs–CorrectionofESP32designerrors.
• ESP32SeriesSoCErrata–DescriptionsofknownerrorsinESP32seriesofSoCs.
• Certificates
https://espressif.com/en/support/documents/certificates
• ESP32Product/ProcessChangeNotifications(PCN)
https://espressif.com/en/support/documents/pcns
• ESP32Advisories–Informationonsecurity,bugs,compatibility,componentreliability.
https://espressif.com/en/support/documents/advisories
• DocumentationUpdatesandUpdateNotificationSubscription
https://espressif.com/en/support/download/documents
Developer Zone
• ESP-IDFProgrammingGuideforESP32–ExtensivedocumentationfortheESP-IDFdevelopmentframework.
• ESP-IDF andotherdevelopmentframeworksonGitHub.
https://github.com/espressif
• ESP32BBSForum–Engineer-to-Engineer(E2E)CommunityforEspressifproductswhereyoucanpostquestions,
shareknowledge,exploreideas,andhelpsolveproblemswithfellowengineers.
https://esp32.com/
• TheESPJournal–BestPractices,Articles,andNotesfromEspressiffolks.
https://blog.espressif.com/
• SeethetabsSDKsandDemos,Apps,Tools,ATFirmware.
https://espressif.com/en/support/download/sdks-demos
Products
• ESP32SeriesSoCs–BrowsethroughallESP32SoCs.
https://espressif.com/en/products/socs?id=ESP32
• ESP32SeriesModules–BrowsethroughallESP32-basedmodules.
https://espressif.com/en/products/modules?id=ESP32
• ESP32SeriesDevKits–BrowsethroughallESP32-baseddevkits.
https://espressif.com/en/products/devkits?id=ESP32
• ESPProductSelector–FindanEspressifhardwareproductsuitableforyourneedsbycomparingorapplyingfilters.
https://products.espressif.com/#/product-selector?language=en
Contact Us
• SeethetabsSalesQuestions,TechnicalEnquiries,CircuitSchematic&PCBDesignReview,GetSamples
(Onlinestores),BecomeOurSupplier,Comments&Suggestions.
https://espressif.com/en/contact-us/sales-questions
EspressifSystems 60 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

AppendixA
Appendix A –ESP32 Pin Lists
A.1. Notes on ESP32 Pin Lists
Table6-1. NotesonESP32PinLists
No. Description
InTableIO_MUX,theboxeshighlightedinyellowindicatetheGPIOpinsthatareinput-only.
1
Pleaseseethefollowingnoteforfurtherdetails.
GPIO pins 34-39 are input-only. These pins do not feature an output driver or internal pull-
2 up/pull-downcircuitry. Thepinnamesare: SENSOR_VP(GPIO36),SENSOR_CAPP(GPIO37),
SENSOR_CAPN(GPIO38),SENSOR_VN(GPIO39),VDET_1(GPIO34),VDET_2(GPIO35).
Thepinsaregroupedintofourpowerdomains: VDDA(analogpowersupply),VDD3P3_RTC
(RTCpowersupply),VDD3P3_CPU(powersupplyofdigitalIOsandCPUcores),VDD_SDIO
(powersupplyofSDIOIOs). VDD_SDIOistheoutputoftheinternalSDIO-LDO.Thevoltageof
3
SDIO-LDOcanbeconfiguredat1.8VorbethesameasthatofVDD3P3_RTC.Thestrapping
pin and eFuse bits determine the default voltage of the SDIO-LDO. Software can change
thevoltageoftheSDIO-LDObyconfiguringregisterbits. Fordetails,pleaseseethecolumn
“PowerDomain”inTableIO_MUX.
ThefunctionalpinsintheVDD3P3_RTCdomainarethosewithanalogfunctions,including
4 the32kHzcrystaloscillator,ADC,DAC,andthecapacitivetouchsensor. Pleaseseecolumns
“AnalogFunction0~2”inTableIO_MUX.
TheseVDD3P3_RTCpinssupporttheRTCfunction,andcanworkduringDeep-sleep. For
5
example,anRTC-GPIOcanbeusedforwakingupthechipfromDeep-sleep.
TheGPIOpinssupportuptosixdigitalfunctions,asshownincolumns“Function0~5”In
TableIO_MUX.Thefunctionselectionregisterswillbesetas“N”,whereNisthefunction
number. Belowaresomedefinitions:
• SD_*isforsignalsoftheSDIOslave.
• HS1_*isforPort1signalsoftheSDIOhost.
• HS2_*isforPort2signalsoftheSDIOhost.
6 • MT*isforsignalsoftheJTAG.
• U0*isforsignalsoftheUART0module.
• U1*isforsignalsoftheUART1module.
• U2*isforsignalsoftheUART2module.
• SPI*isforsignalsoftheSPI01module.
• HSPI*isforsignalsoftheSPI2module.
• VSPI*isforsignalsoftheSPI3module.
EspressifSystems 61 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

AppendixA
No. Description
Eachcolumnaboutdigital“Function”isaccompaniedbyacolumnabout“Type”. Please
seethefollowingexplanationsforthemeaningsof“type”withrespecttoeach“function”
theyareassociatedwith. Foreach“Function-N”,“type”signifies:
• I: input only. If a function other than “Function-N” is assigned, the input signal of
“Function-N”isstillfromthispin.
• I1: input only. If a function other than “Function-N” is assigned, the input signal of
“Function-N”isalways“1”.
• I0: input only. If a function other than “Function-N” is assigned, the input signal of
“Function-N”isalways“0”.
7
• O:outputonly.
• T:high-impedance.
• I/O/T: combinations of input, output, and high-impedance according to the function
signal.
• I1/O/T:combinationsofinput,output,andhigh-impedance,accordingtothefunction
signal. Ifafunctionisnotselected,theinputsignalofthefunctionis“1”.
Forexample,pin30canfunctionasHS1_CMDorSD_CMD,whereHS1_CMDisofan“I1/O/T”
type. Ifpin30isselectedasHS1_CMD,thispin’sinputandoutputarecontrolledbytheSDIO
host. Ifpin30isnotselectedasHS1_CMD,theinputsignaloftheSDIOhostisalways“1”.
Each digital output pin is associated with its configurable drive strength. Column “Drive
Strength” in Table IO_MUX lists the default values. The drive strength of the digital output
pinscanbeconfiguredintooneofthefollowingfouroptions:
• 0: ~5mA
8 • 1: ~10mA
• 2: ~20mA
• 3: ~40mA
Thedefaultvalueis2.
Thedrivestrengthoftheinternalpull-up(wpu)andpull-down(wpd)is~75µA.
Column“AtReset”inTableIO_MUXliststhestatusofeachpinduringreset,includinginput-
9 enable(ie=1),internalpull-up(wpu)andinternalpull-down(wpd). Duringreset,allpinsare
output-disabled.
Column“AfterReset”inTableIO_MUXliststhestatusofeachpinimmediatelyafterreset,
10 includinginput-enable(ie=1),internalpull-up(wpu)andinternalpull-down(wpd). Afterreset,
eachpinissetto“Function0”. Theoutput-enableiscontrolledbydigitalFunction0.
Table Ethernet_MAC is about the signal mapping inside Ethernet MAC. The Ethernet MAC
supportsMIIandRMIIinterfaces,andsupportsboththeinternalPLLclockandtheexternal
11
clock source. For the MII interface, the Ethernet MAC is with/without the TX_ERR signal.
MDC,MDIO,CRSandCOLareslowsignals,andcanbemappedontoanyGPIOpinthrough
theGPIO-Matrix.
TableGPIOMatrixisfortheGPIO-Matrix. Thesignalsoftheon-chipfunctionalmodulescan
be mapped onto any GPIO pin. Some signals can be mapped onto a pin by both IO-MUX
12
andGPIO-Matrix,asshowninthecolumntaggedas“SameinputsignalfromIO_MUXcore”
inTableGPIOMatrix.
EspressifSystems 62 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

AppendixA
No. Description
*InTableGPIO_Matrix，thecolumn“DefaultValueifunassigned”recordsthedefaultvalue
oftheaninputsignalifnoGPIOisassignedtoit. Theactualvalueisdeterminedbyregister
13
GPIO_FUNCm_IN_INV_SEL and GPIO_FUNCm_IN_SEL. (The value of m ranges from 1 to
255.)
A.2. GPIO_Matrix
|        |     | Table6-2.  | GPIO_Matrix |     |                |
| ------ | --- | ---------- | ----------- | --- | -------------- |
| Signal |     | Same Input | Signal      |     | OutputEnableof |
Default
| No. InputSignals |     | fromIO_MUXCore | OutputSignals |     | OutputSignals |
| ---------------- | --- | -------------- | ------------- | --- | ------------- |
ValueIf
Unassigned*
| 0 SPICLK_in       | 0   | yes | SPICLK_out          |                          | SPICLK_oe  |
| ----------------- | --- | --- | ------------------- | ------------------------ | ---------- |
| 1 SPIQ_in         | 0   | yes | SPIQ_out            |                          | SPIQ_oe    |
| 2 SPID_in         | 0   | yes | SPID_out            |                          | SPID_oe    |
| 3 SPIHD_in        | 0   | yes | SPIHD_out           |                          | SPIHD_oe   |
| 4 SPIWP_in        | 0   | yes | SPIWP_out           |                          | SPIWP_oe   |
| 5 SPICS0_in       | 0   | yes | SPICS0_out          |                          | SPICS0_oe  |
| 6 SPICS1_in       | 0   | no  | SPICS1_out          |                          | SPICS1_oe  |
| 7 SPICS2_in       | 0   | no  | SPICS2_out          |                          | SPICS2_oe  |
| 8 HSPICLK_in      | 0   | yes | HSPICLK_out         |                          | HSPICLK_oe |
| 9 HSPIQ_in        | 0   | yes | HSPIQ_out           |                          | HSPIQ_oe   |
| 10 HSPID_in       | 0   | yes | HSPID_out           |                          | HSPID_oe   |
| 11 HSPICS0_in     | 0   | yes | HSPICS0_out         |                          | HSPICS0_oe |
| 12 HSPIHD_in      | 0   | yes | HSPIHD_out          |                          | HSPIHD_oe  |
| 13 HSPIWP_in      | 0   | yes | HSPIWP_out          |                          | HSPIWP_oe  |
| 14 U0RXD_in       | 0   | yes | U0TXD_out           |                          | 1’d1       |
| 15 U0CTS_in       | 0   | yes | U0RTS_out           |                          | 1’d1       |
| 16 U0DSR_in       | 0   | no  | U0DTR_out           |                          | 1’d1       |
| 17 U1RXD_in       | 0   | yes | U1TXD_out           |                          | 1’d1       |
| 18 U1CTS_in       | 0   | yes | U1RTS_out           |                          | 1’d1       |
| 23 I2S0O_BCK_in   | 0   | no  | I2S0O_BCK_out       |                          | 1’d1       |
| 24 I2S1O_BCK_in   | 0   | no  | I2S1O_BCK_out       |                          | 1’d1       |
| 25 I2S0O_WS_in    | 0   | no  | I2S0O_WS_out        |                          | 1’d1       |
| 26 I2S1O_WS_in    | 0   | no  | I2S1O_WS_out        |                          | 1’d1       |
| 27 I2S0I_BCK_in   | 0   | no  | I2S0I_BCK_out       |                          | 1’d1       |
| 28 I2S0I_WS_in    | 0   | no  | I2S0I_WS_out        |                          | 1’d1       |
| 29 I2CEXT0_SCL_in | 1   | no  | I2CEXT0_SCL_out     |                          | 1’d1       |
| 30 I2CEXT0_SDA_in | 1   | no  | I2CEXT0_SDA_out     |                          | 1’d1       |
| 31 pwm0_sync0_in  | 0   | no  | sdio_tohost_int_out |                          | 1’d1       |
| 32 pwm0_sync1_in  | 0   | no  | pwm0_out0a          |                          | 1’d1       |
| 33 pwm0_sync2_in  | 0   | no  | pwm0_out0b          |                          | 1’d1       |
| EspressifSystems  |     | 63  |                     | ESP32SeriesDatasheetv5.3 |            |
SubmitDocumentationFeedback

AppendixA
| Signal |     | Same Input | Signal |     | OutputEnableof |
| ------ | --- | ---------- | ------ | --- | -------------- |
Default
| No. InputSignals |     | fromIO_MUXCore | OutputSignals |     | OutputSignals |
| ---------------- | --- | -------------- | ------------- | --- | ------------- |
ValueIf
Unassigned*
| 34 pwm0_f0_in        | 0   | no  | pwm0_out1a       |                          | 1’d1       |
| -------------------- | --- | --- | ---------------- | ------------------------ | ---------- |
| 35 pwm0_f1_in        | 0   | no  | pwm0_out1b       |                          | 1’d1       |
| 36 pwm0_f2_in        | 0   | no  | pwm0_out2a       |                          | 1’d1       |
| 37 —                 | 0   | no  | pwm0_out2b       |                          | 1’d1       |
| 39 pcnt_sig_ch0_in0  | 0   | no  | —                |                          | 1’d1       |
| 40 pcnt_sig_ch1_in0  | 0   | no  | —                |                          | 1’d1       |
| 41 pcnt_ctrl_ch0_in0 | 0   | no  | —                |                          | 1’d1       |
| 42 pcnt_ctrl_ch1_in0 | 0   | no  | —                |                          | 1’d1       |
| 43 pcnt_sig_ch0_in1  | 0   | no  | —                |                          | 1’d1       |
| 44 pcnt_sig_ch1_in1  | 0   | no  | —                |                          | 1’d1       |
| 45 pcnt_ctrl_ch0_in1 | 0   | no  | —                |                          | 1’d1       |
| 46 pcnt_ctrl_ch1_in1 | 0   | no  | —                |                          | 1’d1       |
| 47 pcnt_sig_ch0_in2  | 0   | no  | —                |                          | 1’d1       |
| 48 pcnt_sig_ch1_in2  | 0   | no  | —                |                          | 1’d1       |
| 49 pcnt_ctrl_ch0_in2 | 0   | no  | —                |                          | 1’d1       |
| 50 pcnt_ctrl_ch1_in2 | 0   | no  | —                |                          | 1’d1       |
| 51 pcnt_sig_ch0_in3  | 0   | no  | —                |                          | 1’d1       |
| 52 pcnt_sig_ch1_in3  | 0   | no  | —                |                          | 1’d1       |
| 53 pcnt_ctrl_ch0_in3 | 0   | no  | —                |                          | 1’d1       |
| 54 pcnt_ctrl_ch1_in3 | 0   | no  | —                |                          | 1’d1       |
| 55 pcnt_sig_ch0_in4  | 0   | no  | —                |                          | 1’d1       |
| 56 pcnt_sig_ch1_in4  | 0   | no  | —                |                          | 1’d1       |
| 57 pcnt_ctrl_ch0_in4 | 0   | no  | —                |                          | 1’d1       |
| 58 pcnt_ctrl_ch1_in4 | 0   | no  | —                |                          | 1’d1       |
| 61 HSPICS1_in        | 0   | no  | HSPICS1_out      |                          | HSPICS1_oe |
| 62 HSPICS2_in        | 0   | no  | HSPICS2_out      |                          | HSPICS2_oe |
| 63 VSPICLK_in        | 0   | yes | VSPICLK_out_mux  |                          | VSPICLK_oe |
| 64 VSPIQ_in          | 0   | yes | VSPIQ_out        |                          | VSPIQ_oe   |
| 65 VSPID_in          | 0   | yes | VSPID_out        |                          | VSPID_oe   |
| 66 VSPIHD_in         | 0   | yes | VSPIHD_out       |                          | VSPIHD_oe  |
| 67 VSPIWP_in         | 0   | yes | VSPIWP_out       |                          | VSPIWP_oe  |
| 68 VSPICS0_in        | 0   | yes | VSPICS0_out      |                          | VSPICS0_oe |
| 69 VSPICS1_in        | 0   | no  | VSPICS1_out      |                          | VSPICS1_oe |
| 70 VSPICS2_in        | 0   | no  | VSPICS2_out      |                          | VSPICS2_oe |
| 71 pcnt_sig_ch0_in5  | 0   | no  | ledc_hs_sig_out0 |                          | 1’d1       |
| 72 pcnt_sig_ch1_in5  | 0   | no  | ledc_hs_sig_out1 |                          | 1’d1       |
| 73 pcnt_ctrl_ch0_in5 | 0   | no  | ledc_hs_sig_out2 |                          | 1’d1       |
| 74 pcnt_ctrl_ch1_in5 | 0   | no  | ledc_hs_sig_out3 |                          | 1’d1       |
| 75 pcnt_sig_ch0_in6  | 0   | no  | ledc_hs_sig_out4 |                          | 1’d1       |
| 76 pcnt_sig_ch1_in6  | 0   | no  | ledc_hs_sig_out5 |                          | 1’d1       |
| EspressifSystems     |     | 64  |                  | ESP32SeriesDatasheetv5.3 |            |
SubmitDocumentationFeedback

AppendixA
| Signal |     | Same Input | Signal |     | OutputEnableof |
| ------ | --- | ---------- | ------ | --- | -------------- |
Default
| No. InputSignals |     | fromIO_MUXCore | OutputSignals |     | OutputSignals |
| ---------------- | --- | -------------- | ------------- | --- | ------------- |
ValueIf
Unassigned*
| 77 pcnt_ctrl_ch0_in6      | 0   | no  | ledc_hs_sig_out6         |                          | 1’d1 |
| ------------------------- | --- | --- | ------------------------ | ------------------------ | ---- |
| 78 pcnt_ctrl_ch1_in6      | 0   | no  | ledc_hs_sig_out7         |                          | 1’d1 |
| 79 pcnt_sig_ch0_in7       | 0   | no  | ledc_ls_sig_out0         |                          | 1’d1 |
| 80 pcnt_sig_ch1_in7       | 0   | no  | ledc_ls_sig_out1         |                          | 1’d1 |
| 81 pcnt_ctrl_ch0_in7      | 0   | no  | ledc_ls_sig_out2         |                          | 1’d1 |
| 82 pcnt_ctrl_ch1_in7      | 0   | no  | ledc_ls_sig_out3         |                          | 1’d1 |
| 83 rmt_sig_in0            | 0   | no  | ledc_ls_sig_out4         |                          | 1’d1 |
| 84 rmt_sig_in1            | 0   | no  | ledc_ls_sig_out5         |                          | 1’d1 |
| 85 rmt_sig_in2            | 0   | no  | ledc_ls_sig_out6         |                          | 1’d1 |
| 86 rmt_sig_in3            | 0   | no  | ledc_ls_sig_out7         |                          | 1’d1 |
| 87 rmt_sig_in4            | 0   | no  | rmt_sig_out0             |                          | 1’d1 |
| 88 rmt_sig_in5            | 0   | no  | rmt_sig_out1             |                          | 1’d1 |
| 89 rmt_sig_in6            | 0   | no  | rmt_sig_out2             |                          | 1’d1 |
| 90 rmt_sig_in7            | 0   | no  | rmt_sig_out3             |                          | 1’d1 |
| 91 —                      | —   | —   | rmt_sig_out4             |                          | 1’d1 |
| 92 —                      | —   | —   | rmt_sig_out6             |                          | 1’d1 |
| 94 twai_rx                | 1   | no  | rmt_sig_out7             |                          | 1’d1 |
| 95 I2CEXT1_SCL_in         | 1   | no  | I2CEXT1_SCL_out          |                          | 1’d1 |
| 96 I2CEXT1_SDA_in         | 1   | no  | I2CEXT1_SDA_out          |                          | 1’d1 |
| 97 host_card_detect_n_1   | 0   | no  | host_ccmd_od_pullup_en_n |                          | 1’d1 |
| 98 host_card_detect_n_2   | 0   | no  | host_rst_n_1             |                          | 1’d1 |
| 99 host_card_write_prt_1  | 0   | no  | host_rst_n_2             |                          | 1’d1 |
| 100 host_card_write_prt_2 | 0   | no  | gpio_sd0_out             |                          | 1’d1 |
| 101 host_card_int_n_1     | 0   | no  | gpio_sd1_out             |                          | 1’d1 |
| 102 host_card_int_n_2     | 0   | no  | gpio_sd2_out             |                          | 1’d1 |
| 103 pwm1_sync0_in         | 0   | no  | gpio_sd3_out             |                          | 1’d1 |
| 104 pwm1_sync1_in         | 0   | no  | gpio_sd4_out             |                          | 1’d1 |
| 105 pwm1_sync2_in         | 0   | no  | gpio_sd5_out             |                          | 1’d1 |
| 106 pwm1_f0_in            | 0   | no  | gpio_sd6_out             |                          | 1’d1 |
| 107 pwm1_f1_in            | 0   | no  | gpio_sd7_out             |                          | 1’d1 |
| 108 pwm1_f2_in            | 0   | no  | pwm1_out0a               |                          | 1’d1 |
| 109 pwm0_cap0_in          | 0   | no  | pwm1_out0b               |                          | 1’d1 |
| 110 pwm0_cap1_in          | 0   | no  | pwm1_out1a               |                          | 1’d1 |
| 111 pwm0_cap2_in          | 0   | no  | pwm1_out1b               |                          | 1’d1 |
| 112 pwm1_cap0_in          | 0   | no  | pwm1_out2a               |                          | 1’d1 |
| 113 pwm1_cap1_in          | 0   | no  | pwm1_out2b               |                          | 1’d1 |
| 114 pwm1_cap2_in          | 0   | no  | pwm2_out1h               |                          | 1’d1 |
| 115 pwm2_flta             | 1   | no  | pwm2_out1l               |                          | 1’d1 |
| 116 pwm2_fltb             | 1   | no  | pwm2_out2h               |                          | 1’d1 |
| 117 pwm2_cap1_in          | 0   | no  | pwm2_out2l               |                          | 1’d1 |
| EspressifSystems          |     | 65  |                          | ESP32SeriesDatasheetv5.3 |      |
SubmitDocumentationFeedback

AppendixA
| Signal |     | Same Input | Signal |     | OutputEnableof |
| ------ | --- | ---------- | ------ | --- | -------------- |
Default
| No. InputSignals |     | fromIO_MUXCore | OutputSignals |     | OutputSignals |
| ---------------- | --- | -------------- | ------------- | --- | ------------- |
ValueIf
Unassigned*
| 118 pwm2_cap2_in    | 0   | no  | pwm2_out3h       |                          | 1’d1 |
| ------------------- | --- | --- | ---------------- | ------------------------ | ---- |
| 119 pwm2_cap3_in    | 0   | no  | pwm2_out3l       |                          | 1’d1 |
| 120 pwm3_flta       | 1   | no  | pwm2_out4h       |                          | 1’d1 |
| 121 pwm3_fltb       | 1   | no  | pwm2_out4l       |                          | 1’d1 |
| 122 pwm3_cap1_in    | 0   | no  | —                |                          | 1’d1 |
| 123 pwm3_cap2_in    | 0   | no  | twai_tx          |                          | 1’d1 |
| 124 pwm3_cap3_in    | 0   | no  | twai_bus_off_on  |                          | 1’d1 |
| 125 —               | —   | —   | twai_clkout      |                          | 1’d1 |
| 140 I2S0I_DATA_in0  | 0   | no  | I2S0O_DATA_out0  |                          | 1’d1 |
| 141 I2S0I_DATA_in1  | 0   | no  | I2S0O_DATA_out1  |                          | 1’d1 |
| 142 I2S0I_DATA_in2  | 0   | no  | I2S0O_DATA_out2  |                          | 1’d1 |
| 143 I2S0I_DATA_in3  | 0   | no  | I2S0O_DATA_out3  |                          | 1’d1 |
| 144 I2S0I_DATA_in4  | 0   | no  | I2S0O_DATA_out4  |                          | 1’d1 |
| 145 I2S0I_DATA_in5  | 0   | no  | I2S0O_DATA_out5  |                          | 1’d1 |
| 146 I2S0I_DATA_in6  | 0   | no  | I2S0O_DATA_out6  |                          | 1’d1 |
| 147 I2S0I_DATA_in7  | 0   | no  | I2S0O_DATA_out7  |                          | 1’d1 |
| 148 I2S0I_DATA_in8  | 0   | no  | I2S0O_DATA_out8  |                          | 1’d1 |
| 149 I2S0I_DATA_in9  | 0   | no  | I2S0O_DATA_out9  |                          | 1’d1 |
| 150 I2S0I_DATA_in10 | 0   | no  | I2S0O_DATA_out10 |                          | 1’d1 |
| 151 I2S0I_DATA_in11 | 0   | no  | I2S0O_DATA_out11 |                          | 1’d1 |
| 152 I2S0I_DATA_in12 | 0   | no  | I2S0O_DATA_out12 |                          | 1’d1 |
| 153 I2S0I_DATA_in13 | 0   | no  | I2S0O_DATA_out13 |                          | 1’d1 |
| 154 I2S0I_DATA_in14 | 0   | no  | I2S0O_DATA_out14 |                          | 1’d1 |
| 155 I2S0I_DATA_in15 | 0   | no  | I2S0O_DATA_out15 |                          | 1’d1 |
| 156 —               | —   | —   | I2S0O_DATA_out16 |                          | 1’d1 |
| 157 —               | —   | —   | I2S0O_DATA_out17 |                          | 1’d1 |
| 158 —               | —   | —   | I2S0O_DATA_out18 |                          | 1’d1 |
| 159 —               | —   | —   | I2S0O_DATA_out19 |                          | 1’d1 |
| 160 —               | —   | —   | I2S0O_DATA_out20 |                          | 1’d1 |
| 161 —               | —   | —   | I2S0O_DATA_out21 |                          | 1’d1 |
| 162 —               | —   | —   | I2S0O_DATA_out22 |                          | 1’d1 |
| 163 —               | —   | —   | I2S0O_DATA_out23 |                          | 1’d1 |
| 164 I2S1I_BCK_in    | 0   | no  | I2S1I_BCK_out    |                          | 1’d1 |
| 165 I2S1I_WS_in     | 0   | no  | I2S1I_WS_out     |                          | 1’d1 |
| 166 I2S1I_DATA_in0  | 0   | no  | I2S1O_DATA_out0  |                          | 1’d1 |
| 167 I2S1I_DATA_in1  | 0   | no  | I2S1O_DATA_out1  |                          | 1’d1 |
| 168 I2S1I_DATA_in2  | 0   | no  | I2S1O_DATA_out2  |                          | 1’d1 |
| 169 I2S1I_DATA_in3  | 0   | no  | I2S1O_DATA_out3  |                          | 1’d1 |
| 170 I2S1I_DATA_in4  | 0   | no  | I2S1O_DATA_out4  |                          | 1’d1 |
| 171 I2S1I_DATA_in5  | 0   | no  | I2S1O_DATA_out5  |                          | 1’d1 |
| EspressifSystems    |     | 66  |                  | ESP32SeriesDatasheetv5.3 |      |
SubmitDocumentationFeedback

AppendixA
| Signal |     | Same Input | Signal |     | OutputEnableof |
| ------ | --- | ---------- | ------ | --- | -------------- |
Default
| No. InputSignals |     | fromIO_MUXCore | OutputSignals |     | OutputSignals |
| ---------------- | --- | -------------- | ------------- | --- | ------------- |
ValueIf
Unassigned*
| 172 I2S1I_DATA_in6  | 0   | no  | I2S1O_DATA_out6  |                          | 1’d1         |
| ------------------- | --- | --- | ---------------- | ------------------------ | ------------ |
| 173 I2S1I_DATA_in7  | 0   | no  | I2S1O_DATA_out7  |                          | 1’d1         |
| 174 I2S1I_DATA_in8  | 0   | no  | I2S1O_DATA_out8  |                          | 1’d1         |
| 175 I2S1I_DATA_in9  | 0   | no  | I2S1O_DATA_out9  |                          | 1’d1         |
| 176 I2S1I_DATA_in10 | 0   | no  | I2S1O_DATA_out10 |                          | 1’d1         |
| 177 I2S1I_DATA_in11 | 0   | no  | I2S1O_DATA_out11 |                          | 1’d1         |
| 178 I2S1I_DATA_in12 | 0   | no  | I2S1O_DATA_out12 |                          | 1’d1         |
| 179 I2S1I_DATA_in13 | 0   | no  | I2S1O_DATA_out13 |                          | 1’d1         |
| 180 I2S1I_DATA_in14 | 0   | no  | I2S1O_DATA_out14 |                          | 1’d1         |
| 181 I2S1I_DATA_in15 | 0   | no  | I2S1O_DATA_out15 |                          | 1’d1         |
| 182 —               | —   | —   | I2S1O_DATA_out16 |                          | 1’d1         |
| 183 —               | —   | —   | I2S1O_DATA_out17 |                          | 1’d1         |
| 184 —               | —   | —   | I2S1O_DATA_out18 |                          | 1’d1         |
| 185 —               | —   | —   | I2S1O_DATA_out19 |                          | 1’d1         |
| 186 —               | —   | —   | I2S1O_DATA_out20 |                          | 1’d1         |
| 187 —               | —   | —   | I2S1O_DATA_out21 |                          | 1’d1         |
| 188 —               | —   | —   | I2S1O_DATA_out22 |                          | 1’d1         |
| 189 —               | —   | —   | I2S1O_DATA_out23 |                          | 1’d1         |
| 190 I2S0I_H_SYNC    | 0   | no  | pwm3_out1h       |                          | 1’d1         |
| 191 I2S0I_V_SYNC    | 0   | no  | pwm3_out1l       |                          | 1’d1         |
| 192 I2S0I_H_ENABLE  | 0   | no  | pwm3_out2h       |                          | 1’d1         |
| 193 I2S1I_H_SYNC    | 0   | no  | pwm3_out2l       |                          | 1’d1         |
| 194 I2S1I_V_SYNC    | 0   | no  | pwm3_out3h       |                          | 1’d1         |
| 195 I2S1I_H_ENABLE  | 0   | no  | pwm3_out3l       |                          | 1’d1         |
| 196 —               | —   | —   | pwm3_out4h       |                          | 1’d1         |
| 197 —               | —   | —   | pwm3_out4l       |                          | 1’d1         |
| 198 U2RXD_in        | 0   | yes | U2TXD_out        |                          | 1’d1         |
| 199 U2CTS_in        | 0   | yes | U2RTS_out        |                          | 1’d1         |
| 200 emac_mdc_i      | 0   | no  | emac_mdc_o       |                          | emac_mdc_oe  |
| 201 emac_mdi_i      | 0   | no  | emac_mdo_o       |                          | emac_mdo_o_e |
| 202 emac_crs_i      | 0   | no  | emac_crs_o       |                          | emac_crs_oe  |
| 203 emac_col_i      | 0   | no  | emac_col_o       |                          | emac_col_oe  |
| 204 pcmfsync_in     | 0   | no  | bt_audio0_irq    |                          | 1’d1         |
| 205 pcmclk_in       | 0   | no  | bt_audio1_irq    |                          | 1’d1         |
| 206 pcmdin          | 0   | no  | bt_audio2_irq    |                          | 1’d1         |
| 207 —               | —   | —   | ble_audio0_irq   |                          | 1’d1         |
| 208 —               | —   | —   | ble_audio1_irq   |                          | 1’d1         |
| 209 —               | —   | —   | ble_audio2_irq   |                          | 1’d1         |
| 210 —               | —   | —   | pcmfsync_out     |                          | pcmfsync_en  |
| 211 —               | —   | —   | pcmclk_out       |                          | pcmclk_en    |
| EspressifSystems    |     | 67  |                  | ESP32SeriesDatasheetv5.3 |              |
SubmitDocumentationFeedback

AppendixA
| Signal |     |     | Same | Input Signal |     | OutputEnableof |
| ------ | --- | --- | ---- | ------------ | --- | -------------- |
Default
| No. InputSignals |     |     | fromIO_MUXCore |     | OutputSignals | OutputSignals |
| ---------------- | --- | --- | -------------- | --- | ------------- | ------------- |
ValueIf
Unassigned*
| 212 — |     | —   | —   |     | pcmdout           | pcmdout_en |
| ----- | --- | --- | --- | --- | ----------------- | ---------- |
| 213 — |     | —   | —   |     | ble_audio_sync0_p | 1’d1       |
| 214 — |     | —   | —   |     | ble_audio_sync1_p | 1’d1       |
| 215 — |     | —   | —   |     | ble_audio_sync2_p | 1’d1       |
| 224 — |     | —   | —   |     | sig_in_func224    | 1’d1       |
| 225 — |     | —   | —   |     | sig_in_func225    | 1’d1       |
| 226 — |     | —   | —   |     | sig_in_func226    | 1’d1       |
| 227 — |     | —   | —   |     | sig_in_func227    | 1’d1       |
| 228 — |     | —   | —   |     | sig_in_func228    | 1’d1       |
A.3. Ethernet_MAC
|     |     | Table6-3. | Ethernet_MAC |     |     |     |
| --- | --- | --------- | ------------ | --- | --- | --- |
PinName Function6 MII(int_osc) MII(ext_osc) RMII(int_osc) RMII(ext_osc)
GPIO0 EMAC_TX_CLK TX_CLK(I) TX_CLK(I) CLK_OUT(O) EXT_OSC_CLK(I)
| GPIO5         | EMAC_RX_CLK      | RX_CLK(I)      |     | RX_CLK(I)  | —              | —         |
| ------------- | ---------------- | -------------- | --- | ---------- | -------------- | --------- |
| GPIO21        | EMAC_TX_EN       | TX_EN(O)       |     | TX_EN(O)   | TX_EN(O)       | TX_EN(O)  |
| GPIO19        | EMAC_TXD0        | TXD[0](O)      |     | TXD[0](O)  | TXD[0](O)      | TXD[0](O) |
| GPIO22        | EMAC_TXD1        | TXD[1](O)      |     | TXD[1](O)  | TXD[1](O)      | TXD[1](O) |
| MTMS          | EMAC_TXD2        | TXD[2](O)      |     | TXD[2](O)  | —              | —         |
| MTDI          | EMAC_TXD3        | TXD[3](O)      |     | TXD[3](O)  | —              | —         |
| MTCK          | EMAC_RX_ER       | RX_ER(I)       |     | RX_ER(I)   | —              | —         |
| GPIO27        | EMAC_RX_DV       | RX_DV(I)       |     | RX_DV(I)   | CRS_DV(I)      | CRS_DV(I) |
| GPIO25        | EMAC_RXD0        | RXD[0](I)      |     | RXD[0](I)  | RXD[0](I)      | RXD[0](I) |
| GPIO26        | EMAC_RXD1        | RXD[1](I)      |     | RXD[1](I)  | RXD[1](I)      | RXD[1](I) |
| U0TXD         | EMAC_RXD2        | RXD[2](I)      |     | RXD[2](I)  | —              | —         |
| MTDO          | EMAC_RXD3        | RXD[3](I)      |     | RXD[3](I)  | —              | —         |
| GPIO16        | EMAC_CLK_OUT     | CLK_OUT(O)     |     | —          | CLK_OUT(O)     | —         |
| GPIO17        | EMAC_CLK_OUT_180 | CLK_OUT_180(O) |     | —          | CLK_OUT_180(O) | —         |
| GPIO4         | EMAC_TX_ER       | TX_ERR(O)*     |     | TX_ERR(O)* | —              | —         |
| InGPIOMatrix* | —                | MDC(O)         |     | MDC(O)     | MDC(O)         | MDC(O)    |
| InGPIOMatrix* | —                | MDIO(IO)       |     | MDIO(IO)   | MDIO(IO)       | MDIO(IO)  |
| InGPIOMatrix* | —                | CRS(I)         |     | CRS(I)     | —              | —         |
| InGPIOMatrix* | —                | COL(I)         |     | COL(I)     | —              | —         |
*Notes: 1. TheGPIOMatrixcanbeanyGPIO.2. TheTX_ERR(O)isoptional.
A.4. IO_MUX
ForthelistofIO_MUXpins,pleaseseethenextpage.
| EspressifSystems |     |     | 68  |     | ESP32SeriesDatasheetv5.3 |     |
| ---------------- | --- | --- | --- | --- | ------------------------ | --- |
SubmitDocumentationFeedback

EspressifSystems AppendixA
IO_MUX
Pin No. P o wer Supply  Analog Pin Digital Pin Power Domain A n a lo g   A n a lo g   A n a lo g   R T C   R T C   Function0 Type Function1 Type Function2 Type Function3 Type Function4 Type Function5 Type D r i v e  S t re ng t h  At Reset After Reset
P in Fu n c t io n0 Fu n c t io n1 Fu n c t io n2 Fu n c tion0 Fu n c tion1 (2 ’ d 2 :  2 0  m A )
|     | 1 VDDA   | VDDA supply in   |
| --- | -------- | ---------------- |
|     | 2 LNA_IN | VDD3P3           |
|     | 3 VDD3P3 | VDD3P3 supply in |
|     | 4 VDD3P3 | VDD3P3 supply in |
5 SENSOR_VP VDD3P3_RTC ADC1_CH0 RTC_GPIO0 GPIO36 I GPIO36 I oe=0, ie=0 oe=0, ie=0
6 SENSOR_CAPP VDD3P3_RTC ADC1_CH1 RTC_GPIO1 GPIO37 I GPIO37 I oe=0, ie=0 oe=0, ie=0
7 SENSOR_CAPN VDD3P3_RTC ADC1_CH2 RTC_GPIO2 GPIO38 I GPIO38 I oe=0, ie=0 oe=0, ie=0
8 SENSOR_VN VDD3P3_RTC ADC1_CH3 RTC_GPIO3 GPIO39 I GPIO39 I oe=0, ie=0 oe=0, ie=0
|     | 9 CHIP_PU | VDD3P3_RTC |
| --- | --------- | ---------- |
10 VDET_1 VDD3P3_RTC ADC1_CH6 RTC_GPIO4 GPIO34 I GPIO34 I oe=0, ie=0 oe=0, ie=0
11 VDET_2 VDD3P3_RTC ADC1_CH7 RTC_GPIO5 GPIO35 I GPIO35 I oe=0, ie=0 oe=0, ie=0
12 32K_XP VDD3P3_RTC XTAL_32K_P ADC1_CH4 TOUCH9 RTC_GPIO9 GPIO32 I/O/T GPIO32 I/O/T 2'd2 oe=0, ie=0 oe=0, ie=0
13 32K_XN VDD3P3_RTC XTAL_32K_N ADC1_CH5 TOUCH8 RTC_GPIO8 GPIO33 I/O/T GPIO33 I/O/T 2'd2 oe=0, ie=0 oe=0, ie=0
14 GPIO25 VDD3P3_RTC DAC_1 ADC2_CH8 RTC_GPIO6 GPIO25 I/O/T GPIO25 I/O/T EMAC_RXD0 I 2'd2 oe=0, ie=0 oe=0, ie=0
15 GPIO26 VDD3P3_RTC DAC_2 ADC2_CH9 RTC_GPIO7 GPIO26 I/O/T GPIO26 I/O/T EMAC_RXD1 I 2'd2 oe=0, ie=0 oe=0, ie=0
16 GPIO27 VDD3P3_RTC ADC2_CH7 TOUCH7 RTC_GPIO17 GPIO27 I/O/T GPIO27 I/O/T EMAC_RX_DV I 2'd2 oe=0, ie=0 oe=0, ie=0
SubmitDocumentationFeedback 17 MTMS VDD3P3_RTC ADC2_CH6 TOUCH6 RTC_GPIO16 MTMS I0 HSPICLK I/O/T GPIO14 I/O/T HS2_CLK O SD_CLK I0 EMAC_TXD2 O 2'd2 oe=0, ie=0 oe=0, ie=1, wpu
18 MTDI VDD3P3_RTC ADC2_CH5 TOUCH5 RTC_GPIO15 MTDI I1 HSPIQ I/O/T GPIO12 I/O/T HS2_DATA2 I1/O/T SD_DATA2 I1/O/T EMAC_TXD3 O 2'd2 oe=0, ie=1, wpd oe=0, ie=1, wpd
|     | 19 VDD3P3_RTC | VDD3P3_RTC supply in |
| --- | ------------- | -------------------- |
20 MTCK VDD3P3_RTC ADC2_CH4 TOUCH4 RTC_GPIO14 MTCK I1 HSPID I/O/T GPIO13 I/O/T HS2_DATA3 I1/O/T SD_DATA3 I1/O/T EMAC_RX_ER I 2'd2 oe=0, ie=0 oe=0, ie=1, wpd
21 MTDO VDD3P3_RTC ADC2_CH3 TOUCH3 RTC_GPIO13 I2C_SDA MTDO O/T HSPICS0 I/O/T GPIO15 I/O/T HS2_CMD I1/O/T SD_CMD I1/O/T EMAC_RXD3 I 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
22 GPIO2 VDD3P3_RTC ADC2_CH2 TOUCH2 RTC_GPIO12 I2C_SCL GPIO2 I/O/T HSPIWP I/O/T GPIO2 I/O/T HS2_DATA0 I1/O/T SD_DATA0 I1/O/T 2'd2 oe=0, ie=1, wpd oe=0, ie=1, wpd
23 GPIO0 VDD3P3_RTC ADC2_CH1 TOUCH1 RTC_GPIO11 I2C_SDA GPIO0 I/O/T CLK_OUT1 O GPIO0 I/O/T EMAC_TX_CLK I 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
24 GPIO4 VDD3P3_RTC ADC2_CH0 TOUCH0 RTC_GPIO10 I2C_SCL GPIO4 I/O/T HSPIHD I/O/T GPIO4 I/O/T HS2_DATA1 I1/O/T SD_DATA1 I1/O/T EMAC_TX_ER O 2'd2 oe=0, ie=1, wpd oe=0, ie=1, wpd
25 GPIO16 VDD_SDIO GPIO16 I/O/T GPIO16 I/O/T HS1_DATA4 I1/O/T U2RXD I1 EMAC_CLK_OUT O 2'd2 oe=0, ie=0 oe=0, ie=1
69
|     | 26 VDD_SDIO | VDD_SDIO supply out/in |
| --- | ----------- | ---------------------- |
27 GPIO17 VDD_SDIO GPIO17 I/O/T GPIO17 I/O/T HS1_DATA5 I1/O/T U2TXD O EMAC_CLK_OUT_180 O 2'd2 oe=0, ie=0 oe=0, ie=1
28 SD_DATA_2 VDD_SDIO SD_DATA2 I1/O/T SPIHD I/O/T GPIO9 I/O/T HS1_DATA2 I1/O/T U1RXD I1 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
29 SD_DATA_3 VDD_SDIO SD_DATA3 I0/O/T SPIWP I/O/T GPIO10 I/O/T HS1_DATA3 I1/O/T U1TXD O 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
30 SD_CMD VDD_SDIO SD_CMD I1/O/T SPICS0 I/O/T GPIO11 I/O/T HS1_CMD I1/O/T U1RTS O 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
31 SD_CLK VDD_SDIO SD_CLK I0 SPICLK I/O/T GPIO6 I/O/T HS1_CLK O U1CTS I1 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
32 SD_DATA_0 VDD_SDIO SD_DATA0 I1/O/T SPIQ I/O/T GPIO7 I/O/T HS1_DATA0 I1/O/T U2RTS O 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
33 SD_DATA_1 VDD_SDIO SD_DATA1 I1/O/T SPID I/O/T GPIO8 I/O/T HS1_DATA1 I1/O/T U2CTS I1 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
34 GPIO5 VDD3P3_CPU GPIO5 I/O/T VSPICS0 I/O/T GPIO5 I/O/T HS1_DATA6 I1/O/T EMAC_RX_CLK I 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
35 GPIO18 VDD3P3_CPU GPIO18 I/O/T VSPICLK I/O/T GPIO18 I/O/T HS1_DATA7 I1/O/T 2'd2 oe=0, ie=0 oe=0, ie=1
36 GPIO23 VDD3P3_CPU GPIO23 I/O/T VSPID I/O/T GPIO23 I/O/T HS1_STROBE I0 2'd2 oe=0, ie=0 oe=0, ie=1
|     | 37 VDD3P3_CPU | VDD3P3_CPU supply in |
| --- | ------------- | -------------------- |
38 GPIO19 VDD3P3_CPU GPIO19 I/O/T VSPIQ I/O/T GPIO19 I/O/T U0CTS I1 EMAC_TXD0 O 2'd2 oe=0, ie=0 oe=0, ie=1
39 GPIO22 VDD3P3_CPU GPIO22 I/O/T VSPIWP I/O/T GPIO22 I/O/T U0RTS O EMAC_TXD1 O 2'd2 oe=0, ie=0 oe=0, ie=1
40 U0RXD VDD3P3_CPU U0RXD I1 CLK_OUT2 O GPIO3 I/O/T 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
41 U0TXD VDD3P3_CPU U0TXD O CLK_OUT3 O GPIO1 I/O/T EMAC_RXD2 I 2'd2 oe=0, ie=1, wpu oe=0, ie=1, wpu
42 GPIO21 VDD3P3_CPU GPIO21 I/O/T VSPIHD I/O/T GPIO21 I/O/T EMAC_TX_EN O 2'd2 oe=0, ie=0 oe=0, ie=1
| ESP32SeriesDatasheetv5.3 | 43 VDDA   | VDDA supply in |
| ------------------------ | --------- | -------------- |
|                          | 44 XTAL_N | VDDA           |
|                          | 45 XTAL_P | VDDA           |
|                          | 46 VDDA   | VDDA supply in |
|                          | 47 CAP2   | VDDA           |
|                          | 48 CAP1   | VDDA           |
T o t al
|     | N u m b er 8 14 26 |     |
| --- | ------------------ | --- |
Notes:
• wpu: weak pull-up;
• wpd: weak pull-down;
• ie: input enable;
• oe: output enable;
• Please see Table: Notes on ESP32 Pin Lists for more information.（请参考表：管脚清单说明。）

RevisionHistory
Revision History
Date Version Releasenotes
Section4.8.3UniversalAsynchronousReceiverTransmitter(UART)and4.8.4
2026.07 v5.3
I2CInterface: Fixedtypos
• ESP32-D0WDR2-V3isendoflifeandupgradedtoESP32-D0WDRH2-V3
2025.11 v5.2
• Table1-1Comparison: Updated”OrderingCode”to”PartNumber”
• Section4.8.3UniversalAsynchronousReceiverTransmitter(UART): Added
description”Programmablebaudratesupto5MBaud”
2025.10 v5.1 • Section3BootConfigurations: FixedthetypoaboutInternalLDO(VDD_SDIO)
VoltageControl
• Fixedothertypos
• Table2-3PowerPins: Addedpowerpin1VDDA
2025.08 v5.0 • UpdatedFigure3-1VisualizationofTimingParametersfortheStrappingPins
• Table5-3DCCharacteristics(3.3V,25°C): AddedV
IH_nRST
• SectionCPUandMemory: ImprovedCoreMarkscores
• Section3.1ChipBootModeControl: Modifiedthedescriptionfrom”validonly
2025.04 v4.9 forESP32ECOV3”to”validonlyforESP32chiprevisionsv3.0andhigher”
• Section4.8.2SerialPeripheralInterface(SPI): AddedinformationaboutSPI
• Table2-2AnalogPins: Fixedtyposaboutpinnumbers
• Section3BootConfigurations: FixedthetypoaboutJTAGsignalsource
control
2025.01 v4.8 • Section2.2PinOverview: AddedanoteaboutJTAGinterfacesignals
• Table2-5PinMappingBetweenChipandFlash/PSRAM: Modifiedanote
aboutVDD_SDIO
• Table5-2RecommendedPowerSupplyCharacteristics: Deletedanoteabout
VDD3P3_RTClimitation
2024.09 v4.7 • Section4.1.1CPU: FixedthelinktoCadenceXtensaISASummary
• Section4.8.7PulseCounterController(PCNT): FixedthetypointheFeature
List
Cont’donnextpage
EspressifSystems 70 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
| Date | Version Releasenotes |     |     |     |
| ---- | -------------------- | --- | --- | --- |
Improvedtheformatting,structure,andwordinginthefollowingsections:
• Section2Pins
| 2024.08 | v4.6 |     |     |     |
| ------- | ---- | --- | --- | --- |
•
Section3BootConfigurations(usedtobenamedas”StrappingPins”)
•
Section4FunctionalDescription
Section2.5.3ChipPower-upandReset: UpdatedthelinktotheVDD_SDIO1.8V
| 2024.02 | v4.5 |     |     |     |
| ------- | ---- | --- | --- | --- |
circuitdesigntoESP32HardwareDesignGuidelines
2023.12 v4.4 Table1-1Comparison: Addedinformationaboutflashunderthetable
•
Updatedformattingthroughoutthedocument
•
Updatedwordinginsomesections
| 2023.07 | v4.3 |     |     |     |
| ------- | ---- | --- | --- | --- |
•
Addedanewsection2.3.1RestrictionsforGPIOsandRTC_GPIOs
•
Addedanewsection4.1.5Cache
• RemovedcontentsabouthallsensoraccordingtoPCN20221202
2023.01 v4.2 • Section4.9.3TouchSensor: Addedanoteaboutlimitedapplicationsoftouch
sensor
•
Section4.1.1CPU:Addedlinkto
| 2022.12 | v4.1 | Xtensa® InstructionSetArchitecture(ISA)Summary |     |     |
| ------- | ---- | ---------------------------------------------- | --- | --- |
• Table1-1Comparison: Updatedthedescriptionaboutchiprevisionupgrade
•
|     |     | SectionProductOverview: | Updatedthedescription |     |
| --- | --- | ----------------------- | --------------------- | --- |
•
Table2-6PinMappingBetweenChipandFlash/PSRAM:Addedtwonotes
belowthetable
•
|         |      | Section2.5.2PowerScheme: | Addedanewitemto“Notesonpowersupply” |     |
| ------- | ---- | ------------------------ | ----------------------------------- | --- |
| 2022.10 | v4.0 |                          |                                     |     |
•
UpdatedFigure1-1ESP32SeriesNomenclature
|     |     | • Table1-1Comparison: | Addedanewcolumn“VDD_SDIOVoltage” |     |
| --- | --- | --------------------- | -------------------------------- | --- |
|     |     | • Section4.8.12TWAI®  | Controller: Updatedthebitrates   |     |
• AddedNotRecommendedforNewDesigns(NRND)labeltoESP32-S0WD
Cont’donnextpage
| EspressifSystems |     |     | 71  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
• AddedanewchipvariantESP32-D0WDR2-V3
• AddedTable2-5PinMappingBetweenChipandFlash/PSRAMandTable2-6
PinMappingBetweenChipandFlash/PSRAM
• UpdatedFigure6-2QFN48(5×5mm)Package
2022.03 v3.9
• UpdatedAppendixIO_MUX
• UpdatedTable4-6PeripheralPinConfigurations
• Section3.1ChipBootModeControl: AddedlinkstoESP32Technical
ReferenceManual
• UpgradedESP32-U4WDHvariantfromsingle-coretodual-core,see
PCN-2021-021. Thesingle-coreversioncoexistswiththenewdual-core
versionaroundDecember2,2021. Thephysicalproductissubjecttobatch
tracking.
• SectionCPUandMemory: AddedCoreMark® score
2021.10 v3.8
• Section4.8.12TWAI® Controller: Updatedthedescription
• AddedNotRecommendedforNewDesigns(NRND)labeltothe
ESP32-D0WDQ6-V3variant
• Section6Packaging: ProvidedalinktoEspressifChipPackageInformation
• UpdatedSectionBluetooth
• RemovedESP32-D2WDvariant
• Section4.7.1BluetoothRadioandBaseband: Updatedwording
2021.07 v3.7 • UpdatedpinfunctionnumbersstartingfromFunction0
• AddedNotRecommendedforNewDesigns(NRND)labeltoESP32-D0WDand
ESP32-D0WDQ6variants
• UpdatedFigureBlockDiagram
• UpdatedTable5-5Reliability
• UpdatedFigure2-3ESP32PowerScheme
• UpdatedTable5-2RecommendedPowerSupplyCharacteristics
2021.03 V3.6
• UpdatedthenotesbelowTable2-4DescriptionofTimingParametersfor
Power-upandReset
• Table4-1,4-6,Section4.8.12TWAI® Controller: Addedmoreinformationabout
TWAI®
Cont’donnextpage
EspressifSystems 72 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
| Date | Version Releasenotes |     |     |     |
| ---- | -------------------- | --- | --- | --- |
• Table2-1PinOverview: UpdatedthedescriptionforCAP2from3nFto3.3nF
|     |     | •   | AddedTWAI® |     |
| --- | --- | --- | ---------- | --- |
SectionAdvancedPeripheralInterfaces:
| 2021.01 | V3.5 |     |     |     |
| ------- | ---- | --- | --- | --- |
•
UpdatedFigureBlockDiagram
•
AppendixIO_MUX:UpdatedtheresetvaluesforMTCK,MTMS,GPIO27
|     |     | • Addedonechipvariant: | ESP32-U4WDH |     |
| --- | --- | ---------------------- | ----------- | --- |
2020.04 V3.4 • UpdatedsomefiguresinTable4-2,5-6,5-7,5-9,5-11,5-12
• Table5-7Receiver–BasicDataRate: Addedanoteunderthetable
•
|         |      | Addedtwochipvariants: | ESP32-D0WD-V3andESP32-D0WDQ6-V3. |     |
| ------- | ---- | --------------------- | -------------------------------- | --- |
| 2020.01 | V3.3 |                       |                                  |     |
•
AddedanoteunderTable4-3Analog-to-DigitalConverter(ADC)
2019.10 V3.2 • UpdatedFigure2-4VisualizationofTimingParametersforPower-upandReset
•
|         |      | Table2-1PinOverview:            | Addedpin-pinmappingbetweenESP32-D2WDand |     |
| ------- | ---- | ------------------------------- | --------------------------------------- | --- |
| 2019.07 | V3.1 | thein-packageflashunderthetable |                                         |     |
•
UpdatedFigure1-1ESP32SeriesNomenclature
• Section3BootConfigurations(usedtobenamedas”StrappingPins”): Added
| 2019.04 | V3.0 |     |     |     |
| ------- | ---- | --- | --- | --- |
informationaboutthesetupandholdtimesforthestrappingpins
•
|     |     | Table2-1PinOverview: | Appliednewformatting |     |
| --- | --- | -------------------- | -------------------- | --- |
•
2019.02 V2.9 Table4-6PeripheralPinConfigurations: FixedtyposwithrespecttotheADC1
channelmappings
• ChangedtheRFpowercontrolrangeinTable5-7,5-10,and5-12from–12~
+12to–12~+9dBm;
| 2019.01 | V2.8 |     |     |     |
| ------- | ---- | --- | --- | --- |
•
Smalltextchanges
• UpdatedSectionApplications
| 2018.11 | V2.7 |     |     |     |
| ------- | ---- | --- | --- | --- |
• TableIO_MUX:Updatedpinstatusesatresetandafterreset
Cont’donnextpage
| EspressifSystems |     |     | 73  | ESP32SeriesDatasheetv5.3 |
| ---------------- | --- | --- | --- | ------------------------ |
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
2018.10 V2.6 • Section6Packaging: UpdatedQFNpackagedrawings
• Table5-1AbsoluteMaximumRatings: Added”CumulativeIOoutputcurrent”
• Table5-3DCCharacteristics(3.3V,25°C):Addedmoreparameters
2018.08 V2.5
• AppendixIO_MUX:Changedthepowerdomainnamestobeconsistentwith
thepinnames
• DeletedinformationonPacketTrafficArbitration(PTA);
• AddedFigure2-4VisualizationofTimingParametersforPower-upandReset
2018.07 V2.4 • Table4-2PowerManagementUnit(PMU):Addedthecurrentconsumption
figuresfordual-coreSoCs
• UpdatedSection4.9.1Analog-to-DigitalConverter(ADC)
• Table4-2PowerManagementUnit(PMU):Addedthecurrentconsumption
2018.06 V2.3
figuresatCPUfrequencyof160MHz
• Table2-1PinOverview: ChangedthevoltagerangeofVDD3P3_RTCfrom
1.8-3.6Vto2.3-3.6V
• UpdatedSection2.5.2PowerScheme
• UpdatedSection4.1.3ExternalFlashandRAM
• UpdatedTable4-2PowerManagementUnit(PMU)
• Removedcontentabouttemperaturesensor;
Changestoelectricalcharacteristics:
• UpdatedTable5-1AbsoluteMaximumRatings
• AddedTable5-2RecommendedPowerSupplyCharacteristics
2018.05 V2.2
• AddedTable5-3DCCharacteristics(3.3V,25°C)
• AddedTable5-5Reliability
• Table5-7Receiver–BasicDataRate: Updatedthevaluesof”Gaincontrolstep”
and”Adjacentchanneltransmitpower”
• Table5-10Transmitter–EnhancedDataRate: Updatedthevaluesof”Gain
controlstep”,”π/4DQPSKmodulationaccuracy”,”8DPSKmodulation
accuracy”,and”In-bandspuriousemissions”
• Table5-12Transmitter: Updatedthevaluesof”Gaincontrolstep”and
”Adjacentchanneltransmitpower”
Cont’donnextpage
EspressifSystems 74 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
• Deletedsoftware-specificfeatures;
• DeletedinformationonLNApre-amplifier;
2018.01 V2.1
• SpecifiedtheCPUspeedandflashspeedofESP32-D2WD;
• Section2.5.2PowerScheme: Addednotes
2017.12 V2.0 • Section6Packaging: Addedanoteonthesequenceofpinnumber
• Table2-1PinOverview: UpdatedthedescriptionofpinCHIP_PU
• Section2.5.2PowerScheme: Addedanote
• Section3BootConfigurations(usedtobenamedas”StrappingPins”):
Updatedthedescriptionofthechip’ssystemreset
2017.10 V1.9
• Section4.6.4Wi-FiRadioandBaseband: Addedadescriptionofantenna
diversityandselection
• Table4-2PowerManagementUnit(PMU):Deleted”Associationsleeppattern”,
addednotestoActivesleepandModem-sleep
• AddedTable4-6PeripheralPinConfigurations
2017.08 V1.8
• FigureBlockDiagram: Correctedatypo
Cont’donnextpage
EspressifSystems 75 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
• SectionBluetooth: Changedthetransmittingpowerto+12dBm;thesensitivity
ofNZIFreceiverto–97dBm
• Table2-1PinOverview: Addedanote
• section4.1.1CPU:Added160MHzclockfrequency
• Section4.6.4Wi-FiRadioandBaseband: Changedthetransmittingpower
from21dBmto20.5dBm
• Section4.7.1BluetoothRadioandBaseband: Changedthedynamiccontrol
rangeofclass-1,class-2andclass-3transmitoutputpowersto”upto24
dBm”;changedthedynamicrangeofNZIFreceiversensitivityto”over97dB”
• Table4-2PowerManagementUnit(PMU):Addedtwonotes
2017.08 V1.7 • UpdatedSection4.8.1GeneralPurposeInput/OutputInterface(GPIO)
• UpdatedSection4.8.11SDIO/SPISlaveController
• UpdatedTable5-1AbsoluteMaximumRatings
• Table5.4RFCurrentConsumptioninActiveMode: Changedthedutycycleon
whichthetransmitters’measurementsarebasedto50%.
• Table5-6Wi-FiRadio: Addedanoteon“Outputimpedance”
• Table5-7,5-9,5-11: Updatedparameter”Sensitivity”
• Table5-7,5-10,5-12: Updatedparameters”RFtransmitpower”and”RFpower
controlrange”;addedparameter”Gaincontrolstep”
• DeletedChapters: ”TouchSensor”and”CodeExamples”;
• Addedalinktocertificationdownload.
• SectionCompleteIntegrationSolution: Changedthenumberofexternal
componentsto20
2017.06 V1.6
• Section4.8.1GeneralPurposeInput/OutputInterface(GPIO):Changedthe
numberofGPIOpinsto34
• SectionCPUandMemory: Changedthepowersupplyrange
• Section2.5.2PowerScheme: Updatedthenote
• UpdatedTable5-1AbsoluteMaximumRatings
2017.06 V1.5
• TableNotesonESP32PinLists: Changedthedrivestrengthvaluesofthe
digitaloutputpinsinNote8
• Addedtheoptiontosubscribefornotificationsofdocumentationchanges
Cont’donnextpage
EspressifSystems 76 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
• SectionClocksandTimers: Addedanotetothefrequencyoftheexternal
crystaloscillator
• Section3BootConfigurations(usedtobenamedas”StrappingPins”): Added
anote
• UpdatedSection4.3RTCandLow-powerManagement
2017.05 V1.4 • Table5-1AbsoluteMaximumRatings: Changedthemaximumdrivingcapability
from12mAto80mA
• Table5-6Wi-FiRadio: Changedtheinputimpedancevalueof50Ωtooutput
impedancevalueof30+j10Ω
• TableNotesonESP32PinLists: AddedanotetoNo.8
• TableIO_MUX:DeletedGPIO20
• AddedAppendixNotesonESP32PinLists
2017.04 V1.3 • UpdatedTable5-6Wi-FiRadio
• UpdatedFigure2-2ESP32PinLayout(QFN5*5,TopView)
• Table2-1PinOverview: Addedanote
2017.03 V1.2
• Section4.1.2InternalMemory: Updatedthenote
• AddedSection1ESP32SeriesComparison
• UpdatedSectionMCUandAdvancedFeatures
• UpdatedSectionBlockDiagram
• UpdatedSection2Pins
2017.02 V1.1 • UpdatedSectionCPUandMemory
• UpdatedSection4.2.3AudioPLLClock
• UpdatedSection5.1AbsoluteMaximumRatings
• UpdatedSection6Packaging
• UpdatedSectionRelatedDocumentationandResources
2016.08 V1.0 Firstrelease.
EspressifSystems 77 ESP32SeriesDatasheetv5.3
SubmitDocumentationFeedback

Disclaimer and Copyright Notice
Informationinthisdocument,includingURLreferences,issubjecttochangewithoutnotice.
ALLTHIRDPARTY’SINFORMATIONINTHISDOCUMENTISPROVIDEDASISWITHNOWARRANTIESTOITSAUTHENTICITYAND
ACCURACY.
NOWARRANTYISPROVIDEDTOTHISDOCUMENTFORITSMERCHANTABILITY,NON-INFRINGEMENT,FITNESSFORANYPARTICULAR
PURPOSE,NORDOESANYWARRANTYOTHERWISEARISINGOUTOFANYPROPOSAL,SPECIFICATIONORSAMPLE.
Allliability,includingliabilityforinfringementofanyproprietaryrights,relatingtouseofinformationinthisdocumentisdisclaimed. No
licensesexpressorimplied,byestoppelorotherwise,toanyintellectualpropertyrightsaregrantedherein.
TheWi-FiAllianceMemberlogoisatrademarkoftheWi-FiAlliance.TheBluetoothlogoisaregisteredtrademarkofBluetoothSIG.
Alltradenames, trademarksandregisteredtrademarksmentionedinthisdocumentarepropertyoftheirrespectiveowners, andare
herebyacknowledged.
Copyright©2026EspressifSystems(Shanghai)Co.,Ltd.Allrightsreserved.
www.espressif.com