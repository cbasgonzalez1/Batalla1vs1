# artilleria-1v1

Prototipo jugable de artillería 1v1 por turnos, vertical, control a un pulgar.

## Comandos

```bash
pnpm dev       # servidor local, puerto 5173 fijo (strictPort)
pnpm build
pnpm preview   # sirve dist/, no es el servidor de desarrollo
```

pnpm, nunca npm: hay `pnpm-lock.yaml` y `packageManager` fijado. Un `npm install`
crea un lock paralelo y desincroniza las dependencias.

## Arquitectura

- Vite + JS vanilla + Three.js. NO TypeScript, NO React, NO framework de UI.
- Capas, de dentro afuera: `src/core/` (puro: rng, mathx, easing, noise) →
  `src/game/` (simulación) → `src/world/` + `src/art/` (presentación) →
  `src/main.js` (ensambla y arranca).
- La dirección no se invierte: nada de `core/` ni `game/` importa Three ni toca
  el DOM. Si necesitas Three en una de esas capas, la pieza está en la capa
  equivocada.

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
- Un solo puerto. Sin backend, sin cuentas, sin menús.

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

Las dos variables están en `.env.local` (fuera de git). Apuntan a la skill
`develop-web-game`, cuyas rutas por defecto son de Codex y aquí no resuelven.
Playwright no es dependencia del proyecto: se usa vía `npx`, con Chromium ya
instalado en `~/.cache/ms-playwright/`.
