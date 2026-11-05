#pragma once
// Stub de <SD.h> para revisar la sintaxis de cal_onboard.cpp en el PC (solo declaraciones)
#include <Arduino.h>
#define FILE_READ "r"
struct File {
    operator bool() const;
    int read(uint8_t *, size_t);
    size_t size();
    const char *name();
    bool isDirectory();
    File openNextFile();
    void close();
};
struct SDFS { File open(const char *, const char *m = FILE_READ); };
extern SDFS SD;
