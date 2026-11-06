"""Fan-out del SSE (04 §5): cada mensaje se serializa UNA vez (en `estado_mision.trama`) y cada cliente tiene una cola
acotada de `RELAY_COLA_CLIENTE_MAX` tramas. Un cliente lento no bloquea a los demas: `publicar` solo encola.

Cola llena: se descarta el `estado` mas viejo de ESE cliente; si no tiene ninguno, se cierra su conexion y el cliente se
pone al dia con el snapshot (el `EventSource` reconecta solo).
"""
from __future__ import annotations

import asyncio
import weakref
from collections import deque
from typing import AsyncIterator, Callable

from estado_mision import Emision


class Cliente:
    def __init__(self, inicial: list[bytes], cola_max: int):
        self.inicial = inicial                       # bienvenida + reanudacion: no cuentan en la cola acotada
        self.cola: deque[tuple[str, bytes]] = deque()
        self.cola_max = cola_max
        self.senal = asyncio.Event()
        self.cerrado = False                         # lo cierra el relay (cola desbordada) o el flujo al terminar
        self.descartados = 0

    def encolar(self, tipo: str, trama: bytes) -> bool:
        """False si el cliente se desbordo y hay que cerrarlo."""
        if self.cerrado:
            return True
        if len(self.cola) >= self.cola_max:
            for i, (t, _) in enumerate(self.cola):
                if t == "estado":
                    del self.cola[i]
                    self.descartados += 1
                    break
            else:
                self.cerrado = True
                self.senal.set()
                return False
        self.cola.append((tipo, trama))
        self.senal.set()
        return True


class Reserva:
    """Un puesto en el limite por IP. Se libera una sola vez, aunque el flujo nunca llegue a empezar (finalize)."""
    def __init__(self, contador: dict[str, int], ip: str):
        contador[ip] = contador.get(ip, 0) + 1
        self._fin = weakref.finalize(self, Reserva._liberar, contador, ip)

    @staticmethod
    def _liberar(contador: dict[str, int], ip: str) -> None:
        n = contador.get(ip, 0) - 1
        if n > 0:
            contador[ip] = n
        else:
            contador.pop(ip, None)

    def liberar(self) -> None:
        self._fin()


class Difusor:
    """Los clientes SSE de UNA mision."""
    def __init__(self, cola_max: int):
        self.clientes: set[Cliente] = set()
        self._cola_max = cola_max
        self.cerrados_por_desborde = 0

    def publicar(self, em: Emision) -> None:
        for c in list(self.clientes):
            if not c.encolar(em.tipo, em.trama):
                self.cerrados_por_desborde += 1
                self.clientes.discard(c)

    async def flujo(self, armar_inicial: Callable[[], list[bytes]], reserva: Reserva) -> AsyncIterator[bytes]:
        """El cuerpo del SSE. El cliente se registra AQUI, ya dentro del flujo, y `armar_inicial()` (bienvenida y
        reanudacion) corre en el mismo tramo sin `await`: no se pierde ni se repite ningun mensaje. Si el flujo nunca
        empieza (el cliente colgo antes), no queda nada registrado."""
        c = Cliente(armar_inicial(), self._cola_max)
        self.clientes.add(c)
        try:
            for t in c.inicial:
                yield t
            c.inicial = []
            while not c.cerrado:
                if not c.cola:
                    c.senal.clear()
                    await c.senal.wait()
                    continue
                yield c.cola.popleft()[1]
        finally:
            c.cerrado = True
            self.clientes.discard(c)
            reserva.liberar()
