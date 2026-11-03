#pragma once
#include <stdint.h>
#include <stddef.h>
// Solo declaraciones: las definiciones las pone el arnes (prueba_mision.cpp), con una NVS de mentira que se guarda en un archivo.
struct Preferences {
    bool begin(const char*, bool);
    void end();
    uint32_t getULong(const char*, uint32_t);
    void putULong(const char*, uint32_t);
    uint32_t getUInt(const char*, uint32_t);
    size_t getBytes(const char*, void*, size_t);
    size_t putBytes(const char*, const void*, size_t);
    bool remove(const char*);
    const char *ns_ = "";
};
