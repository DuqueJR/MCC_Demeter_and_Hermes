---
source: "/Users/juanpa/Develop/PersonalProjects/Hermes/docs/Hermes/03_hardware/datasheets/esp32_s3.pdf"
converted_at: 2026-10-25T01:51:04+00:00
size_bytes: 1098115
tool: tomd
---

| ESP32-S3 |     | Series |     |
| -------- | --- | ------ | --- |
Datasheet
|                | Version       | 2.2            |     |
| -------------- | ------------- | -------------- | --- |
| Xtensa® 32-bit | LX7 dual-core | microprocessor |     |
Bluetooth®
| 2.4 GHz Wi-Fi | (IEEE 802.11b/g/n) | and | 5 (LE) |
| ------------- | ------------------ | --- | ------ |
Optional 1.8 V or 3.3 V flash and PSRAM in the chip’s package
45 GPIOs
| QFN56 (7×7 | mm) Package |     |     |
| ---------- | ----------- | --- | --- |
Including:
ESP32-S3
ESP32-S3FN8
ESP32-S3RH2
ESP32-S3R8
ESP32-S3R16V
ESP32-S3FH4R2
ESP32-S3R8V–Endoflife(EOL)
ESP32-S3R2–Endoflife(EOL),upgradedtoESP32-S3RH2
www.espressif.com

| Product |     | Overview |     |     |     |     |     |     |     |     |
| ------- | --- | -------- | --- | --- | --- | --- | --- | --- | --- | --- |
ESP32-S3isalow-powerMCU-basedsystemonachip(SoC)withintegrated2.4GHzWi-FiandBluetooth®
LowEnergy(BluetoothLE).Itconsistsofhigh-performancedual-coremicroprocessor(Xtensa® 32-bitLX7),a
ULPcoprocessor,aWi-Fibaseband,aBluetoothLEbaseband,RFmodule,andnumerousperipherals.
ThefunctionalblockdiagramoftheSoCisshownbelow.
Espressif ESP32-S3 Wi-Fi + Bluetooth® Low Energy SoC
|     |     | CPU and Memory |     |     |     | RF  |     | Wireless Digital Circuits |     |     |
| --- | --- | -------------- | --- | --- | --- | --- | --- | ------------------------- | --- | --- |
Xtensa® Dual-core 32-bit LX7  2.4 GHz Balun +  External  Wi-Fi
Wi-Fi MAC
|     |     | Microprocessor |     |     | Switch |     | Main Clock |     |     | Baseband |
| --- | --- | -------------- | --- | --- | ------ | --- | ---------- | --- | --- | -------- |
Fast RC
Cache SRAM  zHG 4.2  zHG 4.2 rettimsnarT rezisehtnyS Bluetooth LE Link Controller
|     |     |     |           |     | revieceR |     | Oscillator |     |     |     |
| --- | --- | --- | --------- | --- | -------- | --- | ---------- | --- | --- | --- |
|     |     |     | Interrupt |     |          |  FR |            |     |     |     |
Matrix
Phase Lock
|     | JTAG |     | ROM |     |     |     |     | Bluetooth LE Baseband |     |     |
| --- | ---- | --- | --- | --- | --- | --- | --- | --------------------- | --- | --- |
Loop
|     |      |     |         | Peripherals |      |     |          |     | Security |         |
| --- | ---- | --- | ------- | ----------- | ---- | --- | -------- | --- | -------- | ------- |
|     |      |     | System  |             | GPIO |     | RTC GPIO | SHA | RSA      | AES RNG |
|     | GDMA |     |         | General-    |      |     |          |     |          |         |
Timer
purpose
Timers
|     |     |     |     |     | DIG ADC |     | RTC ADC | HMAC |     |     |
| --- | --- | --- | --- | --- | ------- | --- | ------- | ---- | --- | --- |
RSA_DS
|     | SD/MMC  |     | Pulse  |     |     |     |     |     |     |     |
| --- | ------- | --- | ------ | --- | --- | --- | --- | --- | --- | --- |
World
|     | Host |     | Counter |     | USB Serial/ |     | eFuse  |     |     |     |
| --- | ---- | --- | ------- | --- | ----------- | --- | ------ | --- | --- | --- |
Secure Boot
|     |     |     |     | Controller | JTAG |     | Controller |     |     |     |
| --- | --- | --- | --- | ---------- | ---- | --- | ---------- | --- | --- | --- |
Flash
Permission
|     | SPI0/1  |     | SPI2/3    | I2S       |              |     |              |                 |     | Encryption |
| --- | ------- | --- | --------- | --------- | ------------ | --- | ------------ | --------------- | --- | ---------- |
|     |         |     |           |           | Main System  |     | RTC          | Control         |     |            |
|     |         |     |           |           | Watchdog     |     | Watchdog     |                 |     |            |
|     |         |     | TWAI®     |           | Timers       |     | Timer        |                 |     |            |
|     | USB OTG |     |           | I2C       |              |     |              |                 | RTC |            |
|     |         |     |           |           | Super        |     | Touch        | RTC             |     |            |
|     | UART    |     | LED PWM   | MCPWM     |              |     |              |                 |     | PMU        |
|     |         |     |           |           | Watchdog     |     | Sensor       | Memory          |     |            |
|     |         |     | LCD       | Camera    |              |     | Temperature  |                 |     |            |
|     | RMT     |     |           |           | RTC I2C      |     |              | ULP Coprocessor |     |            |
|     |         |     | Interface | Interface |              |     | Sensor       |                 |     |            |
Power consumption
Normal
Low power consumption components capable of working in Deep-sleep mode
ESP32-S3FunctionalBlockDiagram
Formoreinformationonpowerconsumption,seeSection4.1.3.5PowerManagementUnit(PMU).
| EspressifSystems |     |     |     |     |     | 2   |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

Features
Wi-Fi
• ComplieswithIEEE802.11b/g/n
• Supports20MHzand40MHzbandwidthin2.4GHzband
• 1T1Rmodewithdatarateupto150Mbps
• Wi-FiMultimedia(WMM)
• TX/RXA-MPDU,TX/RXA-MSDU
• ImmediateBlockACK
• Fragmentationanddefragmentation
• AutomaticBeaconmonitoring(hardwareTSF)
• FourvirtualWi-Fiinterfaces
• SimultaneoussupportforInfrastructureBSSinStation,SoftAP,orStation+SoftAPmodes
NotethatwhenESP32-S3scansinStationmode,theSoftAPchannelwillchangealongwiththeStation
channel
• Antennadiversity
• 802.11mcFTM
Bluetooth®
• BluetoothLE:Bluetooth5,BluetoothMesh
• High-powermodewithupto20dBmtransmissionpower
• Speed: 125Kbps,500Kbps,1Mbps,2Mbps
• LEAdvertisingExtensions
• MultipleAdvertisingSets
• LEChannelSelectionAlgorithm#2
• Internalco-existencemechanismbetweenWi-FiandBluetoothtosharethesameantenna
CPU and Memory
• Xtensa® dual-core32-bitLX7microprocessor
• Clockspeed: upto240MHz
• CoreMark® score:
– Twocoresat240MHz: 1329.92CoreMark;5.54CoreMark/MHz
• Five-stagepipeline
• 128-bitdatabusanddedicatedSIMDinstructions
• Singleprecisionfloatingpointunit(FPU)
EspressifSystems 3 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

• Ultra-Low-Power(ULP)coprocessors:
– ULP-RISC-Vcoprocessor
– ULP-FSMcoprocessor
• GeneralDMAcontroller,with5transmitchannelsand5receivechannels
• L1cache
• ROM:384KB
• SRAM:512KB
• SRAMinRTC:16KB
• 4096-biteFusememory,upto1792bitsforusers
• SupportedSPIprotocols: SPI,DualSPI,QuadSPI,OctalSPI,QPIandOPIinterfacesthatallow
connectiontoflash,externalRAM,andotherSPIdevices
• Flashcontrollerwithcacheissupported
• Flashin-CircuitProgramming(ICP)issupported
Peripherals
• 45programmableGPIOs
– 4strappingGPIOs
– GPIOsallocatedforin-packagememory:
* 6GPIOsforeitherin-packageflashorPSRAM
* 7GPIOswhenbothin-packageflashandPSRAMareintegrated
• Connectivityinterfaces:
– ThreeUARTinterfaces
– TwoI2Cinterfaces
– TwoI2Sinterfaces
– LCDinterface
– 8-bit~16-bitDVPcamerainterface
– TwoSPIportsforcommunicationwithflashandRAM
– Twogeneral-purposeSPIports
– TWAI® controller,compatiblewithISO11898-1(CANSpecification2.0)
– Full-speedUSBOTG
– USBSerial/JTAGcontroller
– SD/MMChostcontrollerwith2slots
– LEDPWMcontroller,upto8channels
– TwoMotorControlPWM(MCPWM)
EspressifSystems 4 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

– RMT(TX/RX)
– Pulsecountcontroller
• Analogsignalprocessing:
– Two12-bitSARADCs,upto20channels
– Temperaturesensor
– 14capacitivetouchsensingIOs
• Timers:
– Four54-bitgeneral-purposetimers
– 52-bitsystemtimer
– Threewatchdogtimers
Power Management
• Fine-resolutionpowercontrol,includingclockfrequency,dutycycle,Wi-Fioperatingmodes,and
individualinternalcomponentcontrol
• Fourpowermodesdesignedfortypicalscenarios: Active,Modem-sleep,Light-sleep,Deep-sleep
• PowerconsumptioninDeep-sleepmodeis7µA
• RTCmemoryremainspoweredoninDeep-sleepmode
Security
• Secureboot-permissioncontrolonaccessinginternalandexternalmemory
• Flashencryption-memoryencryptionanddecryption
• Cryptographichardwareacceleration:
– SHAAccelerator(FIPSPUB180-4)
– AESAccelerator(FIPSPUB197)
– RSAAccelerator
– HMACAccelerator
– RSADigitalSignaturePeripheral(RSA_DS)
– RandomNumberGenerator(RNG)
RF Module
• Antennaswitches,RFbalun,poweramplifier,low-noisereceiveamplifier
• Upto+21dBmofpowerforan802.11btransmission
• Upto+19.5dBmofpowerforan802.11ntransmission
• Upto-104.5dBmofsensitivityforBluetoothLEreceiver(125Kbps)
EspressifSystems 5 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

Applications
Withlowpowerconsumption,ESP32-S3isanidealchoiceforIoTdevicesinthefollowingareas:
| • SmartHome            | • GenericLow-powerIoTSensorHubs  |                             |
| ---------------------- | -------------------------------- | --------------------------- |
| • IndustrialAutomation | • GenericLow-powerIoTDataLoggers |                             |
| •                      | •                                |                             |
| HealthCare             | CamerasforVideoStreaming         |                             |
| •                      | •                                |                             |
| ConsumerElectronics    | USBDevices                       |                             |
| • SmartAgriculture     | • SpeechRecognition              |                             |
| •                      | •                                |                             |
| POSMachines            | ImageRecognition                 |                             |
| •                      | •                                |                             |
| ServiceRobot           | Wi-Fi+BluetoothNetworkingCard    |                             |
| • AudioDevices         | • TouchandProximitySensing       |                             |
| EspressifSystems       | 6                                | ESP32-S3SeriesDatasheetv2.2 |
SubmitDocumentationFeedback

Contents
Note:
CheckthelinkortheQRcodetomakesurethatyouusethelatestversionofthisdocument:
https://www.espressif.com/documentation/esp32-s3_datasheet_en.pdf
Contents
Product Overview
2
Features 3
Applications 6
1 ESP32-S3 Series Comparison
13
1.1 Nomenclature 13
1.2 Comparison 13
1.3 ChipRevision 14
2 Pins
15
2.1 PinLayout 15
2.2 PinOverview 16
2.3 IOPins 20
2.3.1 IOMUXFunctions 20
2.3.2 RTCFunctions 23
2.3.3 AnalogFunctions 24
2.3.4 RestrictionsforGPIOsandRTC_GPIOs 25
2.3.5 PeripheralPinAssignment 26
2.4 AnalogPins 28
2.5 PowerSupply 29
2.5.1 PowerPins 29
2.5.2 PowerScheme 29
2.5.3 ChipPower-upandReset 30
2.6 PinMappingBetweenChipandFlash/PSRAM 31
3 Boot Configurations
32
3.1 ChipBootModeControl 33
3.2 VDD_SPIVoltageControl 34
3.3 ROMMessagesPrintingControl 34
3.4 JTAGSignalSourceControl 34
4 Functional Description
36
4.1 System 36
4.1.1 MicroprocessorandMaster 36
4.1.1.1 CPU 36
4.1.1.2 ProcessorInstructionExtensions(PIE) 36
EspressifSystems 7 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

Contents
4.1.1.3 Ultra-Low-PowerCoprocessor(ULP) 37
4.1.1.4 GDMAController(GDMA) 37
4.1.2 MemoryOrganization 38
4.1.2.1 InternalMemory 38
4.1.2.2 ExternalFlashandRAM 39
4.1.2.3 Cache 39
4.1.2.4 eFuseController 40
4.1.3 SystemComponents 40
4.1.3.1 IOMUXandGPIOMatrix 40
4.1.3.2 Reset 41
4.1.3.3 Clock 41
4.1.3.4 InterruptMatrix 42
4.1.3.5 PowerManagementUnit(PMU) 42
4.1.3.6 SystemTimer 44
4.1.3.7 GeneralPurposeTimers 44
4.1.3.8 WatchdogTimers 45
4.1.3.9 XTAL32KWatchdogTimers 45
4.1.3.10 PermissionControl 45
4.1.3.11 WorldController 46
4.1.3.12 SystemRegisters 47
4.1.4 CryptographyandSecurityComponent 47
4.1.4.1 SHAAccelerator 47
4.1.4.2 AESAccelerator 48
4.1.4.3 RSAAccelerator 48
4.1.4.4 SecureBoot 48
4.1.4.5 HMACAccelerator 49
4.1.4.6 RSADigitalSignaturePeripheral(RSA_DS) 49
4.1.4.7 ExternalMemoryEncryptionandDecryption 49
4.1.4.8 ClockGlitchDetection 50
4.1.4.9 RandomNumberGenerator 50
4.2 Peripherals 51
4.2.1 ConnectivityInterface 51
4.2.1.1 UARTController 51
4.2.1.2 I2CInterface 51
4.2.1.3 I2SInterface 52
4.2.1.4 LCDandCameraController 52
4.2.1.5 SerialPeripheralInterface(SPI) 53
4.2.1.6 Two-WireAutomotiveInterface(TWAI®) 54
4.2.1.7 USB2.0OTGFull-SpeedInterface 55
4.2.1.8 USBSerial/JTAGController 56
4.2.1.9 SD/MMCHostController 56
4.2.1.10 MotorControlPWM(MCPWM) 57
4.2.1.11 RemoteControlPeripheral(RMT) 58
4.2.1.12 PulseCountController(PCNT) 58
4.2.2 AnalogSignalProcessing 59
4.2.2.1 SARADC 59
EspressifSystems 8 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

Contents
4.2.2.2 TemperatureSensor 59
4.2.2.3 TouchSensor 59
4.3 WirelessCommunication 61
| 4.3.1 | Radio |     |     | 61  |
| ----- | ----- | --- | --- | --- |
4.3.1.1 2.4GHzReceiver 61
4.3.1.2 2.4GHzTransmitter 61
4.3.1.3 ClockGenerator 61
| 4.3.2 | Wi-Fi |     |     | 61  |
| ----- | ----- | --- | --- | --- |
4.3.2.1 Wi-FiRadioandBaseband 62
4.3.2.2 Wi-FiMAC 62
4.3.2.3 NetworkingFeatures 62
| 4.3.3 | BluetoothLE |     |     | 62  |
| ----- | ----------- | --- | --- | --- |
4.3.3.1 BluetoothLEPHY 63
4.3.3.2 BluetoothLELinkController 63
5 Electrical Characteristics
64
5.1 AbsoluteMaximumRatings 64
5.2 RecommendedOperatingConditions 64
5.3 VDD_SPIOutputCharacteristics 65
5.4 DCCharacteristics(3.3V,25°C) 65
5.5 ADCCharacteristics 66
5.6 CurrentConsumption 66
| 5.6.1 | CurrentConsumptioninActiveMode |     |     | 66  |
| ----- | ------------------------------ | --- | --- | --- |
| 5.6.2 | CurrentConsumptioninOtherModes |     |     | 67  |
5.7 MemorySpecifications 68
5.8 Reliability 69
| 6 RF | Characteristics |     |     |     |
| ---- | --------------- | --- | --- | --- |
70
6.1 Wi-FiRadio 70
| 6.1.1 | Wi-FiRFTransmitter(TX)Characteristics |     |     | 70  |
| ----- | ------------------------------------- | --- | --- | --- |
| 6.1.2 | Wi-FiRFReceiver(RX)Characteristics    |     |     | 71  |
6.2 BluetoothLERadio 72
| 6.2.1 | BluetoothLERFTransmitter(TX)Characteristics |     |     | 73  |
| ----- | ------------------------------------------- | --- | --- | --- |
| 6.2.2 | BluetoothLERFReceiver(RX)Characteristics    |     |     | 74  |
7 Packaging
77
| ESP32-S3 | Consolidated | Pin Overview |     |     |
| -------- | ------------ | ------------ | --- | --- |
79
| Datasheet | Versioning |     |     |     |
| --------- | ---------- | --- | --- | --- |
80
Glossary
81
| Related | Documentation | and Resources |     |     |
| ------- | ------------- | ------------- | --- | --- |
82
| Revision | History |     |     |     |
| -------- | ------- | --- | --- | --- |
83
| EspressifSystems |     |     | 9   | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

ListofTables
List of Tables
1-1 ESP32-S3SeriesComparison 13
2-1 PinOverview 16
2-2 Power-UpGlitchesonPins 18
2-3 PeripheralSignalsRoutedviaIOMUX 20
2-4 IOMUXFunctions 21
2-5 RTCPeripheralSignalsRoutedviaRTCIOMUX 23
2-6 RTCFunctions 23
2-7 AnalogSignalsRoutedtoAnalogFunctions 24
2-8 AnalogFunctions 24
2-9 PeripheralPinAssignment 27
2-10 AnalogPins 28
2-11 PowerPins 29
2-12 VoltageRegulators 29
2-13 DescriptionofTimingParametersforPower-upandReset 30
2-14 PinMappingBetweenChipandFlashorPSRAM 31
3-1 DefaultConfigurationofStrappingPins 32
3-2 DescriptionofTimingParametersfortheStrappingPins 33
3-3 ChipBootModeControl 33
3-4 VDD_SPIVoltageControl 34
3-5 JTAGSignalSourceControl 35
4-1 ComponentsandPowerDomains 44
5-1 AbsoluteMaximumRatings 64
5-2 RecommendedOperatingConditions 64
5-3 VDD_SPIInternalandOutputCharacteristics 65
5-4 DCCharacteristics(3.3V,25°C) 65
5-5 ADCCharacteristics 66
5-6 ADCCalibrationResults 66
5-7 CurrentConsumptionforWi-Fi(2.4GHz)inActiveMode 66
5-8 CurrentConsumptionforBluetoothLEinActiveMode 67
5-9 CurrentConsumptioninModem-sleepMode 67
5-10 CurrentConsumptioninLow-PowerModes 68
5-11 FlashSpecifications 68
5-12 PSRAMSpecifications 69
5-13 ReliabilityQualifications 69
6-1 Wi-FiRFCharacteristics 70
6-2 TXPowerwithSpectralMaskandEVMMeeting802.11Standards 70
1
6-3 TXEVMTest 70
6-4 RXSensitivity 71
6-5 MaximumRXLevel 72
6-6 RXAdjacentChannelRejection 72
6-7 BluetoothLEFrequency 72
6-8 TransmitterCharacteristics-BluetoothLE1Mbps 73
6-9 TransmitterCharacteristics-BluetoothLE2Mbps 73
EspressifSystems 10 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

ListofTables
6-10 TransmitterCharacteristics-BluetoothLE125Kbps 73
6-11 TransmitterCharacteristics-BluetoothLE500Kbps 74
6-12 ReceiverCharacteristics-BluetoothLE1Mbps 74
6-13 ReceiverCharacteristics-BluetoothLE2Mbps 75
6-14 ReceiverCharacteristics-BluetoothLE125Kbps 75
6-15 ReceiverCharacteristics-BluetoothLE500Kbps 76
7-1 ConsolidatedPinOverview 79
EspressifSystems 11 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

ListofFigures
List of Figures
1-1 ESP32-S3SeriesNomenclature 13
2-1 ESP32-S3PinLayout(TopView) 15
2-2 ESP32-S3PowerScheme 30
2-3 VisualizationofTimingParametersforPower-upandReset 30
3-1 VisualizationofTimingParametersfortheStrappingPins 33
4-1 AddressMappingStructure 38
4-2 ComponentsandPowerDomains 43
7-1 QFN56(7×7mm)Package 77
7-2 QFN56(7×7mm)Package(OnlyforESP32-S3FH4R2) 78
EspressifSystems 12 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

1 ESP32-S3SeriesComparison
| 1   | ESP32-S3 | Series |     | Comparison |     |     |     |     |     |     |     |
| --- | -------- | ------ | --- | ---------- | --- | --- | --- | --- | --- | --- | --- |
1.1 Nomenclature
|     | EESSPP3322--SS33 | FF  | HH//NN | xx  | RR HH | xx  | VV  |     |     |     |     |
| --- | ---------------- | --- | ------ | --- | ----- | --- | --- | --- | --- | --- | --- |
1.8 V external SPI flash only
PSRAM size (MB)
PSRAM temperature
H: High temperature
PSRAM
Flash size (MB)
Flash temperature
H: High temperature
N: Normal temperature
Flash
Chip series
|     |     |     |     | Figure1-1. | ESP32-S3SeriesNomenclature |     |     |     |     |     |     |
| --- | --- | --- | --- | ---------- | -------------------------- | --- | --- | --- | --- | --- | --- |
1.2 Comparison
|     |     |     |     | Table1-1. | ESP32-S3SeriesComparison |     |     |     |     |     |     |
| --- | --- | --- | --- | --------- | ------------------------ | --- | --- | --- | --- | --- | --- |
|     | 1   |     |     | 2         |                          |     |     | 3   |     | 4   |     |
PartNumber In-PackageFlash In-PackagePSRAM AmbientTemp. VDD_SPIVoltage ChipRevision
–40∼105°C
| ESP32-S3    |     |              | —   |     | —   |          |     |     | 3.3V/1.8V |     | v0.1/v0.2 |
| ----------- | --- | ------------ | --- | --- | --- | -------- | --- | --- | --------- | --- | --------- |
|             |     |              |     | 5   |     | –40∼85°C |     |     |           |     |           |
| ESP32-S3FN8 |     | 8MB(QuadSPI) |     |     | —   |          |     |     | 3.3V      |     | v0.1/v0.2 |
–40∼105°C
| ESP32-S3RH2 |     |     | —   | 2MB(QuadSPI) |     |     |     |     | 3.3V |     | v0.2 |
| ----------- | --- | --- | --- | ------------ | --- | --- | --- | --- | ---- | --- | ---- |
–40∼65°C
| ESP32-S3R8   |     |     | —   | 8MB(OctalSPI)  |     |          |     |     | 3.3V |     | v0.1/v0.2 |
| ------------ | --- | --- | --- | -------------- | --- | -------- | --- | --- | ---- | --- | --------- |
| ESP32-S3R16V |     |     | —   | 16MB(OctalSPI) |     | –40∼65°C |     |     | 1.8V |     | v0.2      |
ESP32-S3FH4R2 4MB(QuadSPI) 2MB(QuadSPI) –40∼85°C 3.3V v0.1/v0.2
| ESP32-S3R8V(EOL) |     |     | —   | 8MB(OctalSPI) |     | –40∼65°C |     |     | 1.8V |     | v0.1/v0.2 |
| ---------------- | --- | --- | --- | ------------- | --- | -------- | --- | --- | ---- | --- | --------- |
6
| ESP32-S3R2(EOL) |     |     | —   | 2MB(QuadSPI) |     | –40∼85°C |     |     | 3.3V |     | v0.1/v0.2 |
| --------------- | --- | --- | --- | ------------ | --- | -------- | --- | --- | ---- | --- | --------- |
1
Fordetailsonchipmarkingandpacking,seeSection7Packaging.
2
For information about in-package flash, see also Section 4.1.2.1 Internal Memory. By default, the SPI flash on the
chipoperatesatamaximumclockfrequencyof80MHzanddoesnotsupporttheautosuspendfeature. Ifyouhave
a requirement for a higher flash clock frequency of 120 MHz or if you need the flash auto suspend feature, please
contactus.
3 Ambient temperature specifies the recommended temperature range of the environment immediately outside an
Espressifchip. ForchipswithOctalSPIPSRAM(ESP32-S3R8,ESP32-S3R8V,andESP32-S3R16V),ifthePSRAMECC
functionisenabled,themaximumambienttemperaturecanbeimprovedto85°C,whiletheusablesizeofPSRAMwill
bereducedby1/16.
4
FormoreinformationonVDD_SPI,seeSection2.5PowerSupply.
5
FordetailsaboutSPImodes,seeSection2.6PinMappingBetweenChipandFlash/PSRAM.
6 ESP32-S3R2hasbeenupgradedtoESP32-S3RH2. Formoreinformation,seePCN.
| EspressifSystems |     |     |     |     | 13  |     |     | ESP32-S3SeriesDatasheetv2.2 |     |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- | --- |
SubmitDocumentationFeedback

1 ESP32-S3SeriesComparison
1.3 Chip Revision
AsshowninTable1-1ESP32-S3SeriesComparison,ESP32-S3nowhasmultiplechiprevisionsavailableon
themarketusingthesamepartnumber.
Forchiprevisionidentification,ESP-IDFreleasethatsupportsaspecificchiprevision,anderrorsfixedineach
chiprevision,pleaserefertoESP32-S3SeriesSoCErrata.
EspressifSystems 14 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

2 Pins
2 Pins
| 2.1 Pin | Layout |     |     |     |     |     |     |
| ------- | ------ | --- | --- | --- | --- | --- | --- |
UPC_3P3DDV
|     |     |           | P_LATX N_LATX 64OIPG | 54OIPG      |      | 83OIPG    |     |
| --- | --- | --------- | -------------------- | ----------- | ---- | --------- | --- |
|     |     | ADDV ADDV |                      | DXR0U DXT0U | SMTM | ODTM KCTM |     |
IDTM
|     |           | 65 55 | 45 35 25 | 15 05 94 | 84 74 64 | 54 44 34 |             |
| --- | --------- | ----- | -------- | -------- | -------- | -------- | ----------- |
|     | LNA_IN 1  |       |          |          |          |          | 42 GPIO37   |
|     | VDD3P3 2  |       |          |          |          |          | 41 GPIO36   |
|     | VDD3P3 3  |       |          |          |          |          | 40 GPIO35   |
|     | CHIP_PU 4 |       |          |          |          |          | 39 GPIO34   |
|     | GPIO0 5   |       |          |          |          |          | 38 GPIO33   |
|     | GPIO1 6   |       |          |          |          |          | 37 SPICLK_P |
|     | GPIO2 7   |       |          |          |          |          | 36 SPICLK_N |
|     | GPIO3 8   |       |          |          |          |          | 35 SPID     |
ESP32-S3
|                  | GPIO4 9  |               |                            |                                  |                      |                             | 34 SPIQ    |
| ---------------- | -------- | ------------- | -------------------------- | -------------------------------- | -------------------- | --------------------------- | ---------- |
|                  | GPIO5 10 |               |                            |                                  |                      |                             | 33 SPICLK  |
|                  | GPIO6 11 |               |                            |                                  |                      |                             | 32 SPICS0  |
|                  | GPIO7 12 |               |                            |                                  |                      |                             | 31 SPIWP   |
|                  | GPIO8 13 |               |                            |                                  |                      | 57 GND                      | 30 SPIHD   |
|                  | GPIO9 14 |               |                            |                                  |                      |                             | 29 VDD_SPI |
|                  |          | 51 61         | 71 81 91                   | 02 12 22                         | 32 42 52             | 62 72 82                    |            |
|                  |          | 01OIPG 11OIPG | 21OIPG 31OIPG 41OIPG       | CTR_3P3DDV P_K23_LATX N_K23_LATX | 71OIPG 81OIPG 91OIPG | 02OIPG 12OIPG 1SCIPS        |            |
|                  |          | Figure2-1.    | ESP32-S3PinLayout(TopView) |                                  |                      |                             |            |
| EspressifSystems |          |               |                            | 15                               |                      | ESP32-S3SeriesDatasheetv2.2 |            |
SubmitDocumentationFeedback

