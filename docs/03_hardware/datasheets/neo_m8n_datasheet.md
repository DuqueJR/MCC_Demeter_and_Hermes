---
source: "/Users/juanpa/Develop/PersonalProjects/Hermes/docs/Hermes/03_hardware/datasheets/neo_m8n_datasheet.pdf"
converted_at: 2026-10-25T01:51:17+00:00
size_bytes: 1070870
tool: tomd
---



NEO-M8

u-blox M8 concurrent GNSS modules
Data sheet

Abstract
This data sheet describes the NEO-M8 module family which provides concurrent reception of up to
3 GNSS (GPS, Galileo, GLONASS, BeiDou). NEO-M8 is backward compatible with NEO-7, NEO-6 and
NEO-5 families.

www.u-blox.com

UBX-15031086 - R14

C1-Public

NEO-M8 - Data sheet

Document information

Title

Subtitle

NEO-M8

u-blox M8 concurrent GNSS modules

Document type

Data sheet

Document number

UBX-15031086

Revision and date

R14

30-Sep-2025

Document status

Production information

Disclosure restriction  C1-Public

Product status

Corresponding content status

In Development /
Prototype

Objective Specification

Target values. Revised and supplementary data will be published later.

Engineering Sample  Advance Information

Data based on early testing. Revised and supplementary data will be published later.

Initial Production

Early Production Information

Data from product verification. Revised and supplementary data may be published later.

Mass Production /
End of Life

Production Information

Document contains the final product specification.

This document applies to the following products:

Product name

Type number

Firmware version

PCN/IN reference

NEO-M8N

NEO-M8N-0-12

Flash FW SPG 3.01

NEO-M8Q

NEO-M8Q-0-12

ROM SPG 3.01

NEO-M8M

NEO-M8M-0-11

ROM SPG 3.01

NEO-M8J

NEO-M8J-0-11

Flash FW SPG 3.05

UBXDOC-963802114-12646,
UBX-21015025, UBX-22039049

UBXDOC-963802114-12646,
UBX-21015025, UBX-22039049

UBXDOC-963802114-12646,
UBX-21015022, UBX-22039049

UBXDOC-963802114-12646,
UBX-21015025, UBX-22039049

u-blox or third parties may hold intellectual property rights in the products, names, logos, and designs included in this
document. Copying, reproduction, or modification of this document or any part thereof is only permitted with the express
written permission of u-blox. Disclosure to third parties is permitted for clearly public documents only.
The information contained herein is provided “as is” and u-blox assumes no liability for its use. No warranty, either express or
implied, is given, including but not limited to, with respect to the accuracy, correctness, reliability, and fitness for a particular
purpose of the information. This document may be revised by u-blox at any time without notice. For the most recent
documents and product statuses, visit www.u-blox.com.
Copyright © 2025 u-blox AG.

UBX-15031086 - R14
C1-Public

Document information

Page 2 of 29

NEO-M8 - Data sheet

Contents
Document information ............................................................................................................................. 2
Contents ....................................................................................................................................................... 3
1  Functional description ....................................................................................................................... 5
1.1  Overview ........................................................................................................................................................ 5
1.2  Product features ......................................................................................................................................... 5
1.3  Performance ................................................................................................................................................. 6
1.4  Block diagram .............................................................................................................................................. 7
1.5  Supported GNSS constellations .............................................................................................................. 7
1.5.1  GPS ........................................................................................................................................................ 7
1.5.2  GLONASS ............................................................................................................................................. 8
1.5.3  BeiDou ................................................................................................................................................... 8
1.5.4  Galileo .................................................................................................................................................... 8
1.6  Assisted GNSS (A-GNSS) .......................................................................................................................... 8
1.6.1  AssistNowTM Online ............................................................................................................................ 8
1.6.2  AssistNowTM Offline ........................................................................................................................... 8
1.6.3  AssistNowTM Autonomous ............................................................................................................... 9
1.7  Augmentation systems ............................................................................................................................. 9
1.7.1  Satellite-based augmentation system (SBAS) ............................................................................ 9
1.7.2  QZSS ..................................................................................................................................................... 9
IMES ...................................................................................................................................................... 9
1.7.3
1.7.4  Differential GPS (D-GPS) ................................................................................................................. 10
1.8  Broadcast navigation data and satellite signal measurements ..................................................... 10
1.9  Odometer .................................................................................................................................................... 10
1.10 Data logging (NEO-M8N/J) ..................................................................................................................... 10
1.11 Geofencing .................................................................................................................................................. 10
1.12 Message integrity protection ................................................................................................................. 11
1.13 Spoofing detection ................................................................................................................................... 11
1.14 EXTINT: External interrupt ...................................................................................................................... 11
1.14.1  Pin control .......................................................................................................................................... 11
1.14.2  Aiding .................................................................................................................................................. 11
1.15 TIMEPULSE ................................................................................................................................................ 12
1.16 Protocols and interfaces ......................................................................................................................... 12
1.17 Interfaces .................................................................................................................................................... 12
1.17.1  UART ................................................................................................................................................... 12
1.17.2  USB ...................................................................................................................................................... 12
1.17.3  SPI ........................................................................................................................................................ 12
1.17.4  Display data channel (DDC) ............................................................................................................ 13
1.18 Clock generation ........................................................................................................................................ 13
1.18.1  Oscillators .......................................................................................................................................... 13
1.18.2  Real-time clock (RTC) ...................................................................................................................... 13

UBX-15031086 - Production information
C1-Public

Contents

Page 3 of 29

NEO-M8 - Data sheet

1.19 Power management ................................................................................................................................. 13
1.19.1  DC-DC converter ............................................................................................................................... 13
1.19.2  Power mode setup ............................................................................................................................ 13
1.19.3  Continuous mode .............................................................................................................................. 14
1.19.4  Power save mode .............................................................................................................................. 14
1.20 Antenna ....................................................................................................................................................... 14
1.21 LNA_EN ....................................................................................................................................................... 14
2  Pin definition...................................................................................................................................... 15
2.1  Pin assignment .......................................................................................................................................... 15
2.2  Pin name changes ..................................................................................................................................... 16
3  Configuration management .......................................................................................................... 17
3.1  Interface selection (D_SEL) .................................................................................................................... 17
4  Electrical specification ................................................................................................................... 18
4.1  Absolute maximum rating ....................................................................................................................... 18
4.2  Operating conditions ................................................................................................................................ 18
4.3  Indicative current requirements ............................................................................................................ 19
4.4  SPI timing diagrams ................................................................................................................................. 20
4.4.1  Timing recommendations ............................................................................................................... 20
4.5  DDC timing diagrams ............................................................................................................................... 20
5  Mechanical specifications ............................................................................................................. 21
6  Reliability tests and approvals ..................................................................................................... 22
6.1  Reliability tests .......................................................................................................................................... 22
6.2  Approvals .................................................................................................................................................... 22
7  Product handling and soldering ................................................................................................... 23
7.1  Packaging ................................................................................................................................................... 23
7.1.1  Reels .................................................................................................................................................... 23
7.1.2  Tapes ................................................................................................................................................... 23
7.2  Shipment, storage and handling ........................................................................................................... 23
7.2.1  Moisture sensitivity levels .............................................................................................................. 23
7.2.2  Reflow soldering ................................................................................................................................ 24
7.2.3  ESD handling precautions .............................................................................................................. 24
8  Default messages ............................................................................................................................ 25
9  Labeling and ordering information ............................................................................................. 26
9.1  Product labeling ......................................................................................................................................... 26
9.2  Explanation of codes ................................................................................................................................ 26
9.3  Ordering codes ........................................................................................................................................... 26
Appendix .................................................................................................................................................... 27
A  Glossary .............................................................................................................................................. 27
Related documents ................................................................................................................................ 28
Revision history ....................................................................................................................................... 28
Contact ....................................................................................................................................................... 29

