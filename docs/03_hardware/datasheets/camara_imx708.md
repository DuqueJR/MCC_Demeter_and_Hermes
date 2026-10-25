---
source: "/Users/juanpa/Develop/PersonalProjects/Hermes/docs/Hermes/03_hardware/datasheets/camara_imx708.pdf"
converted_at: 2026-10-25T01:51:04+00:00
size_bytes: 1244344
tool: tomd
---

Raspberry Pi Camera Module 3
Standard
NoIR
Wide
NoIR Wide

Published June 2024

Raspberry Pi Ltd

Overview

Raspberry  Pi  Camera  Module  3  is  a  compact  camera  from  Raspberry  Pi.  It  offers  an

IMX708 12-megapixel sensor with HDR, and features phase detection autofocus. Camera

Module 3 is available in standard and wide-angle variants, both of which are available

with or without an infrared cut filter.

Camera  Module  3  can  be  used  to  take  full  HD  video  as  well  as  stills  photographs,

and features an HDR mode up to 3 megapixels. Its operation is fully supported by the

libcamera  library,  including  Camera  Module  3’s  rapid  autofocus  feature:  this  makes  it

easy for beginners to use, while offering plenty for advanced users. Camera Module 3 is

compatible with all Raspberry Pi computers.1

The  PCB  size  and  mounting  holes  remain  the  same  as  for  Camera  Module  2.

The  Z  dimension  differs:  due  to  the  improved  optics,  Camera  Module  3  is  several

millimetres taller than Camera Module 2.

All variants of Camera Module 3 feature:

•  Back-illuminated and stacked CMOS 12-megapixel image sensor (Sony IMX708)

•

•

•

•

•

•

•

•

 High signal-to-noise ratio (SNR)

 Built-in 2D Dynamic Defect Pixel Correction (DPC)

 Phase Detection Autofocus (PDAF) for rapid autofocus

 QBC Re-mosaic function

 HDR mode (up to 3 megapixel output)

 CSI-2 serial data output

 2-wire serial communication (supports I2C fast mode and fast-mode plus)

 2-wire serial control of focus mechanism

1  Excluding early Raspberry Pi Zero models, which lack the necessary FPC connector. Later Raspberry Pi Zero models

require an adapter FPC, sold separately.

2

Raspberry Pi Camera Module 3 – Raspberry Pi LtdSpecification

Sensor:

Resolution:

Sensor size:

Pixel size:

 Sony IMX708

 11.9 megapixels

 7.4mm sensor diagonal

 1.4μm × 1.4μm

Horizontal/vertical:

 4608 × 2592 pixels

Common video modes:

 1080p50, 720p100, 480p120

Output:

IR cut filter:

 RAW10

 Integrated in standard variants; not present in NoIR variants

Autofocus system:

 Phase Detection Autofocus

Dimensions:

 25 × 24 × 11.5mm (12.4mm height for Wide variants)

Ribbon cable length:

 200mm

Cable connector:

 15 × 1mm FPC

Operating temperature:

 0°C to 50°C

Compliance:

 FCC 47 CFR Part 15, Subpart B, Class B Digital Device
Electromagnetic Compatibility Directive (EMC) 2014/30/EU
 Restriction  of  Hazardous  Substances  (RoHS)  Directive
2011/65/EU

Production lifetime:

 Raspberry Pi Camera Module 3 will remain in production until
at least January 2030

3

Raspberry Pi Camera Module 3 – Raspberry Pi Ltd

23.862

23.862

ø4.75

ø2.2

23.862

14.5

14.4

25

10.8

ø6.95

12.5

12

8.3

4.07

2.75

10.8

67°

3.3

7.3

4

5.71

23.862

2.0

8.9

2.0

1.12

19.61

Physical specification

102°

Standard lens

ø4.75

ø2.2

23.862

14.5

14.4

25

10.8

ø5.75

12.5

11.3

6.98

3.875

2.75

10.8

41°

3.3

7.3

4

5.71

23.862

2.0

8.9

2.0

1.12

19.61

66°

25

10.8

ø6.95

Wide lens

ø4.75

ø2.2

23.862

14.5

14.4

12

8.3

4.07

2.75

12.5

10.8

67°

3.3

7.3

4

5.71

23.862

2.0

8.9

2.0

1.12

19.61

102°

Note: all dimensions in mm

tolerances are accurate to 0.2mm

ø4.75

ø2.2

23.862

14.5

14.4

25

10.8

ø5.75

19.61

66°

11.3

6.98

3.875

2.75

12.5

10.8

41°

3.3

7.3

4

5.71

23.862

4

2.0

8.9

2.0

1.12

Raspberry Pi Camera Module 3 – Raspberry Pi Ltd
Variants

Camera Module 3

Camera Module 3
NoIR

Camera Module 3
Wide

Camera Module 3
Wide NoIR

Focus range

10cm–∞

Focal length

4.74mm

10cm–∞

4.74mm

5cm–∞

2.75mm

5cm–∞

2.75mm

Diagonal
field of view

Horizontal
field of view

Vertical
field of view

Focal ratio
(F-stop)

Infrared-sensitive

No

WARNINGS

75 degrees

75 degrees

120 degrees

120 degrees

66 degrees

66 degrees

102 degrees

102 degrees

41 degrees

41 degrees

67 degrees

67 degrees

F1.8

F1.8

Yes

F2.2

No

F2.2

Yes

•

•

•

•

 This product should be operated in a well ventilated environment, and if used inside a case, the case should not
be covered.

 Whilst in use, this product should be firmly secured or should be placed on a stable, flat, non-conductive surface, and
should not be contacted by conductive items.

 The connection of incompatible devices to Raspberry Camera Module 3 may affect compliance, result in damage to
the unit, and invalidate the warranty.

 All peripherals used with this product should comply with relevant standards for the country of use and be marked
accordingly to ensure that safety and performance requirements are met.

SAFETY INSTRUCTIONS

To avoid malfunction or damage to this product, please observe the following:

•

•

•

•

•

•

•

•

•

•

 Important:  Before  connecting  this  device,  shut  down  your  Raspberry  Pi  computer  and  disconnect  it  from
external power.

 If the cable becomes detached, first pull forward the locking mechanism on the connector, then insert the ribbon
cable ensuring that the metal contacts face towards the circuit board, and finally push the locking mechanism
back into place.

 This device should be operated in a dry environment at 0–50°C.

 Do not expose to water or moisture, or place on a conductive surface whilst in operation.

 Do not expose to heat from any source; Raspberry Pi Camera Module 3 is designed for reliable operation at normal
ambient temperatures.

 Store in a cool, dry location.

 Avoid rapid changes of temperature, which can cause moisture to build up in the device, affecting image quality.

 Take care not to fold or strain the ribbon cable.

 Take care whilst handling to avoid mechanical or electrical damage to the printed circuit board and connectors.

 Whilst it is powered, avoid handling the printed circuit board, or handle it only by the edges, to minimise the risk of
electrostatic discharge damage.

5

Raspberry Pi Camera Module 3 – Raspberry Pi LtdRaspberry Pi Camera Module 3 – Raspberry Pi Ltd

6

Raspberry Pi is a trademark of Raspberry Pi Ltd