2 Pins
2.2 Pin Overview
TheESP32-S3chipintegratesmultipleperipheralsthatrequirecommunicationwiththeoutsideworld. Tokeep
thechippackagesizereasonablysmall,thenumberofavailablepinshastobelimited. Sotheonlywayto
routealltheincomingandoutgoingsignalsisthroughpinmultiplexing. Pinmuxingiscontrolledviasoftware
programmableregisters(seeESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIO
Matrix).
Allinall,theESP32-S3chiphasthefollowingtypesofpins:
•
IOpinswiththefollowingpredefinedsetsoffunctionstochoosefrom:
– EachIOpinhaspredefinedIOMUXfunctions–seeTable2-4IOMUXFunctions
– SomeIOpinshavepredefinedRTCfunctions–seeTable2-6RTCFunctions
– SomeIOpinshavepredefinedanalogfunctions–seeTable2-8AnalogFunctions
PredefinedfunctionsmeansthateachIOpinhasasetofdirectconnectionstocertainon-chip
peripherals. Duringrun-time,theusercanconfigurewhichperipheralfromapredefinedsettoconnect
toacertainpinatacertaintimeviamemorymappedregisters(see
ESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOpins).
• Analogpinsthathaveexclusively-dedicatedanalogfunctions–seeTable2-10AnalogPins
•
Powerpinsthatsupplypowertothechipcomponentsandnon-powerpins–seeTable2-11PowerPins
Table2-1PinOverviewgivesanoverviewofallthepins. Formoreinformation,seetherespectivesectionsfor
eachpintypebelow,orESP32-S3ConsolidatedPinOverview.
Table2-1. PinOverview
|     |     |             | 6   |                 | 1   |
| --- | --- | ----------- | --- | --------------- | --- |
|     |     | PinSettings |     | PinFunctionSets |     |
2-5
PinNo. PinName PinType PinProvidingPower AtReset AfterReset IOMUX RTCIOMUX Analog
| 1 LNA_IN  | Analog            |        |        |                |        |
| --------- | ----------------- | ------ | ------ | -------------- | ------ |
| 2 VDD3P3  | Power             |        |        |                |        |
| 3 VDD3P3  | Power             |        |        |                |        |
| 4 CHIP_PU | Analog VDD3P3_RTC |        |        |                |        |
| 5 GPIO0   | IO VDD3P3_RTC     | WPU,IE | WPU,IE | IOMUX RTCIOMUX |        |
| 6 GPIO1   | IO VDD3P3_RTC     | IE     | IE     | IOMUX RTCIOMUX | Analog |
| 7 GPIO2   | IO VDD3P3_RTC     | IE     | IE     | IOMUX RTCIOMUX | Analog |
| 8 GPIO3   | IO VDD3P3_RTC     | IE     | IE     | IOMUX RTCIOMUX | Analog |
| 9 GPIO4   | IO VDD3P3_RTC     |        |        | IOMUX RTCIOMUX | Analog |
| 10 GPIO5  | IO VDD3P3_RTC     |        |        | IOMUX RTCIOMUX | Analog |
| 11 GPIO6  | IO VDD3P3_RTC     |        |        | IOMUX RTCIOMUX | Analog |
| 12 GPIO7  | IO VDD3P3_RTC     |        |        | IOMUX RTCIOMUX | Analog |
| 13 GPIO8  | IO VDD3P3_RTC     |        |        | IOMUX RTCIOMUX | Analog |
| 14 GPIO9  | IO VDD3P3_RTC     |        | IE     | IOMUX RTCIOMUX | Analog |
| 15 GPIO10 | IO VDD3P3_RTC     |        | IE     | IOMUX RTCIOMUX | Analog |
| 16 GPIO11 | IO VDD3P3_RTC     |        | IE     | IOMUX RTCIOMUX | Analog |
| 17 GPIO12 | IO VDD3P3_RTC     |        | IE     | IOMUX RTCIOMUX | Analog |
| 18 GPIO13 | IO VDD3P3_RTC     |        | IE     | IOMUX RTCIOMUX | Analog |
Cont’donnextpage
| EspressifSystems |     | 16  | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

2 Pins
Cont’dfrompreviouspage
|     |     |             | 6   |                 | 1   |
| --- | --- | ----------- | --- | --------------- | --- |
|     |     | PinSettings |     | PinFunctionSets |     |
2-5
PinNo. PinName PinType PinProvidingPower AtReset AfterReset IOMUX RTCIOMUX Analog
| 19 GPIO14     | IO VDD3P3_RTC         |        | IE     | IOMUX RTCIOMUX | Analog |
| ------------- | --------------------- | ------ | ------ | -------------- | ------ |
| 20 VDD3P3_RTC | Power                 |        |        |                |        |
| 21 XTAL_32K_P | IO VDD3P3_RTC         |        |        | IOMUX RTCIOMUX | Analog |
| 22 XTAL_32K_N | IO VDD3P3_RTC         |        |        | IOMUX RTCIOMUX | Analog |
| 23 GPIO17     | IO VDD3P3_RTC         |        | IE     | IOMUX RTCIOMUX | Analog |
| 24 GPIO18     | IO VDD3P3_RTC         |        | IE     | IOMUX RTCIOMUX | Analog |
| 25 GPIO19     | IO VDD3P3_RTC         |        |        | IOMUX RTCIOMUX | Analog |
| 26 GPIO20     | IO VDD3P3_RTC         | USB_PU | USB_PU | IOMUX RTCIOMUX | Analog |
| 27 GPIO21     | IO VDD3P3_RTC         |        |        | IOMUX RTCIOMUX |        |
| 28 SPICS1     | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 29 VDD_SPI    | Power                 |        |        |                |        |
| 30 SPIHD      | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 31 SPIWP      | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 32 SPICS0     | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 33 SPICLK     | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 34 SPIQ       | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 35 SPID       | IO VDD_SPI            | WPU,IE | WPU,IE | IOMUX          |        |
| 36 SPICLK_N   | IO VDD_SPI/VDD3P3_CPU | IE     | IE     | IOMUX          |        |
| 37 SPICLK_P   | IO VDD_SPI/VDD3P3_CPU | IE     | IE     | IOMUX          |        |
| 38 GPIO33     | IO VDD_SPI/VDD3P3_CPU |        | IE     | IOMUX          |        |
| 39 GPIO34     | IO VDD_SPI/VDD3P3_CPU |        | IE     | IOMUX          |        |
| 40 GPIO35     | IO VDD_SPI/VDD3P3_CPU |        | IE     | IOMUX          |        |
| 41 GPIO36     | IO VDD_SPI/VDD3P3_CPU |        | IE     | IOMUX          |        |
| 42 GPIO37     | IO VDD_SPI/VDD3P3_CPU |        | IE     | IOMUX          |        |
| 43 GPIO38     | IO VDD3P3_CPU         |        | IE     | IOMUX          |        |
7
| 44 MTCK       | IO VDD3P3_CPU |        | IE     | IOMUX |     |
| ------------- | ------------- | ------ | ------ | ----- | --- |
| 45 MTDO       | IO VDD3P3_CPU |        | IE     | IOMUX |     |
| 46 VDD3P3_CPU | Power         |        |        |       |     |
| 47 MTDI       | IO VDD3P3_CPU |        | IE     | IOMUX |     |
| 48 MTMS       | IO VDD3P3_CPU |        | IE     | IOMUX |     |
| 49 U0TXD      | IO VDD3P3_CPU | WPU,IE | WPU,IE | IOMUX |     |
| 50 U0RXD      | IO VDD3P3_CPU | WPU,IE | WPU,IE | IOMUX |     |
| 51 GPIO45     | IO VDD3P3_CPU | WPD,IE | WPD,IE | IOMUX |     |
| 52 GPIO46     | IO VDD3P3_CPU | WPD,IE | WPD,IE | IOMUX |     |
| 53 XTAL_N     | Analog        |        |        |       |     |
| 54 XTAL_P     | Analog        |        |        |       |     |
| 55 VDDA       | Power         |        |        |       |     |
| 56 VDDA       | Power         |        |        |       |     |
| 57 GND        | Power         |        |        |       |     |
1. Boldmarksthepinfunctionsetinwhichapinhasitsdefaultfunctioninthedefaultbootmode.Formoreinformationaboutthe
bootmode，seeSection3.1ChipBootModeControl.
2. IncolumnPinProvidingPower,regardingpinspoweredbyVDD_SPI:
• PoweractuallycomesfromtheinternalpowerrailsupplyingpowertoVDD_SPI.Fordetails,seeSection2.5.2Power
Scheme.
3. IncolumnPinProvidingPower,regardingpinspoweredbyVDD3P3_CPU/VDD_SPI:
| EspressifSystems |     | 17  | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

2 Pins
• PinProvidingPower(eitherVDD3P3_CPUorVDD_SPI)isdecidedbyeFusebitEFUSE_PIN_POWER_SELECTION(see
ESP32-S3TechnicalReferenceManual>ChaptereFuseController)andcanbeconfiguredviathe
IO_MUX_PAD_POWER_CTRLbit(seeESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOpins).
4. ForESP32-S3R8VandESP32-S3R16Vchip,astheVDD_SPIvoltagehasbeensetto1.8V,theworkingvoltageforpinsSPICLK_N
andSPICLK_P(GPIO47andGPIO48)wouldalsobe1.8V,whichisdifferentfromotherGPIOs.
5. Thedefaultdrivestrengthsforeachpinareasfollows:
•
GPIO17andGPIO18:10mA
•
GPIO19andGPIO20:40mA
•
Allotherpins:20mA
6. ColumnPinSettingsshowspredefinedsettingsatresetandafterresetwiththefollowingabbreviations:
•
IE–inputenabled
•
WPU–internalweakpull-upresistorenabled
• WPD–internalweakpull-downresistorenabled
• USB_PU–USBpull-upresistorenabled
– Bydefault,theUSBfunctionisenabledforUSBpins(i.e.,GPIO19andGPIO20),andthepinpull-upisdecidedbythe
USBpull-up.TheUSBpull-upiscontrolledbyUSB_SERIAL_JTAG_DP/DM_PULLUPandthepull-upresistorvalueis
controlledbyUSB_SERIAL_JTAG_PULLUP_VALUE.Fordetails,seeESP32-S3TechnicalReferenceManual>Chapter
USBSerial/JTAGController).
– WhentheUSBfunctionisdisabled,USBpinsareusedasregularGPIOsandthepin’sinternalweakpull-upand
pull-downresistorsaredisabledbydefault(configurablebyIO_MUX_FUN_
WPU/WPD).Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOMatrix.
7. DependsonthevalueofEFUSE_DIS_PAD_JTAG
• 0-WPUisenabled
• 1-pinfloating
| Somepinshaveglitchesduringpower-up. | SeedetailsinTable2-2. |     |     |     |
| ----------------------------------- | --------------------- | --- | --- | --- |
Table2-2. Power-UpGlitchesonPins
1
| Pin        | Glitch          |     | TypicalTimePeriod(µs) |     |
| ---------- | --------------- | --- | --------------------- | --- |
| GPIO1      | Low-levelglitch |     |                       | 60  |
| GPIO2      | Low-levelglitch |     |                       | 60  |
| GPIO3      | Low-levelglitch |     |                       | 60  |
| GPIO4      | Low-levelglitch |     |                       | 60  |
| GPIO5      | Low-levelglitch |     |                       | 60  |
| GPIO6      | Low-levelglitch |     |                       | 60  |
| GPIO7      | Low-levelglitch |     |                       | 60  |
| GPIO8      | Low-levelglitch |     |                       | 60  |
| GPIO9      | Low-levelglitch |     |                       | 60  |
| GPIO10     | Low-levelglitch |     |                       | 60  |
| GPIO11     | Low-levelglitch |     |                       | 60  |
| GPIO12     | Low-levelglitch |     |                       | 60  |
| GPIO13     | Low-levelglitch |     |                       | 60  |
| GPIO14     | Low-levelglitch |     |                       | 60  |
| XTAL_32K_P | Low-levelglitch |     |                       | 60  |
| XTAL_32K_N | Low-levelglitch |     |                       | 60  |
| GPIO17     | Low-levelglitch |     |                       | 60  |
Cont’donnextpage
| EspressifSystems |     | 18  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

2 Pins
Table2-2–cont’dfrompreviouspage
1
Pin Glitch TypicalTimePeriod(µs)
Low-levelglitch 60
GPIO18
High-levelglitch 60
Low-levelglitch 60
GPIO19
2
High-levelglitch 60
Pull-downglitch 60
GPIO20
2
High-levelglitch 60
1
Low-levelglitch: thepinisatalowleveloutputstatusduringthetimeperiod;
High-levelglitch: thepinisatahighleveloutputstatusduringthetimeperiod;
Pull-downglitch: thepinisataninternalweakpulled-downstatusduringthetimeperiod;
Pull-upglitch: thepinisataninternalweakpulled-upstatusduringthetimeperiod.
PleaserefertoTable5-4DCCharacteristics(3.3V,25°C)fordetailedparametersabout
low/high-levelandpull-down/up.
2
GPIO19 and GPIO20 pins both have two high-level glitches during chip power-up, each
lastingforabout60µs. Thetotaldurationfortheglitchesandthedelayare3.2msand
2msrespectivelyforGPIO19andGPIO20.
EspressifSystems 19 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

2 Pins
2.3 IO Pins
| 2.3.1 IO MUX Functions |     |     |     |
| ---------------------- | --- | --- | --- |
TheIOMUXallowsmultipleinput/outputsignalstobeconnectedtoasingleinput/outputpin. EachIOpinof
ESP32-S3canbeconnectedtooneofthefivesignals(IOMUXfunctions,i.e.,F0-F4),aslistedinTable2-4IO
MUXFunctions.
Amongthefivesetsofsignals:
•
SomeareroutedviatheGPIOMatrix(GPIO0,GPIO1,etc.),whichincorporatesinternalsignalrouting
circuitryformappingsignalsprogrammatically. Itgivesthepinaccesstoalmostanyperipheralsignals.
However,theflexibilityofprogrammaticmappingcomesatacostasitmightaffectthelatencyofrouted
signals. FordetailsaboutconnectingtoperipheralsignalsviaGPIOMatrix,see
ESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOMatrix.
• Somearedirectlyroutedfromcertainperipherals(U0TXD,MTCK,etc.),includingUART0/1,JTAG,
SPI0/1,andSPI2-seeTable2-3PeripheralSignalsRoutedviaIOMUX.
|             | Table2-3.    | PeripheralSignalsRoutedviaIOMUX |     |
| ----------- | ------------ | ------------------------------- | --- |
| PinFunction | Signal       | Description                     |     |
| U…TXD       | Transmitdata |                                 |     |
| U…RXD       | Receivedata  |                                 |     |
UART0/1interface
| U…RTS | Requesttosend |     |     |
| ----- | ------------- | --- | --- |
| U…CTS | Cleartosend   |     |     |
| MTCK  | Testclock     |     |     |
| MTDO  | TestDataOut   |     |     |
JTAGinterfacefordebugging
| MTDI | TestDataIn        |     |     |
| ---- | ----------------- | --- | --- |
| MTMS | TestModeSelect    |     |     |
| SPIQ | Masterin,slaveout |     |     |
SPID Masterout,slavein SPI0/1interface(poweredbyVDD_SPI)forconnectiontoin-packageor
SPIHD Hold off-packageflash/PSRAMviatheSPIbus. Itsupports1-,2-,4-lineSPI
SPIWP Writeprotect modes. SeealsoSection2.6PinMappingBetweenChipand
| SPICLK | Clock      | Flash/PSRAM |     |
| ------ | ---------- | ----------- | --- |
| SPICS… | Chipselect |             |     |
SPIIO… Data SPI0/1interface(poweredbyVDD_SPIorVDD3P3_CPU)forthehigher
SPIDQS Datastrobe/datamask 4bitsdatalineinterfaceandDQSinterfacein8-lineSPImode
SPICLK_N_DIFF Negativeclocksignal Differentialclocknegative/positivefortheSPIbus
| SPICLK_P_DIFF | Positiveclocksignal |     |     |
| ------------- | ------------------- | --- | --- |
| SUBSPIQ       | Masterin,slaveout   |     |     |
| SUBSPID       | Masterout,slavein   |     |     |
SPI0/1interface(poweredbyVDD3P3_RTCorVDD3V3_CPU)for
| SUBSPIHD | Hold |     |     |
| -------- | ---- | --- | --- |
connectiontoin-packageoroff-packageflash/PSRAMviatheSUBSPI
| SUBSPIWP | Writeprotect |     |     |
| -------- | ------------ | --- | --- |
bus. Itsupports1-,2-,4-lineSPImodes
| SUBSPICLK | Clock      |     |     |
| --------- | ---------- | --- | --- |
| SUBSPICS… | Chipselect |     |     |
SUBSPICLK_N_DIFF Negativeclocksignal Differentialclocknegative/positivefortheSUBSPIbus
| SUBSPICLK_P_DIFF | Positiveclocksignal |     |     |
| ---------------- | ------------------- | --- | --- |
Cont’donnextpage
| EspressifSystems |     | 20  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

2 Pins
Table2-3–cont’dfrompreviouspage
| PinFunction | Signal            |     | Description |     |     |     |
| ----------- | ----------------- | --- | ----------- | --- | --- | --- |
| FSPIQ       | Masterin,slaveout |     |             |     |     |     |
| FSPID       | Masterout,slavein |     |             |     |     |     |
FSPIHD Hold SPI2interfaceforfastSPIconnection. Itsupports1-,2-,4-lineSPI
| FSPIWP  | Writeprotect |     | modes |     |     |     |
| ------- | ------------ | --- | ----- | --- | --- | --- |
| FSPICLK | Clock        |     |       |     |     |     |
| FSPICS0 | Chipselect   |     |       |     |     |     |
FSPIIO… Data Thehigher4bitsdatalineinterfaceandDQSinterfaceforSPI2interface
| FSPIDQS | Datastrobe/datamask |     | in8-lineSPImode |     |     |     |
| ------- | ------------------- | --- | --------------- | --- | --- | --- |
CLK_OUT… Clockoutput Outputclocksignalsgeneratedbythechip’sinternalcomponents
Table2-4IOMUXFunctionsshowstheIOMUXfunctionsofIOpins.
Table2-4. IOMUXFunctions
IOMUXFunction 1,2,3
|             | 2     | 3     |             |           |         |      |
| ----------- | ----- | ----- | ----------- | --------- | ------- | ---- |
| PinNo. GPIO | F0    | Type  | F1 Type F2  | Type F3   | Type F4 | Type |
| 5 GPIO0     | GPIO0 | I/O/T | GPIO0 I/O/T |           |         |      |
| 6 GPIO1     | GPIO1 | I/O/T | GPIO1 I/O/T |           |         |      |
| 7 GPIO2     | GPIO2 | I/O/T | GPIO2 I/O/T |           |         |      |
| 8 GPIO3     | GPIO3 | I/O/T | GPIO3 I/O/T |           |         |      |
| 9 GPIO4     | GPIO4 | I/O/T | GPIO4 I/O/T |           |         |      |
| 10 GPIO5    | GPIO5 | I/O/T | GPIO5 I/O/T |           |         |      |
| 11 GPIO6    | GPIO6 | I/O/T | GPIO6 I/O/T |           |         |      |
| 12 GPIO7    | GPIO7 | I/O/T | GPIO7 I/O/T |           |         |      |
| 13 GPIO8    | GPIO8 | I/O/T | GPIO8 I/O/T | SUBSPICS1 | O/T     |      |
14 GPIO9 GPIO9 I/O/T GPIO9 I/O/T SUBSPIHD I1/O/T FSPIHD I1/O/T
15 GPIO10 GPIO10 I/O/T GPIO10 I/O/T FSPIIO4 I1/O/T SUBSPICS0 O/T FSPICS0 I1/O/T
16 GPIO11 GPIO11 I/O/T GPIO11 I/O/T FSPIIO5 I1/O/T SUBSPID I1/O/T FSPID I1/O/T
17 GPIO12 GPIO12 I/O/T GPIO12 I/O/T FSPIIO6 I1/O/T SUBSPICLK O/T FSPICLK I1/O/T
18 GPIO13 GPIO13 I/O/T GPIO13 I/O/T FSPIIO7 I1/O/T SUBSPIQ I1/O/T FSPIQ I1/O/T
19 GPIO14 GPIO14 I/O/T GPIO14 I/O/T FSPIDQS O/T SUBSPIWP I1/O/T FSPIWP I1/O/T
| 21 GPIO15 | GPIO15 | I/O/T  | GPIO15 I/O/T U0RTS | O           |     |     |
| --------- | ------ | ------ | ------------------ | ----------- | --- | --- |
| 22 GPIO16 | GPIO16 | I/O/T  | GPIO16 I/O/T U0CTS | I1          |     |     |
| 23 GPIO17 | GPIO17 | I/O/T  | GPIO17 I/O/T U1TXD | O           |     |     |
| 24 GPIO18 | GPIO18 | I/O/T  | GPIO18 I/O/T U1RXD | I1 CLK_OUT3 | O   |     |
| 25 GPIO19 | GPIO19 | I/O/T  | GPIO19 I/O/T U1RTS | O CLK_OUT2  | O   |     |
| 26 GPIO20 | GPIO20 | I/O/T  | GPIO20 I/O/T U1CTS | I1 CLK_OUT1 | O   |     |
| 27 GPIO21 | GPIO21 | I/O/T  | GPIO21 I/O/T       |             |     |     |
| 28 GPIO26 | SPICS1 | O/T    | GPIO26 I/O/T       |             |     |     |
| 30 GPIO27 | SPIHD  | I1/O/T | GPIO27 I/O/T       |             |     |     |
| 31 GPIO28 | SPIWP  | I1/O/T | GPIO28 I/O/T       |             |     |     |
| 32 GPIO29 | SPICS0 | O/T    | GPIO29 I/O/T       |             |     |     |
| 33 GPIO30 | SPICLK | O/T    | GPIO30 I/O/T       |             |     |     |
| 34 GPIO31 | SPIQ   | I1/O/T | GPIO31 I/O/T       |             |     |     |
Cont’donnextpage
| EspressifSystems |     |     | 21  | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

2 Pins
Cont’dfrompreviouspage
1,2,3
IOMUXFunction
|             | 2    | 3             |         |         |         |      |
| ----------- | ---- | ------------- | ------- | ------- | ------- | ---- |
| PinNo. GPIO | F0   | Type F1       | Type F2 | Type F3 | Type F4 | Type |
| 35 GPIO32   | SPID | I1/O/T GPIO32 | I/O/T   |         |         |      |
36 GPIO48 SPICLK_N_DIFF O/T GPIO48 I/O/T SUBSPICLK_N_DIFF O/T
37 GPIO47 SPICLK_P_DIFF O/T GPIO47 I/O/T SUBSPICLK_P_DIFF O/T
38 GPIO33 GPIO33 I/O/T GPIO33 I/O/T FSPIHD I1/O/T SUBSPIHD I1/O/T SPIIO4 I1/O/T
39 GPIO34 GPIO34 I/O/T GPIO34 I/O/T FSPICS0 I1/O/T SUBSPICS0 O/T SPIIO5 I1/O/T
40 GPIO35 GPIO35 I/O/T GPIO35 I/O/T FSPID I1/O/T SUBSPID I1/O/T SPIIO6 I1/O/T
41 GPIO36 GPIO36 I/O/T GPIO36 I/O/T FSPICLK I1/O/T SUBSPICLK O/T SPIIO7 I1/O/T
42 GPIO37 GPIO37 I/O/T GPIO37 I/O/T FSPIQ I1/O/T SUBSPIQ I1/O/T SPIDQS I0/O/T
43 GPIO38 GPIO38 I/O/T GPIO38 I/O/T FSPIWP I1/O/T SUBSPIWP I1/O/T
| 44 GPIO39 | MTCK   | I1 GPIO39    | I/O/T CLK_OUT3 | O SUBSPICS1 | O/T |     |
| --------- | ------ | ------------ | -------------- | ----------- | --- | --- |
| 45 GPIO40 | MTDO   | O/T GPIO40   | I/O/T CLK_OUT2 | O           |     |     |
| 47 GPIO41 | MTDI   | I1 GPIO41    | I/O/T CLK_OUT1 | O           |     |     |
| 48 GPIO42 | MTMS   | I1 GPIO42    | I/O/T          |             |     |     |
| 49 GPIO43 | U0TXD  | O GPIO43     | I/O/T CLK_OUT1 | O           |     |     |
| 50 GPIO44 | U0RXD  | I1 GPIO44    | I/O/T CLK_OUT2 | O           |     |     |
| 51 GPIO45 | GPIO45 | I/O/T GPIO45 | I/O/T          |             |     |     |
| 52 GPIO46 | GPIO46 | I/O/T GPIO46 | I/O/T          |             |     |     |
1
Boldmarksthedefaultpinfunctionsinthedefaultbootmode. Formoreinformationaboutthebootmode，seeSection3.1Chip
BootModeControl.
2 Regarding highlighted cells,seeSection2.3.4RestrictionsforGPIOsandRTC_GPIOs.
3
EachIOMUXfunction(Fn,n=0~4)isassociatedwithatype. Thedescriptionoftypeisasfollows:
•I–input.
|     | O–output. T–highimpedance. |     |     |     |     |     |
| --- | -------------------------- | --- | --- | --- | --- | --- |
•I1–input;ifthepinisassignedafunctionotherthanFn,theinputsignalofFnisalways1.
•I0–input;ifthepinisassignedafunctionotherthanFn,theinputsignalofFnisalways0.
| EspressifSystems |     |     | 22  | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

2 Pins
2.3.2 RTC Functions
WhenthechipisinDeep-sleepmode,theIOMUXdescribedinSection2.3.1IOMUXFunctionswillnotwork.
ThatiswheretheRTCIOMUXcomesin. Itallowsmultipleinput/outputsignalstobeasingleinput/outputpin
inDeep-sleepmode,asthepinisconnectedtotheRTCsystemandpoweredbyVDD3P3_RTC.
| RTCIOpinscanbeassignedtoRTCfunctions. |     | Theycan |     |     |
| ------------------------------------- | --- | ------- | --- | --- |
•
EitherworkasRTCGPIOs(RTC_GPIO0,RTC_GPIO1,etc.),connectedtotheULPcoprocessor
•
OrconnecttoRTCperipheralsignals(sar_i2c_scl_0,sar_i2c_sda_0,etc.) -seeTable2-5RTC
PeripheralSignalsRoutedviaRTCIOMUX
Table2-5. RTCPeripheralSignalsRoutedviaRTCIOMUX
|     | PinFunction  | Signal      | Description |     |
| --- | ------------ | ----------- | ----------- | --- |
|     | sar_i2c_scl… | Serialclock |             |     |
RTCI2C0/1interface
|     | sar_i2c_sda… | Serialdata |     |     |
| --- | ------------ | ---------- | --- | --- |
Table2-6RTCFunctionsshowstheRTCfunctionsofRTCIOpins.
Table2-6. RTCFunctions
2
|     | Pin RTC |     | RTCFunction |     |
| --- | ------- | --- | ----------- | --- |
1
|     | No. IOName    | F0         | F1 F2 | F3            |
| --- | ------------- | ---------- | ----- | ------------- |
|     | 5 RTC_GPIO0   | RTC_GPIO0  |       | sar_i2c_scl_0 |
|     | 6 RTC_GPIO1   | RTC_GPIO1  |       | sar_i2c_sda_0 |
|     | 7 RTC_GPIO2   | RTC_GPIO2  |       | sar_i2c_scl_1 |
|     | 8 RTC_GPIO3   | RTC_GPIO3  |       | sar_i2c_sda_1 |
|     | 9 RTC_GPIO4   | RTC_GPIO4  |       |               |
|     | 10 RTC_GPIO5  | RTC_GPIO5  |       |               |
|     | 11 RTC_GPIO6  | RTC_GPIO6  |       |               |
|     | 12 RTC_GPIO7  | RTC_GPIO7  |       |               |
|     | 13 RTC_GPIO8  | RTC_GPIO8  |       |               |
|     | 14 RTC_GPIO9  | RTC_GPIO9  |       |               |
|     | 15 RTC_GPIO10 | RTC_GPIO10 |       |               |
|     | 16 RTC_GPIO11 | RTC_GPIO11 |       |               |
|     | 17 RTC_GPIO12 | RTC_GPIO12 |       |               |
|     | 18 RTC_GPIO13 | RTC_GPIO13 |       |               |
|     | 19 RTC_GPIO14 | RTC_GPIO14 |       |               |
|     | 21 RTC_GPIO15 | RTC_GPIO15 |       |               |
|     | 22 RTC_GPIO16 | RTC_GPIO16 |       |               |
|     | 23 RTC_GPIO17 | RTC_GPIO17 |       |               |
|     | 24 RTC_GPIO18 | RTC_GPIO18 |       |               |
|     | 25 RTC_GPIO19 | RTC_GPIO19 |       |               |
|     | 26 RTC_GPIO20 | RTC_GPIO20 |       |               |
|     | 27 RTC_GPIO21 | RTC_GPIO21 |       |               |
1 ThiscolumnliststheRTCGPIOnames,sinceRTCfunctionsarecon-
figuredwithRTCGPIOregistersthatuseRTCGPIOnumbering.
2
|     | Regarding highlighted | cells,seeSection2.3.4RestrictionsforGPIOs |     |     |
| --- | --------------------- | ----------------------------------------- | --- | --- |
andRTC_GPIOs.
| EspressifSystems |     | 23  |     | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

