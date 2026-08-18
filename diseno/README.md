# `diseno/` — las planchas

Aquí se aprueba un vehículo, una ciudad o una trampa **antes** de modelarlo en
Three. Es SVG, no entra en el `build` y no lo importa nada de `src/`.

```bash
pnpm planchas      # diseno/planchas/parque-movil.html — 15 blindados + 16 ciudades
pnpm propuestas    # diseno/planchas/propuestas.html   — 9 trampas + 3 calles
```

**Las planchas son un render, no la fuente.** Todo lo que aprueban está escrito
en los documentos: `ARTE.md`, `docs/ARTE-VEHICULOS.md`, `docs/CATALOGO-VEHICULOS.md`,
`docs/ESCENARIOS.md`, `docs/TRAMPAS.md` y `docs/DECISIONES.md`. Si borras los HTML
generados no se pierde ninguna decisión — se regeneran con los dos comandos de
arriba.

## Por qué existe

Los blindados anteriores se modelaron directamente en Three y salieron siete
cajas con un tubo. El fallo no fue de ejecución: la guía mandaba «3 a 6 formas
por objeto» y «fuera todo detalle por debajo de 8 px», y cumplirla al pie de la
letra da exactamente eso.

Cuando el error está en la guía, mirar el resultado uno a uno no lo detecta. Hace
falta ver **los quince juntos, al mismo zoom**, y eso cuesta un día de modelado
por vehículo si se hace en 3D. En SVG cuesta un `node`.

## Qué hay dentro

| Fichero | Qué es |
|---|---|
| `paleta.js` | `tono()` y derivados, los dos bandos, la mampostería y los dieciséis teatros |
| `primitivas.js` | Caminos, `siluetaUnica` (un cuerpo, un contorno) y el lienzo con el volteo de Y |
| `vehiculos.js` | Los perfiles de casco, el tren de rodaje y las quince fichas |
| `decorado.js` | `apoyado()`, el motor de colocación y las catorce familias urbanas |
| `escenas.js` | Terreno, perfil de ruinas de fondo, hitos y montaje de la escena |
| `modificadores.js` | Las nueve trampas y su lenguaje visual |
| `canones.js` | *Histórico*: las dos piezas alternativas que se descartaron |
| `planchas.mjs` · `propuestas.mjs` | Generan los dos HTML |

## Qué comparte con el juego, y por qué importa

| Plancha | Juego | Tiene que ser el mismo |
|---|---|---|
| `paleta.js` | `src/art/vehiculo/paleta.js` | los **factores** de `tono()`, no los hex |
| `Y_PIVOTE` | `CONFIG` | el eje de elevación, `ARTE.md` §9 |
| proporciones de las fichas | `fichas/` | largo de casco, radio de rueda, largo de tubo |
| dos pasadas de contorno | shell de casco invertido | el resultado, no la técnica |

**Si una plancha y el juego se ven distintos, el roto está en el juego.** La
plancha no es un boceto: es la especificación con la que se compara.

## Tres reglas del módulo

**Un cuerpo, un contorno.** `siluetaUnica` pinta dos veces: primero todas las
piezas con un trazo grueso del color de contorno, después las mismas rellenas
encima. Los bordes interiores quedan tapados y solo sobrevive el perímetro. No
hay alternativa: `filter` y las máscaras están prohibidas por `ARTE.md` §1.6, y un
contorno por pieza reintroduce las costuras que la regla existe para quitar.

**Nada con base plana.** El borde inferior de todo lo que se apoya se construye
con el perfil del terreno (`apoyado()`). Con base recta la pieza toca el suelo en
un punto y flota en el resto, y como el decorado se pinta después del terreno el
hueco no lo tapa nada.

**Cero arcos y cero azar sin sembrar.** Ningún camino usa `A`: los flags de
barrido se invierten al voltear la Y y no hay forma de comprobarlos sin mirar el
resultado. Y todo lo que se coloca sale de `mulberry32` sembrado, porque dos
móviles con el mismo código de sala tienen que ver el mismo campo.

## Depurar el apoyo

```js
globalThis.__DEPURA_SUELO = true;   // superpone el perfil del terreno en magenta
```

Es lo que descubrió que las piezas **sí** se apoyaban y que lo que engañaba era la
cresta de fondo. Ver `docs/DECISIONES.md` §2.
