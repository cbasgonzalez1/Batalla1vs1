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
- El arte de vehículos vive en `src/art/vehiculo/`: `paleta.js`, `primitivas.js`,
  `toon.js` (material de bandas + shell de contorno), `ensamblar.js` y una ficha
  por vehículo en `fichas/`. `world/cannon.js` **no modela**: pide un `Object3D`
  a `ensamblar.js` y lo coloca. El decorado, igual, en `src/art/decorado/`.
- `diseno/` no entra en el `build`: son las planchas de diseño en SVG con las que
  se aprueba un vehículo, una ciudad o una trampa **antes** de modelarla en Three
  (`pnpm planchas`, `pnpm propuestas`). Comparten paleta y proporciones con el
  juego a propósito — si una plancha y el juego se ven distintos, el roto está en
  el juego. Los HTML generados son un render: todo lo que aprueban está escrito en
  los documentos, y borrarlos no pierde ninguna decisión.

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
- Se entra a una sala con un código y ya está: **jugar nunca pide una cuenta**.
  Esta parte no se toca.
- «Sin cuentas, sin login, sin base de datos» está **derogado** por
  `docs/PLATAFORMA.md` §1: el juego entra **con login** y hay base de datos, y
  sirve para tres cosas y ninguna más — identidad, compras y progreso. La
  simulación no lee nada de ahí (`PLATAFORMA.md` §0.2) y el servidor sigue sin
  simular.
- **La contraseña y el token de sesión no se guardan.** En la tabla vive
  `sal$derivada` de scrypt y el sha256 del token. Quien se lleve una copia de la
  base de datos no entra en ninguna cuenta ni abre ninguna sesión.
- **Sin `DATABASE_URL` el servidor arranca igual.** Salas y partidas funcionan;
  solo se apagan cuentas, tienda y progreso. Es lo que permite que `pnpm dev` y
  las verificaciones de navegador corran sin levantar un Postgres — y de paso,
  que un fallo de la base deje el juego sin cuentas y no sin juego.