2 Pins
| 2.3.3 Analog Functions |     |     |     |     |
| ---------------------- | --- | --- | --- | --- |
SomeIOpinsalsohaveanalogfunctions,foranalogperipherals(suchasADC)inanypowermode. Internal
analogsignalsareroutedtotheseanalogfunctions,seeTable2-7AnalogSignalsRoutedtoAnalog
Functions.
|             | Table2-7. AnalogSignalsRoutedtoAnalogFunctions |     |                      |     |
| ----------- | ---------------------------------------------- | --- | -------------------- | --- |
| PinFunction | Signal                                         |     | Description          |     |
| TOUCH…      | Touchsensorchannel…signal                      |     | Touchsensorinterface |     |
| ADC…_CH…    | ADC1/2channel…signal                           |     | ADC1/2interface      |     |
XTAL_32K_N Negativeclocksignal 32kHzexternalclockinput/output
XTAL_32K_P Positiveclocksignal connectedtoESP32-S3’soscillator
| USB_D- | Data- |     |     |     |
| ------ | ----- | --- | --- | --- |
USBOTGandUSBSerial/JTAGfunction
| USB_D+ | Data+ |     |     |     |
| ------ | ----- | --- | --- | --- |
Table2-8AnalogFunctionsshowstheanalogfunctionsofIOpins.
Table2-8. AnalogFunctions
|     |        |            | AnalogFunction | 1,2      |
| --- | ------ | ---------- | -------------- | -------- |
|     | PinNo. | GPIO 3     | F0             | F1       |
|     | 6      | RTC_GPIO1  | TOUCH1         | ADC1_CH0 |
|     | 7      | RTC_GPIO2  | TOUCH2         | ADC1_CH1 |
|     | 8      | RTC_GPIO3  | TOUCH3         | ADC1_CH2 |
|     | 9      | RTC_GPIO4  | TOUCH4         | ADC1_CH3 |
|     | 10     | RTC_GPIO5  | TOUCH5         | ADC1_CH4 |
|     | 11     | RTC_GPIO6  | TOUCH6         | ADC1_CH5 |
|     | 12     | RTC_GPIO7  | TOUCH7         | ADC1_CH6 |
|     | 13     | RTC_GPIO8  | TOUCH8         | ADC1_CH7 |
|     | 14     | RTC_GPIO9  | TOUCH9         | ADC1_CH8 |
|     | 15     | RTC_GPIO10 | TOUCH10        | ADC1_CH9 |
|     | 16     | RTC_GPIO11 | TOUCH11        | ADC2_CH0 |
|     | 17     | RTC_GPIO12 | TOUCH12        | ADC2_CH1 |
|     | 18     | RTC_GPIO13 | TOUCH13        | ADC2_CH2 |
|     | 19     | RTC_GPIO14 | TOUCH14        | ADC2_CH3 |
|     | 21     | RTC_GPIO15 | XTAL_32K_P     | ADC2_CH4 |
|     | 22     | RTC_GPIO16 | XTAL_32K_N     | ADC2_CH5 |
|     | 23     | RTC_GPIO17 |                | ADC2_CH6 |
|     | 24     | RTC_GPIO18 |                | ADC2_CH7 |
|     | 25     | RTC_GPIO19 | USB_D-         | ADC2_CH8 |
|     | 26     | RTC_GPIO20 | USB_D+         | ADC2_CH9 |
1
Boldmarksthedefaultpinfunctionsinthedefaultboot
Formoreinformationaboutthebootmode，see
mode.
Section3.1ChipBootModeControl.
2
|     | This column | lists the      | RTC GPIO names, | since analog   |
| --- | ----------- | -------------- | --------------- | -------------- |
|     | functions   | are configured | with RTC GPIO   | registers that |
useRTCGPIOnumbering.
3
|     | Regarding | highlighted | cells, see Section | 2.3.4 Re- |
| --- | --------- | ----------- | ------------------ | --------- |
strictionsforGPIOsandRTC_GPIOs.
| EspressifSystems |     |     | 24  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

2 Pins
2.3.4 Restrictions for GPIOs and RTC_GPIOs
AllIOpinsofESP32-S3haveGPIOandsomehaveRTC_GPIOpinfunctions. However,theIOpinsare
multiplexedandcanbeconfiguredfordifferentpurposesbasedontherequirements. SomeIOshave
restrictionsforusage. ItisessentialtoconsiderthemultiplexednatureandthelimitationswhenusingtheseIO
pins.
Intablesofthischapter,somepinfunctionsarein red or yellow. Thesefunctionsindicatepinsthatrequire
extracautionwhenusedas GPIO/GPIO:
• IOPins –allocatedforcommunicationwithin-packageflash/PSRAMandNOTrecommendedforother
uses. Fordetails,seeSection2.6PinMappingBetweenChipandFlash/PSRAM.
• IOPins –haveoneofthefollowingimportantfunctions:
– Strappingpins–needtobeatcertainlogiclevelsatstartup. SeeSection3BootConfigurations.
Note:
StrappingpinsarehighlightedbyPinNameorconfigurationsAtReset,insteadofthepinfunctions.
– USB_D+/-–bydefault,connectedtotheUSBSerial/JTAGController. TofunctionasGPIOs,these
pinsneedtobereconfiguredviatheIO_MUX_MCU_SELbit(see
ESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOMatrixfordetails).
– JTAGinterface–oftenusedfordebugging. SeeTable2-4IOMUXFunctions. Tofreethesepins
up,thepinfunctionsUSB_D+/-oftheUSBSerial/JTAGControllercanbeusedinstead. Seealso
Section3.4JTAGSignalSourceControl.
– UART0interface–oftenusedfordebugging. SeeTable2-4IOMUXFunctions.
– 8-lineSPIinterface–norestrictions,unlessthechipisconnectedtoflash/PSRAMusing8-lineSPI
mode.
Formoreinformationaboutassigningpins,pleaseseeSection2.3.5PeripheralPinAssignmentandESP32-S3
ConsolidatedPinOverview.
EspressifSystems 25 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

2 Pins
2.3.5 Peripheral Pin Assignment
Table2-9PeripheralPinAssignmenthighlightswhichpinscanbeassignedtoeachperipheralinterface
accordingtothefollowingpriorities:
• Priority1(P1): FixedpinsconnecteddirectlytoperipheralsignalsviaIOMUXorRTCIOMUX.
Ifaperipheralinterfacedoesnothavepriority1pins,suchasUART2,itcanbeassignedtoanyGPIOpins
frompriority2topriority4.
• AnyGPIOpinsmappingtoperipheralsignalsviaGPIOMatrix,canbepriority2,3,or4.
– Priority2(P2): GPIOpinscanbefreelyusedwithoutrestrictions.
– Priority3(P3): GPIOpinsshouldbeusedwithcaution,astheymayconflictwiththefollowing
importantfunctionsdescribedinSection2.3.4RestrictionsforGPIOsandRTC_GPIOs:
* GPIO0,GPIO3,GPIO45,GPIO46: Strappingpins.
* GPIO19,GPIO20: USBSerial/JTAGinterface.
* GPIO39,GPIO40,GPIO41,GPIO42: JTAGinterface.
* GPIO43,GPIO44: UART0interface.
* GPIO33,GPIO34,GPIO35,GPIO36,GPIO37: Thehigher4bitsdatalineinterfaceandDQS
interfacefortheSPI0/1interfacein8-lineSPImode,andcanbeGPIOpinsifthechipisnot
connectedtoflashorPSRAMin8-lineSPImode.
– Priority4(P4): GPIOpinsalreadyallocatedornotrecommendedforuse,asdescribedinSection
2.3.4RestrictionsforGPIOsandRTC_GPIOs:
* GPIO26,GPIO27,GPIO28,GPIO29,GPIO30,GPIO31,GPIO32: SPI0/1interfaceconnectedto
thein-packageflashandPSRAM,orrecommendedfortheoff-packageflashandPSRAM.
Ifaperipheralinterfacedoesnothavepriority2to4pins,suchasUSBSerial/JTAG,itmeansitcanbe
assignedonlytopriority1pins.
Note:
• FordetailsaboutwhichperipheralsignalsareconnectedtoIOMUXorRTCIOMUXpins,pleaserefertoSection
2.3.1IOMUXFunctionsorSection2.3.2RTCFunctions.
• FordetailsaboutwhichperipheralsignalscanbeassignedtoGPIOpins,pleasereferto
ESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOMatrix>SectionPeripheralSignalList.
EspressifSystems 26 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

2
Pins
Table2-9. PeripheralPinAssignment
PinNo.PinName USBSerial/JTAGFull-speedUSBOTGJTAG ADC1 ADC2 TouchSensorUART0 UART1 SPI0/1(recommended)SPI0/1(alternative) SPI2(recommended)SPI2(alternative)UART2 I2C TWAI LEDPWM I2S LCDandCameraSPI3 SD/MMC MCPWM RMT PCNT
1 LNA_IN
2 VDD3P3
3 VDD3P3
4 CHIP_PU
5 GPIO0 GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3) GPIO0(P3)
6 GPIO1 ADC1_CH0(P1) TOUCH1(P1) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2) GPIO1(P2)
7 GPIO2 ADC1_CH1(P1) TOUCH2(P1) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2) GPIO2(P2)
8 GPIO3 ADC1_CH2(P1) TOUCH3(P1) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3) GPIO3(P3)
9 GPIO4 ADC1_CH3(P1) TOUCH4(P1) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2) GPIO4(P2)
10 GPIO5 ADC1_CH4(P1) TOUCH5(P1) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2) GPIO5(P2)
11 GPIO6 ADC1_CH5(P1) TOUCH6(P1) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2) GPIO6(P2)
12 GPIO7 ADC1_CH6(P1) TOUCH7(P1) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2) GPIO7(P2)
13 GPIO8 ADC1_CH7(P1) TOUCH8(P1) GPIO8(P2) GPIO8(P2) GPIO8(P2) SUBSPICS1(P1) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2) GPIO8(P2)
14 GPIO9 ADC1_CH8(P1) TOUCH9(P1) GPIO9(P2) GPIO9(P2) GPIO9(P2) SUBSPIHD(P1) FSPIHD(P1) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2) GPIO9(P2)
15 GPIO10 ADC1_CH9(P1) TOUCH10(P1)GPIO10(P2)GPIO10(P2)GPIO10(P2) SUBSPICS0(P1) FSPICS0(P1) FSPIIO4(P1) GPIO10(P2)GPIO10(P2)GPIO10(P2)GPIO10(P2)GPIO10(P2)GPIO10(P2) GPIO10(P2)GPIO10(P2)GPIO10(P2)GPIO10(P2)GPIO10(P2)
16 GPIO11 ADC2_CH0(P1)TOUCH11(P1) GPIO11(P2) GPIO11(P2) GPIO11(P2) SUBSPID(P1) FSPID(P1) FSPIIO5(P1) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2) GPIO11(P2)
17 GPIO12 ADC2_CH1(P1) TOUCH12(P1)GPIO12(P2) GPIO12(P2)GPIO12(P2) SUBSPICLK(P1) FSPICLK(P1) FSPIIO6(P1) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2) GPIO12(P2)
18 GPIO13 ADC2_CH2(P1)TOUCH13(P1)GPIO13(P2) GPIO13(P2) GPIO13(P2) SUBSPIQ(P1) FSPIQ(P1) FSPIIO7(P1) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2) GPIO13(P2)
19 GPIO14 ADC2_CH3(P1)TOUCH14(P1)GPIO14(P2) GPIO14(P2) GPIO14(P2) SUBSPIWP(P1) FSPIWP(P1) FSPIDQS(P1) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2) GPIO14(P2)
20 VDD3P3_RTC
21 XTAL_32K_P ADC2_CH4(P1) U0RTS(P1) GPIO15(P2)GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2) GPIO15(P2)
22 XTAL_32K_N ADC2_CH5(P1) U0CTS(P1) GPIO16(P2)GPIO16(P2) GPIO16(P2) GPIO16(P2) GPIO16(P2) GPIO16(P2)GPIO16(P2)GPIO16(P2)GPIO16(P2)GPIO16(P2)GPIO16(P2) GPIO16(P2)GPIO16(P2)GPIO16(P2)GPIO16(P2)GPIO16(P2)
23 GPIO17 ADC2_CH6(P1) GPIO17(P2) U1TXD(P1) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2) GPIO17(P2)
24 GPIO18 ADC2_CH7(P1) GPIO18(P2) U1RXD(P1) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2) GPIO18(P2)
25 GPIO19 USB_D-(P1) USB_D-(P1) ADC2_CH8(P1) GPIO19(P3) U1RTS(P1) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3) GPIO19(P3)
26 GPIO20 USB_D+(P1) USB_D+(P1) ADC2_CH9(P1) GPIO20(P3)U1CTS(P1) GPIO20(P3) GPIO20(P3) GPIO20(P3) GPIO20(P3) GPIO20(P3)GPIO20(P3)GPIO20(P3)GPIO20(P3)GPIO20(P3)GPIO20(P3) GPIO20(P3)GPIO20(P3)GPIO20(P3)GPIO20(P3)GPIO20(P3)
27 GPIO21 GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2)GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2) GPIO21(P2)
28 SPICS1 GPIO26(P4)GPIO26(P4)SPICS1(P1) GPIO26(P4) GPIO26(P4) GPIO26(P4) GPIO26(P4)GPIO26(P4)GPIO26(P4)GPIO26(P4)GPIO26(P4)GPIO26(P4) GPIO26(P4)GPIO26(P4)GPIO26(P4)GPIO26(P4)GPIO26(P4)
29 VDD_SPI
30 SPIHD GPIO27(P4)GPIO27(P4)SPIHD(P1) GPIO27(P4) GPIO27(P4) GPIO27(P4) GPIO27(P4)GPIO27(P4)GPIO27(P4)GPIO27(P4)GPIO27(P4)GPIO27(P4) GPIO27(P4)GPIO27(P4)GPIO27(P4)GPIO27(P4)GPIO27(P4)
31 SPIWP GPIO28(P4)GPIO28(P4)SPIWP(P1) GPIO28(P4) GPIO28(P4) GPIO28(P4) GPIO28(P4)GPIO28(P4)GPIO28(P4)GPIO28(P4)GPIO28(P4)GPIO28(P4) GPIO28(P4)GPIO28(P4)GPIO28(P4)GPIO28(P4)GPIO28(P4)
32 SPICS0 GPIO29(P4)GPIO29(P4)SPICS0(P1) GPIO29(P4) GPIO29(P4) GPIO29(P4) GPIO29(P4)GPIO29(P4)GPIO29(P4)GPIO29(P4)GPIO29(P4)GPIO29(P4) GPIO29(P4)GPIO29(P4)GPIO29(P4)GPIO29(P4)GPIO29(P4)
33 SPICLK GPIO30(P4)GPIO30(P4)SPICLK(P1) GPIO30(P4) GPIO30(P4) GPIO30(P4) GPIO30(P4)GPIO30(P4)GPIO30(P4)GPIO30(P4)GPIO30(P4)GPIO30(P4) GPIO30(P4)GPIO30(P4)GPIO30(P4)GPIO30(P4)GPIO30(P4)
34 SPIQ GPIO31(P4) GPIO31(P4) SPIQ(P1) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4) GPIO31(P4)
35 SPID GPIO32(P4)GPIO32(P4)SPID(P1) GPIO32(P4) GPIO32(P4) GPIO32(P4) GPIO32(P4)GPIO32(P4)GPIO32(P4)GPIO32(P4)GPIO32(P4)GPIO32(P4) GPIO32(P4)GPIO32(P4)GPIO32(P4)GPIO32(P4)GPIO32(P4)
36 SPICLK_N GPIO48(P2)GPIO48(P2)SPICLK_N_DIFF(P1) SUBSPICLK_N_DIFF(P1)GPIO48(P2) GPIO48(P2) GPIO48(P2)GPIO48(P2)GPIO48(P2)GPIO48(P2)GPIO48(P2)GPIO48(P2) GPIO48(P2)GPIO48(P2)GPIO48(P2)GPIO48(P2)GPIO48(P2)
37 SPICLK_P GPIO47(P2)GPIO47(P2)SPICLK_P_DIFF(P1) SUBSPICLK_P_DIFF(P1)GPIO47(P2) GPIO47(P2) GPIO47(P2)GPIO47(P2)GPIO47(P2)GPIO47(P2)GPIO47(P2)GPIO47(P2) GPIO47(P2)GPIO47(P2)GPIO47(P2)GPIO47(P2)GPIO47(P2)
38 GPIO33 GPIO33(P3)GPIO33(P3)SPIIO4(P1) SUBSPIHD(P1) GPIO33(P3) FSPIHD(P1) GPIO33(P3)GPIO33(P3)GPIO33(P3)GPIO33(P3)GPIO33(P3)GPIO33(P3) GPIO33(P3)GPIO33(P3)GPIO33(P3)GPIO33(P3)GPIO33(P3)
39 GPIO34 GPIO34(P3)GPIO34(P3)SPIIO5(P1) SUBSPICS0(P1) GPIO34(P3) FSPICS0(P1) GPIO34(P3)GPIO34(P3)GPIO34(P3)GPIO34(P3)GPIO34(P3)GPIO34(P3) GPIO34(P3)GPIO34(P3)GPIO34(P3)GPIO34(P3)GPIO34(P3)
40 GPIO35 GPIO35(P3)GPIO35(P3)SPIIO6(P1) SUBSPID(P1) GPIO35(P3) FSPID(P1) GPIO35(P3)GPIO35(P3)GPIO35(P3)GPIO35(P3)GPIO35(P3)GPIO35(P3) GPIO35(P3)GPIO35(P3)GPIO35(P3)GPIO35(P3)GPIO35(P3)
41 GPIO36 GPIO36(P3)GPIO36(P3)SPIIO7(P1) SUBSPICLK(P1) GPIO36(P3) FSPICLK(P1) GPIO36(P3)GPIO36(P3)GPIO36(P3)GPIO36(P3)GPIO36(P3)GPIO36(P3) GPIO36(P3)GPIO36(P3)GPIO36(P3)GPIO36(P3)GPIO36(P3)
42 GPIO37 GPIO37(P3)GPIO37(P3)SPIDQS(P1) SUBSPIQ(P1) GPIO37(P3) FSPIQ(P1) GPIO37(P3)GPIO37(P3)GPIO37(P3)GPIO37(P3)GPIO37(P3)GPIO37(P3) GPIO37(P3)GPIO37(P3)GPIO37(P3)GPIO37(P3)GPIO37(P3)
43 GPIO38 GPIO38(P2) GPIO38(P2) GPIO38(P2)GPIO38(P2)GPIO38(P2) SUBSPIWP(P1) GPIO38(P2) FSPIWP(P1) GPIO38(P2)GPIO38(P2)GPIO38(P2)GPIO38(P2)GPIO38(P2)GPIO38(P2) GPIO38(P2)GPIO38(P2)GPIO38(P2)GPIO38(P2)GPIO38(P2)
44 MTCK MTCK(P1) MTCK(P1) MTCK(P1) GPIO39(P3)GPIO39(P3)GPIO39(P3) SUBSPICS1(P1) GPIO39(P3) GPIO39(P3) GPIO39(P3)GPIO39(P3)GPIO39(P3)GPIO39(P3)GPIO39(P3)GPIO39(P3) GPIO39(P3)GPIO39(P3)GPIO39(P3)GPIO39(P3)GPIO39(P3)
45 MTDO MTDO(P1) MTDO(P1) MTDO(P1) GPIO40(P3)GPIO40(P3)GPIO40(P3) GPIO40(P3) GPIO40(P3) GPIO40(P3) GPIO40(P3)GPIO40(P3)GPIO40(P3)GPIO40(P3)GPIO40(P3)GPIO40(P3) GPIO40(P3)GPIO40(P3)GPIO40(P3)GPIO40(P3)GPIO40(P3)
46 VDD3P3_CPU
47 MTDI MTDI(P1) MTDI(P1) MTDI(P1) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3) GPIO41(P3)
48 MTMS MTMS(P1) MTMS(P1) MTMS(P1) GPIO42(P3)GPIO42(P3)GPIO42(P3) GPIO42(P3) GPIO42(P3) GPIO42(P3) GPIO42(P3)GPIO42(P3)GPIO42(P3)GPIO42(P3)GPIO42(P3)GPIO42(P3) GPIO42(P3)GPIO42(P3)GPIO42(P3)GPIO42(P3)GPIO42(P3)
49 U0TXD U0TXD(P1) GPIO43(P3)GPIO43(P3) GPIO43(P3) GPIO43(P3) GPIO43(P3) GPIO43(P3)GPIO43(P3)GPIO43(P3)GPIO43(P3)GPIO43(P3)GPIO43(P3) GPIO43(P3)GPIO43(P3)GPIO43(P3)GPIO43(P3)GPIO43(P3)
50 U0RXD U0RXD(P1) GPIO44(P3)GPIO44(P3) GPIO44(P3) GPIO44(P3) GPIO44(P3) GPIO44(P3)GPIO44(P3)GPIO44(P3)GPIO44(P3)GPIO44(P3)GPIO44(P3) GPIO44(P3)GPIO44(P3)GPIO44(P3)GPIO44(P3)GPIO44(P3)
51 GPIO45 GPIO45(P3)GPIO45(P3)GPIO45(P3) GPIO45(P3) GPIO45(P3) GPIO45(P3) GPIO45(P3)GPIO45(P3)GPIO45(P3)GPIO45(P3)GPIO45(P3)GPIO45(P3) GPIO45(P3)GPIO45(P3)GPIO45(P3)GPIO45(P3)GPIO45(P3)
52 GPIO46 GPIO46(P3)GPIO46(P3)GPIO46(P3) GPIO46(P3) GPIO46(P3) GPIO46(P3) GPIO46(P3)GPIO46(P3)GPIO46(P3)GPIO46(P3)GPIO46(P3)GPIO46(P3) GPIO46(P3)GPIO46(P3)GPIO46(P3)GPIO46(P3)GPIO46(P3)
53 XTAL_N
54 XTAL_P
55 VDDA
56 VDDA
57 GND
1ForUSBSerial/JTAGandUSBOTG,useUSB_D-andUSB_D+whenoninternalPHY,andtheUSB_D-andUSB_D+canbeswappedbyconfiguringtheUSB_SERIAL_JTAG_EXCHG_PINSbitaccordingtoESP32-S3TechnicalReferenceManual;use otherfixedpins whenonexternalPHY.ForhowtoselectPHY,seeESP32-S3TechnicalReferenceManual>USBSerial/JTAGController>Internal/External
PHYSelection.
2SignalsofUART0,UART1,SPI0/1,andSPI2interfacescanbemappedtoanyGPIOpinsthroughtheGPIOMatrix,regardlessofwhethertheyaredirectlyroutedto fixedpins viaIOMUX.
SubmitDocumentationFeedback
EspressifSystems
27
ESP32-S3SeriesDatasheetv2.2

2 Pins
2.4 Analog Pins
Table2-10. AnalogPins
| Pin Pin   | Pin Pin                                         |                                   |     |
| --------- | ----------------------------------------------- | --------------------------------- | --- |
| No. Name  | Type Function                                   |                                   |     |
| 1 LNA_IN  | I/O LowNoiseAmplifier(RFLNA)input/outputsignals |                                   |     |
|           | High:                                           | on,enablesthechip(poweredup).     |     |
| 4 CHIP_PU | I Low:                                          | off,disablesthechip(powereddown). |     |
|           | Note:                                           | DonotleavetheCHIP_PUpinfloating.  |     |
53 XTAL_N — Externalclockinput/outputconnectedtochip’scrystaloroscillator.
| 54 XTAL_P        | — P/Nmeansdifferentialclockpositive/negative. |     |                             |
| ---------------- | --------------------------------------------- | --- | --------------------------- |
| EspressifSystems |                                               | 28  | ESP32-S3SeriesDatasheetv2.2 |
SubmitDocumentationFeedback

2 Pins
2.5 Power Supply
2.5.1 Power Pins
ThechipispoweredviathepowerpinsdescribedinTable2-11PowerPins.
|     |     | Table2-11. PowerPins |     |     |
| --- | --- | -------------------- | --- | --- |
1,2
PowerSupply
| PinNo. PinName | Direction | PowerDomain/Other                 |     | IOPins 5 |
| -------------- | --------- | --------------------------------- | --- | -------- |
| 2 VDD3P3       | Input     | Analogpowerdomain                 |     |          |
| 3 VDD3P3       | Input     | Analogpowerdomain                 |     |          |
| 20 VDD3P3_RTC  | Input     | RTCandpartofDigitalpowerdomains   |     | RTCIO    |
|                | Input     | In-packagememory(backuppowerline) |     |          |
3,4
29 VDD_SPI
|               | Output | In-packageandoff-packageflash/PSRAM |     | SPIIO     |
| ------------- | ------ | ----------------------------------- | --- | --------- |
| 46 VDD3P3_CPU | Input  | Digitalpowerdomain                  |     | DigitalIO |
| 55 VDDA       | Input  | Analogpowerdomain                   |     |           |
| 56 VDDA       | Input  | Analogpowerdomain                   |     |           |
| 57 GND        | –      | Externalgroundconnection            |     |           |
1
SeeinconjunctionwithSection2.5.2PowerScheme.
2
For recommended and maximum voltage and current, see Section 5.1 Absolute Maximum
RatingsandSection5.2RecommendedOperatingConditions.
3 ToconfigureVDD_SPIasinputoroutput,seeESP32-S3TechnicalReferenceManual>Chap-
terLow-powerManagement.
4 To configure output voltage, see Section 3.2 VDD_SPI Voltage Control and Section 5.3
VDD_SPIOutputCharacteristics.
5
RTCIOpinsarethosepoweredbyVDD3P3_RTCandsoon,asshowninFigure2-2ESP32-S3
PowerScheme. SeealsoTable2-1PinOverview>ColumnPinProvidingPower.
2.5.2 Power Scheme
ThepowerschemeisshowninFigure2-2ESP32-S3PowerScheme.
Thecomponentsonthechiparepoweredviavoltageregulators.
|                  | Table2-12. | VoltageRegulators  |     |     |
| ---------------- | ---------- | ------------------ | --- | --- |
| VoltageRegulator | Output     | PowerSupply        |     |     |
| Digital          | 1.1V       | Digitalpowerdomain |     |     |
| Low-power        | 1.1V       | RTCpowerdomain     |     |     |
Canbeconfiguredtopower
| Flash | 1.8V | in-packageflash/PSRAMor |     |     |
| ----- | ---- | ----------------------- | --- | --- |
off-packagememory
| EspressifSystems |     | 29  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

2 Pins
|       |               |           | Figure2-2. | ESP32-S3PowerScheme |     |     |     |
| ----- | ------------- | --------- | ---------- | ------------------- | --- | --- | --- |
| 2.5.3 | Chip Power-up | and Reset |            |                     |     |     |     |
Oncethepowerissuppliedtothechip,itspowerrailsneedashorttimetostabilize. Afterthat,CHIP_PU–the
pinusedforpower-upandreset–ispulledhightoactivatethechip. ForinformationonCHIP_PUaswellas
power-upandresettiming,seeFigure2-3andTable2-13.
|     |     |     | tSTBL |     |     | tRST |     |
| --- | --- | --- | ----- | --- | --- | ---- | --- |
2.8V
VDDA,
VDD3P3,
VDD3P3_RTC,
VDD3P3_CPU
V
IL_nRST
CHIP_PU
|     |     | Figure2-3. VisualizationofTimingParametersforPower-upandReset |     |     |     |     |     |
| --- | --- | ------------------------------------------------------------- | --- | --- | --- | --- | --- |
Table2-13. DescriptionofTimingParametersforPower-upandReset
|     | Parameter | Description                                         |         |             |          |         | Min(µs) |
| --- | --------- | --------------------------------------------------- | ------- | ----------- | -------- | ------- | ------- |
|     |           | Time reserved                                       | for the | power rails | of VDDA, | VDD3P3, |         |
|     | t         | VDD3P3_RTC,andVDD3P3_CPUtostabilizebeforetheCHIP_PU |         |             |          |         | 50      |
STBL
pinispulledhightoactivatethechip
|     |     | Time reserved | for CHIP_PU | to stay below | V IL_nRST | to reset the |     |
| --- | --- | ------------- | ----------- | ------------- | --------- | ------------ | --- |
|     | t   |               |             |               |           |              | 50  |
RST
chip(seeTable5-4)
| EspressifSystems |     |     |     | 30  |     | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

2 Pins
| 2.6 Pin | Mapping | Between | Chip | and | Flash/PSRAM |     |     |     |     |
| ------- | ------- | ------- | ---- | --- | ----------- | --- | --- | --- | --- |
Table2-14liststhepinmappingbetweenthechipandflash/PSRAMforallSPImodes.
Forchipvariantswithin-packageflash/PSRAM(seeTable1-1ESP32-S3SeriesComparison),thepinsallocated
forcommunicationwithin-packageflash/PSRAMcanbeidentifieddependingontheSPImodeused.
Foroff-packageflash/PSRAM,thesearetherecommendedpinmappings.
FormoreinformationonSPIcontrollers,seealsoSection4.2.1.5SerialPeripheralInterface(SPI).
Notice: Donotusethepinsconnectedtoin-packageflash/PSRAMforanyotherpurposes.
|     |     | Table2-14. | PinMappingBetweenChipandFlashorPSRAM |     |         |             |     |              |     |
| --- | --- | ---------- | ------------------------------------ | --- | ------- | ----------- | --- | ------------ | --- |
|     |     | SingleSPI  |                                      |     | DualSPI | QuadSPI/QPI |     | OctalSPI/OPI |     |
PinNo. PinName Flash PSRAM Flash PSRAM Flash PSRAM Flash PSRAM
| 28  | SPICS1 2 |       | CE#  |       | CE#  |       | CE#  |     | CE# |
| --- | -------- | ----- | ---- | ----- | ---- | ----- | ---- | --- | --- |
| 30  | SPIHD    | HOLD# | SIO3 | HOLD# | SIO3 | HOLD# | SIO3 | DQ3 | DQ3 |
| 31  | SPIWP    | WP#   | SIO2 | WP#   | SIO2 | WP#   | SIO2 | DQ2 | DQ2 |
1
| 32  | SPICS0 | CS# |         | CS# |         | CS# |         | CS#    |        |
| --- | ------ | --- | ------- | --- | ------- | --- | ------- | ------ | ------ |
| 33  | SPICLK | CLK | CLK     | CLK | CLK     | CLK | CLK     | CLK    | CLK    |
| 34  | SPIQ   | DO  | SO/SIO1 | DO  | SO/SIO1 | DO  | SO/SIO1 | DQ1    | DQ1    |
| 35  | SPID   | DI  | SI/SIO0 | DI  | SI/SIO0 | DI  | SI/SIO0 | DQ0    | DQ0    |
| 38  | GPIO33 |     |         |     |         |     |         | DQ4    | DQ4    |
| 39  | GPIO34 |     |         |     |         |     |         | DQ5    | DQ5    |
| 40  | GPIO35 |     |         |     |         |     |         | DQ6    | DQ6    |
| 41  | GPIO36 |     |         |     |         |     |         | DQ7    | DQ7    |
| 42  | GPIO37 |     |         |     |         |     |         | DQS/DM | DQS/DM |
1 CS0isforin-packageflash
2
CS1isforin-packagePSRAM
| EspressifSystems |     |     |     |     | 31  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

