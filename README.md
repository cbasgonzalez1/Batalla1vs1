# Artillería 1v1 — prototipo

Artillería por turnos, vertical, control a un pulgar. Vite + Three.js vanilla.
La dirección de arte sale de la plancha de lookdev: cámara ortográfica a 15°,
key cálida a 45°, plástico mate y regla cruzada de contraste del proyectil.

## Arranque

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

Este proyecto usa **pnpm**. No mezclar con npm ni yarn.

## Cómo se juega

Los cañones están a **88 unidades** uno de otro: el rival no cabe en pantalla.
Hay que tirar sin verlo, o mirar antes.

| Gesto | Qué hace |
|---|---|
| Arrastrar hacia atrás y soltar | Apuntar y disparar, tipo tirachinas. Desde cualquier punto de la pantalla |
| Mantener **Otear** | La cámara barre hasta el rival. Al soltar, vuelve |
| Pellizco / rueda | Zoom manual, entre 0,55× y 2,6× |

Mientras estiras el arrastre la cámara abre plano para que quepa el arco que
ves. Cuanta más potencia cargas, más campo ves — sin llegar nunca a regalarte
la posición del rival.

### Reacción en vuelo

El gancho del juego. En artillería por turnos, mientras el proyectil vuela el
que defiende no hace nada. Aquí sí: a **0,9 s del impacto** se abre una
ventana con dos opciones y **3 cargas por combate**.

- **Escudo** — el impacto hace un 28 % del daño.
- **Salto** — el vehículo brinca 3,6 unidades alejándose del punto de caída.

Los dos gastan carga. El atacante ve cómo el rival reacciona a su tiro, y el
defensor tiene que decidir en menos de un segundo si gasta o aguanta.

### Combate

Vida 100. Un impacto directo hace 46 de daño y la metralla cae con la
distancia hasta 5,2 unidades — un tiro corto puede volarte a ti mismo. Un
combate con buena puntería por los dos lados dura **6-8 rondas**.

## Parámetros por URL

| Parámetro | Valores | Qué hace |
|---|---|---|
| `?seed=` | cualquier texto | Semilla del terreno y del viento |
| `?assist=` | `0` … `1` | Recorte del arco. `1` arco entero, `0` solo 3 puntos |
| `?biome=` | `dunas`, `placa`, `selva` | Bioma; cambia paleta y color del proyectil |

Ejemplo: `http://localhost:5173/?seed=vostok&biome=placa&assist=0.4`

## Consola

`window.GAME` expone `config`, `state`, `world`, `cam`, y para probar sin
tocar código:

```js
GAME.reseed('otra-semilla')   // combate nuevo
GAME.setAssist(0.3)           // recortar el arco
GAME.aim(45, 0.7)             // apuntar: grados y potencia 0..1
GAME.fire()                   // disparar
GAME.stepSim(120)             // avanzar 1 s de simulación sin depender del render
```

`stepSim` existe porque la simulación es determinista y por tanto reproducible
fuera del bucle de dibujo: permite probar balística, daño y reacción sin
cronómetros ni capturas.

## Estado

Hecho: terreno destructible, cañones, arco, disparo, cámara con barrido y
zoom, vida con destrucción y pantalla de victoria, y reacción en vuelo.

### Sotavento

Un cañonazo **no destruye terreno: lo traslada**. El cráter levanta la masa que
excava y el viento la deja caer a sotavento, más lejos cuanto más vertical fue
la caída del proyectil. Como el alcance de un tiro depende de la altura del
suelo bajo los dos cañones, mover arena le **invalida al rival la solución de
tiro** que le costó tres turnos encontrar.

En calma la arena vuelve al propio cráter: cavar sin viento no sirve de nada.
El viento deja de ser ruido y pasa a ser el recurso que hace permanente lo que
excavas — y como deriva en vez de sortearse, el del turno siguiente se puede
leer ya.

La pregunta del turno deja de ser *¿acerté?* y pasa a ser **¿gasto este disparo
en cerrar mi horquilla o en romper la suya?**