UBX-15031086 - Production information
C1-Public

Contents

Page 4 of 29

NEO-M8 - Data sheet

1  Functional description

1.1  Overview
The  NEO-M8  series  of  concurrent  GNSS  modules  is  built  on  the  high-performing  u-blox  M8  GNSS
engine in the industry-proven NEO form factor.

The NEO-M8 modules utilize concurrent reception of up to three GNSS systems (GPS/Galileo together
with BeiDou or GLONASS), recognize multiple constellations simultaneously and provide outstanding
positioning accuracy in scenarios where urban canyon or weak signals are involved. For even better
and  faster  positioning  improvement,  the  NEO-M8  series  supports  augmentation  of  QZSS,  GAGAN
and  IMES  together  with  WAAS,  EGNOS,  and  MSAS.  The  NEO-M8  series  also  supports  message
integrity protection, geofencing, and spoofing detection with configurable interface settings to easily
fit to customer applications.

The NEO‑M8M is optimized for cost-sensitive applications, while NEO-M8N and NEO-M8Q provide
the best performance. The future-proof NEO-M8N and NEO-M8J include an internal flash that allows
future  firmware  updates.  This  makes  NEO-M8N  and  NEO-M8J  perfectly  suited  to  industrial  and
automotive applications.

The  I2C-compliant  DDC  interface  provides  connectivity  and  enables  synergies  with  most  u‑blox
cellular  modules.  For  RF  optimization,  NEO-M8J,  NEO-M8N,  and  NEO-M8Q  feature  an  additional
front-end  LNA  for  easier  antenna  integration  and  a  front-end  SAW  filter  for  increased  jamming
immunity.

u-blox M8 modules use GNSS chips qualified according to AEC‑Q100, are manufactured in ISO/TS
16949  certified  sites,  and  are  fully  tested  on  a  system  level.  Qualification  tests  are  performed  as
stipulated  in  the  ISO16750  standard:  “Road  vehicles  –  Environmental  conditions  and  testing  for
electrical and electronic equipment”.

The  u-blox  NEO-M8  modules  can  also  benefit  from  the  u-blox  AssistNow  assistance  service.  The
Online service provides GNNS broadcast parameters, for example, ephemeris, almanac plus time or
rough  position  to  reduce  the  receiver’s  time  to  first  fix  significantly  and  to  improve  acquisition
sensitivity.  The  extended  validity  of  AssistNow  Offline  data  (up  to  35  days)  and  AssistNow
Autonomous data (up to 6 days) provide faster acquisition after a long off time.

☞  See section 1.6 for more information concerning the NEO-M8 related AssistNow Assistance.

1.2  Product features

 Model

 Category

 GNSS

 Supply

 Interfaces

 Features

 Grade

i

i

n
o
s
c
e
r
P
d
r
a
d
n
a
t
S

 NEO-M8N

 NEO-M8Q

●

●

 NEO-M8M  ●

 NEO-M8J

●

i

S
S
N
G
n
o
s
c
e
r
P
h
g
H

i

i

i

g
n
n
o
k
c
e
R
d
a
e
D

i

g
n
m
T

i

t
n
e
r
r
u
c
n
o
c
f
o
r
e
b
m
u
N

S
S
N
G

3

3

3

3

S
S
Z
Q

/

S
P
G

●

●

●

●

S
S
A
N
O
L
G

o
e

l
i
l

a
G

u
o
D
e
B

i

●  ●  ●

●  ●  ●

●  ●  ●

●  ●  ●

l

)
h
s
a
l
f
(
e
b
a
m
m
a
r
g
o
r
P

)
t
n
a

i
l