3 BootConfigurations
3 Boot Configurations
ThechipallowsforconfiguringthefollowingbootparametersthroughstrappingpinsandeFuseparametersat
power-uporahardwarereset,withoutmicrocontrollerinteraction.
•
Chipbootmode
| – Strappingpin: GPIO0andGPIO46 |     |     |     |
| ------------------------------ | --- | --- | --- |
• VDD_SPIvoltage
| – Strappingpin: GPIO45 |                                          |     |     |
| ---------------------- | ---------------------------------------- | --- | --- |
| – eFuseparameter:      | EFUSE_VDD_SPI_FORCEandEFUSE_VDD_SPI_TIEH |     |     |
• ROMmessageprinting
| – Strappingpin: GPIO46 |                             |     |     |
| ---------------------- | --------------------------- | --- | --- |
| – eFuseparameter:      | EFUSE_UART_PRINT_CONTROLand |     |     |
EFUSE_DIS_USB_SERIAL_JTAG_ROM_PRINT
• JTAGsignalsource
| – Strappingpin: GPIO3 |     |     |     |
| --------------------- | --- | --- | --- |
– eFuseparameter: EFUSE_DIS_PAD_JTAG,EFUSE_DIS_USB_JTAG,andEFUSE_STRAP_JTAG_SEL
ThedefaultvaluesofalltheaboveeFuseparametersare0,whichmeansthattheyarenotburnt. Giventhat
eFuseisone-timeprogrammable,onceprogrammedto1,itcanneverberevertedto0. Forhowtoprogram
eFuseparameters,pleaserefertoESP32-S3TechnicalReferenceManual>ChaptereFuseController.
Thedefaultvaluesofthestrappingpins,namelythelogiclevels,aredeterminedbypins’internalweak
pull-up/pull-downresistorsatresetifthepinsarenotconnectedtoanycircuit,orconnectedtoanexternal
high-impedancecircuit.
|     | Table3-1. DefaultConfigurationofStrappingPins |                      |          |
| --- | --------------------------------------------- | -------------------- | -------- |
|     | StrappingPin                                  | DefaultConfiguration | BitValue |
|     | GPIO0                                         | Weakpull-up          | 1        |
|     | GPIO3                                         | Floating             | –        |
|     | GPIO45                                        | Weakpull-down        | 0        |
|     | GPIO46                                        | Weakpull-down        | 0        |
Tochangethebitvalues,thestrappingpinsshouldbeconnectedtoexternalpull-down/pull-upresistances. If
theESP32-S3isusedasadevicebyahostMCU,thestrappingpinvoltagelevelscanalsobecontrolledby
thehostMCU.
Allstrappingpinshavelatches. AtChipReset,thelatchessamplethebitvaluesoftheirrespectivestrapping
pinsandstorethemuntilthechipispowereddownorshutdown. Thestatesoflatchescannotbechangedin
anyotherway. Itmakesthestrappingpinvaluesavailableduringtheentirechipoperation,andthepinsare
freeduptobeusedasregularIOpinsafterreset. FordetailsonChipReset,see
ESP32-S3TechnicalReferenceManual>ChapterResetandClock.
| EspressifSystems |     | 32  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

3 BootConfigurations
Thetimingofsignalsconnectedtothestrappingpinsshouldadheretothesetuptimeandholdtime
specificationsinTable3-2andFigure3-1.
|     | Table3-2.             | DescriptionofTimingParametersfortheStrappingPins |     |     |     |         |
| --- | --------------------- | ------------------------------------------------ | --- | --- | --- | ------- |
|     | Parameter Description |                                                  |     |     |     | Min(ms) |
Setuptimeisthetimereservedforthepowerrailstostabilizebe-
|     | t   |     |     |     |     | 0   |
| --- | --- | --- | --- | --- | --- | --- |
SU
foretheCHIP_PUpinispulledhightoactivatethechip.
|     | Hold | time is the time reserved | for the chip | to read | the strapping |     |
| --- | ---- | ------------------------- | ------------ | ------- | ------------- | --- |
t pin values after CHIP_PU is already high and before these pins 3
H
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
GPIO0andGPIO46controlthebootmodeaftertheresetisreleased. SeeTable3-3ChipBootMode
Control.
|     |     | Table3-3. ChipBootModeControl |       |            |     |     |
| --- | --- | ----------------------------- | ----- | ---------- | --- | --- |
|     |     | BootMode                      | GPIO0 | GPIO46     |     |     |
|     |     | SPIbootmode                   |       | 1 Anyvalue |     |     |
2
|     |     | Jointdownloadbootmode |     | 0   | 0   |     |
| --- | --- | --------------------- | --- | --- | --- | --- |
1
Boldmarksthedefaultvalueandconfiguration.
2
JointDownloadBootmodesupportsthefollowing
downloadmethods:
•USBDownloadBoot:
–USB-Serial-JTAGDownloadBoot
–USB-OTGDownloadBoot
•UARTDownloadBoot
InadditiontoSPIBootandJointDownloadBootmodes,ESP32-S3alsosupportsSPIDownloadBootmode.
| EspressifSystems |     |     | 33  |     | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

3 BootConfigurations
Fordetails,pleaseseeESP32-S3TechnicalReferenceManual>ChapterChipBootControl.
| 3.2 VDD_SPI | Voltage | Control |     |     |     |     |
| ----------- | ------- | ------- | --- | --- | --- | --- |
TherequiredVDD_SPIvoltageforthechipsoftheESP32-S3SeriescanbefoundinTable1-1ESP32-S3Series
Comparison.
TheVDD_SPIvoltagecanbe:
• (Default)3.3VsuppliedbyVDD3P3_RTCviaR
SPI
•
1.8VsuppliedbytheFlashVoltageRegulator
ThevoltageisdeterminedbyEFUSE_VDD_SPI_FORCE,GPIO45,andEFUSE_VDD_SPI_TIEH.
|     |     | Table3-4. | VDD_SPIVoltageControl |     |     |     |
| --- | --- | --------- | --------------------- | --- | --- | --- |
VDD_SPIpowersource 2 Voltage EFUSE_VDD_SPI_FORCE GPIO45 EFUSE_VDD_SPI_TIEH
|                |     |      |     | 0   | 0   | Ignored |
| -------------- | --- | ---- | --- | --- | --- | ------- |
| VDD3P3_RTCviaR |     | 3.3V |     |     |     |         |
SPI
|                       |     |      |     | 1   | Ignored | 1       |
| --------------------- | --- | ---- | --- | --- | ------- | ------- |
|                       |     |      |     | 0   | 1       | Ignored |
| FlashVoltageRegulator |     | 1.8V |     |     |         |         |
|                       |     |      |     | 1   | Ignored | 0       |
1
Boldmarksthedefaultvalueandconfiguration.
2 SeeSection2.5.2PowerScheme.
| 3.3 ROM | Messages | Printing | Control |     |     |     |
| ------- | -------- | -------- | ------- | --- | --- | --- |
Duringthebootprocess,themessagesbytheROMcodecanbeprintedto:
• (Default)UART0andUSBSerial/JTAGcontroller
•
USBSerial/JTAGcontroller
•
UART0
TheROMmessagesprintingtoUARTorUSBSerial/JTAGcontrollercanberespectivelydisabledbyconfiguring
registersandeFuse. Fordetailedinformation,pleaserefertoESP32-S3TechnicalReferenceManual>
ChapterChipBootControl.
| 3.4 JTAG | Signal Source | Control |     |     |     |     |
| -------- | ------------- | ------- | --- | --- | --- | --- |
ThestrappingpinGPIO3canbeusedtocontrolthesourceofJTAGsignalsduringtheearlybootprocess. This
pindoesnothaveanyinternalpullresistorsandthestrappingvaluemustbecontrolledbytheexternalcircuit
thatcannotbeinahighimpedancestate.
AsTable3-5JTAGSignalSourceControlshows,GPIO3isusedincombinationwithEFUSE_DIS_PAD_JTAG,
EFUSE_DIS_USB_JTAG,andEFUSE_STRAP_JTAG_SEL.
| EspressifSystems |     |     |     | 34  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

3 BootConfigurations
Table3-5. JTAGSignalSourceControl
JTAGSignalSource EFUSE_DIS_PAD_JTAG EFUSE_DIS_USB_JTAG EFUSE_STRAP_JTAG_SEL GPIO3
|                           | 0   |     | 0   |     | 0       | Ignored |
| ------------------------- | --- | --- | --- | --- | ------- | ------- |
| USBSerieal/JTAGController | 0   |     | 0   |     | 1       | 1       |
|                           | 1   |     | 0   |     | Ignored | Ignored |
|                           | 0   |     | 0   |     | 1       | 0       |
JTAGpins 2
|                | 0   |     | 1   |     | Ignored | Ignored |
| -------------- | --- | --- | --- | --- | ------- | ------- |
| JTAGisdisabled | 1   |     | 1   |     | Ignored | Ignored |
1
Boldmarksthedefaultvalueandconfiguration.
2 JTAGpinsrefertoMTDI,MTCK,MTMS,andMTDO.
| EspressifSystems |     | 35  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

4 FunctionalDescription
4 Functional Description
4.1 System
Thissectiondescribesthecoreofthechip’soperation,coveringitsmicroprocessor,memoryorganization,
systemcomponents,andsecurityfeatures.
4.1.1 Microprocessor and Master
Thissubsectiondescribesthecoreprocessingunitswithinthechipandtheircapabilities.
4.1.1.1 CPU
ESP32-S3hasalow-powerXtensa® dual-core32-bitLX7microprocessor.
FeatureList
• Five-stagepipelinethatsupportstheclockfrequencyofupto240MHz
• 16-bit/24-bitinstructionsetprovidinghighcodedensity
• 32-bitcustomizedinstructionsetand128-bitdatabusthatprovidehighcomputingperformance
• Supportforsingle-precisionfloating-pointunit(FPU)
• 32-bitmultiplierand32-bitdivider
• UnbufferedGPIOinstructions
• 32interruptsatsixlevels
• WindowedABIwith64physicalgeneralregisters
• TracefunctionwithTRAXcompressor,upto16KBtracememory
• JTAGfordebugging
ForinformationabouttheXtensa® InstructionSetArchitecture,pleasereferto
Xtensa® InstructionSetArchitecture(ISA)Summary.
4.1.1.2 Processor Instruction Extensions (PIE)
ESP32-S3containsaseriesofnewextendedinstructionsetinordertoimprovetheoperationefficiencyof
specificAIandDSP(DigitalSignalProcessing)algorithms.
FeatureList
• 128-bitnewgeneral-purposeregisters
• 128-bitvectoroperations,e.g.,complexmultiplication,addition,subtraction,multiplication,shifting,
comparison,etc
• Datahandlinginstructionsandload/storeoperationinstructionscombined
• Non-aligned128-bitvectordata
EspressifSystems 36 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
•
Saturationoperation
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterProcessorInstructionExtensions.
| 4.1.1.3 Ultra-Low-Power |     | Coprocessor | (ULP) |     |
| ----------------------- | --- | ----------- | ----- | --- |
TheULPcoprocessorisdesignedasasimplified,low-powerreplacementofCPUinsleepmodes. Itcanbe
alsousedtosupplementthefunctionsoftheCPUinnormalworkingmode. TheULPcoprocessorandRTC
memoryremainpoweredupduringtheDeep-sleepmode. Hence,thedevelopercanstoreaprogramforthe
ULPcoprocessorintheRTCslowmemorytoaccessRTCGPIO,RTCperipheraldevices,RTCtimersand
internalsensorsinDeep-sleepmode.
ESP32-S3hastwoULPcoprocessors,onebasedonRISC-Vinstructionsetarchitecture(ULP-RISC-V)andthe
otheronfinitestatemachine(ULP-FSM).TheclockofthecoprocessorsistheinternalfastRCoscillator.
FeatureList
• ULP-RISC-V:
| – SupportforRV32IMCinstructionset            |     |     |     |     |
| -------------------------------------------- | --- | --- | --- | --- |
| – Thirty-two32-bitgeneral-purposeregisters   |     |     |     |     |
| – 32-bitmultiplieranddivider                 |     |     |     |     |
| – Supportforinterrupts                       |     |     |     |     |
| – BootedbytheCPU,itsdedicatedtimer,orRTCGPIO |     |     |     |     |
• ULP-FSM:
– Supportforcommoninstructionsincludingarithmetic,jump,andprogramcontrolinstructions
| – Supportforon-boardsensormeasurementinstructions |     |     |     |     |
| ------------------------------------------------- | --- | --- | --- | --- |
| – BootedbytheCPU,itsdedicatedtimer,orRTCGPIO      |     |     |     |     |
Note:
Notethatthesetwocoprocessorscannotworksimultaneously.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterULPCoprocessor.
| 4.1.1.4 GDMA | Controller | (GDMA) |     |     |
| ------------ | ---------- | ------ | --- | --- |
ESP32-S3hasageneral-purposeDMAcontroller(GDMA)withfiveindependentchannelsfortransmittingand
anotherfiveindependentchannelsforreceiving. ThesetenchannelsaresharedbyperipheralsthathaveDMA
feature,andsupportdynamicpriority.
TheGDMAcontrollercontrolsdatatransferusinglinkedlists. Itallowsperipheral-to-memoryand
memory-to-memorydatatransferatahighspeed. AllchannelscanaccessinternalandexternalRAM.
ThetenperipheralsonESP32-S3withDMAfeatureareSPI2,SPI3,UHCI0,I2S0,I2S1,LCD/CAM,AES,SHA,
ADC,andRMT.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterGDMAController.
| EspressifSystems |     |     | 37  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

4 FunctionalDescription
4.1.2 Memory Organization
Thissubsectiondescribesthememoryarrangementtoexplainhowdataisstored,accessed,andmanaged
forefficientoperation.
Figure4-1illustratestheaddressmappingstructureofESP32-S3.
CPU
|     |     | 0x0000_0000 | Reserved |     |     |
| --- | --- | ----------- | -------- | --- | --- |
0x3BFF_FFFF
|     | Data bus | 0x3C00_0000 | 32 MB           |     |     |
| --- | -------- | ----------- | --------------- | --- | --- |
|     |          | 0x3DFF_FFFF | External memory |     |     |
0x3E00_0000
|     |     | 0x3FC8_7FFF | Reserved |     |     |
| --- | --- | ----------- | -------- | --- | --- |
Data bus
|     |     | 0x3FC8_8000 | 480 KB          |     |     |
| --- | --- | ----------- | --------------- | --- | --- |
|     |     | 0x3FCF_FFFF | Internal memory |     |     |
0x3FD0_0000
Reserved
0x3FEF_FFFF
|     |     | 0x3FF0_0000 | 128 KB          | Data bus |      |
| --- | --- | ----------- | --------------- | -------- | ---- |
|     |     |             |                 | ROM      | SRAM |
|     |     | 0x3FF1_FFFF | Internal memory |          |      |
0x3FF2_0000
|     | Cache | 0x3FFF_FFFF | Reserved |     |     |
| --- | ----- | ----------- | -------- | --- | --- |
Instruction bus
|     |     | 0x4000_0000 | 384 KB          |     |     |
| --- | --- | ----------- | --------------- | --- | --- |
|     |     | 0x4005_FFFF | Internal memory |     |     |
0x4006_0000
Reserved
0x4036_FFFF
External Memory MMU
|     |     | 0x4037_0000 | 448 KB          | Instruction bus |     |
| --- | --- | ----------- | --------------- | --------------- | --- |
|     |     | 0x403D_FFFF | Internal memory |                 |     |
|     |     | 0x403E_0000 | Reserved        |                 |     |
0x41FF_FFFF
|     | Instruction bus | 0x4200_0000 | 32 MB |     |     |
| --- | --------------- | ----------- | ----- | --- | --- |
GDMA
|     |     | 0x43FF_FFFF | External memory |     |     |
| --- | --- | ----------- | --------------- | --- | --- |
0x4400_0000
Reserved
0x4FFF_FFFF
Data/Instruction bus
|     |     | 0x5000_0000 | 8 KB            |     | RTC ★       |
| --- | --- | ----------- | --------------- | --- | ----------- |
|     |     | 0x5000_1FFF | Internal memory |     | Slow Memory |
|     |     | 0x5000_2000 | Reserved        |     |             |
0x5FFF_FFFF
|     |     | 0x6000_0000 | 836 KB      | Data/Instruction bus | RTC Peripherals★  |
| --- | --- | ----------- | ----------- | -------------------- | ----------------- |
|     |     | 0x600D_0FFF | Peripherals |                      | Other Peripherals |
0x600D_1000
|                       |     | 0x600F_DFFF | Reserved        |     |             |
| --------------------- | --- | ----------- | --------------- | --- | ----------- |
|                       |     | 0x600F_E000 | 8 KB            |     | RTC         |
|                       |     | 0x600F_FFFF | Internal memory |     | Fast Memory |
| Not available for use |     | 0x6010_0000 |                 |     |             |
Reserved
| Available for use |     | 0xFFFF_FFFF |     |     |     |
| ----------------- | --- | ----------- | --- | --- | --- |
Accessible by ULP co-processor
★
Figure4-1. AddressMappingStructure
4.1.2.1 Internal Memory
TheinternalmemoryofESP32-S3referstothememoryintegratedonthechipdieorinthechippackage,
includingROM,SRAM,eFuse,andflash.
FeatureList
• 384KBROM:forbootingandcorefunctions
•
512KBon-chipSRAM:fordataandinstructions,runningataconfigurablefrequencyofupto240MHz
•
RTCFASTmemory: 8KBSRAMthatsupportsread/write/instructionfetchbythemainCPU(LX7
dual-coreprocessor). ItcanretaindatainDeep-sleepmode
| EspressifSystems |     | 38  |     | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

4 FunctionalDescription
• RTCSLOWMemory: 8KBSRAMthatsupportsread/write/instructionfetchbythemainCPU(LX7
dual-coreprocessor)orcoprocessors. ItcanretaindatainDeep-sleepmode
• 4096-biteFusememory: 1792bitsareavailableforusers,suchasencryptionkeyanddeviceID.See
alsoSection4.1.2.4eFuseController
• In-packageflashandPSRAM:
– SeeflashandPSRAMsizeinChapter1ESP32-S3SeriesComparison
– Forspecifications,refertoSection5.7MemorySpecifications.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSystemandMemory.
4.1.2.2 External Flash and RAM
ESP32-S3supportsSPI,DualSPI,QuadSPI,OctalSPI,QPI,andOPIinterfacesthatallowconnectionto
multipleexternalflashandRAM.
TheexternalflashandRAMcanbemappedintotheCPUinstructionmemoryspaceandread-onlydata
memoryspace. TheexternalRAMcanalsobemappedintotheCPUdatamemoryspace. ESP32-S3supports
upto1GBofexternalflashandRAM,andhardwareencryption/decryptionbasedonXTS-AEStoprotectusers’
programsanddatainflashandexternalRAM.
Throughhigh-speedcaches,ESP32-S3cansupportatatimeupto:
• ExternalflashorRAMmappedinto32MBinstructionspaceasindividualblocksof64KB
• ExternalRAMmappedinto32MBdataspaceasindividualblocksof64KB.8-bit,16-bit,32-bit,and
128-bitreadsandwritesaresupported. Externalflashcanalsobemappedinto32MBdataspaceas
individualblocksof64KB,butonlysupporting8-bit,16-bit,32-bitand128-bitreads.
Note:
AfterESP32-S3isinitialized,firmwarecancustomizethemappingofexternalRAMorflashintotheCPUaddressspace.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSystemandMemory.
4.1.2.3 Cache
ESP32-S3hasaninstructioncacheandadatacachesharedbythetwoCPUcores. Eachcachecanbe
partitionedintomultiplebanks.
FeatureList
• Instructioncache: 16KB(onebank)or32KB(twobanks)
Datacache: 32KB(onebank)or64KB(twobanks)
• Instructioncache: four-wayoreight-waysetassociative
Datacache: four-waysetassociative
• Blocksizeof16bytesor32bytesforbothinstructioncacheanddatacache
• Pre-loadfunction
• Lockfunction
EspressifSystems 39 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
• Criticalwordfirstandearlyrestart
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSystemandMemory.
4.1.2.4 eFuse Controller
ESP32-S3containsa4-KbiteFusetostoreparameters,whichareburnedandreadbyaneFuse
controller.
FeatureList
• 4Kbitsintotal,with1792bitsreservedforusers,e.g.,encryptionkeyanddeviceID
• One-timeprogrammablestorage
• Configurablewriteprotection
• Configurablereadprotection
• Varioushardwareencodingschemestoprotectagainstdatacorruption
Fordetails,seeESP32-S3TechnicalReferenceManual>ChaptereFuseController.
4.1.3 System Components
Thissubsectiondescribestheessentialcomponentsthatcontributetotheoverallfunctionalityandcontrolof
thesystem.
4.1.3.1 IO MUX and GPIO Matrix
TheIOMUXandGPIOMatrixintheESP32-S3chipprovideflexibleroutingofperipheralinputandoutput
signalstotheGPIOpins. Theseperipheralsenhancethefunctionalityandperformanceofthechipbyallowing
theconfigurationofI/O,supportformultiplexing,andsignalsynchronizationforperipheralinputs.
FeatureList
• GPIOMatrix:
– Afull-switchingmatrixbetweentheperipheralinput/outputsignalsandtheGPIOpins
– 175digitalperipheralinputsignalscanbesourcedfromtheinputofanyGPIOpins
– TheoutputofanyGPIOpinscanbefromanyofthe184digitalperipheraloutputsignals
– SupportssignalsynchronizationforperipheralinputsbasedonAPBclockbus
– Providesinputsignalfilter
– Supportssigmadeltamodulatedoutput
– SupportsGPIOsimpleinputandoutput
• IOMUX:
– ProvidesoneconfigurationregisterIO_MUX_GPIOn_REGforeachGPIOpin. Thepincanbe
configuredto
* performGPIOfunctionroutedbyGPIOmatrix
EspressifSystems 40 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
* orperformdirectconnectionbypassingGPIOmatrix
– Supportssomehigh-speeddigitalsignals(SPI,JTAG,UART)bypassingGPIOmatrixforbetter
high-frequencydigitalperformance(IOMUXisusedtoconnectthesepinsdirectlytoperipherals)
• RTCIOMUX:
– Controlslowpowerfeatureof22RTCGPIOpins
– Controlsanalogfunctionsof22RTCGPIOpins
– Redirects22RTCinput/outputsignalstoRTCsystem
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterIOMUXandGPIOMatrix.
4.1.3.2 Reset
ESP32-S3providesfourresetlevels,namelyCPUReset,CoreReset,SystemReset,andChipReset.
FeatureList
• Supportfourresetlevels:
– CPUReset: onlyresetsCPUxcore. CPUxcanbeCPU0orCPU1here. Oncesuchresetisreleased,
programswillbeexecutedfromCPUxresetvector. EachCPUcorehasitsownresetlogic. IfCPU
ResetisfromCPU0,thesensitiveregisterswillbereset,too.
– CoreReset: resetsthewholedigitalsystemexceptRTC,includingCPU0,CPU1,peripherals,Wi-Fi,
Bluetooth® LE(BLE),anddigitalGPIOs.
– SystemReset: resetsthewholedigitalsystem,includingRTC.
– ChipReset: resetsthewholechip.
• Supportsoftwareresetandhardwarereset:
– SoftwareresetistriggeredbyCPUxconfiguringitscorrespondingregisters. Referto
ESP32-S3TechnicalReferenceManual>ChapterLow-powerManagementformoredetails.
– Hardwareresetisdirectlytriggeredbythecircuit.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterResetandClock.
4.1.3.3 Clock
CPUClock
TheCPUclockhasthreepossiblesources:
• Externalmaincrystalclock
• InternalfastRCoscillator(typicallyabout17.5MHz,adjustable)
• PLLclock
Theapplicationcanselecttheclocksourcefromthethreeclocksabove. Theselectedclocksourcedrives
theCPUclockdirectly,orafterdivision,dependingontheapplication. OncetheCPUisreset,thedefault
clocksourcewouldbetheexternalmaincrystalclockdividedby2.
EspressifSystems 41 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
Note:
ESP32-S3isunabletooperatewithoutanexternalmaincrystalclock.
RTCClock
TheRTCslowclockisusedforRTCcounter,RTCwatchdogandlow-powercontroller. Ithasthreepossible
sources:
• Externallow-speed(32kHz)crystalclock
• InternalslowRCoscillator(typicallyabout136kHz,adjustable)
• InternalfastRCoscillatordividedclock(derivedfromtheinternalfastRCoscillatordividedby256)
TheRTCfastclockisusedforRTCperipheralsandsensorcontrollers. Ithastwopossiblesources:
• Externalmaincrystalclockdividedby2
• InternalfastRCoscillator(typicallyabout17.5MHz,adjustable)
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterResetandClock.
4.1.3.4 Interrupt Matrix
TheinterruptmatrixembeddedinESP32-S3independentlyallocatesperipheralinterruptsourcestothetwo
CPUs’peripheralinterrupts,totimelyinformCPU0orCPU1toprocesstheinterruptsoncetheinterruptsignals
aregenerated.
FeatureList
• 99peripheralinterruptsourcesasinput
• Generate26peripheralinterruptstoCPU0and26peripheralinterruptstoCPU1asoutput.
NotethattheremainingsixCPU0interruptsandsixCPU1interruptsareinternalinterrupts.
• DisableCPUnon-maskableinterrupt(NMI)sources
• Querycurrentinterruptstatusofperipheralinterruptsources
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterInterruptMatrix.
4.1.3.5 Power Management Unit (PMU)
ESP32-S3hasanadvancedPowerManagementUnit(PMU).Itcanbeflexiblyconfiguredtopowerup
differentpowerdomainsofthechiptoachievethebestbalancebetweenchipperformance,power
consumption,andwakeuplatency.
TheintegratedUltra-Low-Power(ULP)coprocessorsallowESP32-S3tooperateinDeep-sleepmodewith
mostofthepowerdomainsturnedoff,thusachievingextremelylow-powerconsumption.
ConfiguringthePMUisacomplexprocedure. Tosimplifypowermanagementfortypicalscenarios,thereare
thefollowingpredefinedpowermodesthatpowerupdifferentcombinationsofpowerdomains:
• Activemode–TheCPU,RFcircuits,andallperipheralsareon. Thechipcanprocessdata,receive,
transmit,andlisten.
EspressifSystems 42 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
•
Modem-sleepmode–TheCPUison,buttheclockfrequencycanbereduced. Thewireless
connectionscanbeconfiguredtoremainactiveasRFcircuitsareperiodicallyswitchedonwhen
required.
• Light-sleepmode–TheCPUstopsrunning,andcanbeoptionallypoweredon. TheRTCperipherals,as
wellastheULPcoprocessorcanbewokenupperiodicallybythetimer. Thechipcanbewokenupvia
allwakeupmechanisms: MAC,RTCtimer,orexternalinterrupts. Wirelessconnectionscanremainactive.
Somegroupsofdigitalperipheralscanbeoptionallypoweredoff.
•
Deep-sleepmode–OnlyRTCispoweredon. WirelessconnectiondataisstoredinRTCmemory.
Forpowerconsumptionindifferentpowermodes,seeSection5.6CurrentConsumption.
Figure4-2ComponentsandPowerDomains andthefollowingTable4-1showthedistributionofchip
| componentsbetween |     | powerdomains | and powersubdomains. |     |     |     |     |     |     |
| ----------------- | --- | ------------ | -------------------- | --- | --- | --- | --- | --- | --- |
Espressif’s ESP32-S3 Wi-Fi + Bluetooth® Low Energy SoC
Digital Power Domain
|     |     | CPU |        |     |     |     |      |       | System  |
| --- | --- | --- | ------ | --- | --- | --- | ---- | ----- | ------- |
|     |     |     | SPI0/1 |     | I2C |     | GPIO | TWAI® |         |
Timer
|     | Xtensa® Dual- | JTAG |     |     |     |     |     |     |     |
| --- | ------------- | ---- | --- | --- | --- | --- | --- | --- | --- |
USB Serial/
|     | core 32-bit LX7  |       | Camera    |     | I2S |      |     |      | General- |
| --- | ---------------- | ----- | --------- | --- | --- | ---- | --- | ---- | -------- |
|     |                  |       |           |     |     | UART |     | JTAG |          |
|     | Microprocessor   | Cache | Interface |     |     |      |     |      | purpose  |
Timers
|     | World  | Interrupt  | Pulse  |     | LCD  |     | Flash  |     |     |
| --- | ------ | ---------- | ------ | --- | ---- | --- | ------ | --- | --- |
RMT
|     | Controller | Matrix | Counter | Interface |     | Encryption |     |     |     |
| --- | ---------- | ------ | ------- | --------- | --- | ---------- | --- | --- | --- |
Main System
Watchdog
|     |                           |            | DIG ADC | RNG |                               | MCPWM |     | LED PWM |         |
| --- | ------------------------- | ---------- | ------- | --- | ----------------------------- | ----- | --- | ------- | ------- |
|     | ROM                       | SRAM       |         |     |                               |       |     |         | Timers  |
|     | Wireless Digital Circuits |            |         |     | Optional Digital Peripherals  |       |     |         |         |
|     | Bluetooth LE Link         |            |         |     |                               |       |     |         | SD/MMC  |
|     |                           | Wi-Fi MAC  | SHA     |     | RSA                           | HMAC  |     | RSA_DS  | Host    |
Controller
|     | Bluetooth LE  | Wi-Fi            |     |        |     |                     |     |      |         |
| --- | ------------- | ---------------- | --- | ------ | --- | ------------------- | --- | ---- | ------- |
|     | Baseband      | Baseband         | AES | SPI2/3 |     | Secure Boot         |     | GDMA | USB OTG |
|     |               | RTC Power Domain |     |        |     | Analog Power Domain |     |      |         |
eFuse
|     | PMU |     | RTC Memory |     |     |     | RF Circuits |     |     |
| --- | --- | --- | ---------- | --- | --- | --- | ----------- | --- | --- |
Controller
|     |                          |     |     |     |     | 2.4 GHz  |     | 2.4 GHz     |     |
| --- | ------------------------ | --- | --- | --- | --- | -------- | --- | ----------- | --- |
|     | Optional RTC Peripherals |     |     |     |     | Receiver |     | Transmitter |     |
Super
|     |          | ULP         |          |     |     |             | RF  | 2.4 GHz Balun  |     |
| --- | -------- | ----------- | -------- | --- | --- | ----------- | --- | -------------- | --- |
|     | RTC GPIO |             | Watchdog |     |     |             |     |                |     |
|     |          | Coprocessor |          |     |     | Synthesizer |     | + Switch       |     |
|     | RTC I2C  | RTC ADC     |          |     |     |             |     |                |     |
XTAL_CLK
|     |     |     | RTC  |     | PLL |     | RC_FAST_CLK |     |     |
| --- | --- | --- | ---- | --- | --- | --- | ----------- | --- | --- |
Watchdog
|     | Temperature  | Touch  | Timer |     | Phase Lock  |     |     | Fast RC    | External Main  |
| --- | ------------ | ------ | ----- | --- | ----------- | --- | --- | ---------- | -------------- |
|     | Sensor       | Sensor |       |     |             |     |     |            |                |
|     |              |        |       |     | Loop        |     |     | Oscillator | Clock          |
Power distribution
Power domain
Power subdomain
|                  |     | Figure4-2. | ComponentsandPowerDomains |     |     |     |     |                             |     |
| ---------------- | --- | ---------- | ------------------------- | --- | --- | --- | --- | --------------------------- | --- |
| EspressifSystems |     |            |                           | 43  |     |     |     | ESP32-S3SeriesDatasheetv2.2 |     |
SubmitDocumentationFeedback

