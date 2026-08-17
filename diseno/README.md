# `diseno/` — las planchas

Aquí se aprueba un vehículo o una escena **antes** de modelarlo en Three. Es SVG,
no entra en el `build` y no lo importa nada de `src/`.

```bash
pnpm planchas     # escribe diseno/planchas/parque-movil.html
```

## Por qué existe

Los siete blindados anteriores se modelaron directamente en Three y salieron
siete cajas con un tubo. El fallo no fue de ejecución: la guía mandaba «3 a 6
formas por objeto» y «fuera todo detalle por debajo de 8 px», y cumplirla al pie
de la letra da exactamente eso. Cuando el error está en la guía, mirar el
resultado uno a uno no lo detecta — hace falta ver **los quince juntos, al mismo
zoom**, y eso cuesta un día de modelado por vehículo si se hace en 3D.

En SVG cuesta un `node`.

## Qué comparte con el juego, y por qué importa

| Plancha | Juego | Tiene que ser el mismo |
|---|---|---|
| `paleta.js` | `src/art/vehiculo/paleta.js` | los factores de `tono()`, no los hex |
| `Y_PIVOTE` | `CONFIG` | el eje de elevación, `ARTE.md` §9 |
| proporciones de las fichas | `fichas/` | largo de casco, radio de rueda, largo de tubo |
| dos pasadas de contorno | shell de casco invertido | el resultado, no la técnica |

**Si una plancha y el juego se ven distintos, el roto está en el juego.** La
plancha no es un boceto: es la especificación con la que se compara.

## Cómo se consigue «un cuerpo, un contorno»

`docs/ARTE-VEHICULOS.md` §12 exige que casco, torreta, mantelete, tubo y freno de
boca salgan de una silueta continua. Aquí eso se hace pintando dos veces
(`primitivas.js`, `siluetaUnica`): primero todas las piezas con un trazo grueso
del color de contorno, después las mismas piezas rellenas encima. Los bordes
interiores quedan tapados y solo sobrevive el perímetro.

No hay alternativa: `filter` y las máscaras de desenfoque están prohibidas por
`ARTE.md` §1.6, y un contorno por pieza reintroduce las costuras que la regla
existe para quitar. En 3D el equivalente es **una geometría fusionada y un solo
shell**, no un shell por pieza.

## Cero arcos

Ningún camino usa `A`. Los flags de barrido de un arco se invierten al voltear
la Y —y aquí se voltea una vez, en `lienzo()`— y no hay forma de comprobarlos
sin mirar el resultado. Todo círculo y toda cápsula salen muestreados como
polígono.

## Cero azar sin sembrar

`escenas.js` coloca decorado con `mulberry32` sembrado desde el nombre del
teatro. Dos móviles con el mismo código de sala tienen que ver el mismo campo y
el servidor no manda nada de esto: una escena con `Math.random()` es una escena
distinta en cada teléfono.
