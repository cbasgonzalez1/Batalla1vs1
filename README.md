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

## Jugar con amigos

```bash
pnpm server     # sala de batalla, puerto 8787
pnpm dev        # el juego
```

Abre `?online`, teclea tu nombre y pulsa **Crear sala**: sale un código de
cuatro letras para dictar por teléfono. Los demás entran con ese código, eligen
bando y confirman.

Hasta **3 por bando**, y los bandos pueden ser desiguales — en familia nunca
sois pares. El turno alterna bando y rota dentro de cada uno (`Ana → Bea → Caro
→ Dani → Eva → Fran`), saltando a quien ya ha caído. Gana el bando que deja al
otro sin nadie.

Durante el vuelo, la ventana de reacción se le abre al rival **más cercano al
impacto previsto**: es el único a quien le sirve de algo gastar una carga.

No hay cuentas ni registro: se entra con un código y ya está.

```bash
pnpm verificar:lobby   # dos navegadores reales entrando a la misma sala
pnpm verificar:red     # dos navegadores jugando cuatro turnos de verdad
pnpm verificar:3v3     # seis navegadores, tres por bando
pnpm verificar:fase2   # que la franja se pinta y el vernier afina 4x
pnpm verificar:ia      # que la dificultad significa algo, en terreno real
pnpm verificar:partida-ia  # una partida entera contra la maquina
pnpm verificar:replay  # se juega, se copia el enlace y se reproduce
pnpm verificar:trampas # que el deflector devuelve el tiro y castiga
pnpm verificar:sala    # seis clientes; SABOTEAR=1 rompe uno a proposito
```

## Desplegar

Un solo contenedor: el servidor de salas sirve también el juego ya compilado.
Eso significa un único dominio que configurar, el WebSocket va al mismo origen
y detrás de HTTPS pasa a `wss` sin tocar nada.

```bash
docker build -t batalla1vs1 .
docker run -p 8787:8787 batalla1vs1
```

En **Dokploy**: aplicación nueva de tipo Dockerfile apuntando a este repo,
puerto interno `8787`, dominio con HTTPS y **WebSocket habilitado en el proxy**
(Traefik lo hace solo, pero conviene comprobarlo: sin eso la sala conecta y se
cae en cuanto empieza a hablar). No hace falta base de datos, ni volúmenes, ni
variables de entorno — salvo `PUERTO` si te conviene otro.

El estado vive en memoria: al reiniciar el contenedor se pierden las salas
abiertas. Es a propósito, no hay nada que valga la pena persistir.

## Parámetros por URL

| Parámetro | Valores | Qué hace |
|---|---|---|
| `?seed=` | cualquier texto | Semilla del terreno y del viento |
| `?assist=` | `0` … `1` | Recorte del arco. `1` arco entero, `0` solo 3 puntos |
| `?biome=` | `dunas`, `placa`, `salar`, `caldera`, `tranquilidad`, `selva` | Bioma; cambia paleta y color del proyectil |
| `?trampas=` | `0` … `1` | Minas, deflectores y muros en el campo |
| `?online` | — | Abre la pantalla de sala |
| `?sala=` | código de 4 letras | Entra directo a esa sala |
| `?servidor=` | `ws://host:puerto` | Otro servidor de salas |
| `?ia=` | `facil`, `normal`, `dificil` | La máquina lleva el bando B |
| `?replay=` | código del enlace | Repite un combate guardado |

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

El HUD enseña el viento de ahora y, en fantasma, **el del turno siguiente** — se
puede porque el PRNG va sembrado y ese valor ya está calculado. Eso da el reloj:
*me quedan tres turnos para empujarle arena encima antes de que gire*.

Y tras cada fallo salen dos números, no uno: `Corto 9,9 · Arena +1,3 a 19`.
Cuánto fallaste **y qué construiste**. A 88 unidades no ves tu impacto, así que
sin eso fallar no enseñaba nada y el turno se tiraba a la basura.

### La franja y el vernier

Arriba del todo, las 140 unidades del campo comprimidas en 44 px: el perfil del
terreno, los vehículos, tu marca corta y tu larga con la banda entre ellas, y
—mientras arrastras— dónde va a caer tu arena.

La resolución es **basta a propósito**: una muestra cada 4 unidades, más del
doble del radio de explosión. Da topología, no solución de tiro. Si permitiera
apuntar, el juego sería leer una barra en vez de tirar.