4 FunctionalDescription
|             |        |     |          | Table4-1. ComponentsandPowerDomains |          |          |        |       |     |          |
| ----------- | ------ | --- | -------- | ----------------------------------- | -------- | -------- | ------ | ----- | --- | -------- |
|             | Power  | RTC |          | Digital                             |          |          | Analog |       |     |          |
|             | Domain |     | Optional |                                     | Optional | Wireless | RC_    |       |     |          |
|             |        |     |          |                                     |          |          |        | XTAL_ |     | RF       |
| Power       |        |     | RTC      | CPU                                 | Digital  | Digital  | FAST_  |       | PLL |          |
|             |        |     |          |                                     |          |          |        | CLK   |     | Circuits |
| Mode        |        |     | Periph   |                                     | Periph   | Circuits | CLK    |       |     |          |
| Active      |        | ON  | ON       | ON ON                               | ON       | ON       | ON ON  | ON    | ON  | ON       |
|             |        |     |          |                                     |          | 1        |        |       |     | 2        |
| Modem-sleep |        | ON  | ON       | ON ON                               | ON       | ON       | ON ON  | ON    | ON  | OFF      |
| Light-sleep |        | ON  | ON       | ON OFF                              | 1 ON 1   | OFF 1    | ON OFF | OFF   | OFF | OFF 2    |
| Deep-sleep  |        | ON  | ON 1     | OFF OFF                             | OFF      | OFF      | ON OFF | OFF   | OFF | OFF      |
1
Configurable. SeeESP32-S3TechnicalReferenceManual>ChapterLow-powerManagementformoredetails.
2
IfWirelessDigitalCircuitsareon,RFcircuitsareperiodicallyswitchedonwhenrequiredbyinternaloperationtokeep
activewirelessconnectionsrunning.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterLowPowerManagement.
| 4.1.3.6 | System | Timer |     |     |     |     |     |     |     |     |
| ------- | ------ | ----- | --- | --- | --- | --- | --- | --- | --- | --- |
ESP32-S3integratesa52-bitsystemtimer,whichhastwo52-bitcountersandthreecomparators.
FeatureList
• Counterswithaclockfrequencyof16MHz
•
Threetypesofindependentinterruptsgeneratedaccordingtoalarmvalue
| •   | Twoalarmmodes: |     | targetmodeandperiodmode |     |     |     |     |     |     |     |
| --- | -------------- | --- | ----------------------- | --- | --- | --- | --- | --- | --- | --- |
• 52-bittargetalarmvalueand26-bitperiodicalarmvalue
•
ReadsleeptimefromRTCtimerwhenthechipisawakenfromDeep-sleeporLight-sleepmode
•
CounterscanbestallediftheCPUisstalledorinOCDmode
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSystemTimer.
| 4.1.3.7 | General | Purpose | Timers |     |     |     |     |     |     |     |
| ------- | ------- | ------- | ------ | --- | --- | --- | --- | --- | --- | --- |
ESP32-S3isembeddedwithfour54-bitgeneral-purposetimers,whicharebasedon16-bitprescalersand
54-bitauto-reload-capableup/down-timers.
FeatureList
•
16-bitclockprescaler,from2to65536
• 54-bittime-basecounterprogrammabletobeincrementingordecrementing
• Abletoreadreal-timevalueofthetime-basecounter
•
Haltingandresumingthetime-basecounter
• Programmablealarmgeneration
• Timervaluereload(Auto-reloadatalarmorsoftware-controlledinstantreload)
| EspressifSystems |     |     |     |     | 44  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- | --- |
SubmitDocumentationFeedback

4 FunctionalDescription
• Levelinterruptgeneration
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterTimerGroup.
4.1.3.8 Watchdog Timers
ESP32-S3containsthreewatchdogtimers: oneineachofthetwotimergroups(calledMainSystem
WatchdogTimers,orMWDT)andoneintheRTCModule(calledtheRTCWatchdogTimer,orRWDT).
Duringtheflashbootprocess,RWDTandthefirstMWDTareenabledautomaticallyinordertodetectand
recoverfrombootingerrors.
FeatureList
• Fourstages:
– Eachwithaprogrammabletimeoutvalue
– Eachstagecanbeconfigured,enabledanddisabledseparately
• Uponexpiryofeachstage:
– Interrupt,CPUreset,orcoreresetoccursforMWDT
– Interrupt,CPUreset,corereset,orsystemresetoccursforRWDT
• 32-bitexpirycounter
• Writeprotection,topreventRWDTandMWDTconfigurationfrombeingalteredinadvertently
• Flashbootprotection: IfthebootprocessfromanSPIflashdoesnotcompletewithinapredetermined
periodoftime,thewatchdogwillreboottheentiremainsystem
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterWatchdogTimers.
4.1.3.9 XTAL32K Watchdog Timers
InterruptandWake-Up
WhentheXTAL32KwatchdogtimerdetectstheoscillationfailureofXTAL32K_CLK,anoscillationfailure
interruptRTC_XTAL32K_DEAD_INT(forinterruptdescription,pleasereferto
ESP32-S3TechnicalReferenceManual>ChapterLow-powerManagement)isgenerated. Atthispoint,the
CPUwillbewokenupifinLight-sleepmodeorDeep-sleepmode.
BACKUP32K_CLK
OncetheXTAL32KwatchdogtimerdetectstheoscillationfailureofXTAL32K_CLK,itreplacesXTAL32K_CLK
withBACKUP32K_CLK(withafrequencyof32kHzorso)derivedfromRTC_CLKasRTC’sSLOW_CLK,soasto
ensureproperfunctioningofthesystem.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterXTAL32KWatchdogTimers.
4.1.3.10 Permission Control
InESP32-S3,thePermissionControlmoduleisusedtocontrolaccesstotheslaves(includinginternal
memory,peripherals,externalflash,andRAM).Thehostcanaccessitsslaveonlyifithastherightpermission.
Inthisway,dataandinstructionsareprotectedfromillegitimatereadorwrite.
EspressifSystems 45 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
TheESP32-S3CPUcanruninbothSecureWorldandNon-secureWorldwhereindependentpermission
controlsareadopted. ThePermissionControlmoduleisabletoidentifywhichWorldthehostisrunningand
thenproceedwithitsnormaloperations.
FeatureList
• Manageaccesstointernalmemoryby:
– CPU
– CPUtracemodule
– GDMA
• ManageaccesstoexternalflashandRAMby:
– MMU
– SPI1
– GDMA
– CPUthroughCache
• Manageaccesstoperipherals,supporting
– independentpermissioncontrolforeachperipheral
– monitoringnon-alignedaccess
– accesscontrolforcustomizedaddressrange
• Integratepermissionlockregister
– Allpermissionregisterscanbelockedwiththepermissionlockregister. Oncelocked,the
permissionregisterandthelockregistercannotbemodified,unlesstheCPUisreset.
• Integratepermissionmonitorinterrupt
– Incaseofillegitimateaccess,thepermissionmonitorinterruptwillbetriggeredandtheCPUwillbe
informedtohandletheinterrupt.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterPermissionControl.
4.1.3.11 World Controller
ESP32-S3candividethehardwareandsoftwareresourcesintoaSecureWorldandaNon-SecureWorldto
preventsabotageoraccesstodeviceinformation. Switchingbetweenthetwoworldsisperformedbythe
WorldController.
FeatureList
• ControloftheCPUswitchingbetweensecureandnon-secureworlds
• Controlof15DMAperipheralsswitchingbetweensecureandnon-secureworlds
• RecordofCPU’sworldswitchinglogs
• ShieldingoftheCPU’sNMIinterrupt
EspressifSystems 46 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterWorldController.
4.1.3.12 System Registers
ESP32-S3systemregisterscanbeusedtocontrolthefollowingperipheralblocksandcoremodules:
• Systemandmemory
• Clock
• SoftwareInterrupt
• Low-powermanagement
• Peripheralclockgatingandreset
• CPUControl
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSystemRegisters.
4.1.4 Cryptography and Security Component
Thissubsectiondescribesthesecurityfeaturesincorporatedintothechip,whichsafeguarddataand
operations.
4.1.4.1 SHA Accelerator
ESP32-S3integratesanSHAaccelerator,whichisahardwaredevicethatspeedsupSHAalgorithm
significantly.
FeatureList
• AllthehashalgorithmsintroducedinFIPSPUB180-4Spec.
– SHA-1
– SHA-224
– SHA-256
– SHA-384
– SHA-512
– SHA-512/224
– SHA-512/256
– SHA-512/t
• Twoworkingmodes
– TypicalSHA
– DMA-SHA
• interleavedfunctionwhenworkinginTypicalSHAworkingmode
• InterruptfunctionwhenworkinginDMA-SHAworkingmode
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSHAAccelerator.
EspressifSystems 47 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.1.4.2 AES Accelerator
ESP32-S3integratesanAdvancedEncryptionStandard(AES)Accelerator,whichisahardwaredevicethat
speedsupAESalgorithmsignificantly.
FeatureList
• TypicalAESworkingmode
– AES-128/AES-256encryptionanddecryption
• DMA-AESworkingmode
– AES-128/AES-256encryptionanddecryption
– Blockciphermode
* ECB(ElectronicCodebook)
* CBC(CipherBlockChaining)
* OFB(OutputFeedback)
* CTR(Counter)
* CFB8(8-bitCipherFeedback)
* CFB128(128-bitCipherFeedback)
– Interruptoncompletionofcomputation
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterAESAccelerator.
4.1.4.3 RSA Accelerator
TheRSAAcceleratorprovideshardwaresupportforhighprecisioncomputationusedinvariousRSA
asymmetriccipheralgorithms.
FeatureList
• Large-numbermodularexponentiationwithtwooptionalaccelerationoptions
• Large-numbermodularmultiplication,upto4096bits
• Large-numbermultiplication,withoperandsupto2048bits
• Operandsofdifferentlengths
• Interruptoncompletionofcomputation
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterRSAAccelerator.
4.1.4.4 Secure Boot
SecureBootfeatureusesahardwarerootoftrusttoensureonlysignedfirmware(withRSA-PSSsignature)can
bebooted.
EspressifSystems 48 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.1.4.5 HMAC Accelerator
TheHash-basedMessageAuthenticationCode(HMAC)modulecomputesMessageAuthenticationCodes
(MACs)usingHashalgorithmandkeysasdescribedinRFC2104.
FeatureList
• StandardHMAC-SHA-256algorithm
• Hashresultonlyaccessiblebyconfigurablehardwareperipheral(indownstreammode)
• Compatibletochallenge-responseauthenticationalgorithm
• GeneratesrequiredkeysfortheRSADigitalSignaturePeripheral(RSA_DS)(indownstreammode)
• Re-enablessoft-disabledJTAG(indownstreammode)
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterHMACAccelerator.
4.1.4.6 RSA Digital Signature Peripheral (RSA_DS)
AnRSADigitalSignaturePeripheral(RSA_DS)isusedtoverifytheauthenticityandintegrityofamessage
usingacryptographicalgorithm.
FeatureList
• RSA_DSwithkeylengthupto4096bits
• Encryptedprivatekeydata,onlydecryptablebyRSA_DS
• SHA-256digesttoprotectprivatekeydataagainsttamperingbyanattacker
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterRSADigitalSignaturePeripheral(RSA_DS).
4.1.4.7 External Memory Encryption and Decryption
ESP32-S3integratesanExternalMemoryEncryptionandDecryptionmodulethatcomplieswiththeXTS-AES
standard.
FeatureList
• GeneralXTS-AESalgorithm,compliantwithIEEEStd1619-2007
• Software-basedmanualencryption
• High-speedautoencryption,withoutsoftware’sparticipation
• High-speedautodecryption,withoutsoftware’sparticipation
• Encryptionanddecryptionfunctionsjointlydeterminedbyregistersconfiguration,eFuseparameters,
andbootmode
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterExternalMemoryEncryptionand
Decryption.
EspressifSystems 49 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.1.4.8 Clock Glitch Detection
TheClockGlitchDetectionmoduleonESP32-S3monitorsinputclocksignalsfromXTAL_CLK.Ifitdetectsa
glitchwithawidthshorterthan3ns,inputclocksignalsfromXTAL_CLKareblocked.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterClockGlitchDetection.
4.1.4.9 Random Number Generator
Therandomnumbergenerator(RNG)inESP32-S3generatestruerandomnumbers,whichmeansrandom
numbergeneratedfromaphysicalprocess,ratherthanbymeansofanalgorithm. Nonumbergenerated
withinthespecifiedrangeismoreorlesslikelytoappearthananyothernumber.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterRandomNumberGenerator.
EspressifSystems 50 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.2 Peripherals
Thissectiondescribesthechip’speripheralcapabilities,coveringconnectivityinterfacesandon-chipsensors
thatextenditsfunctionality.
4.2.1 Connectivity Interface
Thissubsectiondescribestheconnectivityinterfacesonthechipthatenablecommunicationandinteraction
withexternaldevicesandnetworks.
4.2.1.1 UART Controller
ESP32-S3hasthreeUART(UniversalAsynchronousReceiverTransmitter)controllers,i.e.,UART0,UART1,and
UART2,whichsupportIrDAandasynchronouscommunication(RS232andRS485)ataspeedofupto5
Mbps.
FeatureList
• Threeclocksourcesthatcanbedivided
• Programmablebaudrate
• 1024x8-bitRAMsharedbyTXFIFOsandRXFIFOsofthethreeUARTcontrollers
• Full-duplexasynchronouscommunication
• Automaticbaudratedetectionofinputsignals
• Databitsrangingfrom5to8
• Stopbitsof1,1.5,2,or3bits
• Paritybit
• SpecialcharacterAT_CMDdetection
• RS485protocol
• IrDAprotocol
• High-speeddatacommunicationusingGDMA
• UARTaswake-upsource
• Softwareandhardwareflowcontrol
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterUARTController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.2 I2C Interface
ESP32-S3hastwoI2CbusinterfaceswhichareusedforI2Cmastermodeorslavemode,dependingonthe
user’sconfiguration.
EspressifSystems 51 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• Standardmode(100kbit/s)
• Fastmode(400kbit/s)
• Upto800kbit/s(constrainedbySCLandSDApull-upstrength)
• 7-bitand10-bitaddressingmode
• Doubleaddressingmode(slaveaddressingandslaveregisteraddressing)
ThehardwareprovidesacommandabstractionlayertosimplifytheusageoftheI2Cperipheral.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterI2CController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.3 I2S Interface
ESP32-S3includestwostandardI2Sinterfaces. Theycanoperateinmastermodeorslavemode,in
full-duplexmodeorhalf-duplexcommunicationmode,andcanbeconfiguredtooperatewithan8-bit,16-bit,
24-bit,or32-bitresolutionasaninputoroutputchannel. BCKclockfrequency,from10kHzupto40MHz,is
supported.
TheI2SinterfacehasadedicatedDMAcontroller. ItsupportsTDMPCM,TDMMSBalignment,TDMLSB
alignment,TDMPhillips,andPDMinterface.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterI2SController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.4 LCD and Camera Controller
TheLCDandCameracontrollerofESP32-S3consistsofaLCDmoduleandacameramodule.
TheLCDmoduleisdesignedtosendparallelvideodatasignals,anditsbussupports8-bit~16-bitparallel
RGB,I8080,andMOTO6800interfaces. Theseinterfacesoperateat40MHzorlower,andsupportconversion
amongRGB565,YUV422,YUV420,andYUV411.
Thecameramoduleisdesignedtoreceiveparallelvideodatasignals,anditsbussupportsan8-bit~16-bit
DVPimagesensor,withclockfrequencyofupto40MHz. Thecamerainterfacesupportsconversionamong
RGB565,YUV422,YUV420,andYUV411.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterLCDandCameraController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
EspressifSystems 52 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
| 4.2.1.5 Serial | Peripheral | Interface | (SPI) |     |
| -------------- | ---------- | --------- | ----- | --- |
ESP32-S3hasthefollowingSPIinterfaces:
•
SPI0usedbyESP32-S3’sGDMAcontrollerandcachetoaccessin-packageoroff-packageflash/PSRAM
• SPI1usedbytheCPUtoaccessin-packageoroff-packageflash/PSRAM
• SPI2isageneralpurposeSPIcontrollerwithaccesstoaDMAchannelallocatedbytheGDMAcontroller
•
SPI3isageneralpurposeSPIcontrollerwithaccesstoaDMAchannelallocatedbytheGDMAcontroller
FeatureList
•
SPI0andSPI1:
| – SupportsSingleSPI,DualSPI,QuadSPI,OctalSPI,QPI,andOPImodes |     |     |     |     |
| ------------------------------------------------------------ | --- | --- | --- | --- |
– 8-lineSPImodesupportssingledatarate(SDR)anddoubledatarate(DDR)
– Configurableclockfrequencywithamaximumof120MHzfor8-lineSPISDR/DDRmodes
| – Datatransmissionisinbytes |     |     |     |     |
| --------------------------- | --- | --- | --- | --- |
• SPI2:
| – Supportsoperationasamasterorslave                          |     |     |     |     |
| ------------------------------------------------------------ | --- | --- | --- | --- |
| – ConnectstoaDMAchannelallocatedbytheGDMAcontroller          |     |     |     |     |
| – SupportsSingleSPI,DualSPI,QuadSPI,OctalSPI,QPI,andOPImodes |     |     |     |     |
| – Configurableclockpolarity(CPOL)andphase(CPHA)              |     |     |     |     |
| – Configurableclockfrequency                                 |     |     |     |     |
| – Datatransmissionisinbytes                                  |     |     |     |     |
– Configurablereadandwritedatabitorder: most-significantbit(MSB)first,orleast-significantbit
(LSB)first
| – Asamaster |     |     |     |     |
| ----------- | --- | --- | --- | --- |
* Supports2-linefull-duplexcommunicationwithclockfrequencyupto80MHz
* Full-duplex8-lineSPImodesupportssingledatarate(SDR)only
* Supports1-,2-,4-,8-linehalf-duplexcommunicationwithclockfrequencyupto80MHz
* Half-duplex8-lineSPImodesupportsbothsingledatarate(upto80MHz)anddoubledatarate
(upto40MHz)
* ProvidessixSPI_CSpinsforconnectionwithsixindependentSPIslaves
* ConfigurableCSsetuptimeandholdtime
| – Asaslave |     |     |     |     |
| ---------- | --- | --- | --- | --- |
* Supports2-linefull-duplexcommunicationwithclockfrequencyupto60MHz
* Supports1-,2-,4-linehalf-duplexcommunicationwithclockfrequencyupto60MHz
* Full-duplexandhalf-duplex8-lineSPImodesupportssingledatarate(SDR)only
| EspressifSystems |     |     | 53  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

4 FunctionalDescription
• SPI3:
– Supportsoperationasamasterorslave
– ConnectstoaDMAchannelallocatedbytheGDMAcontroller
– SupportsSingleSPI,DualSPI,QuadSPI,andQPImodes
– Configurableclockpolarity(CPOL)andphase(CPHA)
– Configurableclockfrequency
– Datatransmissionisinbytes
– Configurablereadandwritedatabitorder: most-significantbit(MSB)first,orleast-significantbit
(LSB)first
– Asamaster
* Supports2-linefull-duplexcommunicationwithclockfrequencyupto80MHz
* Supports1-,2-,4-linehalf-duplexcommunicationwithclockfrequencyupto80MHz
* ProvidesthreeSPI_CSpinsforconnectionwiththreeindependentSPIslaves
* ConfigurableCSsetuptimeandholdtime
– Asaslave
* Supports2-linefull-duplexcommunicationwithclockfrequencyupto60MHz
* Supports1-,2-,4-linehalf-duplexcommunicationwithclockfrequencyupto60MHz
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSPIController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.6 Two-Wire Automotive Interface (TWAI®)
TheTwo-WireAutomotiveInterface(TWAI®)isamulti-master,multi-castcommunicationprotocolwitherror
detectionandsignalingaswellasinbuiltmessageprioritiesandarbitration.
FeatureList
• CompatiblewithISO11898-1protocol(CANSpecification2.0)
• Standardframeformat(11-bitID)andextendedframeformat(29-bitID)
• Bitratesfrom1Kbit/sto1Mbit/s
• Multiplemodesofoperation:
– Normal
– ListenOnly
– Self-Test(noacknowledgmentrequired)
• 64-bytereceiveFIFO
EspressifSystems 54 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
•
Acceptancefilter(singleanddualfiltermodes)
• Errordetectionandhandling:
| – Errorcounters                       |     |     |     |     |
| ------------------------------------- | --- | --- | --- | --- |
| – Configurableerrorinterruptthreshold |     |     |     |     |
| – Errorcodecapture                    |     |     |     |     |
| – Arbitrationlostcapture              |     |     |     |     |
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterTwo-wireAutomotiveInterface.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
| 4.2.1.7 USB | 2.0 OTG Full-Speed | Interface |     |     |
| ----------- | ------------------ | --------- | --- | --- |
ESP32-S3featuresafull-speedUSBOTGinterfacealongwithanintegratedtransceiver. TheUSBOTG
interfacecomplieswiththeUSB2.0specification.
GeneralFeatures
• FSandLSdatarates
•
HNPandSRPasA-deviceorB-device
•
DynamicFIFO(DFIFO)sizing
• Multiplemodesofmemoryaccess
| – Scatter/GatherDMAmode |     |     |     |     |
| ----------------------- | --- | --- | --- | --- |
| – BufferDMAmode         |     |     |     |     |
| – Slavemode             |     |     |     |     |
• Canchooseintegratedtransceiverorexternaltransceiver
•
UtilizingintegratedtransceiverwithUSBSerial/JTAGbytime-divisionmultiplexingwhenonlyintegrated
transceiverisused
• SupportUSBOTGusingoneofthetransceiverswhileUSBSerial/JTAGusingtheotheronewhenboth
integratedtransceiverorexternaltransceiverareused
DeviceModeFeatures
• Endpointnumber0alwayspresent(bi-directional,consistingofEP0INandEP0OUT)
•
Sixadditionalendpoints(endpointnumbers1to6),configurableasINorOUT
•
MaximumoffiveINendpointsconcurrentlyactiveatanytime(includingEP0IN)
• AllOUTendpointsshareasingleRXFIFO
• EachINendpointhasadedicatedTXFIFO
| EspressifSystems |     |     | 55  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

4 FunctionalDescription
HostModeFeatures
• Eightchannels(pipes)
– Acontrolpipeconsistsoftwochannels(INandOUT),asINandOUTtransactionsmustbehandled
separately. OnlyControltransfertypeissupported.
– EachoftheothersevenchannelsisdynamicallyconfigurabletobeINorOUT,andsupportsBulk,
Isochronous,andInterrupttransfertypes.
• AllchannelsshareanRXFIFO,non-periodicTXFIFO,andperiodicTXFIFO.ThesizeofeachFIFOis
configurable.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterUSBOn-The-Go.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.8 USB Serial/JTAG Controller
ESP32-S3integratesaUSBSerial/JTAGcontroller.
FeatureList
• USBFull-speeddevice.
• CanbeconfiguredtoeitheruseinternalUSBPHYofESP32-S3orexternalPHYviaGPIOmatrix.
• Fixedfunctiondevice,hardwiredforCDC-ACM(CommunicationDeviceClass-AbstractControlModel)
andJTAGadapterfunctionality.
• TwoOUTEndpoints,threeINEndpointsinadditiontoControlEndpoint0;Upto64-bytedatapayload
size.
• InternalPHY,sonoorveryfewexternalcomponentsneededtoconnecttoahostcomputer.
• CDC-ACMadherentserialportemulationisplug-and-playonmostmodernOSes.
• JTAGinterfaceallowsfastcommunicationwithCPUdebugcoreusingacompactrepresentationofJTAG
instructions.
• CDC-ACMsupportshostcontrollablechipresetandentryintodownloadmode.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterUSBSerial/JTAGController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.9 SD/MMC Host Controller
ESP32-S3hasanSD/MMCHostcontroller.
EspressifSystems 56 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
FeatureList
• SecureDigital(SD)memoryversion3.0andversion3.01
• SecureDigitalI/O(SDIO)version3.0
• ConsumerElectronicsAdvancedTransportArchitecture(CE-ATA)version1.1
• MultimediaCards(MMCversion4.41,eMMCversion4.5andversion4.51)
• Upto80MHzclockoutput
• Threedatabusmodes:
– 1-bit
– 4-bit(supportstwoSD/SDIO/MMC4.41cards,andoneSDcardoperatingat1.8Vin4-bitmode)
– 8-bit
Note:
Whenworkingat80MHz,theclockphaseadjustmentislimitedandonlyphase0°and180°aresupported. ThePCB
layoutshouldbeoptimizedaccordinglytoensuretimingclosure.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterSD/MMCHostController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
FeatureList
• Cangenerateadigitalwaveformwithconfigurableperiodsanddutycycle. Thedutycycleresolutioncan
beupto14bitswithina1msperiod
• Multipleclocksources,includingAPBclockandexternalmaincrystalclock
• CanoperatewhentheCPUisinLight-sleepmode
• Gradualincreaseordecreaseofdutycycle,usefulfortheLEDRGBcolor-fadinggenerator
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterLEDPWMController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.10 Motor Control PWM (MCPWM)
ESP32-S3integratestwoMCPWMsthatcanbeusedtodrivedigitalmotorsandsmartlight. EachMCPWM
peripheralhasoneclockdivider(prescaler),threePWMtimers,threePWMoperators,andacapturemodule.
PWMtimersareusedforgeneratingtimingreferences. ThePWMoperatorsgeneratedesiredwaveformbased
onthetimingreferences. AnyPWMoperatorcanbeconfiguredtousethetimingreferencesofanyPWM
timers. DifferentPWMoperatorscanusethesamePWMtimer’stimingreferencestoproducerelatedPWM
EspressifSystems 57 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
signals. PWMoperatorscanalsousedifferentPWMtimers’valuestoproducethePWMsignalsthatwork
alone. DifferentPWMtimerscanalsobesynchronizedtogether.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterMotorControlPWM.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.11 Remote Control Peripheral (RMT)
TheRemoteControlPeripheral(RMT)isdesignedtosendandreceiveinfraredremotecontrolsignals.
FeatureList
• FourTXchannels
• FourRXchannels
• Supportmultiplechannels(programmable)transmittingdatasimultaneously
• Eightchannelssharea384x32-bitRAM
• SupportmodulationonTXpulses
• SupportfilteringanddemodulationonRXpulses
• WrapTXmode
• WrapRXmode
• ContinuousTXmode
• DMAaccessforTXmodeonchannel3
• DMAaccessforRXmodeonchannel7
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterRemoteControlPeripheral.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.1.12 Pulse Count Controller (PCNT)
Thepulsecountcontroller(PCNT)capturespulseandcountspulseedgesthroughmultiplemodes.
FeatureList
• Fourindependentpulsecounters(units)thatcountfrom1to65535
• Eachunitconsistsoftwoindependentchannelssharingonepulsecounter
• Allchannelshaveinputpulsesignals(e.g. sig_ch0_un)withtheircorrespondingcontrolsignals(e.g.
ctrl_ch0_un)
• Independentlyfilterglitchesofinputpulsesignals(sig_ch0_unandsig_ch1_un)andcontrolsignals
(ctrl_ch0_unandctrl_ch1_un)oneachunit
EspressifSystems 58 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
• Eachchannelhasthefollowingparameters:
1. Selectionbetweencountingonpositiveornegativeedgesoftheinputpulsesignal
2. ConfigurationtoIncrement,Decrement,orDisablecountermodeforcontrolsignal’shighandlow
states
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterPulseCountController.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.2 Analog Signal Processing
Thissubsectiondescribescomponentsonthechipthatsenseandprocessreal-worlddata.
4.2.2.1 SAR ADC
ESP32-S3integratestwo12-bitSARADCsandsupportsmeasurementson20channels(analog-enabledpins).
Forpower-savingpurpose,theULPcoprocessorsinESP32-S3canalsobeusedtomeasurevoltageinsleep
modes. Byusingthresholdsettingsorothermethods,wecanawakentheCPUfromsleepmodes.
Note:
PleasenotethattheADC2_CH…analogfunctions(seeTable2-8AnalogFunctions)cannotbeusedwithWi-Fisimul-
taneously.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
4.2.2.2 Temperature Sensor
Thetemperaturesensorgeneratesavoltagethatvarieswithtemperature. Thevoltageisinternallyconverted
viaanADCintoadigitalvalue.
Thetemperaturesensorhasarangeof–40°Cto125°C.Itisdesignedprimarilytosensethetemperature
changesinsidethechip. Thetemperaturevaluedependsonfactorssuchasmicrocontrollerclockfrequency
orI/Oload. Generally,thechip’sinternaltemperatureishigherthantheambienttemperature.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
4.2.2.3 Touch Sensor
ESP32-S3has14capacitive-sensingGPIOs,whichdetectvariationsinducedbytouchingorapproachingthe
GPIOswithafingerorotherobjects. Thelow-noisenatureofthedesignandthehighsensitivityofthecircuit
allowrelativelysmallpadstobeused. Arraysofpadscanalsobeused,sothatalargerareaormorepoints
EspressifSystems 59 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
canbedetected. Thetouchsensingperformancecanbefurtherenhancedbythewaterproofdesignand
digitalfilteringfeature.
Note:
ESP32-S3touchsensorhasnotpassedtheConductedSusceptibility(CS)testfornow,andthushaslimitedapplication
scenarios.
Fordetails,seeESP32-S3TechnicalReferenceManual>ChapterOn-ChipSensorsandAnalogSignal
Processing.
PinAssignment
Fordetails,seeSection2.3.5PeripheralPinAssignment.
EspressifSystems 60 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.3 Wireless Communication
Thissectiondescribesthechip’swirelesscommunicationcapabilities,spanningradiotechnology,Wi-Fi,
Bluetooth,and802.15.4.
4.3.1 Radio
Thissubsectiondescribesthefundamentalradiotechnologyembeddedinthechipthatfacilitateswireless
communicationanddataexchange.
4.3.1.1 2.4 GHz Receiver
The2.4GHzreceiverdemodulatesthe2.4GHzRFsignaltoquadraturebasebandsignalsandconvertsthem
tothedigitaldomainwithtwohigh-resolution,high-speedADCs. Toadapttovaryingsignalchannel
conditions,ESP32-S3integratesRFfilters,AutomaticGainControl(AGC),DCoffsetcancelationcircuits,and
basebandfilters.
4.3.1.2 2.4 GHz Transmitter
The2.4GHztransmittermodulatesthequadraturebasebandsignalstothe2.4GHzRFsignal,anddrivesthe
antennawithahigh-poweredCMOSpoweramplifier. Theuseofdigitalcalibrationfurtherimprovesthelinearity
ofthepoweramplifier.
Tocompensateforreceiverimperfections,additionalcalibrationmethodsarebuiltintothechip,
including:
• Carrierleakagecompensation
• I/Qamplitude/phasematching
• Basebandnonlinearitiessuppression
• RFnonlinearitiessuppression
• Antennamatching
Thesebuilt-incalibrationroutinesreducethecostandtimetothemarketforyourproduct,andeliminatethe
needforspecializedtestingequipment.
4.3.1.3 Clock Generator
Theclockgeneratorproducesquadratureclocksignalsof2.4GHzforboththereceiverandthetransmitter. All
componentsoftheclockgeneratorareintegratedintothechip,includinginductors,varactors,filters,
regulators,anddividers.
Theclockgeneratorhasbuilt-incalibrationandself-testcircuits. Quadratureclockphasesandphasenoise
areoptimizedonchipwithpatentedcalibrationalgorithmswhichensurethebestperformanceofthereceiver
andthetransmitter.
4.3.2 Wi-Fi
Thissubsectiondescribesthechip’sWi-Ficapabilities,whichfacilitatewirelesscommunicationatahighdata
rate.
EspressifSystems 61 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
4.3.2.1 Wi-Fi Radio and Baseband
TheESP32-S3Wi-Firadioandbasebandsupportthefollowingfeatures:
• 802.11b/g/n
• 802.11nMCS0-7thatsupports20MHzand40MHzbandwidth
• 802.11nMCS32
• 802.11n0.4µsguard-interval
• Datarateupto150Mbps
• RXSTBC(singlespatialstream)
• Adjustabletransmittingpower
• Antennadiversity:
ESP32-S3supportsantennadiversitywithanexternalRFswitch. Thisswitchiscontrolledbyoneor
moreGPIOs,andusedtoselectthebestantennatominimizetheeffectsofchannelimperfections.
4.3.2.2 Wi-Fi MAC
ESP32-S3implementsthefull802.11b/g/nWi-FiMACprotocol. ItsupportstheBasicServiceSet(BSS)STA
andSoftAPoperationsundertheDistributedControlFunction(DCF).Powermanagementishandled
automaticallywithminimalhostinteractiontominimizetheactivedutyperiod.
TheESP32-S3Wi-FiMACappliesthefollowinglow-levelprotocolfunctionsautomatically:
• FourvirtualWi-Fiinterfaces
• SimultaneousInfrastructureBSSStationmode,SoftAPmode,andStation+SoftAPmode
• RTSprotection,CTSprotection,ImmediateBlockACK
• Fragmentationanddefragmentation
• TX/RXA-MPDU,TX/RXA-MSDU
• TXOP
• WMM
• GCMP,CCMP,TKIP,WAPI,WEP,BIP,WPA2-PSK/WPA2-Enterprise,andWPA3-PSK/WPA3-Enterprise
• Automaticbeaconmonitoring(hardwareTSF)
• 802.11mcFTM
4.3.2.3 Networking Features
UsersareprovidedwithlibrariesforTCP/IPnetworking,ESP-WIFI-MESHnetworking,andothernetworking
protocolsoverWi-Fi. TLS1.2supportisalsoprovided.
4.3.3 Bluetooth LE
Thissubsectiondescribesthechip’sBluetoothcapabilities,whichfacilitatewirelesscommunicationfor
low-power,short-rangeapplications. ESP32-S3includesaBluetoothLowEnergysubsystemthatintegratesa
EspressifSystems 62 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

