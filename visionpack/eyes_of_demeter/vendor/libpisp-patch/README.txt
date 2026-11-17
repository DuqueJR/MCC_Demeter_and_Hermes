Demeter maintains a small libpisp example extension for decoding the captured
PISP_COMP1 format. The source is based on Raspberry Pi libpisp commit
f8a5eb2af4c5dea76442785ef42b2fb1aa9e62f9 (version 1.7.0).

build.sh clones that exact commit into .build/sources/libpisp, then overlays
praw2rgb.cpp and examples-meson.build from this directory before building.
The upstream libpisp source is not modified in place by this project.

The copied and modified example is distributed under the upstream BSD-2-Clause
license; see LICENSE. The surrounding libpisp source remains available from
https://github.com/raspberrypi/libpisp at the pinned commit in dependencies.lock.