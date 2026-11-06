#pragma once
// Stub de <esp_attr.h> para el PC. RTC_NOINIT_ATTR pone la variable en una seccion propia: el arnes la vuelca a un archivo entre
// "reinicios" y la recarga, como la memoria RTC que sobrevive a un reinicio por software, watchdog o brownout.
// Como se encuentra esa seccion (inicio y tamano) depende del enlazador: ver rtc_host.h.
#if defined(__APPLE__)
// Mach-O exige "segmento,seccion" (el nombre de la seccion, de hasta 16 caracteres)
#define RTC_NOINIT_ATTR __attribute__((section("__DATA,rtc_noinit"), used))
#else
// GNU ld define __start_rtc_noinit_host y __stop_rtc_noinit_host para una seccion cuyo nombre es un identificador de C.
#define RTC_NOINIT_ATTR __attribute__((section("rtc_noinit_host"), used))
#endif