- Todo lo que se venda es **decorativo**. No es amabilidad de diseño: un dato de
  pago que entrara en el bucle de paso fijo sería pago-por-ganar *y* desincronía
  a la vez.

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
pnpm verificar:bd      # esquema, cuentas, tienda y progreso, contra un Postgres real
pnpm verificar:cuenta  # las pantallas de acceso y tienda, en un navegador de verdad
pnpm verificar:sala    # seis clientes reales; SABOTEAR=1 rompe uno a proposito
pnpm verificar:red     # dos navegadores jugando de verdad
pnpm verificar:3v3     # seis navegadores, tres por bando
```

En producción el servidor sirve **también** el juego desde `dist/`, así que hay
un solo origen: el WebSocket no necesita CORS y detrás de HTTPS pasa a `wss`
solo. El cliente lo detecta mirando el puerto — el 5173 es Vite en desarrollo y
solo ahí busca el servidor aparte. Un contenedor y un dominio.

La base de datos es **un servicio más al lado**, no una pieza de este camino:
guarda cuenta, compras y progreso, y no opina sobre ninguna partida en curso. El
servidor sigue sin simular. `docker compose up -d bd` levanta solo el Postgres
para desarrollar contra él.

Y guarda las partidas **enteras** sin guardar estado, por lo mismo que existe el
enlace de repetición: con la semilla y la lista de tiros se reconstruye el
combate golpe a golpe. Tres turnos con avance y reacción son 37 bytes.
La lógica de cuentas está en `server/cuentas.js` y se prueba sin abrir un puerto,
igual que `salas.js` se prueba sin abrir un socket; el SQL está en `server/db/` y
lo prueba `pnpm verificar:bd` contra Postgres de verdad.

En el navegador, `src/net/cuenta.js` habla con esa API y **nunca lanza**: todo
devuelve `{ ok }` o `{ ok: false, error }`, porque un servidor caído o un token
caducado tienen que dejar una pantalla con un mensaje y no el juego en negro. Las
pantallas son `src/ui/acceso.js` y `src/ui/tienda.js`, y la de acceso **solo se
monta si `GET /salud` dice que hay cuentas** — por eso `pnpm dev` y las
verificaciones de navegador siguen corriendo sin Postgres.

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

## Avanzar: la decisión del turno

Cada turno se puede mover el blindado antes de disparar (`src/game/avance.js`).
Hay un depósito que se gasta por distancia, se paga más caro cuesta arriba y no
sube de cierta pendiente. Se repone en parte cada turno, así que moverse es una
elección y no un desplazamiento gratis.

Engancha con Sotavento, que es lo importante: la arena que amontonas deja de ser
relieve y pasa a ser un **muro**. Con bastante altura delante, el rival se queda
encerrado en su hoyo. Es la primera vez que construir terreno tiene una
consecuencia directa sobre el otro jugador.

Dos reglas que no se pueden relajar:

- **`mover()` es idempotente.** Se le pasa siempre la x de inicio de turno y el
  desplazamiento pedido, nunca un incremento. Por eso el movimiento viaja por el
  cable como un solo número junto al disparo: los seis móviles lo recalculan y
  les sale lo mismo. Si fuera incremental, un cuadro perdido en un móvil movería
  el tanque a otro sitio.
- **Mover es una intención hasta que disparas**, igual que apuntar. El depósito
  no se descuenta y la posición no es autoritativa hasta `comprometerAvance()`.
  En red eso significa que tampoco el que se mueve lo aplica antes del eco.

El avance también va en el replay (campo `M` del enlace). Sin él, una repetición
tiraría desde la posición inicial y todos los impactos caerían en otro sitio a
partir del primer turno en que alguien se movió.

## Convenciones

- Comentarios y nombres en español. Los comentarios explican el porqué de una
  decisión, nunca el qué hace la línea siguiente.
- La configuración numérica vive en el objeto `CONFIG` de `src/main.js`, no
  dispersa en constantes por fichero.
- Los valores de arte salen de los documentos de arte, y **solo** de ahí. Son
  seis y no se solapan:
  - `ARTE.md` — reglas generales, paleta, teatros, suelo, fondo, movimiento y
    presupuesto de cuadro. Manda en todo lo que no tenga documento propio.
  - `docs/ARTE-VEHICULOS.md` — vehículos. **Sustituye a `ARTE.md` §5 y §8.**
  - `docs/ESCENARIOS.md` — las reglas de colocación, las catorce familias de
    decorado urbano, los nueve hitos y las tres composiciones de calle.
  - `docs/TRAMPAS.md` — las tres trampas que ya existen, los nueve modificadores
    de tiro propuestos y cómo se distinguen del decorado.
  - `docs/CATALOGO-VEHICULOS.md` — las quince fichas, con sus números.
  - `docs/DECISIONES.md` — **qué se derogó y por qué.** Antes de reintroducir una
    regla que veas en un commit antiguo, búscala ahí: la mitad de los defectos de
    arte de este juego venían de reglas escritas, no de errores de ejecución.
  - `docs/CHECKLIST-REVISION.md` — cómo se valida antes de decir que está
    terminado.

  `docs/PLATAFORMA.md` **no es uno de ellos**: no manda sobre arte. Manda sobre
  cuentas, compras, base de datos, reconexión y publicación en Android e iOS, y
  es el único sitio donde se deroga una restricción dura de este fichero.

  Si vas a inventarte un color, una medida o una duración, para y pregunta. Si
  cambias uno, cámbialo **también** en su documento: un número de arte que solo
  existe en el código deja de ser una decisión y pasa a ser un accidente.
- Estilo: **cartoon vectorial de contorno grueso** tipo Hills of Steel /
  Angry Birds, en malla de Three.js con cámara ortográfica de perfil. Las seis
  reglas invariables de `ARTE.md` §1 no se negocian: contorno, tres tonos, luz
  fija arriba-izquierda, sombra de contacto, esquinas redondeadas y cero
  degradados.
- **El detalle está jerarquizado, no racionado.** La regla vieja de «3 a 6 formas
  por objeto» ya no vale para vehículos y era la causa de que los que hay
  parezcan cajas con un tubo. Ahora: silueta (4–6 piezas) + forma (6–10) +
  superficie (calcomanías, sin coste de malla), con un tope de **12 a 18 piezas**
  por vehículo y **8 llamadas de dibujo**. Detalle mínimo: 1,3 u en silueta,
  0,7 u en forma, 0,27 u en superficie y nunca aislado. Lo que no llega al mínimo
  **se elimina o se fusiona; nunca se reduce**. `docs/ARTE-VEHICULOS.md` §1.
- **Un cuerpo, un contorno** (`docs/ARTE-VEHICULOS.md` §12). Casco, torreta,
  mantelete, tubo y freno de boca son **una sola silueta continua** con **un solo
  shell de contorno**. Los bultos del techo crecen del borde; las calcomanías no
  llevan contorno propio. La vara de medir es la imagen de referencia aprobada:
  casco `#7D8B4E`, contorno `#2B3419`, oruga `#4A4A42`.