4 FunctionalDescription
hardwarelinklayercontroller,anRF/modemblockandafeature-richsoftwareprotocolstack. Itsupportsthe
corefeaturesofBluetooth5andBluetoothMesh.
4.3.3.1 Bluetooth LE PHY
BluetoothLowEnergyradioandPHYinESP32-S3support:
• 1MbpsPHY
• 2MbpsPHYforhightransmissionspeedandhighdatathroughput
• CodedPHYforhighRXsensitivityandlongrange(125Kbpsand500Kbps)
• Class1transmitpowerwithoutexternalPA
• HWListenBeforeTalk(LBT)
4.3.3.2 Bluetooth LE Link Controller
BluetoothLowEnergyLinkLayerControllerinESP32-S3supports:
• LEAdvertisingExtensions,toenhancebroadcastingcapacityandbroadcastmoreintelligentdata
• MultipleAdvertisingSets
• SimultaneousAdvertisingandScanning
• Multipleconnectionsinsimultaneouscentralandperipheralroles
• AdaptiveFrequencyHopping(AFH)andChannelAssessment
• LEChannelSelectionAlgorithm#2
• ConnectionParameterUpdate
• HighDutyCycleNon-ConnectableAdvertising
• LEPrivacyv1.2
• LEDataPacketLengthExtension
• LinkLayerExtendedScannerFilterPolicies
• LowDutyCycleDirectedAdvertising
• LinkLayerEncryption
• LEPing
EspressifSystems 63 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| 5 Electrical |     | Characteristics |         |     |     |     |     |     |
| ------------ | --- | --------------- | ------- | --- | --- | --- | --- | --- |
| 5.1 Absolute |     | Maximum         | Ratings |     |     |     |     |     |
StressesabovethoselistedinTable5-1AbsoluteMaximumRatingsmaycausepermanentdamagetothe
device. Thesearestressratingsonlyandnormaloperationofthedeviceattheseoranyotherconditions
beyondthoseindicatedinSection5.2RecommendedOperatingConditionsisnotimplied. Exposureto
absolute-maximum-ratedconditionsforextendedperiodsmayaffectdevicereliability.
|     |     |                | Table5-1.                 | AbsoluteMaximumRatings |     |      |        |       |
| --- | --- | -------------- | ------------------------- | ---------------------- | --- | ---- | ------ | ----- |
|     |     | Parameter      | Description               |                        |     | Min  | Max    | Unit  |
|     |     | Inputpowerpins | 1 Allowedinputvoltage     |                        |     | –0.3 |        | 3.6 V |
|     |     | I 2            | CumulativeIOoutputcurrent |                        |     |      | — 1500 | mA    |
output
|     |     | T STORE | Storagetemperature |     |     | –40 |     | 150 °C |
| --- | --- | ------- | ------------------ | --- | --- | --- | --- | ------ |
1
Formoreinformationoninputpowerpins,seeSection2.5.1PowerPins.
2
TheproductprovedtobefullyfunctionalafterallitsIOpinswerepulledhigh
while being connected to ground for 24 consecutive hours at ambient tem-
peratureof25°C.
| 5.2 Recommended |     |     | Operating | Conditions |     |     |     |     |
| --------------- | --- | --- | --------- | ---------- | --- | --- | --- | --- |
Forrecommendedambienttemperature,seeSection1ESP32-S3SeriesComparison.
|     |             |     | Table5-2. RecommendedOperatingConditions |     |     |     |     |          |
| --- | ----------- | --- | ---------------------------------------- | --- | --- | --- | --- | -------- |
|     | Parameter   | 1   | Description                              |     |     | Min | Typ | Max Unit |
|     | VDDA,VDD3P3 |     | Recommendedinputvoltage                  |     |     | 3.0 | 3.3 | 3.6 V    |
2
|     | VDD3P3_RTC       |     | Recommendedinputvoltage |     |     | 3.0 | 3.3 | 3.6 V |
| --- | ---------------- | --- | ----------------------- | --- | --- | --- | --- | ----- |
|     | VDD_SPI(asinput) |     | —                       |     |     | 1.8 | 3.3 | 3.6 V |
3
|     | VDD3P3_CPU |     | Recommendedinputvoltage |     |     | 3.0 | 3.3 | 3.6 V |
| --- | ---------- | --- | ----------------------- | --- | --- | --- | --- | ----- |
|     | I          | 4   | Cumulativeinputcurrent  |     |     | 0.5 | —   | — A   |
VDD
1 SeeinconjunctionwithSection2.5PowerSupply.
2
If VDD3P3_RTC is used to power VDD_SPI (see Section 2.5.2 Power Scheme),
thevoltagedroponR SPI shouldbeaccountedfor. SeealsoSection5.3VDD_SPI
OutputCharacteristics.
3
IfwritingtoeFuses, thevoltageonVDD3P3_CPUshouldnotexceed3.3Vasthe
circuitsresponsibleforburningeFusesaresensitivetohighervoltages.
4
If you use a single power supply, the recommended output current is 500 mA or
more.
| EspressifSystems |     |     |     |     | 64  |     | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| 5.3 VDD_SPI | Output | Characteristics |     |     |     |     |     |     |     |     |     |     |
| ----------- | ------ | --------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
Table5-3. VDD_SPIInternalandOutputCharacteristics
1
|     | Parameter | Description |         |     |            |     |           |     | Typ | Unit |     |     |
| --- | --------- | ----------- | ------- | --- | ---------- | --- | --------- | --- | --- | ---- | --- | --- |
|     |           | VDD_SPI     | powered | by  | VDD3P3_RTC |     | via R SPI |     |     |      |     |     |
|     | R         |             |         |     |            |     |           |     | 14  | Ω    |     |     |
|     | SPI       |             |         |     | 2          |     |           |     |     |      |     |     |
for3.3Vflash/PSRAM
|     |       | Output | current | when VDD_SPI |     | is powered |     | by  |     |     |     |     |
| --- | ----- | ------ | ------- | ------------ | --- | ---------- | --- | --- | --- | --- | --- | --- |
|     | I SPI |        |         |              |     |            |     |     | 40  | mA  |     |     |
FlashVoltageRegulatorfor1.8Vflash/PSRAM
1 SeeinconjunctionwithSection2.5.2PowerScheme.
|     | 2 VDD3P3_RTCmustbemorethanVDD_flash_min+I_flash_max*R |     |     |     |     |     |     |     |     | ;   |     |     |
| --- | ----------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
SPI
where
•VDD_flash_min–minimumoperatingvoltageofflash/PSRAM
•I_flash_max–maximumoperatingcurrentofflash/PSRAM
| 5.4 DC    | Characteristics | (3.3      | V,                           | 25 °C) |     |     |     |     |     |     |     |      |
| --------- | --------------- | --------- | ---------------------------- | ------ | --- | --- | --- | --- | --- | --- | --- | ---- |
|           |                 | Table5-4. | DCCharacteristics(3.3V,25°C) |        |     |     |     |     |     |     |     |      |
| Parameter | Description     |           |                              |        |     |     | Min |     | Typ | Max |     | Unit |
| C         | Pincapacitance  |           |                              |        |     |     |     | —   | 2   |     | —   | pF   |
IN
|     |                        |     |     |     |     |          |     | 1   |     |     | 1    |     |
| --- | ---------------------- | --- | --- | --- | --- | -------- | --- | --- | --- | --- | ---- | --- |
| V   | High-levelinputvoltage |     |     |     |     | 0.75×VDD |     |     | —   | VDD | +0.3 | V   |
IH
1
| V   | Low-levelinputvoltage |     |     |     |     |     | –0.3 |     | —   | 0.25×VDD |     | V   |
| --- | --------------------- | --- | --- | --- | --- | --- | ---- | --- | --- | -------- | --- | --- |
IL
| I   | High-levelinputcurrent |     |     |     |     |     |     | —   | —   |     | 50  | nA  |
| --- | ---------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
IH
| I IL | Low-levelinputcurrent   |     |     |     |     |         |     | —   | —   |         | 50  | nA  |
| ---- | ----------------------- | --- | --- | --- | --- | ------- | --- | --- | --- | ------- | --- | --- |
| 2    |                         |     |     |     |     |         |     | 1   |     |         |     |     |
| V OH | High-leveloutputvoltage |     |     |     |     | 0.8×VDD |     |     | —   |         | —   | V   |
| 2    |                         |     |     |     |     |         |     |     |     |         | 1   |     |
| V    | Low-leveloutputvoltage  |     |     |     |     |         |     | —   | —   | 0.1×VDD |     | V   |
OL
1
|      | High-levelsourcecurrent(VDD |     |     | =3.3V, |     |     |     |     |     |     |     |     |
| ---- | --------------------------- | --- | --- | ------ | --- | --- | --- | --- | --- | --- | --- | --- |
| I OH |                             |     |     |        |     |     |     | —   | 40  |     | —   | mA  |
V >=2.64V,PAD_DRIVER=3)
OH
|     | Low-levelsinkcurrent(VDD |     | 1 =3.3V,V |     | =   |     |     |     |     |     |     |     |
| --- | ------------------------ | --- | --------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
OL
| I   |     |     |     |     |     |     |     | —   | 28  |     | —   | mA  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
OL
0.495V,PAD_DRIVER=3)
| R PU | Internalweakpull-upresistor   |     |     |     |     |     |     | —   | 45  |     | —   | kΩ  |
| ---- | ----------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R    | Internalweakpull-downresistor |     |     |     |     |     |     | —   | 45  |     | —   | kΩ  |
PD
Chipresetreleasevoltage(CHIP_PUvoltage
|           |     |     |     |     |     |          |     | 1   |     |     | 1    |     |
| --------- | --- | --- | --- | --- | --- | -------- | --- | --- | --- | --- | ---- | --- |
| V IH_nRST |     |     |     |     |     | 0.75×VDD |     |     | —   | VDD | +0.3 | V   |
iswithinthespecifiedrange)
Chipresetvoltage(CHIP_PUvoltageiswithin
1
| V   |     |     |     |     |     |     | –0.3 |     | —   | 0.25×VDD |     | V   |
| --- | --- | --- | --- | --- | --- | --- | ---- | --- | --- | -------- | --- | --- |
IL_nRST
thespecifiedrange)
1
VDD–voltagefromapowerpinofarespectivepowerdomain.
2
| V OH             | andV OL aremeasuredusinghigh-impedanceload. |     |     |     |     |     |     |                             |     |     |     |     |
| ---------------- | ------------------------------------------- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- | --- | --- |
| EspressifSystems |                                             |     |     |     | 65  |     |     | ESP32-S3SeriesDatasheetv2.2 |     |     |     |     |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
| 5.5 ADC | Characteristics |     |     |     |     |     |     |     |
| ------- | --------------- | --- | --- | --- | --- | --- | --- | --- |
Themeasurementsinthissectionaretakenwithanexternal100nFcapacitorconnectedtotheADC,usingDC
signalsasinput,andatanambienttemperatureof25°CwithdisabledWi-Fi.
|     |     |        | Table5-5. | ADCCharacteristics |         |      |     |     |
| --- | --- | ------ | --------- | ------------------ | ------- | ---- | --- | --- |
|     |     | Symbol |           |                    | Min Max | Unit |     |     |
1
|     |     | DNL(Differentialnonlinearity) |     |     | –4    | 4 LSB |     |     |
| --- | --- | ----------------------------- | --- | --- | ----- | ----- | --- | --- |
|     |     | INL(Integralnonlinearity)     |     |     | –8    | 8 LSB |     |     |
|     |     | Samplingrate                  |     |     | — 100 | kSPS  | 2   |     |
1
TogetbetterDNLresults,youcansamplemultipletimesand
applyafilter,orcalculatetheaveragevalue.
2
kSPSmeanskilosamples-per-second.
ThecalibratedADCresultsafterhardwarecalibrationandsoftwarecalibrationareshowninTable5-6. For
higheraccuracy,youmayimplementyourowncalibrationmethods.
|           |     |                                         | Table5-6. | ADCCalibrationResults |     |     |         |      |
| --------- | --- | --------------------------------------- | --------- | --------------------- | --- | --- | ------- | ---- |
| Parameter |     | Description                             |           |                       |     |     | Min Max | Unit |
|           |     | ATTEN0,effectivemeasurementrangeof0~850 |           |                       |     |     | –5 5    | mV   |
–6
|     |     | ATTEN1,effectivemeasurementrangeof0~1100 |     |     |     |     | 6   | mV  |
| --- | --- | ---------------------------------------- | --- | --- | --- | --- | --- | --- |
Totalerror
|             |                     | ATTEN2,effectivemeasurementrangeof0~1600 |                |     |     |     | –10 10 | mV  |
| ----------- | ------------------- | ---------------------------------------- | -------------- | --- | --- | --- | ------ | --- |
|             |                     | ATTEN3,effectivemeasurementrangeof0~2900 |                |     |     |     | –50 50 | mV  |
| 5.6 Current |                     | Consumption                              |                |     |     |     |        |     |
| 5.6.1       | Current Consumption |                                          | in Active Mode |     |     |     |        |     |
Thecurrentconsumptionmeasurementsaretakenwitha3.3Vsupplyat25°Cambienttemperature.
TXcurrentconsumptionisratedata100%dutycycle.
RXcurrentconsumptionisratedwhentheperipheralsaredisabledandtheCPUidle.
|     |          | Table5-7. | CurrentConsumptionforWi-Fi(2.4GHz)inActiveMode |                       |     |     |          |     |
| --- | -------- | --------- | ---------------------------------------------- | --------------------- | --- | --- | -------- | --- |
|     | WorkMode |           | RFCondition                                    | Description           |     |     | Peak(mA) |     |
|     |          |           |                                                | 802.11b,1Mbps,@21dBm  |     |     | 340      |     |
|     |          |           |                                                | 802.11g,54Mbps,@19dBm |     |     | 291      |     |
TX
|     |     |     |     | 802.11n,HT20,MCS7,@18.5dBm |     |     | 283 |     |
| --- | --- | --- | --- | -------------------------- | --- | --- | --- | --- |
Active(RFworking)
|     |     |     |     | 802.11n,HT40,MCS7,@18dBm |     |     | 286 |     |
| --- | --- | --- | --- | ------------------------ | --- | --- | --- | --- |
|     |     |     |     | 802.11b/g/n,HT20         |     |     | 88  |     |
RX
|                  |     |     |     | 802.11n,HT40 |     |                             | 91  |     |
| ---------------- | --- | --- | --- | ------------ | --- | --------------------------- | --- | --- |
| EspressifSystems |     |     |     | 66           |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
|                   | Table5-8.   | CurrentConsumptionforBluetoothLEinActiveMode |                      |     |          |
| ----------------- | ----------- | -------------------------------------------- | -------------------- | --- | -------- |
| WorkMode          |             | RFCondition                                  | Description          |     | Peak(mA) |
|                   |             |                                              | BluetoothLE@21.0dBm  |     | 335      |
|                   |             | TX                                           | BluetoothLE@9.0dBm   |     | 193      |
| Active(RFworking) |             |                                              | BluetoothLE@0dBm     |     | 176      |
|                   |             |                                              | BluetoothLE@–15.0dBm |     | 116      |
|                   |             | RX                                           | BluetoothLE          |     | 93       |
| 5.6.2 Current     | Consumption | in Other                                     | Modes                |     |          |
ThemeasurementsbelowareapplicabletoESP32-S3andESP32-S3FH8. SinceESP32-S3R2,ESP32-S3RH2,
ESP32-S3R8,ESP32-S3R8V,ESP32-S3R16V,andESP32-S3FN4R2areembeddedwithPSRAM,theircurrent
consumptionmightbehigher.
Table5-9. CurrentConsumptioninModem-sleepMode
1 2
|          | Frequency |                            |     |     | Typ Typ   |
| -------- | --------- | -------------------------- | --- | --- | --------- |
| Workmode |           | Description                |     |     |           |
|          | (MHz)     |                            |     |     | (mA) (mA) |
|          |           | WAITI(Dualcoreinidlestate) |     |     | 13.2 18.8 |
Singlecorerunning32-bitdataaccessinstructions,the
16.2 21.8
othercoreinidlestate
|     |     | 40 Dualcorerunning32-bitdataaccessinstructions |     |     | 18.7 24.4 |
| --- | --- | ---------------------------------------------- | --- | --- | --------- |
Singlecorerunning128-bitdataaccessinstructions,the
19.9 25.4
othercoreinidlestate
|     |     | Dualcorerunning128-bitdataaccessinstructions |     |     | 23.0 28.8 |
| --- | --- | -------------------------------------------- | --- | --- | --------- |
|     |     | WAITI                                        |     |     | 22.0 36.1 |
Singlecorerunning32-bitdataaccessinstructions,the
28.4 42.6
othercoreinidlestate
|     |     | 80 Dualcorerunning32-bitdataaccessinstructions |     |     | 33.1 47.3 |
| --- | --- | ---------------------------------------------- | --- | --- | --------- |
Singlecorerunning128-bitdataaccessinstructions,the
35.1 49.6
othercoreinidlestate
|     | 3   | Dualcorerunning128-bitdataaccessinstructions |     |     | 41.8 56.3 |
| --- | --- | -------------------------------------------- | --- | --- | --------- |
Modem-sleep
|     |     | WAITI |     |     | 27.6 42.3 |
| --- | --- | ----- | --- | --- | --------- |
Singlecorerunning32-bitdataaccessinstructions,the
39.9 54.6
othercoreinidlestate
|     |     | 160 Dualcorerunning32-bitdataaccessinstructions |     |     | 49.6 64.1 |
| --- | --- | ----------------------------------------------- | --- | --- | --------- |
Singlecorerunning128-bitdataaccessinstructions,the
54.4 69.2
othercoreinidlestate
|     |     | Dualcorerunning128-bitdataaccessinstructions |     |     | 66.7 81.1 |
| --- | --- | -------------------------------------------- | --- | --- | --------- |
|     |     | WAITI                                        |     |     | 32.9 47.6 |
Singlecorerunning32-bitdataaccessinstructions,the
51.2 65.9
othercoreinidlestate
|     |     | 240 Dualcorerunning32-bitdataaccessinstructions |     |     | 66.2 81.3 |
| --- | --- | ----------------------------------------------- | --- | --- | --------- |
Singlecorerunning128-bitdataaccessinstructions,the
72.4 87.9
othercoreinidlestate
Cont’donnextpage
| EspressifSystems |     |     | 67  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
Table5-9–cont’dfrompreviouspage
1 2
|          | Frequency |                                              |     |     |     | Typ  | Typ        |
| -------- | --------- | -------------------------------------------- | --- | --- | --- | ---- | ---------- |
| Workmode |           | Description                                  |     |     |     |      |            |
|          | (MHz)     |                                              |     |     |     | (mA) | (mA)       |
|          |           | Dualcorerunning128-bitdataaccessinstructions |     |     |     |      | 91.7 107.9 |
1
Currentconsumptionwhenallperipheralclocksaredisabled.
2
Current consumption when all peripheral clocks are enabled. In practice, the current consumption might be
differentdependingonwhichperipheralsareenabled.
3
In Modem-sleep mode, Wi-Fi is clock gated, and the current consumption might be higher when accessing
flash. Foraflashratedat80Mbit/s,inSPI2-linemodetheconsumptionis10mA.
Table5-10. CurrentConsumptioninLow-PowerModes
Typ(µA)
| Workmode | Description |     |     |     |     |     |     |
| -------- | ----------- | --- | --- | --- | --- | --- | --- |
1
Light-sleep VDD_SPIandWi-Fiarepowereddown,andallGPIOsarehigh-impedance. 240
|     | TheULPco-processor |     | ULP-FSM |     |     |     | 170 |
| --- | ------------------ | --- | ------- | --- | --- | --- | --- |
2
|     | ispoweredon |     | ULP-RISC-V |     |     |     | 190 |
| --- | ----------- | --- | ---------- | --- | --- | --- | --- |
3
| Deep-sleep | ULPsensor-monitoredpattern              |     |                               |     |     |     | 18  |
| ---------- | --------------------------------------- | --- | ----------------------------- | --- | --- | --- | --- |
|            | RTCmemoryandRTCperipheralsarepoweredup. |     |                               |     |     |     | 8   |
|            | RTCmemoryispoweredup.                   |     | RTCperipheralsarepowereddown. |     |     |     | 7   |
| Poweroff   | CHIP_PUissettolowlevel.                 |     | Thechipisshutdown.            |     |     |     | 1   |
1
InLight-sleepmode,allrelatedSPIpinsarepulledup. ForchipsembeddedwithPSRAM,pleaseadd
correspondingPSRAMconsumptionvalues,e.g.,140µAfor8MB8-linePSRAM(3.3V),200µAfor
8MB8-linePSRAM(1.8V)and40µAfor2MB4-linePSRAM(3.3V).
2
During Deep-sleep, when the ULP co-processor is powered on, peripherals such as GPIO and I2C
areabletooperate.
3
The “ULP sensor-monitored pattern” refers to the mode where the ULP coprocessor or the sensor
worksperiodically. Whentouchsensorsworkwithadutycycleof1%,thetypicalcurrentconsumption
is18µA.
| 5.7 Memory | Specifications |     |     |     |     |     |     |
| ---------- | -------------- | --- | --- | --- | --- | --- | --- |
Thedatabelowissourcedfromthememoryvendordatasheet. Thesevaluesareguaranteedthroughdesign
and/orcharacterizationbutarenotfullytestedinproduction. Devicesareshippedwiththememory
erased.
Table5-11. FlashSpecifications
|     | Parameter | Description              |     | Min  | Typ  | Max Unit |     |
| --- | --------- | ------------------------ | --- | ---- | ---- | -------- | --- |
|     |           | Powersupplyvoltage(1.8V) |     | 1.65 | 1.80 | 2.00 V   |     |
VCC
|     |     | Powersupplyvoltage(3.3V) |     | 2.7 | 3.3 | 3.6 V |     |
| --- | --- | ------------------------ | --- | --- | --- | ----- | --- |
|     | F   | Maximumclockfrequency    |     | 80  | —   | — MHz |     |
C
|     | —   | Program/erasecycles |     | 100,000 | —   | — cycles |     |
| --- | --- | ------------------- | --- | ------- | --- | -------- | --- |
|     | T   | Dataretentiontime   |     | 20      | —   | — years  |     |
RET
|     | T PP | Pageprogramtime      |     | —   | 0.8 | 5 ms   |     |
| --- | ---- | -------------------- | --- | --- | --- | ------ | --- |
|     | T SE | Sectorerasetime(4KB) |     | —   | 70  | 500 ms |     |
Cont’donnextpage
| EspressifSystems |     |     | 68  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

5 ElectricalCharacteristics
Table5-11–cont’dfrompreviouspage
|     | Parameter | Description          |     |     | Min | Typ Max | Unit |
| --- | --------- | -------------------- | --- | --- | --- | ------- | ---- |
|     | T         | Blockerasetime(32KB) |     |     | —   | 0.2     | 2 s  |
BE1
|     | T BE2 | Blockerasetime(64KB) |     |     | —   | 0.3    | 3 s |
| --- | ----- | -------------------- | --- | --- | --- | ------ | --- |
|     |       | Chiperasetime(16Mb)  |     |     | —   | 7 20   | s   |
|     |       | Chiperasetime(32Mb)  |     |     | —   | 20 60  | s   |
|     | T     | Chiperasetime(64Mb)  |     |     | —   | 25 100 | s   |
CE
|     |           | Chiperasetime(128Mb)     |                     |     | —         | 60 200 | s    |
| --- | --------- | ------------------------ | ------------------- | --- | --------- | ------ | ---- |
|     |           | Chiperasetime(256Mb)     |                     |     | —         | 70 300 | s    |
|     |           | Table5-12.               | PSRAMSpecifications |     |           |        |      |
|     | Parameter | Description              |                     |     | Min Typ   | Max    | Unit |
|     |           | Powersupplyvoltage(1.8V) |                     |     | 1.62 1.80 | 1.98   | V    |
VCC
|     |     | Powersupplyvoltage(3.3V) |     |     | 2.7 3.3 | 3.6 | V   |
| --- | --- | ------------------------ | --- | --- | ------- | --- | --- |
|     | F   | Maximumclockfrequency    |     |     | 80      | — — | MHz |
C
5.8 Reliability
|          |     | Table5-13.     | ReliabilityQualifications |     |     |     |              |
| -------- | --- | -------------- | ------------------------- | --- | --- | --- | ------------ |
| TestItem |     | TestConditions |                           |     |     |     | TestStandard |
HTOL(HighTemperature
|     |     | 125°C,1000hours |     |     |     |     | JESD22-A108 |
| --- | --- | --------------- | --- | --- | --- | --- | ----------- |
OperatingLife)
1
| ESD(Electro-Static |     | HBM(HumanBodyMode) |     | ±2000V |     |     | JS-001 |
| ------------------ | --- | ------------------ | --- | ------ | --- | --- | ------ |
2
| DischargeSensitivity) |     | CDM(ChargeDeviceMode) |     | ±1000V |     |     | JS-002 |
| --------------------- | --- | --------------------- | --- | ------ | --- | --- | ------ |
Currenttrigger±200mA
| Latchup |     |     |     |     |     |     | JESD78 |
| ------- | --- | --- | --- | --- | --- | --- | ------ |
Voltagetrigger1.5×VDD
max
Bake24hours@125°C
J-STD-020,JESD47,
Preconditioning
|     |     | Moisturesoak(level3: | 192hours@30°C,60%RH) |     |     |     |     |
| --- | --- | -------------------- | -------------------- | --- | --- | --- | --- |
JESD22-A113
|     |     | IRreflowsolder: 260+0°C,20seconds,threetimes |     |     |     |     |     |
| --- | --- | -------------------------------------------- | --- | --- | --- | --- | --- |
TCT(TemperatureCycling
|     |     | –65°C/150°C,500cycles |     |     |     |     | JESD22-A104 |
| --- | --- | --------------------- | --- | --- | --- | --- | ----------- |
Test)
uHAST(Highly
| AcceleratedStressTest, |     | 130°C,85%RH,96hours |     |     |     |     | JESD22-A118 |
| ---------------------- | --- | ------------------- | --- | --- | --- | --- | ----------- |
unbiased)
HTSL(HighTemperature
|     |     | 150°C,1000hours |     |     |     |     | JESD22-A103 |
| --- | --- | --------------- | --- | --- | --- | --- | ----------- |
StorageLife)
LTSL(LowTemperature
|     |     | –40°C,1000hours |     |     |     |     | JESD22-A119 |
| --- | --- | --------------- | --- | --- | --- | --- | ----------- |
StorageLife)
1
JEDECdocumentJEP155statesthat500VHBMallowssafemanufacturingwithastandardESDcontrolprocess.
2
JEDECdocumentJEP157statesthat250VCDMallowssafemanufacturingwithastandardESDcontrolprocess.
| EspressifSystems |     |     | 69  |     |     | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