p
m
o
c
C
2
I
(

C
D
D

T
R
A
U

B
S
U

I

P
S

.

V
6
3
–
V
5
6
1

.

.

V
6
3
–
V
7
2

.

i

g
n
g
g
o

l

a
t
a
D

l

y
p
p
u
s
a
n
n
e
t
n
a
n
i
-
t
l
i

u
B

i

r
o
s
v
r
e
p
u
s
d
n
a

a
n
n
e
t
n
a
n
i
-
t
l
i

u
B

W
A
S

l

a
n
o
i
t
i
d
d
A

A
N
L

l

a
n
o
i
t
i
d
d
A

l

a
t
s
y
r
c
C
T
R

r
o
t
a

l
l
i

c
s
O

l

e
s
u
p
e
m
T

i

●

●

●  ●  ●  ●  ●  ●  ●  ●  ●  T

●  ●  ●  ●

●  ●  ●  T

●

●  ●  ●  ●

●  C

●

●  ●  ●  ●  ●  ●  ●  ●  ●  C

1

1

1

1

d
r
a
d
n
a
t
S

e
v
i
t
o
m
o
t
u
A

l

i

a
n
o
s
s
e
f
o
r
P

●

●

●

●

UBX-15031086 - Production information
C1-Public

Functional description

Page 5 of 29

C = Crystal / T = TCXO

NEO-M8 - Data sheet

1.3  Performance

Parameter

Specification

Receiver type

72-channel u-blox M8 engine
GPS L1C/A, SBAS L1C/A, QZSS L1C/A, QZSS L1 SAIF, GLONASS L1OF, BeiDou B1I, Galileo E1B/C

Accuracy of time
pulse signal

RMS
99%

30 ns
60 ns

Frequency of time
pulse signal

0.25 Hz…10 MHz
(configurable)

Operational limits 1  Dynamics

≤ 4 g

Altitude

Velocity

50,000 m

500 m/s

0.05 m/s

0.3 degrees

GPS & GLONASS

GPS

GLONASS

BeiDou

Galileo

Velocity accuracy  2

Heading accuracy 2

GNSS

Horizontal position
accuracy  3

With SBAS

2.5 m
2.0 m

2.5 m
2.0 m

4 m
-

3 m
-

3 m
-

NEO-M8N/Q

Max navigation
update rate

NEO-M8N

5 Hz

10 Hz

10 Hz

10 Hz

10 Hz

NEO-M8Q

10 Hz

18 Hz

18 Hz

18 Hz

18 Hz

Time-To-First-Fix  4  Cold start

Sensitivity 6

Hot start

Aided starts  5

Tracking &
Navigation

26 s

1 s

2 s

29 s

1 s

2 s

30 s

1 s

2 s

34 s

1 s

3 s

45 s

1 s

7 s

–167 dBm

–166 dBm

-166 dBm

-160 dBm

-159 dBm

Reacquisition

–160 dBm

–160 dBm

-156 dBm

-157 dBm

-153 dBm

Cold start

–148 dBm

–148 dBm

-145 dBm

-143 dBm

-138 dBm

Hot start

–157 dBm

–157 dBm

-156 dBm

-155 dBm

-151 dBm

NEO-M8J/M

Max navigation
update rate

NEO-M8J

5 Hz

10 Hz

10 Hz

10 Hz

10 Hz

NEO-M8M

10 Hz

18 Hz

18 Hz

18 Hz

18 Hz

Time-To-First-Fix 4  Cold start

Sensitivity 6

Hot start

Aided starts 6

Tracking &
Navigation

26 s

1 s

3 s

30 s

1 s

3 s

33 s

1 s

3 s

39 s

1 s

7 s

57 s

1 s

7 s

-164 dBm

-164 dBm

-163 dBm

-160 dBm

-154 dBm

Reacquisition

-160 dBm

-159 dBm

-156 dBm

-155 dBm

-152dBm

Cold start

-148 dBm

-147 dBm

-145 dBm

-143 dBm

-133 dBm

Hot start

-157 dBm

-156 dBm

-155 dBm

-155 dBm

-151 dBm

Table 1: NEO-M8 performance in different GNSS modes (default: concurrent reception of GPS and GLONASS including
QZSS, SBAS)

1  Assuming Airborne < 4 g platform
2  50% at 30 m/s
3  CEP, 50%, 24 hours static, -130 dBm, > 6 SVs
4  All satellites at -130 dBm, except Galileo at -127 dBm
5  Dependent on aiding data connection speed and latency
6  Demonstrated with a good external LNA

UBX-15031086 - Production information
C1-Public

Functional description

Page 6 of 29

1.4  Block diagram

NEO-M8 - Data sheet

Figure 1: NEO-M8 block diagram

 Supported GNSS constellations

1.5
The  NEO-M8  GNSS  modules  are  concurrent  GNSS  receivers  which  can  receive  and  track  multiple
GNSS  systems:  GPS,  Galileo,  GLONASS  and  BeiDou.  Owing  to  the  dual-frequency  RF  front-end
architecture, either GLONASS or BeiDou can be processed concurrently with GPS and Galileo signals
providing reception of three GNSS systems. By default the M8 receivers are configured for concurrent
GPS and GLONASS, including SBAS and QZSS reception. If power consumption is a key factor, the
receiver should be configured for a single GNSS operation using GPS, Galileo, GLONASS or BeiDou and
disabling QZSS and SBAS. The module can be configured to receive any single GNSS constellation or
within the set of permissible combinations shown below.

GPS

Galileo

GLONASS

BeiDou

•

•

•

•

•

–

–

–

•

•

•

–

–

•

•

–

–

•

–

•

–

•

–

•

–

–

•

–

•

–

•

•

Table 2 Permissible GNSS combinations (• = enabled)

☞  The SBAS and QZSS augmentation systems can be enabled only if GPS operation is configured.
☞  Galileo is not enabled as the default configuration.

1.5.1  GPS

The  NEO-M8  positioning  modules  are  designed to  receive  and  track  the  L1C/A  signals  provided  at
1575.42 MHz by the global positioning system (GPS).

UBX-15031086 - Production information
C1-Public

Functional description

Page 7 of 29

NEO-M8 - Data sheet

1.5.2  GLONASS

The NEO-M8 modules can receive and process the GLONASS satellite system as an alternative to the
US-based  global  positioning  system  (GPS).  u-blox  NEO-M8  positioning  modules  are  designed  to
receive and track the L1OF signals GLONASS provides at 1602 MHz + k*562.5 kHz, where k is the
satellite’s frequency channel number (k = –7,..., 5, 6). The ability to receive and track GLONASS L1OF
satellite signals allows design of GLONASS receivers where required by regulations.

To take advantage of GPS and GLONASS, dedicated hardware preparation must be made during the
design-in  phase.  See  the  NEO-8Q  /  NEO-M8  Hardware  integration  manual  [1]  for  u-blox  design
recommendations.

1.5.3  BeiDou

The NEO-M8 modules can receive and process the B1I signals broadcast at 1561.098 MHz from the
BeiDou Navigation Satellite System. The ability to receive and track BeiDou signals in conjunction with
another constellation results in higher coverage, improved reliability and better accuracy.

1.5.4  Galileo

The NEO-M8 positioning modules can receive and track the E1-B/C signals centered on the GPS L1
frequency band. GPS and Galileo signals can be processed concurrently together with either BeiDou
or  GLONASS  signals,  enhancing  coverage,  reliability  and  accuracy.  The  SAR  return  link  message
(RLM) parameters for both short and long versions are decoded by the receiver and made available to
users via UBX proprietary messages.

☞  Galileo has been implemented according to ICD release 1.2 (November 2015) and verified with live

signals from the Galileo in-orbit validation campaign.

☞  Galileo reception is by default disabled, but can be enabled by sending a configuration message
(UBX-CFG-GNSS)  to  the  receiver.  See  the  u-blox  8  /  u-blox  M8  Receiver  Description  including
Protocol Specification [2] for more information.

1.6  Assisted GNSS (A-GNSS)
Supply  of  GNSS  receiver  assistance  information,  such  as  ephemeris,  almanac,  rough  user  position
and time, will reduce the time to first fix significantly and improve acquisition sensitivity. The NEO-
M8J,  NEO-M8N,  NEO-M8Q,  and  NEO-M8M  modules  support  the  u-blox  AssistNow  Online  and
AssistNow Offline A-GNSS services, support AssistNow Autonomous, and are OMA SUPL compliant.

1.6.1  AssistNowTM Online

With  AssistNow  Online,  an  internet-connected  host  downloads  assistance  data  from  the  u-blox
AssistNow  Online  service  to  the  receiver  at  system  start-up.  The  Multi-GNSS  Assistance  (MGA)
service is an HTTP protocol-based network operator-independent service.

Supplying assistance information, such as ephemeris, almanac, a rough last position and time, can
reduce the time to first fix significantly and improve acquisition sensitivity.

☞  The AssistNow Online service provides data for GPS, GLONASS, BeiDou, Galileo and QZSS

1.6.2  AssistNowTM Offline

With the AssistNow Offline service, users can download long-term orbit data over the internet at their
convenience. The orbit data can be stored in the GNSS receiver’s SQI flash memory or, alternatively,
within  the  memory  of  the  application  processor.  The  function  requires  no  connectivity  at  system

UBX-15031086 - Production information
C1-Public

Functional description

Page 8 of 29

NEO-M8 - Data sheet

start-up, enabling a position fix within seconds, even when no network is available. AssistNow Offline
offers augmentation for up to 35 days.

☞  AssistNow Offline service provides data for GPS and GLONASS only, BeiDou and Galileo are not

currently supported.

1.6.3  AssistNowTM Autonomous

AssistNow Autonomous provides aiding information without the need for a host or external network
connection. Based on previous broadcast satellite ephemeris data downloaded to and stored by the
GNSS  receiver,  AssistNow  Autonomous  automatically  generates  accurate  predictions  of  satellite
orbital  data  (“AssistNow  Autonomous  data”)  that  is  usable  for  future  GNSS  position  fixes.  The
concept capitalizes on the periodic nature of GNSS satellites; by capturing strategic ephemeris data
at  specific  times  of  the  day.  The  flash  memory-based  NEO-M8N/J  modules  can  predict  accurate
satellite ephemeris for up to six days after initial reception. The ROM-based NEO-M8M/Q modules
can use only GPS satellites with a prediction time of up to three days.

u-blox AssistNow Autonomous benefits are:

•  Faster fix in situations where satellite signals are weak
•  No connectivity required
•  Compatible  with  AssistNow  Online  (can  work  stand-alone,  or  in  tandem  with  AssistNow  Online

service)

•  No integration effort; calculations are done in the background, transparent to the user

☞  For more details on A-GNSS, see the u-blox 8 / u-blox M8 Receiver Description including Protocol

Specification [2].

1.7  Augmentation systems

1.7.1  Satellite-based augmentation system (SBAS)

The  u-blox  NEO-M8  modules  support  reception  of  SBAS  broadcast  signals.  These  systems
supplement  GNSS  data  with  additional  regional  or  wide  area  GPS  augmentation  data.  The  system
broadcasts  range  correction  and  integrity  information  via  satellite  which  can  be  used  by  GNSS
receivers  to  improve  resulting  precision.  SBAS  satellites  can  be  used  as  additional  satellites  for
ranging (navigation), further enhancing availability. The following SBAS types are supported: GAGAN,
WAAS, EGNOS and MSAS.

☞  For more details, see the u-blox 8 / u-blox M8 Receiver Description,  Protocol Specification [2].

1.7.2  QZSS

The Quasi-Zenith Satellite System (QZSS) is a  regional navigation satellite system that transmits
additional GPS L1 C/A signals for the Pacific region covering Japan and Australia. NEO-M8 positioning
modules are able to receive and track these signals concurrently with GPS signals, resulting in better
availability especially under challenging signal conditions, e.g. in urban canyons. The L1- SAIF signal
provided by QZSS can be enabled for reception via a GNSS configuration message.

1.7.3

IMES

The Japanese Indoor Messaging System (IMES) system is used for indoor position reporting using
low-power  transmitters  which  broadcast  a  GPS–like  signal. NEO-M8  modules can  be  configured  to
receive and demodulate the signal to provide an in-door location estimate.

☞  This service is authorized and available only in Japan.

UBX-15031086 - Production information
C1-Public

Functional description

Page 9 of 29

NEO-M8 - Data sheet

☞

IMES reception is disabled by default.

1.7.4  Differential GPS (D-GPS)

u-blox receivers support Differential GPS (D-GPS) data according to RTCM specification 10402.3 [4]:
The use of D-GPS improves GPS position accuracy. The RTCM implementation supports the following
RTCM 2.3 messages.

Message type

Description

1

2

3

9

Differential GPS corrections

Delta differential GPS corrections

GPS reference station parameters

GPS partial correction set

Table 3: Supported RTCM 2.3 messages

☞  RTCM corrections cannot be used together with SBAS.
☞  For more details, see the u-blox 8 / u-blox M8 Receiver Description including Protocol Specification

[2].

1.8  Broadcast navigation data and satellite signal

measurements

The NEO-M8 modules can output all the GNSS broadcast data upon reception from tracked satellites.
This includes all the supported GNSS signals plus the augmentation services SBAS, QZSS and IMES.
The receiver also makes available the tracked satellite signal information, that is, raw code phase and
Doppler measurements in a form aligned to the ETSI mobile cellular location services protocol (RRLP)
[6]. For more details, see the u-blox 8 / u-blox M8 Receiver Description including Protocol Specification
[2].

1.9  Odometer
The odometer function provides information on travelled ground distance (in meters) based on the
position and Doppler-based velocity output from the navigation solution. For each computed distance
since  the  last  odometer  reset,  the  odometer  estimates  a  1-sigma  accuracy  value.  The  total
cumulative ground distance is maintained and saved in the BBR memory.

☞  The odometer feature is disabled by default. For more details, see the u-blox 8 / u-blox M8 Receiver

Description including Protocol Specification [2].

1.10 Data logging (NEO-M8N/J)
The  NEO-M8N  and  NEO-M8J  modules  can  be  used  in  data  logging  applications.  The  data  logging
feature enables continuous storage of position, velocity and time information to an onboard SQI flash
memory (at least 16 Mbit). It can also log the distance from the odometer. The information can be
downloaded from the receiver later for further analysis or for conversion to a mapping tool. For more
information see the u-blox 8 / u-blox M8 Receiver Description including Protocol Specification [2].

1.11  Geofencing
The  u-blox  NEO-M8  modules  support  up  to  four  circular  Geofencing  areas  defined  on  the  Earth’s
surface  using  a  2D  model.  Geofencing  is  active when  at  least  one  Geofence  is  defined,  the  current
status can be found by polling the receiver. A GPIO pin can be nominated to indicate status to, for
example, wake up a host on activation.

UBX-15031086 - Production information
C1-Public

Functional description

Page 10 of 29

NEO-M8 - Data sheet

1.12 Message integrity protection
The  NEO-M8  modules  provide  a  function  to  detect  third  party  interference  with  the  UBX  message
steam  sent  from  receiver  to  host.  The  security  mechanism  “signs”  nominated  messages  via  a
subsequent UBX message. This message signature is then compared with one generated by the host
to determine if the message data has been altered. The signature algorithm seed can use one fixed
secret ID key set by eFuse in production and a dynamic ID key set by the host, enabling users to detect
“man-in-the-middle” style attacks.

1.13 Spoofing detection
Spoofing is a process whereby a malicious third party tries to control the reported position via a “fake”
GNSS broadcast signal. This may result in the form of reporting incorrect position, velocity or time.
To combat against this, NEO-M8 modules include spoofing detection measures to alert the host when
signals appear to be suspicious. The receiver combines a number of checks on the received signals
looking for inconsistencies across several parameters.

☞  This feature does not guarantee detecting all spoofing attacks.

1.14 EXTINT: External interrupt
EXTINT is an external interrupt pin with fixed input voltage thresholds with respect to VCC. It can be
used for control of the receiver or for aiding.

For more information about how to implement and configure these features, see the u-blox 8 / u-blox
M8  Receiver  Description  including  Protocol  Specification  [2] and  the  NEO-8Q  /  NEO-M8  Hardware
integration manual [1].

1.14.1  Pin control

The pin control feature allows overriding the automatic active/inactive cycle of power save mode. The
state of the receiver can be controlled through the EXTINT pin.

The receiver can also be forced OFF using EXTINT when power save mode is not active.

1.14.2  Aiding

The EXTINT pin can be used to supply time or frequency aiding data to the receiver.

For time aiding, hardware time synchronization can be achieved by connecting an accurate time pulse
to the EXTINT pin.

Frequency aiding can be implemented by connecting a periodic rectangular signal with a frequency up
to 500 kHz and arbitrary duty cycle (low/high phase duration must not be shorter than 50 ns) to the
EXTINT pin. Provide the applied frequency value to the receiver using UBX messages.

UBX-15031086 - Production information
C1-Public

Functional description

Page 11 of 29

NEO-M8 - Data sheet

1.15 TIMEPULSE
A configurable time pulse signal is available with the NEO-M8N, NEO-M8J, NEO-M8Q, and NEO-M8M
modules.

The TIMEPULSE output generates pulse trains synchronized with GPS or UTC time grid with intervals
configurable  over  a  wide  frequency  range.  Thus  it  may  be  used  as  a  low  frequency  time
synchronization pulse or as a high frequency reference signal.

By default the time pulse signal is configured to 1 pulse per second. For more information, see the
u-blox 8 / u-blox M8 Receiver Description including Protocol Specification [2].

1.16 Protocols and interfaces

Protocol

Type

NMEA 0183, version 4.0 (V2.1, V2.3 or V4.1 configurable)  Input/output, ASCII

UBX

RTCM

Table 4: Available protocols

Input/output, binary, u-blox proprietary

Input message, 1, 2, 3, 9

All protocols are available on UART, USB, DDC (I2C-compliant) and SPI. For specification of the various
protocols, see the u-blox 8 / u-blox M8 Receiver Description including Protocol Specification [2].

1.17 Interfaces
A number of interfaces are provided either for data communication or memory access. The embedded
firmware uses these interfaces according to their respective protocol specifications.

1.17.1  UART

The NEO-M8 modules include one UART interface, which can be used for communication to a host. It
supports configurable baud rates. For supported baud  rates, see the  u-blox 8 / u-blox M8 Receiver
Description including Protocol Specification [2].

☞  Designs  must  allow  access  to  the  UART  and  the  SAFEBOOT_N  function  pin  for  future  service,

updates and reconfiguration.

1.17.2  USB

A USB interface, which is compatible to USB version 2.0 FS (full speed, 12 Mbit/s), can be used for
communication as an alternative to the UART. The pull-up resistor on pin USB_DP is integrated to
signal a full-speed device to the host. The VDD_USB pin supplies the USB interface. The u-blox USB
(CDC-ACM)  driver  supports  Windows  Vista  and  Windows  7  and  8  operating  systems.  A  separate
driver  (CDC-ACM)  is  not  required  for  Windows  10  which  has  a  built-in  USB-serial  driver.  However,
plugging initially into an internet-connected Windows 10 PC will download the u-blox combined sensor
and VCP driver package.

☞  USB drivers can be downloaded from the u-blox web site, www.u-blox.com.

1.17.3  SPI

The SPI interface is designed to allow communication to a host CPU. The interface can be operated in
slave  mode  only.  The  maximum  transfer  rate  using  SPI  is  125 kB/s  and  the  maximum  SPI  clock
frequency is 5.5 MHz. Note that SPI is not available in the default configuration because its pins are
shared with the UART and DDC interfaces. The SPI interface can be enabled by connecting D_SEL (pin
2) to ground (see section 3.1).

UBX-15031086 - Production information
C1-Public

Functional description

Page 12 of 29

NEO-M8 - Data sheet

1.17.4  Display data channel (DDC)

An I2C-compliant DDC interface is available for communication with an external host CPU or u-blox
cellular modules. The interface can be operated in slave mode only. The DDC protocol and electrical
interface are fully compatible with the fast-mode of the I2C industry standard. Since the maximum
SCL clock frequency is 400 kHz, the maximum transfer rate is 400 kbit/s.

1.18 Clock generation

1.18.1  Oscillators

NEO-M8 GNSS modules are available in TCXO and crystal versions. The TCXO allows accelerated weak
signal acquisition, enabling faster start and reacquisition times.

Oscillators  used  on  NEO-M8  modules  are  carefully  selected  and  screened  for  stability  and  against
frequency perturbations across the full operating range (–40 °C to +85 °C).

The careful selection and qualification of critical parts, such as GNSS oscillators, has resulted in u-
blox modules being the most reliable positioning modules in the industry, particularly in challenging
conditions.

1.18.2  Real-time clock (RTC)

The RTC is driven by a 32 kHz oscillator using an RTC crystal. If the main supply voltage fails, and a
battery is connected to V_BCKP, parts of the receiver switch off, but the RTC still runs providing a
timing reference for the receiver. This operating mode is called hardware backup mode, which enables
all relevant data to be saved in the backup RAM to allow a hot or warm start later.

1.19 Power management
u-blox M8 technology offers a power-optimized architecture with built-in autonomous power saving
functions to minimize power consumption at any given time. Furthermore, the receiver can be used in
two  operating  modes:  continuous  mode  for  best  performance  or  power  save  mode  for  optimized
power consumption, respectively.

1.19.1  DC-DC converter

The NEO-M8 modules integrate a DC-DC converter, allowing reduced power consumption especially
when using a main supply voltage above 2.5 V.

☞  For more information, see the NEO-8Q / NEO-M8 Hardware integration manual [1].

1.19.2  Power mode setup

u-blox  M8  modules  can  be  configured  to  run  in  either  continuous  or  a  choice  of  power  save  mode
configurations.  A template of power mode settings can be used to easily select typical power mode
setups to cover the majority of users’ requirements.

For specific power saving applications the user has the option to fully configure via the power save
mode configuration. For more information, see section 1.19.4.

The u-blox M8 modules’ power mode setup offers a choice of continuous operation and preset power
save mode configurations.

•  Continuous (default) mode for best GNSS performance vs. power consumption
•  Continuous with no compromise in power consumption
•  A 1 Hz cyclic tracking mode for aggressive power reduction

UBX-15031086 - Production information
C1-Public

Functional description

Page 13 of 29

NEO-M8 - Data sheet

•  Choice of 2 or 4 Hz7 cyclic tracking modes for typical wearable applications
•  ON/OFF interval mode

1.19.3  Continuous mode

Continuous mode uses the acquisition engine at full performance resulting in the shortest possible
TTFF and the highest sensitivity. It searches for all possible satellites until the Almanac is completely
downloaded. The receiver then switches to the tracking engine to lower power consumption.

Thus, a lower tracking current consumption level will be achieved when:

•  A valid GNSS position is obtained
•  The entire Almanac has been downloaded
•  The Ephemeris for each satellite in view is valid

1.19.4  Power save mode

For  specific  power  saving  applications  outside  the  typical  preset  power  mode  setups,  users  can
configure a tailored power save mode.

The  power  save  mode  provides  two  dedicated  methods,  ON/OFF  and  cyclic  tracking,  that  reduce
average current consumption in different ways to match the needs of the specific application. These
operations can be set by using a specific UBX message.

☞  For more information about power management strategies, see the u-blox 8 / u-blox M8 Receiver

Description including Protocol Specification [2].

1.20 Antenna
NEO-M8 modules are designed for use with passive 8 and active 9 antennas.

Parameter

Antenna type

Specification

Passive and active antenna

Active antenna recommendations  Minimum gain
Maximum gain
Maximum noise figure

15 dB (to compensate signal loss in RF cable)
50 10 dB / 30 11 dB
1.5 dB

Table 5: Antenna specifications for NEO-M8 modules

1.21 LNA_EN
The LNA_EN pin provides optional control for switching off power to an active antenna or separate
LNA. This facility is provided to help minimize power consumption in power save mode operation. See
the NEO-8Q / NEO-M8 Hardware integration manual [1] for more information.

7  Single GNSS constellation configuration only.
8   For integration of NEO-M8 modules with Cellular products, see the NEO-8Q / NEO-M8 Hardware integration manual [1].
9  For using active antennas with NEO-M8 modules, see the NEO-8Q / NEO-M8 Hardware integration manual [1].
10  NEO-M8M
11  NEO-M8N/J/Q

UBX-15031086 - Production information
C1-Public

Functional description

Page 14 of 29

2  Pin definition
2.1  Pin assignment

NEO-M8 - Data sheet

Figure 2: Pin assignment

No.

Name

PIO no.

I/O

Description

☞  PIO = Peripheral Input Output

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

SAFEBOOT_N

D_SEL

TIMEPULSE

EXTINT

USB_DM

USB_DP

VDD_USB

RESET_N

VCC_RF

GND

RF_IN

GND

GND

LNA_EN /
Reserved

Reserved

Reserved

Reserved

SDA /
SPI CS_N

SCL /
SPI CLK

TXD /
SPI MISO

RXD /
SPI MOSI

V_BCKP

VCC

GND

-

-

11

13

-

-

-

-

-

-

-

-

-

16

9

8

6

7

-

Table 6: Pinout of NEO-M8

I

I

O

I

I/O

I/O

I

I

O

I

I

I

I

O

-

-

-

I/O

I/O

O

I

I

I

I

SAFEBOOT_N (for future service, updates and reconfiguration, leave OPEN)

Interface select

Time pulse (1PPS)

External interrupt pin

USB data

USB data

USB supply

RESET_N

Output voltage RF section

Ground

GNSS signal input

Ground

Ground

LNA_EN (NEO-M8N/Q/J): Antenna/LNA control
Reserved (NEO-M8M): Reserved

Reserved

Reserved

Reserved

DDC data if D_SEL =1 (or open)
SPI chip select if D_SEL = 0

DDC clock if D_SEL =1 (or open)
SPI clock if D_SEL = 0

Serial port if D_SEL =1 (or open)
SPI MISO if D_SEL = 0

Serial port if D_SEL =1 (or open)
SPI MOSI if D_SEL = 0

Backup voltage supply

Supply voltage

Ground

UBX-15031086 - Production information
C1-Public

Pin definition

Page 15 of 29

NEO-M8 - Data sheet

☞  Pins designated as “Reserved” should not be used. For more information about pinouts, see the

NEO-8Q / NEO-M8 Hardware integration manual [1].

2.2  Pin name changes
Selected  pin  names  have  been  updated  to  agree  with  a  common  naming  convention  across  u-blox
modules.  The pins have not changed their operation and are the same physical hardware but with
updated names. The table below lists the pins that have a changed name along with their old and new
names.

No.

1

14

20

21

Previous name

New name

Reserved

ANT_ON

TxD
SPI MISO

RxD
SPI MOSI

SAFEBOOT_N

LNA_EN

TXD /
SPI MISO

RXD /
SPI MOSI

Table 7: Pin name changes

UBX-15031086 - Production information
C1-Public

Pin definition

Page 16 of 29

NEO-M8 - Data sheet

3  Configuration management

Configuration  settings  can  be  modified  with  UBX  configuration  messages.  The  modified  settings
remain effective until power-down or reset. If these settings have been stored in battery-backup RAM,
the modified configuration will be retained as long as the backup battery supply is not interrupted.

With the NEO-M8, configuration settings modified with UBX configuration messages can be saved
permanently. In this case, the modified settings remain effective even after power-down and do not
require backup battery supply.

Interface selection (D_SEL)

3.1
At startup, pin 2 (D_SEL) determines which data interfaces are used for communication. If D_SEL is
set  high  or  left  open,  UART  and  DDC  become  available.  If  D_SEL  is  set  low,  that  is,  connected  to
ground, the NEO-M8 module series can communicate to a host via SPI.

Pin #

20

21

19

18

D_SEL=”1”
(left open)

D_SEL =”0”
(connected to GND)

UART TX

UART RX

DDC SCL

DDC SDA

SPI  MISO

SPI  MOSI

SPI  CLK

SPI  CS_N

Table 8: Data interface selection by D_SEL

UBX-15031086 - Production information
C1-Public

Configuration management

Page 17 of 29

NEO-M8 - Data sheet

4  Electrical specification

☞  The limiting values given are in accordance with the Absolute Maximum Rating System (IEC 134).
Stress above one or more of the limiting values may cause permanent damage to the device. These
are stress ratings only and operation of the device at these or at any other conditions above those
given in the characteristics sections of the specification is not implied. Exposure to these limits
for extended periods may affect device reliability.

☞  Where  application  information  is  given,  it  is  advisory  only  and  does  not  form  part  of  the
specification. For more information, see the NEO-8Q / NEO-M8 Hardware integration manual [1].

4.1  Absolute maximum rating

Parameter

Symbol

Condition

If VCC < 3.1V
If VCC > 3.1V

Power supply voltage

Backup battery voltage

USB supply voltage

Input pin voltage

DC current through any digital I/O pin
(except supplies)

VCC_RF output current

Input power at RF_IN

VCC

V_BCKP

VDD_USB

VIN

VIN_USB

IPIN

ICC_RF

PRFIN

Storage temperature

TSTG

Table 9: Absolute maximum ratings

Min

–0.5

–0.5

–0.5

–0.5
-0.5

–0.5

Max

Units

3.6

3.6

3.6

VCC+0.5
3.6

V

V

V

V
V

VDD_USB  V

10

mA

source impedance   = 50 Ω,
continuous wave

NEO-M8N/M8Q/M8J
NEO-M8M

–40
–40

100

15

85
105

mA

dBm

°C

⚠  Stressing  the  device  beyond  the  “Absolute  Maximum  Ratings”  may  cause  permanent  damage.
These  are  stress  ratings  only.  The  product  is  not  protected  against  overvoltage  or  reversed
voltages. If necessary, voltage spikes exceeding the power supply voltage specification, given in
Table 9, must be limited to values within the specified boundaries by using appropriate protection
diodes.

4.2  Operating conditions

☞  All specifications are at an ambient temperature of +25 °C. Extreme operating temperatures can
significantly  impact  specification  values.  Applications  operating  near  the  temperature  limits
should be tested to ensure the specification.

Parameter

Symbol

Power supply voltage NEO-M8N/Q/J   VCC

Min

2.7

3.0

Typical

Max

Units  Condition

Power supply voltage NEO-M8M

VCC

1.65

1.8, 3.0

Supply voltage USB

VDDUSB

3.0

3.3

Backup battery voltage

V_BCKP

1.4

Backup battery current

SW backup current

Input pin voltage range

Digital IO pin low level input voltage

Digital IO pin high level input voltage

I_BCKP

I_SWBCKP

15

30

VIN

VIL

VIH

0

0

0.7*VCC

3.6

3.6

3.6

3.6

VCC

V

V

V

V

µA

µA

V

0.2*VCC  V

VCC

V

V_BCKP = 1.8 V, VCC = 0 V

VCC = 3 V

UBX-15031086 - Production information
C1-Public

Electrical specification

Page 18 of 29

NEO-M8 - Data sheet

Parameter

Symbol

Min

Typical

Digital IO pin low level output voltage

VOL

Digital IO pin high level output voltage  VOH

VCC–0.4

Pull-up resistor for RESET_N (internal)  RPU

11

Max

0.4

Units  Condition

IOL = 4mA

IOH = 4mA

V

V

kΩ

USB_DM, USB_DP

VCC_RF voltage

VCC_RF output current

Receiver chain noise figure  12

Operating temperature

Table 10: Operating conditions

VINU

Compatible with USB with 27 Ω series resistance

VCC_RF

ICC_RF

NFTOT

TOPR

–40

VCC–0.1

2.0

V

mA

dB

°C

50

85

☞  Operation beyond the specified operating conditions can affect device reliability.

Indicative current requirements

4.3
Table 11 lists examples of the total system supply current for a possible application.

☞  Values  in  Table  11  are  provided  for  customer  information  only  as  an  example  of  typical  power
requirements.  Values  are  characterized  on  samples,  actual  power  requirements  can  vary
depending on FW version used, external circuitry, number of SVs tracked, signal strength, type of
start as well as time, duration and conditions of test.

Parameter

Symbol

Module

Typical
GPS & GLONASS

Typical
GPS

Max  Units  Condition

Max. supply current  13

ICCP

All

67

mA

Average supply current  14, 15

ICC Acquisition
16

ICC Tracking
(continuous mode)

ICC Tracking
(Power Save mode /
1 Hz)

NEO-M8N

NEO-M8M

NEO-M8Q

NEO-M8J

NEO-M8N

NEO-M8M

NEO-M8Q

NEO-M8J

NEO-M8N

32

24

30

31

30

21

28

29

13

NEO-M8M

5.3

NEO-M8Q

11.5

NEO-M8J

12

25

19

24

24

23

17

23

23

12

4.8

11.1

11

mA

Estimated at 3 V

mA

mA

mA

mA

Estimated at 3 V

mA

mA

mA

mA

Estimated at 3 V

mA

mA

mA

Table 11: Indicative power requirements at 3.0 V

☞  For more information about power requirements, see the NEO-8Q / NEO-M8 Hardware integration

manual [1].

☞  For  more  information  on  how  to  noticeably  reduce  current  consumption,  see  the  Power

Management Application Note [5].

12 Only valid for the GPS band.
13 Use this figure to dimension maximum current capability of power supply. Measure this parameter with 1 Hz bandwidth.
14 Use this figure to determine required battery capacity.
15 Simulated GNSS constellation using power levels of -130 dBm. VCC = 3.0 V.
16 Average current from start-up until the first fix.

UBX-15031086 - Production information
C1-Public

Electrical specification

Page 19 of 29

4.4  SPI timing diagrams
To  avoid  incorrect  operation  of  the  SPI,  the  user  needs  to  comply  with  certain  timing  conditions.
Consider the following signals for timing constraints:

NEO-M8 - Data sheet

Symbol

Description

SPI  CS_N (SS_N)

Slave select signal

SPI  CLK (SCK)

Slave clock signal

Table 12: Symbol description

Figure 3: SPI timing diagram

4.4.1  Timing recommendations

The recommendations below are based on a firmware running from flash memory.

Parameter

Description

Recommendation

tINIT

tDES

tbit

tbyte

Minimum initialization time

10 us

Deselect time

1 ms

Minimum bit time

180 ns (5.5 MHz maximum bit frequency)

Minimum byte period

8 µs (125 kHz maximum byte frequency)

Table 13: SPI timing recommendations

☞  The  values

in  Table  13  result  from  the  requirement  of  an  error-free  transmission.
By  allowing  just  a  few  errors  and  disabling  the  glitch  filter,  the  bit  rate  can  be  increased
considerably.

4.5  DDC timing diagrams
The DDC interface is I2C Fast Mode compliant. For timing parameters, consult the I2C standard.

☞  The maximum bit rate is 400 kbit/s. The interface stretches the clock when slowed down when

serving interrupts, so real bit rates may be slightly lower.

UBX-15031086 - Production information
C1-Public

Electrical specification

Page 20 of 29

5  Mechanical specifications

NEO-M8 - Data sheet

Figure 4: NEO-M8 mechanical drawing

Symbol

Min [mm]

Typ. [mm]  Max [mm]

A

B

C

D

E

F

G

H

K

M

N

P*

Weight

15.9

12.1

2.2

0.9

1.0

2.9

0.9

-

0.7

0.8

0.4

0.0

16.0

12.2

2.4

1.0

1.1

3.0

1.0

0.82

0.8

0.9

0.5

-

1.0 g

16.1

12.3

2.6

1.1

1.2

3.1

1.1

-

0.9

1.0

0.6

0.5

Table 14 NEO-M8 mechanical dimensions

The de-paneling residual tabs may be on either side (not both)

☞  The mechanical picture of the de-paneling residual tabs (P*) is an approximate representation. The

shape and position of the residual tab may vary.

☞  When designing the component keep-out area, note that the de-paneling residual tabs can be on

either side of the module (not both).

☞  For  information  about  the  paste  mask  and  footprint,  see  the  NEO-8Q  /  NEO-M8  Hardware

integration manual [1].

UBX-15031086 - Production information
C1-Public

Mechanical specifications

Page 21 of 29

NEO-M8 - Data sheet

6  Reliability tests and approvals

6.1  Reliability tests

☞  The NEO-M8N, NEO-M8J, NEO-M8Q, and NEO-M8M modules are based on AEC-Q100 qualified

GNSS chips.

Tests  for  product  family  qualifications  are  according to  ISO  16750  "Road  vehicles  –  environmental
conditions and testing for electrical and electronic equipment”, and appropriate standards.

6.2  Approvals

The NEO-M8N, NEO-M8J, NEO-M8Q, and NEO-M8M modules comply with the
Directives  2011/65/EU  and  2015/863/EU  of  the  European  Parliament  and  the
Council on the Restriction of Use of certain Hazardous Substances (RoHS).

UBX-15031086 - Production information
C1-Public

Reliability tests and approvals

Page 22 of 29

NEO-M8 - Data sheet

7  Product handling and soldering

7.1  Packaging
To enable efficient production, production lot set-up and tear-down, the NEO-M8 GNSS modules are
delivered  as  hermetically  sealed,  reeled  tapes.  For  more  information,  see  the  u-blox  Packaging
Information Reference [3].

7.1.1  Reels

The NEO-M8 GNSS modules are deliverable in quantities of 500 pcs on a reel. The NEO-M8 modules
are shipped on reel type A, as specified in the u-blox Packaging Information Reference [3].

7.1.2  Tapes

The dimensions and orientations of the tapes for NEO-M8 modules are specified in Figure 5.

Figure 5: Dimensions (in mm) and orientation for NEO-M8 modules on tape

7.2  Shipment, storage and handling
For  important  information  regarding  shipment,  storage  and  handling,  see  the  u-blox  Packaging
Information Reference [3].

7.2.1  Moisture sensitivity levels

The moisture sensitivity level (MSL) relates to the packaging and handling precautions required. The
NEO-M8 modules are rated at MSL level 4.

☞  For MSL standard see IPC/JEDEC J-STD-020, which can be downloaded from www.jedec.org.

UBX-15031086 - Production information
C1-Public

Product handling and soldering

Page 23 of 29

NEO-M8 - Data sheet

☞  For more information regarding MSL, see the u-blox Packaging Information Reference [3].

7.2.2  Reflow soldering

Reflow profiles are to be selected according to u-blox recommendations (see the NEO-8Q / NEO-M8
Hardware Integration Manual [1]).

7.2.3  ESD handling precautions

⚠  NEO-M8  modules  are  electrostatic  sensitive  devices  (ESD).  Observe  precautions  for  handling!

Failure to observe these precautions can result in severe damage to the GNSS receiver!

GNSS  receivers  are  electrostatic  sensitive  devices  (ESD)  and  require  special  precautions  when
handling.  Exercise  particular  care  when  handling  patch  antennas,  due  to  the  risk  of  electrostatic
charges.  In  addition  to  standard  ESD  safety  practices,  take  the  following  measures  into  account
whenever handling the receiver:

•  Unless  there  is  a  galvanic  coupling  between  the  local
GND (i.e. the work desk) and the PCB GND, the first point
of  contact  when  handling  the  PCB  must  always  be
between the local GND and PCB GND.

•  Before mounting an antenna patch, connect ground of

the device.

•  When handling the RF pin, do not come into contact with
any charged capacitors and be careful when contacting
materials that can develop charges (e.g. patch antenna
~10 pF, coax cable ~50-80 pF/m, soldering iron).

•  To  prevent  electrostatic  discharge  through  the  RF
input, do not touch any exposed antenna area. If there is
any risk that such exposed antenna area is touched in a
non-ESD  protected  work  area,  implement  proper  ESD
protection measures in the design.

•  When  soldering  RF  connectors  and  patch  antennas  to
the  receiver’s  RF  pin,  make  sure  to  use  an  ESD  safe
soldering iron (tip).

UBX-15031086 - Production information
C1-Public

Product handling and soldering

Page 24 of 29

NEO-M8 - Data sheet

8  Default messages

Interface

UART output

USB output

UART input

USB input

DDC

SPI

TIMEPULSE
(1 Hz Nav)

Settings

9600 baud, 8 bits, no parity bit, 1 stop bit.
Configured to transmit both NMEA and UBX protocols, but only the following NMEA (and no
UBX) messages have been activated at start-up:

GGA, GLL, GSA, GSV, RMC, VTG, TXT

Configured to transmit both NMEA and UBX protocols, but only the following NMEA (and no
UBX) messages have been activated at start-up:
GGA, GLL, GSA, GSV, RMC, VTG, TXT
USB power mode: bus-powered

9600 baud, 8 bits, no parity bit, 1 stop bit, autobauding disabled.
Automatically accepts following protocols without need of explicit configuration:
UBX, NMEA, RTCM
The GNSS receiver supports interleaved UBX and NMEA messages.

Automatically accepts following protocols without need of explicit configuration:
UBX, NMEA
The GPS receiver supports interleaved UBX and NMEA messages.
USB power mode: bus-powered

Fully compatible with the I2C industry standard, available for communication with an external
host CPU or u-blox cellular modules, operated in slave mode only. Default messages activated.
NMEA and UBX are enabled as input messages, only NMEA as output messages.
Maximum bit rate 400 kbit/s.

Allow communication to a host CPU, operated in slave mode only. Default messages activated.
SPI is not available in the default configuration.

1 pulse per second, synchronized at rising edge, pulse length 100 ms

Table 15: Default messages

☞  Refer  to  the  u-blox  8  /  u-blox  M8  Receiver  Description  including  Protocol  Specification  [2]  for

information about other settings.

UBX-15031086 - Production information
C1-Public

Default messages

Page 25 of 29

NEO-M8 - Data sheet

9  Labeling and ordering information

9.1  Product labeling
The labeling of u-blox NEO-M8 GNSS modules includes important product information. The location
of the NEO-M8 product type number is shown in Figure 6.

Figure 6: Location of product type number on u-blox NEO-M8 module label

9.2  Explanation of codes
Three different product code formats are used. The Product name is used in documentation such as
this data sheet and identifies all u-blox M8 products, independent of packaging and quality grade. The
Ordering  code  includes  options  and  quality,  while  the  Type  number  includes  the  hardware  and
firmware versions. Table 16 shows the structure of these three different formats.

Format

Product name

Ordering code

Type number

Structure

PPP-TGV

PPP-TGV-N

PPP-TGV-N-XX

Table 16: Product code formats

The parts of the product code are explained in Table 17.

Code

Meaning

Example

PPP

TG

V

N

Product family

NEO

Platform

Variant

M8 = u-blox M8

Function set (A-Z), T = Timing, R = DR, etc.

Option / Quality grade

Describes standardized functional element or quality grade
0 = Default variant, A = Automotive

XX

Product detail

Describes product details or options such as hard- and software revision, cable length,
etc.

Table 17: Part identification code

9.3  Ordering codes

Ordering code

Product

NEO-M8J-0

NEO-M8M-0

NEO-M8N-0

NEO-M8Q-0

u-blox M8 Concurrent GNSS LCC Module, crystal, flash, SAW, LNA, 12.2x16 mm, 500 pcs/reel

u-blox M8 Concurrent GNSS LCC Module, crystal, ROM, 12.2x16 mm, 500 pcs/reel

u-blox M8 Concurrent GNSS LCC Module, TCXO, flash, SAW, LNA, 12.2x16 mm, 500 pcs/reel

u-blox M8 Concurrent GNSS LCC Module, TCXO, ROM, SAW, LNA, 12.2x16 mm, 500 pcs/reel

Table 18: Product ordering codes for professional grade modules

☞  Product changes affecting form, fit or function are documented by u-blox. For a list of Product

Change Notifications (PCNs), see our website.

UBX-15031086 - Production information  Labeling and ordering information
C1-Public

Page 26 of 29

NEO-M8 - Data sheet

Appendix

A  Glossary

Abbreviation

Definition

AEC

BBR

DDC

Automotive Electronics Council

Battery Backed RAM

Display Data Channel

EGNOS

European Geostationary Navigation Overlay Service

ESD

FOC

Electrostatic Sensitive Device*

Full Operational Capability

GAGAN

GPS Aided GEO Augmented Navigation

GLONASS

GLObal Navigation Satellite System (Russian)

GNSS

GPIO

GPS

IMES

I2C

IEC

ISO

LCC

LCS

LNA

MSAS

MSL

NMEA

PPP

PCB

PCN

PPS

QZSS

RLM

RRLP

RTC

RTCM

SAW

SBAS

SCL

SMD

SUPL

TCXO

TTFF

UART

UTC

Global Navigation Satellite System

General Purpose Input/Output

Global Positioning System

Indoor MEssaging System

Inter-Integrated Circuit

International Electrotechnical Commission

International Organization for Standardization

Leadless Chip Carrier

LoCation Services (protocol)

Low Noise Amplifier

MTSAT Satellite Augmentation System

Moisture Sensitivity Level

National Marine Electronics Association

Point-to-Point Protocol* / Precise Point Positioning*

Printed Circuit Board

Product Change Notification

Pulse Per Second

Quasi-Zenith Satellite System

Return Link Message

Radio Resource LCS Protocol

Real Time Clock

Radio Technical Commission for Maritime Services

Surface Acoustic Wave

Satellite-Based Augmentation System

Serial Clock

Solder Mask Defined

Secure User Plane Location

Temperature-Compensated Crystal Oscillator

Time-To-First-Fix

Universal Asynchronous Receiver/Transmitter

Coordinated Universal Time

WAAS

Wide Area Augmentation System

Table 19: Explanation of the abbreviations and terms used

UBX-15031086 - Production information
C1-Public

Appendix

Page 27 of 29

NEO-M8 - Data sheet

Related documents
[1]  NEO-8Q / NEO-M8 Hardware integration manual, UBX-15029985
[2]  u-blox 8 / u-blox M8 Receiver description including Protocol Specification, UBX-13003221
[3]  u-blox Packaging Information Reference, UBX-14001652
[4]  RTCM 10402.3 Recommended Standards for Differential GNSS, Ver. 2.3, RTCM AUG. 20, 2001
[5]  Power Management Application note, UBX-13005162
[6]  Radio Resource LCS Protocol (RRLP), (3GPP TS 44.031 version 11.0.0 Release 11)

☞  For regular updates to u-blox documentation and to receive product change notifications, register

on our homepage (www.u-blox.com).

Revision history

Revision  Date

Comments

R01

R02

R03

R04

R05

R06

R07

R08

R09

28-Jan-2016  Advance Information

01-Jun-2016  Added NEO-M8M and NEO-M8Q variant information, pin name change advisory

05-Aug-2016  Product Information

23-May-2019  Updated sections 1.6.3 (AssistNow Autonomous), 184.1 (Absolute maximum rating) and

6.2 (RoHS statement), added PIO numbers in section 2.1

24-Jan-2020  Updated section 4.2 Operating conditions (power supply voltage for NEO-M8M)

25-Mar-2020  Updated grade information in section 1.2 (Product features table)

30-Apr-2020  Updated type number and PCN reference for NEO-M8N and NEO-M8Q in page 2

15-Feb-2021  Added NEO-M8J variant information

04-May-2021  Updated page 2 (NEO-M8J to Initial Production status, NEO-M8J FW to SPG3.05,

updated type number and PCN reference for NEO-M8M). Adjusted section 4.1 (NEO-M8M
storage temperature). Updated NEO-M8J content in section 4.3 (Indicative current
requirements).

R10

22-Jun-2021  Updated type number and PCN reference for NEO-M8N, NEO-M8J and NEO-M8Q in page

2.
Updated position accuracy in single GAL constellation (section 1.3 Performance).

R11

22-Oct-2021  Document status updated to Production information in section Document information,

updated Table 1 (added horizontal position accuracy with SBAS).

R12

R13

R14

16-Dec-2022  Chapter Mechanical specifications updated with information on de-paneling residual tabs

1-Apr-2025

Updated the reel type, delivery quantity and tape dimensions in sections Reels and Tapes.

30-Sept-2025  Updated product weight in Mechanical specifications

UBX-15031086 - Production information
C1-Public

Related documents

Page 28 of 29

NEO-M8 - Data sheet

Contact
u-blox AG

Address:  Zürcherstrasse 68

8800 Thalwil
Switzerland

For further support and contact information, visit us at www.u-blox.com/support.

UBX-15031086 - Production information
C1-Public

Contact

Page 29 of 29