- Un vehículo se construye **solo** con las primitivas de
  `src/art/vehiculo/primitivas.js`. Una ficha de `fichas/` es un objeto de
  números y **no importa Three**: lo vigila `tests/arquitectura.test.js`. Si una
  forma no encaja en una primitiva, se añade **a la primitiva**, no a la ficha.
- `docs/ARTE-VEHICULOS.md` §8 blinda el invariante de `ARTE.md` §9: el ancla
  `boca` del tubo está a la misma Y mundial en **los quince vehículos**, la
  balística lee solo esa ancla y `tests/world/cannon.test.js` recorre el catálogo
  entero. Cinco fichas corrigen el anclaje del tubo para cumplirlo (mortero,
  cohetes, antiaéreo, obús, asalto pesado) y cada corrección está escrita con su
  motivo. Si una decisión estética choca con esto, **gana el invariante**.
- **Nada de rostros ni figuras.** Ni tripulantes, ni siluetas, ni cascos, ni
  manos, ni cadáveres, ni cruces de tumba, ni iconografía humana en un cartel o
  una señal. El juego son máquinas y terreno. Aplica a vehículos, decorado,
  trampas, HUD e iconos, en todos los niveles de detalle.
- Ningún vehículo, escena o trampa está terminado hasta pasar
  `docs/CHECKLIST-REVISION.md`. La prueba que decide no es mirar uno: es **la
  fila de comparación** con los quince al mismo zoom, en color y en negro.
- El pintado se ajusta solo (`src/art/calidad.js`) hasta que el cuadro cabe en
  16,7 ms. Solo toca densidad de píxeles y sombra: nunca efectos, nunca trampas
  y nunca la física, porque dos móviles distintos tienen que jugar la misma
  partida. `?calidad=alta|media|baja|minima` lo clava para medir.
- El sonido está cableado (`src/audio/sonidos.js`) y espera los MP3 en
  `public/audio/`. Un fichero que falta no suena y ya: nunca un error en consola
  ni un hueco en la partida.

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

Para arte, además de la captura y la consola limpia:

```bash
pnpm planchas              # regenera diseno/planchas/*.html (no necesita servidor)
pnpm verificar:familia     # los quince en fila: color, bandos, negro y 0,55x
pnpm verificar:bocas       # la Y del ancla `boca` de las quince fichas
pnpm verificar:cuadro      # seis vehiculos en pantalla por debajo de 16,7 ms
```

`verificar:familia` es el que suspende un vehículo aprobado por separado, y por
eso se ejecuta **en cada cambio de sprite**, no al final del lote.

## Idioma

Español si el dispositivo está en español, inglés en cualquier otro caso. No hay
selector: manda el idioma del móvil, que es lo que espera quien abre un enlace y
se pone a jugar.

Los textos van en `src/ui/i18n.js` y solo ahí. En el marcado se etiquetan con
`data-i18n` (contenido) y `data-i18n-aria` (etiqueta accesible), dejando el
español escrito en el HTML como respaldo por si el módulo no carga. Si añades un
texto y olvidas traducirlo, `tests/ui/i18n.test.js` falla: las dos tablas tienen
que tener las mismas claves.