6 RFCharacteristics
| 6 RF | Characteristics |     |     |     |     |
| ---- | --------------- | --- | --- | --- | --- |
ThissectioncontainstableswithRFcharacteristicsoftheEspressifproduct.
TheRFdataismeasuredattheantennaport,whereRFcableisconnected,includingthefront-endloss. The
front-endcircuitisa0Ωresistor.
Devicesshouldoperateinthecenterfrequencyrangeallocatedbyregionalregulatoryauthorities. Thetarget
centerfrequencyrangeandthetargettransmitpowerareconfigurablebysoftware. SeeESPRFTestTooland
TestGuideforinstructions.
Unlessotherwisestated,theRFtestsareconductedwitha3.3V(±5%)supplyat25ºCambienttemperature.
| 6.1 Wi-Fi   | Radio                                  |                                  |     |                 |     |
| ----------- | -------------------------------------- | -------------------------------- | --- | --------------- | --- |
|             |                                        | Table6-1. Wi-FiRFCharacteristics |     |                 |     |
|             | Name                                   |                                  |     | Description     |     |
|             | Centerfrequencyrangeofoperatingchannel |                                  |     | 2412~2484MHz    |     |
|             | Wi-Fiwirelessstandard                  |                                  |     | IEEE802.11b/g/n |     |
| 6.1.1 Wi-Fi | RF Transmitter                         | (TX) Characteristics             |     |                 |     |
Table6-2. TXPowerwithSpectralMaskandEVMMeeting802.11Standards
|     |                        |           |           | Min Typ     | Max   |
| --- | ---------------------- | --------- | --------- | ----------- | ----- |
|     | Rate                   |           |           | (dBm) (dBm) | (dBm) |
|     | 802.11b,1Mbps          |           |           | — 21.0      | —     |
|     | 802.11b,11Mbps         |           |           | — 21.0      | —     |
|     | 802.11g,6Mbps          |           |           | — 20.5      | —     |
|     | 802.11g,54Mbps         |           |           | — 19.0      | —     |
|     | 802.11n,HT20,MCS0      |           |           | — 19.5      | —     |
|     | 802.11n,HT20,MCS7      |           |           | — 18.5      | —     |
|     | 802.11n,HT40,MCS0      |           |           | — 19.5      | —     |
|     | 802.11n,HT40,MCS7      |           |           | — 18.0      | —     |
|     |                        | Table6-3. | TXEVMTest | 1           |       |
|     |                        |           |           | Min Typ     | Limit |
|     | Rate                   |           |           | (dB) (dB)   | (dB)  |
|     | 802.11b,1Mbps,@21dBm   |           |           | — –24.5     | –10   |
|     | 802.11b,11Mbps,@21dBm  |           |           | — –24.5     | –10   |
|     | 802.11g,6Mbps,@20.5dBm |           |           | — –21.5     | –5    |
|     | 802.11g,54Mbps,@19dBm  |           |           | — –28.0     | –25   |
Cont’donnextpage
| EspressifSystems |     |     | 70  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

6 RFCharacteristics
Table6-3–cont’dfrompreviouspage
|     |                            |     |     |     | Min  | Typ Limit |
| --- | -------------------------- | --- | --- | --- | ---- | --------- |
|     | Rate                       |     |     |     | (dB) | (dB) (dB) |
|     | 802.11n,HT20,MCS0,@19.5dBm |     |     |     | —    | –23.0 –5  |
|     | 802.11n,HT20,MCS7,@18.5dBm |     |     |     | —    | –29.5 –27 |
|     | 802.11n,HT40,MCS0,@19.5dBm |     |     |     | —    | –23.0 –5  |
|     | 802.11n,HT40,MCS7,@18dBm   |     |     |     | —    | –29.5 –27 |
1
|     | EVM | is measured | at the corresponding |     | typical TX | power provided |
| --- | --- | ----------- | -------------------- | --- | ---------- | -------------- |
inTable6-2TXPowerwithSpectralMaskandEVMMeeting802.11
Standardsabove.
| 6.1.2 Wi-Fi | RF Receiver | (RX) Characteristics |     |     |     |     |
| ----------- | ----------- | -------------------- | --- | --- | --- | --- |
ForRXtests,thePER(packeterrorrate)limitis8%for802.11b,and10%for802.11g/n.
|     |      |     | Table6-4. | RXSensitivity |       |             |
| --- | ---- | --- | --------- | ------------- | ----- | ----------- |
|     |      |     |           |               | Min   | Typ Max     |
|     | Rate |     |           |               | (dBm) | (dBm) (dBm) |
–98.4
|     | 802.11b,1Mbps     |     |     |     | —   | —       |
| --- | ----------------- | --- | --- | --- | --- | ------- |
|     | 802.11b,2Mbps     |     |     |     | —   | –95.4 — |
|     | 802.11b,5.5Mbps   |     |     |     | —   | –93.0 — |
|     | 802.11b,11Mbps    |     |     |     | —   | –88.6 — |
|     | 802.11g,6Mbps     |     |     |     | —   | –93.2 — |
|     | 802.11g,9Mbps     |     |     |     | —   | –91.8 — |
|     | 802.11g,12Mbps    |     |     |     | —   | –91.2 — |
|     | 802.11g,18Mbps    |     |     |     | —   | –88.6 — |
|     | 802.11g,24Mbps    |     |     |     | —   | –86.0 — |
|     | 802.11g,36Mbps    |     |     |     | —   | –82.4 — |
|     | 802.11g,48Mbps    |     |     |     | —   | –78.2 — |
|     | 802.11g,54Mbps    |     |     |     | —   | –76.5 — |
|     | 802.11n,HT20,MCS0 |     |     |     | —   | –92.6 — |
|     | 802.11n,HT20,MCS1 |     |     |     | —   | –91.0 — |
|     | 802.11n,HT20,MCS2 |     |     |     | —   | –88.2 — |
|     | 802.11n,HT20,MCS3 |     |     |     | —   | –85.0 — |
–81.8
|     | 802.11n,HT20,MCS4 |     |     |     | —   | —       |
| --- | ----------------- | --- | --- | --- | --- | ------- |
|     | 802.11n,HT20,MCS5 |     |     |     | —   | –77.4 — |
|     | 802.11n,HT20,MCS6 |     |     |     | —   | –75.8 — |
|     | 802.11n,HT20,MCS7 |     |     |     | —   | –74.2 — |
|     | 802.11n,HT40,MCS0 |     |     |     | —   | –90.0 — |
–88.0
|     | 802.11n,HT40,MCS1 |     |     |     | —   | —       |
| --- | ----------------- | --- | --- | --- | --- | ------- |
|     | 802.11n,HT40,MCS2 |     |     |     | —   | –85.2 — |
|     | 802.11n,HT40,MCS3 |     |     |     | —   | –82.0 — |
|     | 802.11n,HT40,MCS4 |     |     |     | —   | –79.0 — |
|     | 802.11n,HT40,MCS5 |     |     |     | —   | –74.4 — |
Cont’donnextpage
| EspressifSystems |     |     |     | 71  |     | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

6 RFCharacteristics
Table6-4–cont’dfrompreviouspage
|     |                   |     | Min   | Typ Max     |
| --- | ----------------- | --- | ----- | ----------- |
|     | Rate              |     | (dBm) | (dBm) (dBm) |
|     | 802.11n,HT40,MCS6 |     | —     | –72.8 —     |
|     | 802.11n,HT40,MCS7 |     | —     | –71.4 —     |
Table6-5. MaximumRXLevel
|     |                   |     | Min   | Typ Max     |
| --- | ----------------- | --- | ----- | ----------- |
|     | Rate              |     | (dBm) | (dBm) (dBm) |
|     | 802.11b,1Mbps     |     | —     | 5 —         |
|     | 802.11b,11Mbps    |     | —     | 5 —         |
|     | 802.11g,6Mbps     |     | —     | 5 —         |
|     | 802.11g,54Mbps    |     | —     | 0 —         |
|     | 802.11n,HT20,MCS0 |     | —     | 5 —         |
|     | 802.11n,HT20,MCS7 |     | —     | 0 —         |
|     | 802.11n,HT40,MCS0 |     | —     | 5 —         |
|     | 802.11n,HT40,MCS7 |     | —     | 0 —         |
Table6-6. RXAdjacentChannelRejection
|               |                   |     | Min  | Typ Max   |
| ------------- | ----------------- | --- | ---- | --------- |
|               | Rate              |     | (dB) | (dB) (dB) |
|               | 802.11b,1Mbps     |     | —    | 35 —      |
|               | 802.11b,11Mbps    |     | —    | 35 —      |
|               | 802.11g,6Mbps     |     | —    | 31 —      |
|               | 802.11g,54Mbps    |     | —    | 20 —      |
|               | 802.11n,HT20,MCS0 |     | —    | 31 —      |
|               | 802.11n,HT20,MCS7 |     | —    | 16 —      |
|               | 802.11n,HT40,MCS0 |     | —    | 25 —      |
|               | 802.11n,HT40,MCS7 |     | —    | 11 —      |
| 6.2 Bluetooth | LE Radio          |     |      |           |
Table6-7. BluetoothLEFrequency
|                  |                                   |     | Min   | Typ Max                     |
| ---------------- | --------------------------------- | --- | ----- | --------------------------- |
|                  | Parameter                         |     | (MHz) | (MHz) (MHz)                 |
|                  | Centerfrequencyofoperatingchannel |     | 2402  | — 2480                      |
| EspressifSystems |                                   | 72  |       | ESP32-S3SeriesDatasheetv2.2 |
SubmitDocumentationFeedback

6 RFCharacteristics
| 6.2.1 Bluetooth | LE RF Transmitter |                                             | (TX) | Characteristics |        |     |     |           |
| --------------- | ----------------- | ------------------------------------------- | ---- | --------------- | ------ | --- | --- | --------- |
|                 | Table6-8.         | TransmitterCharacteristics-BluetoothLE1Mbps |      |                 |        |     |     |           |
| Parameter       |                   | Description                                 |      |                 | Min    | Typ |     | Max Unit  |
|                 |                   | RFpowercontrolrange                         |      |                 | –24.00 |     | 0   | 20.00 dBm |
RFtransmitpower
|     |     | Gaincontrolstep |     |     |     | —   | 3.00 | — dB |
| --- | --- | --------------- | --- | --- | --- | --- | ---- | ---- |
Max|f |
|     |     |     | n   |     |     | —   | 2.50 | — kHz |
| --- | --- | --- | --- | --- | --- | --- | ---- | ----- |
n=0,1,2,..k
|                                |     | Max|f  |     | |     |     |     |      |       |
| ------------------------------ | --- | ------ | --- | ----- | --- | --- | ---- | ----- |
|                                |     |        | 0−f |       |     | —   | 2.00 | — kHz |
| Carrierfrequencyoffsetanddrift |     |        |     | n     |     |     |      |       |
|                                |     | Max|f  | n−f | n−5 | |     | —   | 1.39 | — kHz |
|                                |     | |f 1−f | |   |       |     | —   | 0.80 | — kHz |
0
|     |     | ∆f1 |     |     |     | — 249.00 |     | — kHz |
| --- | --- | --- | --- | --- | --- | -------- | --- | ----- |
avg
|     |     | Min∆f2 |     | (foratleast |     |     |     |     |
| --- | --- | ------ | --- | ----------- | --- | --- | --- | --- |
max
| Modulationcharacteristics |     |     |     |     |     | — 198.00 |     | — kHz |
| ------------------------- | --- | --- | --- | --- | --- | -------- | --- | ----- |
99.9%ofall∆f2
max )
|                          |           | ∆f2                                         | avg /∆f1 | avg |        | —        | 0.86 | — —       |
| ------------------------ | --------- | ------------------------------------------- | -------- | --- | ------ | -------- | ---- | --------- |
|                          |           | ±2MHzoffset                                 |          |     |        | — –37.00 |      | — dBm     |
| In-bandspuriousemissions |           | ±3MHzoffset                                 |          |     |        | — –42.00 |      | — dBm     |
|                          |           | >±3MHzoffset                                |          |     |        | — –44.00 |      | — dBm     |
|                          | Table6-9. | TransmitterCharacteristics-BluetoothLE2Mbps |          |     |        |          |      |           |
| Parameter                |           | Description                                 |          |     | Min    | Typ      |      | Max Unit  |
|                          |           | RFpowercontrolrange                         |          |     | –24.00 |          | 0    | 20.00 dBm |
RFtransmitpower
|     |     | Gaincontrolstep |     |     |     | —   | 3.00 | — dB |
| --- | --- | --------------- | --- | --- | --- | --- | ---- | ---- |
Max|f |
|     |     |     | n   |     |     | —   | 2.50 | — kHz |
| --- | --- | --- | --- | --- | --- | --- | ---- | ----- |
n=0,1,2,..k
|     |     | Max|f |     | |   |     |     |      |       |
| --- | --- | ----- | --- | --- | --- | --- | ---- | ----- |
|     |     |       | 0−f | n   |     | —   | 1.90 | — kHz |
Carrierfrequencyoffsetanddrift
|     |     | Max|f  |     | |   |     |     |      |       |
| --- | --- | ------ | --- | --- | --- | --- | ---- | ----- |
|     |     |        | n−f | n−5 |     | —   | 1.40 | — kHz |
|     |     | |f 1−f | |   |     |     | —   | 1.10 | — kHz |
0
|     |     | ∆f1 |     |     |     | — 499.00 |     | — kHz |
| --- | --- | --- | --- | --- | --- | -------- | --- | ----- |
avg
|     |     | Min∆f2 |     | (foratleast |     |     |     |     |
| --- | --- | ------ | --- | ----------- | --- | --- | --- | --- |
max
| Modulationcharacteristics |     |               |     |     |     | — 416.00 |     | — kHz |
| ------------------------- | --- | ------------- | --- | --- | --- | -------- | --- | ----- |
|                           |     | 99.9%ofall∆f2 |     | )   |     |          |     |       |
max
∆f2 /∆f1
|                          |            |                                               | avg | avg |        | —        | 0.89 | — —       |
| ------------------------ | ---------- | --------------------------------------------- | --- | --- | ------ | -------- | ---- | --------- |
|                          |            | ±4MHzoffset                                   |     |     |        | — –43.80 |      | — dBm     |
| In-bandspuriousemissions |            | ±5MHzoffset                                   |     |     |        | — –45.80 |      | — dBm     |
|                          |            | >±5MHzoffset                                  |     |     |        | — –47.00 |      | — dBm     |
|                          | Table6-10. | TransmitterCharacteristics-BluetoothLE125Kbps |     |     |        |          |      |           |
| Parameter                |            | Description                                   |     |     | Min    | Typ      |      | Max Unit  |
|                          |            | RFpowercontrolrange                           |     |     | –24.00 |          | 0    | 20.00 dBm |
RFtransmitpower
|     |     | Gaincontrolstep |     |     |     | —   | 3.00 | — dB  |
| --- | --- | --------------- | --- | --- | --- | --- | ---- | ----- |
|     |     | Max|f           | |   |     |     | —   | 0.80 | — kHz |
n n=0,1,2,..k
|     |     | Max|f | 0−f | |   |     | —   | 0.98 | — kHz |
| --- | --- | ----- | --- | --- | --- | --- | ---- | ----- |
n
Carrierfrequencyoffsetanddrift
|     |     | |f n−f |     | |   |     | —   | 0.30 | — kHz |
| --- | --- | ------ | --- | --- | --- | --- | ---- | ----- |
n−3
|     |     | |f 0−f | |   |     |     | —   | 1.00 | — kHz |
| --- | --- | ------ | --- | --- | --- | --- | ---- | ----- |
3
Cont’donnextpage
| EspressifSystems |     |     |     | 73  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

6 RFCharacteristics
Table6-10–cont’dfrompreviouspage
| Parameter |     | Description |     |     | Min | Typ      |     | Max | Unit |
| --------- | --- | ----------- | --- | --- | --- | -------- | --- | --- | ---- |
|           |     | ∆f1         |     |     |     | — 248.00 |     | —   | kHz  |
avg
| Modulationcharacteristics |     | Min∆f1 | (foratleast |     |     |     |     |     |     |
| ------------------------- | --- | ------ | ----------- | --- | --- | --- | --- | --- | --- |
max
|                          |            |                                               |     |       |        | — 222.00 |     | —     | kHz  |
| ------------------------ | ---------- | --------------------------------------------- | --- | ----- | ------ | -------- | --- | ----- | ---- |
|                          |            | 99.9%ofall∆f1                                 |     | max ) |        |          |     |       |      |
|                          |            | ±2MHzoffset                                   |     |       |        | — –37.00 |     | —     | dBm  |
| In-bandspuriousemissions |            | ±3MHzoffset                                   |     |       |        | — –42.00 |     | —     | dBm  |
|                          |            | >±3MHzoffset                                  |     |       |        | — –44.00 |     | —     | dBm  |
|                          | Table6-11. | TransmitterCharacteristics-BluetoothLE500Kbps |     |       |        |          |     |       |      |
| Parameter                |            | Description                                   |     |       | Min    | Typ      |     | Max   | Unit |
|                          |            | RFpowercontrolrange                           |     |       | –24.00 |          | 0   | 20.00 | dBm  |
RFtransmitpower
|     |     | Gaincontrolstep |     |     |     | —   | 3.00 | —   | dB  |
| --- | --- | --------------- | --- | --- | --- | --- | ---- | --- | --- |
|     |     | Max|f           | |   |     |     | —   | 0.70 | —   | kHz |
n n=0,1,2,..k
|     |     | Max|f | 0−f | |     |     | —   | 0.90 | —   | kHz |
| --- | --- | ----- | ----- | --- | --- | --- | ---- | --- | --- |
n
Carrierfrequencyoffsetanddrift
|     |     | |f n−f | |   |     |     | —   | 0.85 | —   | kHz |
| --- | --- | ------ | --- | --- | --- | --- | ---- | --- | --- |
n−3
|f 0−f |
|     |     |     | 3   |     |     | —        | 0.34 | —   | kHz |
| --- | --- | --- | --- | --- | --- | -------- | ---- | --- | --- |
|     |     | ∆f2 |     |     |     | — 213.00 |      | —   | kHz |
avg
| Modulationcharacteristics |     | Min∆f2        | (foratleast |     |     |          |     |     |     |
| ------------------------- | --- | ------------- | ----------- | --- | --- | -------- | --- | --- | --- |
|                           |     |               | max         |     |     | — 196.00 |     | —   | kHz |
|                           |     | 99.9%ofall∆f2 |             | )   |     |          |     |     |     |
max
|                                |                | ±2MHzoffset                              |                      |     |     | — –37.00 |       | —   | dBm  |
| ------------------------------ | -------------- | ---------------------------------------- | -------------------- | --- | --- | -------- | ----- | --- | ---- |
| In-bandspuriousemissions       |                | ±3MHzoffset                              |                      |     |     | — –42.00 |       | —   | dBm  |
|                                |                | >±3MHzoffset                             |                      |     |     | — –44.00 |       | —   | dBm  |
| 6.2.2 Bluetooth                | LE RF Receiver |                                          | (RX) Characteristics |     |     |          |       |     |      |
|                                | Table6-12.     | ReceiverCharacteristics-BluetoothLE1Mbps |                      |     |     |          |       |     |      |
| Parameter                      |                |                                          | Description          |     |     | Min      | Typ   | Max | Unit |
| Sensitivity@30.8%PER           |                |                                          | —                    |     |     | —        | –97.5 | —   | dBm  |
| Maximumreceivedsignal@30.8%PER |                |                                          | —                    |     |     | —        | 8     | —   | dBm  |
| Co-channelC/I                  |                |                                          | F=F0MHz              |     |     | —        | 9     | —   | dB   |
|                                |                |                                          | F=F0+1MHz            |     |     | —        | –3    | —   | dB   |
|                                |                |                                          | F=F0–1MHz            |     |     | —        | –3    | —   | dB   |
–28
|     |     |     | F=F0+2MHz |     |     | —   |     | —   | dB  |
| --- | --- | --- | --------- | --- | --- | --- | --- | --- | --- |
|     |     |     | F=F0–2MHz |     |     | —   | –30 | —   | dB  |
AdjacentchannelselectivityC/I
|                |     |     | F=F0+3MHz |       |     | —   | –31 | —   | dB  |
| -------------- | --- | --- | --------- | ----- | --- | --- | --- | --- | --- |
|                |     |     | F=F0–3MHz |       |     | —   | –33 | —   | dB  |
|                |     |     | F>F0+3MHz |       |     | —   | –32 | —   | dB  |
|                |     |     | F>F0–3MHz |       |     | —   | –36 | —   | dB  |
| Imagefrequency |     |     | —         |       |     | —   | –32 | —   | dB  |
|                |     |     | F=F       | +1MHz |     | —   | –39 | —   | dB  |
image
Adjacentchanneltoimagefrequency
–31
|     |     |     | F=F image | –1MHz |     | —   |     | —   | dB  |
| --- | --- | --- | --------- | ----- | --- | --- | --- | --- | --- |
Cont’donnextpage
| EspressifSystems |     |     |     | 74  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |     |
| ---------------- | --- | --- | --- | --- | --- | --------------------------- | --- | --- | --- |
SubmitDocumentationFeedback

6 RFCharacteristics
Table6-12–cont’dfrompreviouspage
| Parameter | Description     | Min Typ | Max Unit |
| --------- | --------------- | ------- | -------- |
|           | 30MHz~2000MHz   | — –9    | — dBm    |
|           | 2003MHz~2399MHz | — –19   | — dBm    |
Out-of-bandblockingperformance
|                 | 2484MHz~2997MHz  | — –16 | — dBm |
| --------------- | ---------------- | ----- | ----- |
|                 | 3000MHz~12.75GHz | — –5  | — dBm |
| Intermodulation | —                | — –31 | — dBm |
Table6-13. ReceiverCharacteristics-BluetoothLE2Mbps
| Parameter                      | Description | Min Typ | Max Unit |
| ------------------------------ | ----------- | ------- | -------- |
| Sensitivity@30.8%PER           | —           | — –93.5 | — dBm    |
| Maximumreceivedsignal@30.8%PER | —           | — 3     | — dBm    |
| Co-channelC/I                  | F=F0MHz     | — 10    | — dB     |
|                                | F=F0+2MHz   | — –8    | — dB     |
|                                | F=F0–2MHz   | — –5    | — dB     |
|                                | F=F0+4MHz   | — –31   | — dB     |
|                                | F=F0–4MHz   | — –33   | — dB     |
AdjacentchannelselectivityC/I
|                                 | F=F0+6MHz | — –37 | — dB |
| ------------------------------- | --------- | ----- | ---- |
|                                 | F=F0–6MHz | — –37 | — dB |
|                                 | F>F0+6MHz | — –40 | — dB |
|                                 | F>F0–6MHz | –40   |      |
|                                 |           | —     | — dB |
| Imagefrequency                  | —         | — –31 | — dB |
|                                 | F=F +2MHz | — –37 | — dB |
| Adjacentchanneltoimagefrequency | image     |       |      |
|                                 | F=F –2MHz | — –8  | — dB |
image
|     | 30MHz~2000MHz   | — –16 | — dBm |
| --- | --------------- | ----- | ----- |
|     | 2003MHz~2399MHz | — –20 | — dBm |
Out-of-bandblockingperformance
|     | 2484MHz~2997MHz | — –16 | — dBm |
| --- | --------------- | ----- | ----- |
–16
|                 | 3000MHz~12.75GHz | —     | — dBm |
| --------------- | ---------------- | ----- | ----- |
| Intermodulation | —                | — –30 | — dBm |
Table6-14. ReceiverCharacteristics-BluetoothLE125Kbps
| Parameter                      | Description | Min Typ  | Max Unit |
| ------------------------------ | ----------- | -------- | -------- |
| Sensitivity@30.8%PER           | —           | — –104.5 | — dBm    |
| Maximumreceivedsignal@30.8%PER | —           | — 8      | — dBm    |
| Co-channelC/I                  | F=F0MHz     | — 6      | — dB     |
|                                | F=F0+1MHz   | — –6     | — dB     |
|                                | F=F0–1MHz   | — –5     | — dB     |
|                                | F=F0+2MHz   | — –32    | — dB     |
|                                | F=F0–2MHz   | — –39    | — dB     |
AdjacentchannelselectivityC/I
|     | F=F0+3MHz | — –35 | — dB |
| --- | --------- | ----- | ---- |
|     | F=F0–3MHz | — –45 | — dB |
|     | F>F0+3MHz | — –35 | — dB |
Cont’donnextpage
| EspressifSystems | 75  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

6 RFCharacteristics
Table6-14–cont’dfrompreviouspage
| Parameter      | Description     | Min Typ | Max Unit |
| -------------- | --------------- | ------- | -------- |
|                | F>F0–3MHz       | — –48   | — dB     |
| Imagefrequency | —               | — –35   | — dB     |
|                | F=F image +1MHz | — –49   | — dB     |
Adjacentchanneltoimagefrequency
|     | F=F image –1MHz | — –32 | — dB |
| --- | --------------- | ----- | ---- |
Table6-15. ReceiverCharacteristics-BluetoothLE500Kbps
| Parameter                      | Description | Min Typ | Max Unit |
| ------------------------------ | ----------- | ------- | -------- |
| Sensitivity@30.8%PER           | —           | — –101  | — dBm    |
| Maximumreceivedsignal@30.8%PER | —           | — 8     | — dBm    |
| Co-channelC/I                  | F=F0MHz     | — 4     | — dB     |
|                                | F=F0+1MHz   | — –5    | — dB     |
|                                | F=F0–1MHz   | — –5    | — dB     |
|                                | F=F0+2MHz   | — –28   | — dB     |
|                                | F=F0–2MHz   | — –36   | — dB     |
AdjacentchannelselectivityC/I
|                                 | F=F0+3MHz | — –36 | — dB |
| ------------------------------- | --------- | ----- | ---- |
|                                 | F=F0–3MHz | — –38 | — dB |
|                                 | F>F0+3MHz | — –37 | — dB |
|                                 | F>F0–3MHz | — –41 | — dB |
| Imagefrequency                  | —         | — –37 | — dB |
|                                 | F=F +1MHz | — –44 | — dB |
| Adjacentchanneltoimagefrequency | image     |       |      |
|                                 | F=F –1MHz | — –28 | — dB |
image
| EspressifSystems | 76  | ESP32-S3SeriesDatasheetv2.2 |     |
| ---------------- | --- | --------------------------- | --- |
SubmitDocumentationFeedback

7 Packaging
7 Packaging
• Forinformationabouttape,reel,andproductmarking,pleasereferto
ESP32-S3ChipPackagingInformation.
• Thepinsofthechiparenumberedinanti-clockwiseorderstartingfromPin1inthetopview. Forpin
numbersandpinnames,seealsoFigure2-1ESP32-S3PinLayout(TopView).
• Therecommendedlandpatternsourcefile(asc)isavailablefordownload. Youcanimportthefilewith
softwaresuchasPADSandAltiumDesigner.
• AllESP32-S3chipvariantshaveidenticallandpattern(seeFigure7-1)exceptESP32-S3FH4R2hasa
biggerEPAD(seeFigure7-2). Thesourcefile(asc)maybeadoptedforESP32-S3FH4R2byalteringthe
sizeoftheEPAD(seedimensionsD2andE2inFigure7-2).
Pin 1 Pin 1
Pin 2 Pin 2
Pin 3 Pin 3
Figure7-1. QFN56(7×7mm)Package
EspressifSystems 77 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

