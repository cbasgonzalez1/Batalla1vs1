# Sonidos

Suelta aquí los MP3 con **exactamente estos nombres**. El juego los carga solos
al arrancar; los que falten simplemente no suenan, sin errores ni huecos.

| Fichero | Cuándo suena | Qué pide |
|---|---|---|
| `disparo.mp3` | al soltar el dedo | seco y corto, < 400 ms |
| `impacto.mp3` | el proyectil revienta | grave, con cuerpo |
| `pluma.mp3` | la arena cae a sotavento | siseo suave, ~1,4 s |
| `escudo.mp3` | se gasta una carga de escudo | metálico, breve |
| `salto.mp3` | el vehículo brinca | mecánico, breve |
| `victoria.mp3` | cae el último rival | 1-2 s |
| `viento.mp3` | fondo continuo | bucle limpio, sin golpes en los extremos |

Consejos que ahorran retoques: exporta en mono a 128 kbps (es un juego, no un
disco, y en móvil se nota el peso más que la calidad), deja el silencio inicial
recortado a cero —si no, el disparo llega tarde— y normaliza a -3 dBFS para que
no saturen al mezclarse.

`viento.mp3` es el único que se reproduce en bucle: si tiene un chasquido en el
corte, se oirá cada vez que dé la vuelta.