El **vernier** resuelve un problema medido: el arrastre útil son ~106 px en un
móvil, y como la potencia interpola el cuadrado de la velocidad, 1 px vale ~1,07
unidades de alcance. Corregir 1,5 unidades pedía mover el dedo 1,4 px, por debajo
del temblor de un pulgar. Ahora, dentro de 40 px del arrastre anterior, el dedo
pesa **cuatro veces menos**. Sin modos y sin botón: la función es continua, así
que no hay salto al cruzar el borde.

### Aludes

La arena que queda más empinada que su ángulo de reposo (34°) se derrumba. Un
depósito normal aguanta solo; tres apilados en el mismo punto, no.

Solo se mueve la arena **suelta**: el terreno generado tiene laderas de hasta
72° y está asentado. Y el reposo se mide contra el perfil de la arena, no contra
el del terreno — con arena de verdad, un depósito en una ladera resbalaría hasta
el valle y levantar el suelo del rival, que es el corazón de Sotavento, sería
imposible.

El alud es **progresivo**: cada turno se dan hasta 288 pasadas y el montón se
sigue asentando en los siguientes, cada vez menos. Forzar la convergencia de
golpe pedía más de mil pasadas y un tirón de 100 ms.

### Trampas

`?trampas=0` a `?trampas=1`. A 0 el campo está despejado; a 1 hay seis y la
mitad son deflectores.

| | Qué hace |
|---|---|
| **Mina** | Detona donde está. El cráter sale ahí, no donde apuntabas |
| **Deflector** | Invierte el tiro. **Vuelve hacia ti**, y si te cae encima te lo comes |
| **Muro** | Se traga el proyectil. No duele, pero pierdes el turno |

Aparecen **en el aire**, cortando las parábolas, y **apoyadas en la pista**,
cerrando el tiro raso —que si no sería siempre la jugada segura—. No hay
deflectores tumbados: devolverían el tiro contra el propio suelo.

Saltar para esquivar un obús y **aterrizar sobre una mina** es peor que haberse
quedado quieto. Eso es lo que hace que las trampas del suelo sean una decisión.

Salen de la semilla, así que los seis móviles siembran el mismo campo sin que el
servidor mande nada.

El rebote está medido: con el 0,82 inicial el tiro devuelto se pasaba por encima
del propio cañón y salía del mapa —volvía, pero no castigaba—. Con **0,60** cae
a 2,7 u de media del que disparó y castiga en la mitad de los rebotes.

### Jugar contra la máquina

`?ia=facil`, `?ia=normal` o `?ia=dificil` y el bando B lo lleva el ordenador.
Medido sobre 60 combates en terreno real con viento:

| Dificultad | Fallo mediano | Aciertan |
|---|---|---|
| fácil | 6,0 u | 45 % |
| normal | 3,1 u | 70 % |
| difícil | 1,4 u | 95 % |

La IA usa `simulate()` como oráculo, o sea la misma función que mueve el
proyectil de verdad: no hay una física para ella y otra para ti. **Barre** la
potencia en vez de bisecarla, porque el alcance no crece de forma monótona —
pasado cierto punto el proyectil se sale del mundo y no impacta nunca.

El fallo se mete desplazando el objetivo, no toqueteando la potencia: así falla
corta o larga, como una persona, en vez de con un ángulo raro que se ve de lejos
que es de máquina. Y con distribución normal, porque los fallos humanos se
agrupan cerca del blanco.

Todo su azar sale del PRNG sembrado, así que una partida contra la IA es tan
reproducible como una entre personas.

### Repetir un combate

Al ganar aparece **Copiar enlace**: pega ese enlace y el combate se vuelve a
jugar entero, tiro a tiro, en cualquier dispositivo. Cuatro turnos ocupan 64
caracteres.

Se puede porque la simulación es determinista: no hace falta guardar el terreno,
ni las vidas, ni dónde cayó cada proyectil. Con la semilla y la lista de tiros,
cualquier móvil lo reconstruye — y sale idéntico, no parecido.

La **revancha** también usa semilla explícita (`vostok#2`, `vostok#3`). Antes
derivaba del número de disparos del combate anterior, así que no había forma de
volver a una revancha sin repetir toda la partida previa.

### Sonido

Cableado y esperando los ficheros: suelta los MP3 en `public/audio/` con los
nombres de `public/audio/LEEME.md` y sonarán solos. Los que falten no suenan, sin
errores ni huecos — el juego es jugable sin ninguno.

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
pnpm test        # 193 tests, sin navegador
pnpm test:watch
```

Cubren el PRNG, la balística, las reglas de combate, la generación y
destrucción del terreno, la conservación de masa de Sotavento, la deriva del
viento, el reparto de turnos por equipos, el idioma y la frontera entre capas. Los números de balance
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
