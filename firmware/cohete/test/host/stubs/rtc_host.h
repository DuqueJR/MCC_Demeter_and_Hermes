#pragma once
// Acceso del arnes a la seccion de RTC_NOINIT_ATTR (ver esp_attr.h), portable entre Linux (GNU ld) y macOS (Mach-O).
// rtcHostInicio() = primer byte de la seccion; rtcHostTam() = su tamano. Solo lo incluye el arnes, en una unidad de compilacion.
#include <stddef.h>
#if defined(__APPLE__)
#include <mach-o/getsect.h>
#include <mach-o/ldsyms.h>
static inline char *rtcHostInicio(size_t *tam = nullptr) {
    unsigned long n = 0;
    char *p = (char *)getsectiondata(&_mh_execute_header, "__DATA", "rtc_noinit", &n);
    if (tam) *tam = p ? (size_t)n : 0;
    return p;
}
#else
extern "C" { extern char __start_rtc_noinit_host[]; extern char __stop_rtc_noinit_host[]; }
static inline char *rtcHostInicio(size_t *tam = nullptr) {
    if (tam) *tam = (size_t)(__stop_rtc_noinit_host - __start_rtc_noinit_host);
    return __start_rtc_noinit_host;
}
#endif
static inline size_t rtcHostTam() { size_t n = 0; rtcHostInicio(&n); return n; }