7 Packaging
(cid:18)(cid:21)
(cid:1239)(cid:2801)(cid:3910)(cid:5522)(cid:3374)
(cid:36)(cid:40)(cid:53)(cid:36)(cid:3)(cid:40)(cid:53)(cid:56)(cid:55)(cid:36)(cid:49)(cid:42)(cid:44)(cid:54)
(cid:7420)(cid:4299)(cid:1931)(cid:5107)
FOREHOPE ELECTRONIC
(cid:41)(cid:50)(cid:53)(cid:40)(cid:43)(cid:50)(cid:51)(cid:40)(cid:3)(cid:38)(cid:50)(cid:49)(cid:41)(cid:44)(cid:39)(cid:40)(cid:49)(cid:55)(cid:44)(cid:36)(cid:47)(cid:16)(cid:37)
(cid:17)(cid:71)(cid:72)(cid:87)(cid:76)(cid:69)(cid:76)(cid:75)(cid:82)(cid:85)(cid:83)(cid:3)(cid:72)(cid:85)(cid:68)(cid:3)(cid:81)(cid:82)(cid:76)(cid:87)(cid:70)(cid:88)(cid:71)(cid:82)(cid:85)(cid:83)(cid:72)(cid:85)(cid:3)(cid:71)(cid:81)(cid:68)(cid:3)(cid:72)(cid:86)(cid:88)(cid:3)(cid:71)(cid:72)(cid:93)(cid:76)(cid:85)(cid:82)(cid:75)(cid:87)(cid:88)(cid:68)(cid:81)(cid:88)(cid:3)(cid:79)(cid:79)(cid:68)(cid:3)(cid:71)(cid:81)(cid:68)(cid:3)(cid:72)(cid:83)(cid:82)(cid:75)(cid:72)(cid:85)(cid:82)(cid:41)(cid:3)(cid:73)(cid:82)(cid:3)(cid:92)(cid:87)(cid:85)(cid:72)(cid:83)(cid:82)(cid:85)(cid:83)(cid:3)(cid:72)(cid:75)(cid:87)(cid:3)(cid:72)(cid:85)(cid:68)(cid:3)(cid:81)(cid:76)(cid:72)(cid:85)(cid:72)(cid:75)(cid:3)(cid:81)(cid:82)(cid:76)(cid:87)(cid:68)(cid:80)(cid:85)(cid:82)(cid:73)(cid:81)(cid:76)(cid:3)(cid:86)(cid:87)(cid:76)(cid:3)(cid:71)(cid:81)(cid:68)(cid:3)(cid:87)(cid:81)(cid:72)(cid:80)(cid:88)(cid:70)(cid:82)(cid:71)(cid:3)(cid:86)(cid:76)(cid:75)(cid:55)
(cid:103)
(cid:51)(cid:68)(cid:71)(cid:85)(cid:68)(cid:76)(cid:70)(cid:3)(cid:21)(cid:19)(cid:21)(cid:20)(cid:17)(cid:20)(cid:19)(cid:17)(cid:20)(cid:21)
(cid:54)(cid:75)(cid:68)(cid:90)(cid:81)(cid:3)(cid:21)(cid:19)(cid:21)(cid:20)(cid:17)(cid:20)(cid:19)(cid:17)(cid:20)(cid:21)
(cid:52)(cid:41)(cid:49)(cid:58)(cid:37)(cid:16)(cid:26)(cid:104)(cid:26)(cid:16)(cid:24)(cid:25)(cid:47)(cid:16)(cid:37) (cid:16)(cid:16) (cid:36)
(cid:11)(cid:51)(cid:19)(cid:17)(cid:23)(cid:3)(cid:3)(cid:55)(cid:19)(cid:17)(cid:27)(cid:24)(cid:12)
(cid:20)(cid:3)(cid:3)(cid:50)(cid:41)(cid:3)(cid:3)(cid:21) (cid:20)(cid:24)(cid:29)(cid:20)
Figure7-2. QFN56(7×7mm)Package(OnlyforESP32-S3FH4R2)
EspressifSystems 78 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

EspressifSystems ESP32-S3ConsolidatedPinOverview
| ESP32-S3 | Consolidated | Pin Overview |                  |                         |     |     |               |
| -------- | ------------ | ------------ | ---------------- | ----------------------- | --- | --- | ------------- |
|          |              |              | Table7-1.        | ConsolidatedPinOverview |     |     |               |
|          |              | PinSettings  | RTCIOMUXFunction | AnalogFunction          |     |     | IOMUXFunction |
PinNo. PinName PinType PinProvidingPower AtReset AfterReset F0 F3 F0 F1 F0 Type F1 Type F2 Type F3 Type F4 Type
| 1 LNA_IN  | Analog            |     |     |     |     |     |     |
| --------- | ----------------- | --- | --- | --- | --- | --- | --- |
| 2 VDD3P3  | Power             |     |     |     |     |     |     |
| 3 VDD3P3  | Power             |     |     |     |     |     |     |
| 4 CHIP_PU | Analog VDD3P3_RTC |     |     |     |     |     |     |
5 GPIO0 IO VDD3P3_RTC WPU,IE WPU,IE RTC_GPIO0 sar_i2c_scl_0 GPIO0 I/O/T GPIO0 I/O/T
6 GPIO1 IO VDD3P3_RTC IE IE RTC_GPIO1 sar_i2c_sda_0 TOUCH1 ADC1_CH0 GPIO1 I/O/T GPIO1 I/O/T
7 GPIO2 IO VDD3P3_RTC IE IE RTC_GPIO2 sar_i2c_scl_1 TOUCH2 ADC1_CH1 GPIO2 I/O/T GPIO2 I/O/T
8 GPIO3 IO VDD3P3_RTC IE IE RTC_GPIO3 sar_i2c_sda_1 TOUCH3 ADC1_CH2 GPIO3 I/O/T GPIO3 I/O/T
9 GPIO4 IO VDD3P3_RTC RTC_GPIO4 TOUCH4 ADC1_CH3 GPIO4 I/O/T GPIO4 I/O/T
10 GPIO5 IO VDD3P3_RTC RTC_GPIO5 TOUCH5 ADC1_CH4 GPIO5 I/O/T GPIO5 I/O/T
11 GPIO6 IO VDD3P3_RTC RTC_GPIO6 TOUCH6 ADC1_CH5 GPIO6 I/O/T GPIO6 I/O/T
12 GPIO7 IO VDD3P3_RTC RTC_GPIO7 TOUCH7 ADC1_CH6 GPIO7 I/O/T GPIO7 I/O/T
13 GPIO8 IO VDD3P3_RTC RTC_GPIO8 TOUCH8 ADC1_CH7 GPIO8 I/O/T GPIO8 I/O/T SUBSPICS1 O/T
14 GPIO9 IO VDD3P3_RTC IE RTC_GPIO9 TOUCH9 ADC1_CH8 GPIO9 I/O/T GPIO9 I/O/T SUBSPIHD I1/O/T FSPIHD I1/O/T
15 GPIO10 IO VDD3P3_RTC IE RTC_GPIO10 TOUCH10 ADC1_CH9 GPIO10 I/O/T GPIO10 I/O/T FSPIIO4 I1/O/T SUBSPICS0 O/T FSPICS0 I1/O/T
16 GPIO11 IO VDD3P3_RTC IE RTC_GPIO11 TOUCH11 ADC2_CH0 GPIO11 I/O/T GPIO11 I/O/T FSPIIO5 I1/O/T SUBSPID I1/O/T FSPID I1/O/T
SubmitDocumentationFeedback 17 GPIO12 IO VDD3P3_RTC IE RTC_GPIO12 TOUCH12 ADC2_CH1 GPIO12 I/O/T GPIO12 I/O/T FSPIIO6 I1/O/T SUBSPICLK O/T FSPICLK I1/O/T
18 GPIO13 IO VDD3P3_RTC IE RTC_GPIO13 TOUCH13 ADC2_CH2 GPIO13 I/O/T GPIO13 I/O/T FSPIIO7 I1/O/T SUBSPIQ I1/O/T FSPIQ I1/O/T
19 GPIO14 IO VDD3P3_RTC IE RTC_GPIO14 TOUCH14 ADC2_CH3 GPIO14 I/O/T GPIO14 I/O/T FSPIDQS O/T SUBSPIWP I1/O/T FSPIWP I1/O/T
| 20 VDD3P3_RTC | Power |     |     |     |     |     |     |
| ------------- | ----- | --- | --- | --- | --- | --- | --- |
21 XTAL_32K_P IO VDD3P3_RTC RTC_GPIO15 XTAL_32K_P ADC2_CH4 GPIO15 I/O/T GPIO15 I/O/T U0RTS O
22 XTAL_32K_N IO VDD3P3_RTC RTC_GPIO16 XTAL_32K_N ADC2_CH5 GPIO16 I/O/T GPIO16 I/O/T U0CTS I1
23 GPIO17 IO VDD3P3_RTC IE RTC_GPIO17 ADC2_CH6 GPIO17 I/O/T GPIO17 I/O/T U1TXD O
24 GPIO18 IO VDD3P3_RTC IE RTC_GPIO18 ADC2_CH7 GPIO18 I/O/T GPIO18 I/O/T U1RXD I1 CLK_OUT3 O
25 GPIO19 IO VDD3P3_RTC RTC_GPIO19 USB_D- ADC2_CH8 GPIO19 I/O/T GPIO19 I/O/T U1RTS O CLK_OUT2 O
79
26 GPIO20 IO VDD3P3_RTC USB_PU USB_PU RTC_GPIO20 USB_D+ ADC2_CH9 GPIO20 I/O/T GPIO20 I/O/T U1CTS I1 CLK_OUT1 O
| 27 GPIO21  | IO VDD3P3_RTC |               | RTC_GPIO21 |     | GPIO21 I/O/T | GPIO21 I/O/T |     |
| ---------- | ------------- | ------------- | ---------- | --- | ------------ | ------------ | --- |
| 28 SPICS1  | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPICS1 O/T   | GPIO26 I/O/T |     |
| 29 VDD_SPI | Power         |               |            |     |              |              |     |
| 30 SPIHD   | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPIHD I1/O/T | GPIO27 I/O/T |     |
| 31 SPIWP   | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPIWP I1/O/T | GPIO28 I/O/T |     |
| 32 SPICS0  | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPICS0 O/T   | GPIO29 I/O/T |     |
| 33 SPICLK  | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPICLK O/T   | GPIO30 I/O/T |     |
| 34 SPIQ    | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPIQ I1/O/T  | GPIO31 I/O/T |     |
| 35 SPID    | IO VDD_SPI    | WPU,IE WPU,IE |            |     | SPID I1/O/T  | GPIO32 I/O/T |     |
36 SPICLK_N IO VDD_SPI/VDD3P3_CPU IE IE SPICLK_P_DIFF O/T GPIO48 I/O/T SUBSPICLK_P_DIFF O/T
37 SPICLK_P IO VDD_SPI/VDD3P3_CPU IE IE SPICLK_N_DIFF O/T GPIO47 I/O/T SUBSPICLK_N_DIFF O/T
38 GPIO33 IO VDD_SPI/VDD3P3_CPU IE GPIO33 I/O/T GPIO33 I/O/T FSPIHD I1/O/T SUBSPIHD I1/O/T SPIIO4 I1/O/T
39 GPIO34 IO VDD_SPI/VDD3P3_CPU IE GPIO34 I/O/T GPIO34 I/O/T FSPICS0 I1/O/T SUBSPICS0 O/T SPIIO5 I1/O/T
40 GPIO35 IO VDD_SPI/VDD3P3_CPU IE GPIO35 I/O/T GPIO35 I/O/T FSPID I1/O/T SUBSPID I1/O/T SPIIO6 I1/O/T
ESP32-S3SeriesDatasheetv2.2
41 GPIO36 IO VDD_SPI/VDD3P3_CPU IE GPIO36 I/O/T GPIO36 I/O/T FSPICLK I1/O/T SUBSPICLK O/T SPIIO7 I1/O/T
42 GPIO37 IO VDD_SPI/VDD3P3_CPU IE GPIO37 I/O/T GPIO37 I/O/T FSPIQ I1/O/T SUBSPIQ I1/O/T SPIDQS I0/O/T
43 GPIO38 IO VDD3P3_CPU IE GPIO38 I/O/T GPIO38 I/O/T FSPIWP I1/O/T SUBSPIWP I1/O/T
44 MTCK IO VDD3P3_CPU IE MTCK I1 GPIO39 I/O/T CLK_OUT3 O SUBSPICS1 O/T
| 45 MTDO       | IO VDD3P3_CPU | IE  |     |     | MTDO O/T | GPIO40 I/O/T | CLK_OUT2 O |
| ------------- | ------------- | --- | --- | --- | -------- | ------------ | ---------- |
| 46 VDD3P3_CPU | Power         |     |     |     |          |              |            |
| 47 MTDI       | IO VDD3P3_CPU | IE  |     |     | MTDI I1  | GPIO41 I/O/T | CLK_OUT1 O |
| 48 MTMS       | IO VDD3P3_CPU | IE  |     |     | MTMS I1  | GPIO42 I/O/T |            |
49 U0TXD IO VDD3P3_CPU WPU,IE WPU,IE U0TXD O GPIO43 I/O/T CLK_OUT1 O
50 U0RXD IO VDD3P3_CPU WPU,IE WPU,IE U0RXD I1 GPIO44 I/O/T CLK_OUT2 O
51 GPIO45 IO VDD3P3_CPU WPD,IE WPD,IE GPIO45 I/O/T GPIO45 I/O/T
52 GPIO46 IO VDD3P3_CPU WPD,IE WPD,IE GPIO46 I/O/T GPIO46 I/O/T
| 53 XTAL_N                             | Analog                                                             |     |     |     |     |     |     |
| ------------------------------------- | ------------------------------------------------------------------ | --- | --- | --- | --- | --- | --- |
| 54 XTAL_P                             | Analog                                                             |     |     |     |     |     |     |
| 55 VDDA                               | Power                                                              |     |     |     |     |     |     |
| 56 VDDA                               | Power                                                              |     |     |     |     |     |     |
| 57 GND                                | Power                                                              |     |     |     |     |     |     |
| *Fordetails,seeSection2Pins.Regarding | highlighted cells,seeSection2.3.4RestrictionsforGPIOsandRTC_GPIOs. |     |     |     |     |     |     |

DatasheetVersioning
| Datasheet | Versioning |     |     |     |
| --------- | ---------- | --- | --- | --- |
Datasheet
|     | Status | Watermark | Definition |     |
| --- | ------ | --------- | ---------- | --- |
Version
Thisdatasheetisunderdevelopmentforproducts
v0.1~v0.5
|     | Draft | Confidential | inthedesignstage. | Specificationsmaychange |
| --- | ----- | ------------ | ----------------- | ----------------------- |
(excludingv0.5)
withoutpriornotice.
Thisdatasheetisactivelyupdatedforproductsin
v0.5~v1.0 Preliminary theverificationstage. Specificationsmaychange
Preliminary
(excludingv1.0) release beforemassproduction,andthechangeswillbe
documentationinthedatasheet’sRevisionHistory.
Thisdatasheetispubliclyreleasedforproductsin
|               |                 |     | massproduction. | Specificationsarefinalized,and |
| ------------- | --------------- | --- | --------------- | ------------------------------ |
| v1.0andhigher | Officialrelease | —   |                 |                                |
majorchangeswillbecommunicatedviaProduct
ChangeNotifications(PCN).
Not
|            |     | Recommended  | Thisdatasheetisupdatedlessfrequentlyfor |     |
| ---------- | --- | ------------ | --------------------------------------- | --- |
| Anyversion | —   |              |                                         |     |
|            |     | forNewDesign | productsnotrecommendedfornewdesigns.    |     |
1
(NRND)
|            |     | EndofLife | Thisdatasheetisnolongermtainedforproducts |     |
| ---------- | --- | --------- | ----------------------------------------- | --- |
| Anyversion | —   |           |                                           |     |
|            |     | (EOL) 2   | thathavereachedendoflife.                 |     |
1 Watermark will be added to the datasheet title page only when all the product variants covered by this
datasheetarenotrecommendedfornewdesigns.
2
Watermark will be added to the datasheet title page only when all the product variants covered by this
datasheethavereachedendoflife.
| EspressifSystems |     |     | 80  | ESP32-S3SeriesDatasheetv2.2 |
| ---------------- | --- | --- | --- | --------------------------- |
SubmitDocumentationFeedback

Glossary
Glossary
module
Aself-containedunitintegratedwithinthechiptoextenditscapabilities,suchascryptographicmodules,
RFmodules2
peripheral
Ahardwarecomponentorsubsystemwithinthechiptointerfacewiththeoutsideworld2
in-packageflash
Flashintegrateddirectlyintothechip’spackage,andexternaltothechipdie4,13
off-packageflash
Flashexternaltothechip’spackage20
strappingpin
AtypeofGPIOpinusedtoconfigurecertainoperationalsettingsduringthechip’spower-up,andcanbe
reconfiguredasnormalGPIOafterthechip’sreset32
eFuseparameter
Aparameterstoredinanelectricallyprogrammablefuse(eFuse)memorywithinachip. Theparameter
canbesetbyprogrammingEFUSE_PGM_DATAn_REGregisters,andreadbyreadingaregisterfield
namedaftertheparameter32
SPIbootmode
AbootmodeinwhichusersloadandexecutetheexistingcodefromSPIflash33
jointdownloadbootmode
AbootmodeinwhichuserscandownloadcodeintoflashviatheUARTorotherinterfaces(seeTable3-3
ChipBootModeControl>Note),andloadandexecutethedownloadedcodefromtheflashorSRAM33
eFuse
Aone-timeprogrammable(OTP)memorywhichstoressystemanduserparameters,suchasMAC
address,chiprevisionnumber,flashencryptionkey,etc. Value0indicatesthedefaultstate,andvalue1
indicatestheeFusehasbeenprogrammed39
EspressifSystems 81 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

RelatedDocumentationandResources
Related Documentation and Resources
Related Documentation
• ESP32-S3TechnicalReferenceManual–DetailedinformationonhowtousetheESP32-S3memoryandperiph-
erals.
• ESP32-S3HardwareDesignGuidelines–GuidelinesonhowtointegratetheESP32-S3intoyourhardwareprod-
uct.
• ESP32-S3SeriesSoCErrata–DescriptionsofknownerrorsinESP32-S3seriesofSoCs.
• Certificates
https://espressif.com/en/support/documents/certificates
• ESP32-S3Product/ProcessChangeNotifications(PCN)
https://espressif.com/en/support/documents/pcns?keys=ESP32-S3
• ESP32-S3Advisories–Informationonsecurity,bugs,compatibility,componentreliability.
https://espressif.com/en/support/documents/advisories?keys=ESP32-S3
• DocumentationUpdatesandUpdateNotificationSubscription
https://espressif.com/en/support/download/documents
Developer Zone
• ESP-IDFProgrammingGuideforESP32-S3–ExtensivedocumentationfortheESP-IDFdevelopmentframework.
• ESP-IDF andotherdevelopmentframeworksonGitHub.
https://github.com/espressif
• ESP32BBSForum–Engineer-to-Engineer(E2E)CommunityforEspressifproductswhereyoucanpostquestions,
shareknowledge,exploreideas,andhelpsolveproblemswithfellowengineers.
https://esp32.com/
• ESP-FAQ–AsummarydocumentoffrequentlyaskedquestionsreleasedbyEspressif.
https://espressif.com/projects/esp-faq/en/latest/index.html
• TheESPJournal–BestPractices,Articles,andNotesfromEspressiffolks.
https://blog.espressif.com/
• SeethetabsSDKsandDemos,Apps,Tools,ATFirmware.
https://espressif.com/en/support/download/sdks-demos
Products
• ESP32-S3SeriesSoCs–BrowsethroughallESP32-S3SoCs.
https://espressif.com/en/products/socs?id=ESP32-S3
• ESP32-S3SeriesModules–BrowsethroughallESP32-S3-basedmodules.
https://espressif.com/en/products/modules?id=ESP32-S3
• ESP32-S3SeriesDevKits–BrowsethroughallESP32-S3-baseddevkits.
https://espressif.com/en/products/devkits?id=ESP32-S3
• ESPProductSelector–FindanEspressifhardwareproductsuitableforyourneedsbycomparingorapplyingfilters.
https://products.espressif.com/#/product-selector?language=en
Contact Us
• SeethetabsSalesQuestions,TechnicalEnquiries,CircuitSchematic&PCBDesignReview,GetSamples
(Onlinestores),BecomeOurSupplier,Comments&Suggestions.
https://espressif.com/en/contact-us/sales-questions
EspressifSystems 82 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

RevisionHistory
Revision History
Date Version Releasenotes
• RenamedtheDigitalSignaturemoduleto“RSADigitalSignaturePeripheral
(RSA_DS)”
• UpdatedFigure4-1AddressMappingStructure
2026-03-05 v2.2
• AddedanoteinSection4.2.1.9SD/MMCHostController
• Updatedtable5-10CurrentConsumptioninLow-PowerModes
• UpdatedthestatusofESP32-S3R2toEndofLifeandaddedchipvariant
ESP32-S3RH2
• Updated“OrderingCode”to“PartNumber”inTable1-1ESP32-S3Series
Comparison
• AddedSection1.3ChipRevisionandchipversioninformationinTable1-1
ESP32-S3SeriesComparison
• AddedSection2.3.5PeripheralPinAssignmentandupdatedthePinAs-
signmentpartforeachsubsectioninSection4.2Peripherals
2025-11-28 v2.1
• Updated Figure 3-1 Visualization of Timing Parameters for the Strapping
Pins
• AddedSection5.7MemorySpecifications
• Added Table 5-8 Current Consumption for Bluetooth LE in Active Mode
inSection5.6CurrentConsumption
• AddedAppendixDatasheetStatusDefinitionsandGlossary
• Otherstructural,formatting,andcontentimprovements
• UpdatedthestatusofESP32-S3R8VtoEndofLife
• UpdatedtheCoreMark® scoreinSectionCPUandMemory
• Updated Figure 4.1.2 Memory Organization in Section 4-1 Address Map-
pingStructure
• Updatedthetemperaturesensor’smeasurementrangeinSection4.2.2.2
2025-04-24 v2.0
TemperatureSensor
• AddedsomenotesinChapter6RFCharacteristics
• UpdatedthesourcefilelinkfortherecommendedlandpatterninChapter
7Packaging
Cont’donnextpage
EspressifSystems 83 ESP32-S3SeriesDatasheetv2.2
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
| Date | Version | Releasenotes |     |     |     |     |     |     |     |     |
| ---- | ------- | ------------ | --- | --- | --- | --- | --- | --- | --- | --- |
•
Updateddescriptionsonthetitlepage
•
UpdatedfeaturedescriptionsinSectionFeaturesandadjustedtheformat
•
|     |     | Updated | the pin | introduction |     | in Section | 2.2 Pin | Overview | and | adjusted |
| --- | --- | ------- | ------- | ------------ | --- | ---------- | ------- | -------- | --- | -------- |
theformat
• UpdateddescriptionsinSection2.3IOPins,anddividedSectionRTCand
|            |      | Analog | Pin Functions |     | into Section | 2.3.3 | Analog | Functions | and | Section |
| ---------- | ---- | ------ | ------------- | --- | ------------ | ----- | ------ | --------- | --- | ------- |
| 2024-09-11 | v1.9 |        |               |     |              |       |        |           |     |         |
2.3.2RTCFunctions
• UpdatedSectionStrappingPinstoSection3BootConfigurations
• AdjustedthestructureandsectionorderinSection4FunctionalDescrip-
|     |     | tion, | deleted Section |     | Peripheral | Pin | Configurations, | and | added | the Pin |
| --- | --- | ----- | --------------- | --- | ---------- | --- | --------------- | --- | ----- | ------- |
AssignmentpartineachsubsectioninSection4.2Peripherals
• AddedchipvariantESP32-S3R16Vandupdatedrelatedinformation
|     |     | • Added | the second | and | third | table | notes in Table | 1-1 | ESP32-S3 | Series |
| --- | --- | ------- | ---------- | --- | ----- | ----- | -------------- | --- | -------- | ------ |
Comparison
| 2023-11-24 | v1.8 | •   |     |     |     |     |     |     |     |     |
| ---------- | ---- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
UpdatedSection3.1ChipBootModeControl
•
UpdatedSection5.5ADCCharacteristics
•
Otherminorupdates
• RemovedthesamplestatusforESP32-S3FH4R2
• UpdatedFigureESP32-S3FunctionalBlockDiagramandFigure4-2Com-
ponentsandPowerDomains
•
AddedthepredefinedsettingsatresetandafterresetforGPIO20inTable
2-1PinOverview
•
UpdatednotesforTable2-4IOMUXFunctions
| 2023-06 | v1.7 |           |     |       |                 |     |                  |     |     |            |
| ------- | ---- | --------- | --- | ----- | --------------- | --- | ---------------- | --- | --- | ---------- |
|         |      | • Updated | the | clock | name “FOSC_CLK” |     | to “RC_FAST_CLK” |     |     | in Section |
4.1.3.5PowerManagementUnit(PMU)
|     |     | • Updated | descriptions |     | in Section | 4.2.1.5 | Serial Peripheral |     | Interface | (SPI) |
| --- | --- | --------- | ------------ | --- | ---------- | ------- | ----------------- | --- | --------- | ----- |
andSection4.1.4.3RSAAccelerator
• Otherminorupdates
Cont’donnextpage
| EspressifSystems |     |     |     | 84  |     |     | ESP32-S3SeriesDatasheetv2.2 |     |     |     |
| ---------------- | --- | --- | --- | --- | --- | --- | --------------------------- | --- | --- | --- |
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
| Date | Version | Releasenotes |     |     |     |     |     |
| ---- | ------- | ------------ | --- | --- | --- | --- | --- |
•
Improvedthecontentinthefollowingsections:
|         |      | –   | SectionProductOverview                       |     |     |     |     |
| ------- | ---- | --- | -------------------------------------------- | --- | --- | --- | --- |
|         |      | –   | Section2Pins                                 |     |     |     |     |
|         |      | –   | Section4.1.3.5PowerManagementUnit(PMU)       |     |     |     |     |
|         |      | –   | Section4.2.1.5SerialPeripheralInterface(SPI) |     |     |     |     |
|         |      | –   | Section5.1AbsoluteMaximumRatings             |     |     |     |     |
|         |      | –   | Section5.2RecommendedOperatingConditions     |     |     |     |     |
|         |      | –   | Section5.3VDD_SPIOutputCharacteristics       |     |     |     |     |
| 2023-02 | v1.6 | –   | Section5.5ADCCharacteristics                 |     |     |     |     |
•
AddedESP32-S3ConsolidatedPinOverview
•
UpdatedthenotesinSection1ESP32-S3SeriesComparisonandSection
7Packaging
•
UpdatedtheeffectivemeasurementrangeinTable5-5ADCCharacteris-
tics
• UpdatedtheBluetoothmaximumtransmitpower
• Otherminorupdates
•
Removedthe“ExternalPAissupported”featurefromSectionFeatures
|         |      | •            |             |             |                   |          | ∼   |
| ------- | ---- | ------------ | ----------- | ----------- | ----------------- | -------- | --- |
|         |      | Updated      | the ambient | temperature | for ESP32-S3FH4R2 | from –40 | 105 |
| 2022-12 | v1.5 | °Cto–40∼85°C |             |             |                   |          |     |
• AddedtwonotesinSection7
•
AddedthepackageinformationforESP32-S3FH4R2inSection7
•
AddedESP32-S3SeriesSoCErratainSection
| 2022-11 | v1.4 |     |     |     |     |     |     |
| ------- | ---- | --- | --- | --- | --- | --- | --- |
•
Otherminorupdates
• AddedanoteaboutthemaximumambienttemperatureofR8serieschips
toTable1-1andTable5-2
•
Addedinformationaboutpower-upglitchesforsomepinsinSection2.2
•
AddedtheinformationaboutVDD3P3powerpinstoTable2.2andSec-
tion2.5.2
| 2022-09 | v1.3 | • Updatedsection4.3.3.1 |     |     |     |     |     |
| ------- | ---- | ----------------------- | --- | --- | --- | --- | --- |
• AddedthefourthnoteinTable2-1
|     |     | • Updated | the minimum | and maximum | values of Bluetooth | LE RF | transmit |
| --- | --- | --------- | ----------- | ----------- | ------------------- | ----- | -------- |
powerinSection6.2.1
• Otherminorupdates
• UpdateddescriptionofROMcodeprintinginSection3
• UpdatedFigureESP32-S3FunctionalBlockDiagram
| 2022-07 | v1.2 | • UpdateSection5.6 |     |     |     |     |     |
| ------- | ---- | ------------------ | --- | --- | --- | --- | --- |
• DeletedthehyperlinksinApplication
Cont’donnextpage
| EspressifSystems |     |     | 85  |     | ESP32-S3SeriesDatasheetv2.2 |     |     |
| ---------------- | --- | --- | --- | --- | --------------------------- | --- | --- |
SubmitDocumentationFeedback

RevisionHistory
Cont’dfrompreviouspage
Date Version Releasenotes
• SynchronizedeFusesizethroughout
• UpdatedpindescriptioninTable2-1
2022-04 v1.1 • UpdatedSPIresistanceinTable5-3
• AddedinformationaboutchipESP32-S3FH4R2
• Addedwake-upsourcesforDeep-sleepmode
• AddedTable3-4fordefaultconfigurationsofVDD_SPI
• AddedADCcalibrationresultsinTable5-5
• Added typical values when all peripherals and peripheral clocks are en-
abledtoTable5-9
• Addedmoredescriptionsofmodules/peripheralsinSection4
2022-01 v1.0 • UpdatedFigureESP32-S3FunctionalBlockDiagram
• UpdatedJEDECspecification
• UpdatedWi-FiRFdatainSection5.6
• UpdatedtemperatureforESP32-S3R8andESP32-S3R8V
• UpdateddescriptionofDeep-sleepmodeinTable5-10
• Updatedwordingthroughout
2021-10-12 v0.6.1 Updatedtextdescription
• Updated to chip revision 1 by swapping pin 53 and pin 54 (XTAL_P and
XTAL_N)
• UpdatedFigureESP32-S3FunctionalBlockDiagram
• AddedCoreMarkscoreinsectionFeatures
• UpdatedSection3
2021-09-30 v0.6
• AddeddataforcumulativeIOoutputcurrentinTable5-1
• AddeddataforModem-sleepcurrentconsumptioninTable5-9
• Updateddatainsection5.6,6.1,and6.2
• Updatedwordingthroughout
• Added“forchiprevision0”oncover,infooterandwatermarktoindicate
thatthecurrentandpreviousversionsofthisdatasheetareforchipver-
2021-07-19 v0.5.1 sion0
• Correctedafewtypos
2021-07-09 v0.5 Preliminaryversion
EspressifSystems 86 ESP32-S3SeriesDatasheetv2.2
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