**Sin el motion spec todavía.** No hay retroceso del cañón, fogonazo, humo,
estela, onda expansiva, escombros ni screen shake.
Lo que sí se mueve es lo que hace falta para jugar: el barrido de cámara
(700 ms, `easeInOutCubic`), el salto de reacción (280 ms, `easeOutQuad`) y el
giro del proyectil sobre su eje.

## Arquitectura

```
src/
  core/      rng (mulberry32), ruido 1D + fBm, easings, utilidades
  game/      ballistics.js ← integrador a paso fijo, hecho a mano
             combat.js     ← vida, daño por proximidad, cargas de reacción
  art/       direction.js  ← todos los colores, luces y materiales
             geometry.js   ← caja biselada, texturas de punto y cielo
  world/     terrain.js    ← heightmap + malla extruida + destrucción
             cannon.js     ← vehículo del jugador
             gamecamera.js ← ortográfica con barrido, seguimiento y límites
             trajectory.js ← arco punteado
  ui/        hud.js        ← todo el DOM del HUD
             input.js      ← arrastrar y soltar + pellizco
  main.js    ensamblado, bucle a paso fijo y máquina de estados
```

`core/` no depende de nadie y `game/` no sabe que existe Three ni el DOM: ahí
viven la balística y las reglas de combate, y por eso se pueden probar sin
montar la escena. Lo que dibuja va en `world/` y `art/`; lo que escucha al dedo,
en `ui/`. La frontera la vigila `tests/arquitectura.test.js`.

## Idioma

Se elige solo: español si el dispositivo está en español, inglés en cualquier
otro caso. No hay selector. Un móvil en catalán o gallego (`['ca-ES','es-ES']`)
se queda en español, que para esa familia es mejor elección que el inglés.

```bash
node scripts/verificar-idioma.mjs   # con pnpm dev levantado
```

Comprueba en un Chromium real, con cinco idiomas de dispositivo, que el `lang`
del documento y los textos salen como toca y que la consola queda limpia.

## Tests

```bash
pnpm test        # 68 tests, sin navegador
pnpm test:watch
```

Cubren el PRNG, la balística, las reglas de combate, la generación y
destrucción del terreno, y la frontera entre capas. Los números de balance
(46 de daño directo, radio 5,2, escudo 0,28, 3 cargas) están escritos literales
en `tests/game/combat.test.js`: si alguien los retoca sin querer, el test falla.

### Determinismo

El estado autoritativo del terreno es un heightmap 1D; la malla solo lo
representa. La simulación avanza **solo** en pasos fijos de 1/120 s y no
consume `Math.random()` en ningún punto: toda la aleatoriedad viene de
`mulberry32` con semilla. La misma semilla y los mismos inputs dan el mismo
resultado a 30 o a 144 fps.

El arco de previsión y el proyectil real comparten la misma función `step()`.
Eso no es solo higiene: la ventana de reacción se abre contando pasos hasta el
impacto **previsto**, y solo es exacta porque la predicción y el vuelo real no
pueden divergir.

### Verificado en navegador

- Misma semilla en carga inicial y en `reseed`: 0 columnas de diferencia sobre
  384. Semilla distinta: todas cambian.
- Cráter de radio 2,6 → 5,06 de ancho medido, profundidad máxima 2,6 exacta,
  centrado en el impacto.
- `assistLevel` 1 / 0,6 / 0,25 / 0 → 43 / 27 / 13 / 3 puntos dibujados.
- Ventana de reacción: se abre a exactamente 108 pasos (0,9 s) del impacto.
  Sin reaccionar 22,7 de daño; con escudo 6,4 (factor 0,28 exacto); con salto
  6,5. La carga se descuenta en los dos casos.
- Línea de tiro despejada en 5 semillas distintas; alcance a máxima potencia
  ~109 unidades para 88 de separación.
- Zoom máximo (2,6×): el encuadre llega justo al borde del mundo, sin pasarse.
