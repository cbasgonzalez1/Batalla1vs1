# artilleria-1v1

Prototipo jugable de artillería 1v1 por turnos, vertical, control a un pulgar.

## Comandos

```bash
pnpm dev       # servidor local, puerto 5173 fijo (strictPort)
pnpm test      # vitest, sin navegador
pnpm build
pnpm preview   # sirve dist/, no es el servidor de desarrollo
```

pnpm, nunca npm: hay `pnpm-lock.yaml` y `packageManager` fijado. Un `npm install`
crea un lock paralelo y desincroniza las dependencias.

## Arquitectura

- Vite + JS vanilla + Three.js. NO TypeScript, NO React, NO framework de UI.
- Capas, de dentro afuera: `src/core/` (puro: rng, mathx, easing, noise) →
  `src/game/` (simulación: balística y combate) → `src/world/` + `src/art/`
  (escena) + `src/ui/` (DOM) → `src/main.js` (ensambla y arranca).
- La dirección no se invierte: `core/` no depende de nadie, y `game/` no importa
  Three, no toca el DOM y no conoce `world/`, `art/` ni `ui/`. Si necesitas Three
  en una de esas capas, la pieza está en la capa equivocada — muévela, no
  relajes la regla.
- Esto no es documentación: lo vigila `tests/arquitectura.test.js` y falla en
  rojo. Ese mismo test prohíbe `Math.random()` y la lectura del reloj en
  `core/` y `game/`.

## Restricciones duras

- PROHIBIDO instalar o usar Rapier, cannon-es, ammo.js o cualquier motor de
  física. La integración es propia: paso fijo `FIXED_DT` = 1/120 s, Euler
  semi-implícito.
- Determinismo obligatorio: ninguna llamada a `Math.random()` en el bucle de
  simulación. La única fuente de azar es `mulberry32` sembrado
  (`src/core/rng.js`), inyectado por constructor. Sin relojes ni `Date.now()`
  dentro de la simulación.
- Exponer siempre `window.render_game_to_text()` (ángulo, potencia, viento,
  posición y velocidad del proyectil, altura del terreno muestreada, turno
  activo) y `window.advanceTime(ms)` para avanzar frames de forma determinista.
- Sin cuentas, sin login, sin base de datos. Se entra a una sala con un código
  y ya está.

## El servidor no simula

Hay servidor porque el juego es online por equipos (hasta 3 por bando), pero su
único trabajo es repartir mensajes entre los móviles de una sala. No calcula
balística, no aplica daño y no guarda el estado de la partida.

Cada móvil simula la partida entera a partir de la semilla y de los inputs que
recibe: el mismo paso fijo y el mismo PRNG dan el mismo resultado en los seis
dispositivos. Por eso viaja el input (ángulo, potencia, reacción), nunca la
posición del proyectil.

Esto es innegociable, y no por elegancia: si el servidor empieza a calcular,
hay dos verdades que mantener sincronizadas y el determinismo deja de servir
para nada. Si algo no cuadra entre dos móviles, el fallo está en la simulación
o en el orden de los inputs, nunca en "lo que dijo el servidor".

`server/salas.js` tiene toda la lógica y se prueba sin abrir un socket;
`server/index.js` es solo transporte. En el servidor SÍ se puede usar
`Math.random()` y el reloj — el determinismo que importa vive en el navegador, y
el servidor solo elige códigos de sala y la semilla inicial, que reparte a todos
antes de empezar.

```bash
pnpm server            # puerto 8787
pnpm verificar:sala    # seis clientes reales; SABOTEAR=1 rompe uno a proposito
pnpm verificar:red     # dos navegadores jugando de verdad
pnpm verificar:3v3     # seis navegadores, tres por bando
```

En producción el servidor sirve **también** el juego desde `dist/`, así que hay
un solo origen: el WebSocket no necesita CORS y detrás de HTTPS pasa a `wss`
solo. El cliente lo detecta mirando el puerto — el 5173 es Vite en desarrollo y
solo ahí busca el servidor aparte. Un contenedor, un dominio, sin base de datos.

Cuidado al escribir estas verificaciones: los guiones tienen que **esperar a que
el disparo llegue a todos** antes de avanzar el tiempo. Si no, el que aún no lo
ha recibido avanza en vano, se queda un turno atrás y el resultado parece una
desincronía del juego cuando el roto es el guion. Ha pasado dos veces.

Los inputs viajan sellados con el paso en que se aplican (`src/game/cola.js`).
Un input no se ejecuta cuando llega, sino en su paso: así los seis móviles hacen
lo mismo en el mismo momento aunque los mensajes lleguen en distinto orden. Lo
que llega tarde **no se aplica** — hacerlo divergiría — y se apunta para poder
avisar. Cada turno se manda una huella del estado y el servidor avisa si dos
móviles no coinciden.

## Convenciones

- Comentarios y nombres en español. Los comentarios explican el porqué de una
  decisión, nunca el qué hace la línea siguiente.
- La configuración numérica vive en el objeto `CONFIG` de `src/main.js`, no
  dispersa en constantes por fichero.
- Los valores de arte (paleta, luces, roughness, easings, duraciones) salen de
  `ART.md`. Si vas a inventarte un color o una duración, para y pregunta.

## Bucle de test

Tras cada cambio significativo, antes de decir que algo funciona: levantar
`pnpm dev`, ejecutar el cliente Playwright y revisar capturas y errores de
consola.

```bash
node "$WEB_GAME_CLIENT" --actions-file "$WEB_GAME_ACTIONS" --url http://localhost:5173
```

Las dos variables están en `.env.local` (fuera de git) y apuntan a
`scripts/`, no a `~/.claude/skills`: Node resuelve `node_modules` desde la
carpeta del script, así que el cliente de la skill solo encuentra `playwright`
si vive dentro del proyecto. El cliente escribe `state-N.json` y `shot-N.png` en
`--screenshot-dir`; no imprime nada por stdout.

Con `pnpm dev` levantado:

```bash
pnpm verificar:idioma        # cinco idiomas de dispositivo en un Chromium real
pnpm verificar:determinismo  # dos pestanas, misma semilla, mismo texto
```

## Idioma

Español si el dispositivo está en español, inglés en cualquier otro caso. No hay
selector: manda el idioma del móvil, que es lo que espera quien abre un enlace y
se pone a jugar.

Los textos van en `src/ui/i18n.js` y solo ahí. En el marcado se etiquetan con
`data-i18n` (contenido) y `data-i18n-aria` (etiqueta accesible), dejando el
español escrito en el HTML como respaldo por si el módulo no carga. Si añades un
texto y olvidas traducirlo, `tests/ui/i18n.test.js` falla: las dos tablas tienen
que tener las mismas claves.
