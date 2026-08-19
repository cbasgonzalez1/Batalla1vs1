# Plataforma

Normativo. Cubre lo que el juego necesita para **cobrar por camuflajes, aguantar
muchas partidas a la vez, guardar el progreso y publicarse en Android e iOS**.

Este documento **deroga en parte una restricción dura de `AGENTS.md`** (§1), y por
eso existe: en este proyecto una regla no se relaja en silencio. Lo que no aparece
aquí sigue vigente tal cual está escrito.

**§2 y §4 ya están construidos**: esquema, cuentas, tienda, progreso, las
pantallas que los usan y las pruebas que los sostienen. §3 y §5 siguen siendo
plan, y cada sección dice en qué estado está.

---

## 0. Lo que NO se toca, pase lo que pase

Tres invariantes. Si una decisión de negocio choca con una de ellas, **gana el
invariante** y se busca otra forma de cobrar.

**0.1 · El servidor no simula.** Ni con base de datos, ni con cuentas, ni con
compras. Su trabajo sigue siendo repartir mensajes entre los móviles de una sala.
El motivo no es elegancia: si el servidor calcula, hay **dos verdades** que
mantener sincronizadas y el determinismo deja de servir para nada. La única
excepción está en §4.4, y es fuera del camino de la partida en vivo.

**0.2 · La simulación no lee nada de la base de datos.** Ni el camuflaje, ni el
nivel, ni lo comprado. El bucle de paso fijo tiene que dar el mismo resultado en
los seis móviles a partir de la semilla y los inputs, y un dato que viene de una
cuenta llega tarde, llega distinto o no llega. Todo lo que se vende es
**decorativo**, y eso no es una decisión de diseño amable: es lo que impide a la
vez el pago-por-ganar y la desincronía.

**0.3 · El juego pide cuenta, y el servidor no la necesita para repartir salas.**

La primera versión de esta sección decía «se juega sin cuenta» y recomendaba no
poner un registro delante de la primera partida. **Decisión del proyecto: se
entra con login.** Queda escrito el motivo por el que se propuso lo contrario —el
código de sala es lo que hace que abrir un enlace y disparar sea inmediato— para
que dentro de seis meses nadie tenga que reconstruirlo.

Lo que sí es técnico y no se toca: **el servidor de salas no depende de la base
de datos**. Sin `DATABASE_URL` arranca igual y las partidas funcionan; lo único
que se apaga son cuentas, tienda y progreso. No es una puerta de atrás al login:
es que `pnpm dev` y las seis verificaciones de navegador tienen que poder correr
sin levantar un Postgres, o dejan de correrse. Y de paso, un fallo de la base de
datos deja el juego sin cuentas, no sin juego.

---

## 1. Lo que se deroga

`AGENTS.md` § Restricciones duras dice hoy:

> Sin cuentas, sin login, sin base de datos. Se entra a una sala con un código y
> ya está.

| Decía | Dice | Por qué |
|---|---|---|
| Sin cuentas, sin login | **Con login** | Decisión del proyecto. Una compra y un progreso tienen que sobrevivir a cambiar de móvil, y eso no se puede hacer sin identidad |
| Sin base de datos | **Base de datos** para cuenta, compras y progreso — y para nada más | Un camuflaje pagado que se pierde al borrar la caché es un reembolso |
| Se entra a una sala con un código | **Igual**: el código de sala sigue siendo cómo se juntan dos jugadores | Es la mecánica de invitación, no el modelo de identidad |

---

## 2. Camuflajes

### 2.1 Lo que ya está resuelto

**Hecho.** El catálogo vive en `src/art/vehiculo/camuflajes.js` y son ocho: dos de
serie —los ejemplares aprobados, que se regalan al crear la cuenta— y seis en la
tienda. El motor de vehículos ya estaba preparado y no hubo que tocarlo:

- **Un camuflaje es UN color.** Todo el vehículo —contorno, bandas de sombra,
  manchas— se calcula de `BANDOS[x].base` con `tono()`
  (`docs/ARTE-VEHICULOS.md` §6). Añadir un camuflaje es añadir un número.
- **El deterioro funciona con cualquiera.** `art/vehiculo/deterioro.js` guarda el
  color de fábrica al construir el vehículo y tizna desde ahí, así que un
  camuflaje nuevo se ensucia igual sin una línea de más.
- **No cuesta llamadas de dibujo.** El material de relleno es **uno solo** para
  los quince y el color va por vértice: dos jugadores con camuflajes distintos
  siguen costando lo mismo que dos iguales.

### 2.2 La restricción que sí hay que respetar

`docs/ARTE-VEHICULOS.md` §6: **el bando se distingue por el color del casco y por
nada más.** Está prohibido distinguirlos con banda, estrella, cruz o bandera. Un
camuflaje premium que acerque el bando A al B **rompe la lectura de la partida**,
y eso no se arregla con una etiqueta en el HUD.

Los dos ejemplares aprobados, medidos:

| Bando | Base | H | S | L |
|---|---|---|---|---|
| A | `#7D8B4E` oliva | 74° | 28 % | 43 % |
| B | `#5C7D92` acero | 203° | 23 % | 47 % |

**La banda, ya en código** (`BANDAS` en `camuflajes.js`): el bando A vive en
**H 45–105°** y el B en **H 175–235°**, los dos con **S 12–45 %** y **L 34–54 %**.
Fuera de ahí no se vende, por mucho que se pague. Los dos rangos están separados
por 70° de tono, que es lo que sostiene la lectura a 0,55× de zoom.

No es una recomendación escrita en un documento: lo comprueba
`tests/art/camuflajes.test.js` sobre el catálogo entero, y **el servidor se niega
a sembrar la tienda** si algún color se sale. Sigue pendiente aprobar los seis de
pago mirando la fila de comparación con los dos bandos en el mismo campo.

Un camuflaje que quiera salirse de la banda —un invierno blanco, un desierto muy
claro— **es otra decisión**: hay que probar que los dos bandos se siguen
distinguiendo con los dos puestos en el mismo campo, y pasar
`docs/CHECKLIST-REVISION.md` §3.

### 2.3 Las pantallas — **hechas**

- **Acceso** (`src/ui/acceso.js`): crear cuenta o entrar, con el mismo lenguaje
  visual que la sala. Aparece **sólo si el servidor tiene cuentas** — se pregunta
  a `GET /salud` antes de montarla— y **encima de un juego que ya está
  corriendo**: si el servidor tarda o no contesta, lo que hay detrás es una
  partida y no un vacío.
- **Tienda y vitrina** (`src/ui/tienda.js`): los ocho camuflajes por bandos, con
  la muestra pintada con **las mismas funciones de paleta que el vehículo**
  —`claro`, `oscuro`, `contorno`— para que lo que se ve en la tienda sea lo que
  se verá en el campo. Una tienda que enseña otra cosa vende devoluciones. Se
  abre desde la pantalla de victoria, que es cuando el jugador está parado.
- Lo que no se tiene dice **«Próximamente»** y está desactivado, porque el pago
  todavía no existe. La pantalla no finge que se puede comprar.

Elegir un camuflaje **rehace la partida** con la misma semilla: es instantáneo,
no se pierde nada y es la única forma de que el color se vea, porque el casco se
pinta al montar el vehículo.

### 2.4 Cómo viaja

Un camuflaje es **estado de sala, no de simulación**. Va en el mensaje `empezar`
junto a la alineación, para que los seis móviles pinten el mismo tanque; no entra
en el paso fijo ni en la huella de estado. Si un móvil recibe un camuflaje que no
conoce —cliente viejo—, pinta el base de su bando y sigue jugando: un cosmético
nunca puede impedir una partida.

**Pendiente de decidir:** el enlace de repetición (`src/game/replay.js`) guarda
semilla y tiros, no camuflajes, así que una repetición sale con los colores por
defecto. O se añaden dos identificadores al enlace, o se acepta. Recomiendo
aceptarlo: el enlace cabe en un WhatsApp justamente porque no lleva nada que no
haga falta para reconstruir la partida.

---

## 3. Muchas partidas a la vez

### 3.1 Lo que aguanta hoy

Mucho más de lo que parece, y por una razón concreta: **por el cable solo viajan
inputs**. Un turno son un ángulo, una potencia, un avance y, a veces, una
reacción — los mismos datos que caben en cinco o seis caracteres del enlace de
repetición. No viaja el terreno, ni el proyectil, ni el daño.

`server/salas.js` guarda las salas en un `Map` en memoria y `GET /salud` ya
informa de cuántas hay y cuántas conexiones. El coste por sala es tan bajo que el
límite no va a ser la CPU.

### 3.2 Lo que se rompe primero, y no es la escala

**La reconexión.** Hoy, cuando un socket se cae, `salas.salir()` saca al jugador
y no hay forma de volver. En un móvil eso pasa constantemente: se bloquea la
pantalla, entra una llamada, cambia de wifi a datos. **Antes de pensar en un
segundo servidor hay que resolver esto**, o el lanzamiento en móvil se cae solo.

Y el determinismo lo pone fácil: para devolver a alguien a su partida no hace
falta guardar el estado, basta con **la semilla y la lista de inputs**, que es
exactamente lo que el servidor ya está reenviando. La sala guarda ese registro,
el que vuelve lo recibe entero, resimula en silencio y se pone al día. El
servidor sigue sin calcular nada: solo repite lo que ya dijo.

Tres cosas que hay que fijar al hacerlo: cuánto se aguanta una sala sin su
jugador (propongo 60 s), qué pasa mientras —el turno del ausente no puede
bloquear a los demás— y un tope al registro de inputs por sala, que si no es una
fuga de memoria con forma de partida larga.

### 3.3 Escalar de verdad

Cuando haga falta más de un proceso: **afinidad por código de sala**. Una sala es
completamente independiente de otra —no comparten nada— así que basta con enrutar
por un hash del código a una instancia. Es más simple que un bus compartido y no
añade una pieza que pueda caerse.

Lo que hay que aceptar con eso: **reiniciar una instancia tumba sus partidas en
vivo**. Con la reconexión de §3.2 y el registro de inputs en un almacén
compartido eso se convierte en un tirón de unos segundos en vez de una derrota.
Sin ella, cualquier despliegue es una purga.

---

## 4. Base de datos — **construida**

Postgres. Ocho tablas, `server/db/esquema.sql`, que se aplica entero en cada
arranque y es idempotente. Sin herramienta de migraciones todavía: cuando haga
falta, ese fichero es la 001 y las siguientes se añaden numeradas al lado.

```
jugador ── sesion            quién eres y desde qué dispositivo
        ── desbloqueo ── camuflaje     qué tienes
        ── compra                       cómo lo conseguiste
        ── progreso                     la vitrina (es una CACHÉ)
partida ── participacion                cada combate y quién lo jugó
```

### 4.1 Qué guarda

- **Cuenta**: correo, nombre, y los dos camuflajes elegidos.
- **Sesión**: una por dispositivo, con caducidad de 30 días.
- **Compras y desbloqueos**: qué se compró, cuándo, con qué recibo.
- **Partidas**: el combate **entero**, y el progreso agregado de cada jugador.

**Dos cosas no se guardan nunca, ni cifradas ni de ninguna forma:**

- **La contraseña.** En `jugador.clave` vive `sal$derivada` de scrypt, con sal
  distinta por jugador. Quien se lleve una copia de la tabla no entra en ninguna
  cuenta.
- **El token de sesión.** En `sesion.huella` vive su sha256. El token viaja al
  móvil una vez y no vuelve a existir en el servidor. Aquí sha256 a pelo **sí**
  vale y scrypt no: un token son 32 bytes de azar, no una palabra que alguien
  pueda adivinar.

### 4.2 Qué NO guarda, nunca

**El estado de una partida en vivo.** Ni el terreno, ni las vidas, ni el turno.
En el momento en que la base de datos tiene una opinión sobre cómo va un combate,
el servidor pasa a ser una segunda verdad y §0.1 se cae. El estado vive en los
móviles; a la tabla `partida` solo se escribe cuando el combate ha **terminado**.

### 4.3 «Guardar todo del juego» sale gratis, y es por el determinismo

Una partida entera cabe en una cadena de texto. `partida.repeticion` guarda
`semilla~turno.turno.turno` —el mismo formato del enlace que ya se comparte
(`src/game/replay.js`)— y con eso cualquier dispositivo reconstruye el combate
golpe a golpe: no hay que guardar dónde cayó cada proyectil, ni el terreno turno
a turno, ni las vidas. **Medido: tres turnos con avance y reacción ocupan 37
bytes.** Una partida de dieciséis anda por el centenar.

Eso es lo que hace que guardar todo sea barato aquí y carísimo en un juego que no
fuera determinista. Y no es teoría: `pnpm verificar:bd` guarda una partida,
la vuelve a leer de Postgres, la decodifica y comprueba que salen los mismos
turnos, con su avance y su reacción.

### 4.4 El progreso es una caché

Todo lo de `progreso` se puede recalcular sumando `participacion`, y hay una
consulta que lo hace (`recomponerProgreso`). Se guarda aparte porque la vitrina
se lee en cada pantalla de inicio y sumar el historial entero cada vez es tirar
la base de datos por una cifra que casi nunca cambia.

Que sea una caché es la razón por la que **puede vivir sin auditar**. Hoy el
progreso se guarda tal cual lo cuenta el cliente, porque es de vitrina y no
decide nada. Sigue en pie el problema honesto:

- **Un cliente no es de fiar** diciendo «he ganado veinte partidas». Y el
  servidor no simula, así que no puede saberlo mirando.
- **Lo que ya existe** detecta divergencia, no mentira: cada turno los móviles
  mandan una huella del estado y el servidor avisa si dos no coinciden
  (`PIDE.checksum`). En un 1v1 hay dos huellas y un empate no dice quién miente.
- **La salida sancionada, y la única:** el servidor puede **auditar una partida
  terminada** volviéndola a simular desde la semilla y los inputs, fuera del
  camino de la partida en vivo. No es simular el combate: es repetir uno que ya
  acabó. La imagen de producción **ya copia `src/game`, `src/core` y `src/net`**,
  así que el motor está ahí; falta escribirlo.
- **En el momento en que haya clasificación competitiva, auditar es
  obligatorio.** Entonces se cambian los criterios y se recompone el progreso
  desde `participacion`, sin migrar nada. Esa es toda la ventaja de que sea una
  caché.

### 4.5 La API

Todo bajo `/api/`. La lógica está en `server/cuentas.js` y se prueba sin abrir un
puerto —igual que `salas.js` se prueba sin abrir un socket—; `server/index.js`
solo traduce a HTTP.

| | | |
|---|---|---|
| `POST` | `/api/registro` | correo, contraseña y nombre → token y los dos camuflajes de serie |
| `POST` | `/api/sesion` | entrar → token |
| `DELETE` | `/api/sesion` | salir |
| `GET` | `/api/yo` | cuenta, desbloqueos y progreso de una tacada |
| `GET` | `/api/tienda` | el catálogo; **se puede mirar sin cuenta** |
| `PUT` | `/api/camuflaje` | elegir el de un bando, si lo tienes |
| `POST` | `/api/partida` | guardar un combate terminado |
| `GET` | `/api/historial` | tus últimas partidas, con su enlace de repetición |

El cliente es `src/net/cuenta.js`, y **nunca lanza**: todo devuelve `{ ok }` o
`{ ok: false, error }`. Un servidor caído, un móvil sin cobertura o un token
caducado tienen que dejar una pantalla con un mensaje, no una excepción sin
recoger que deje el juego en negro. Un 401 borra el token guardado en el sitio,
porque un token caducado que se queda convierte cada arranque en un error.

El token va en `Authorization: Bearer`, **no en una cookie**: el juego se empaqueta
con WebView para Android e iOS y ahí las cookies de tercera parte son un campo de
minas.

Cuatro decisiones que están en el código y conviene no deshacer:

- **El mismo mensaje** para «ese correo no existe» y «esa contraseña es mala».
  Distinguirlos regala una lista de correos registrados a quien pruebe uno a uno.
- **Ocho intentos** fallidos por correo y diez minutos de castigo.
- **El jugador de una partida sale de la sesión**, nunca de un id que venga en el
  cuerpo. Si no, cualquiera suma partidas ganadas a la cuenta de otro.
- **Una partida sin cuenta se guarda igual**, con `jugador_id` a `NULL`. Lo que no
  tiene es a quién sumarle el progreso.

### 4.6 Cómo se levanta

```bash
docker compose up -d bd        # solo Postgres, para desarrollar contra el
DATABASE_URL=postgres://artilleria:artilleria@127.0.0.1:55432/artilleria pnpm server
pnpm verificar:bd              # con DATABASE_URL puesto: esquema, cuentas, tienda, progreso
docker compose up -d           # todo, como en produccion
```

`docker-compose.yml` levanta los dos servicios. La base **no está en el camino de
una partida**: si se cae, las salas siguen funcionando.

---

## 5. Android e iOS

### 5.1 Cómo se empaqueta

Es una web app: portrait fijo, control a un pulgar y calidad que se ajusta sola
(`src/art/calidad.js`). Se envuelve con Capacitor y se publica el mismo `dist/`.
No hay que reescribir el juego.

### 5.2 La regla que decide el backend de compras

**Un bien digital dentro de una app tiene que pasar por el billing de Apple y de
Google.** Una pasarela propia para vender un camuflaje es rechazo en la revisión,
no una optimización de comisiones. Eso fija el flujo entero:

```
SDK de la tienda → recibo → tu servidor valida el recibo contra Apple/Google → desbloqueo en la base de datos
```

Tu servidor **nunca ve una tarjeta**. Guarda el recibo y a quién pertenece.

**Consecuencia que hay que decidir pronto:** la versión web no puede compartir ese
flujo. O la web es una demo sin compras, o es una tienda aparte con su propia
pasarela y sus propios desbloqueos. Mezclar las dos es la forma más rápida de que
un usuario pague dos veces por lo mismo.

### 5.3 Lo que ya está bien y no hay que tocar

- **El bucle no acelera al volver de segundo plano.** El paso fijo acumula con
  `Math.min(0.25, dt)` y un tope de 240 pasos: un móvil que ha estado bloqueado
  no adelanta media partida de golpe al despertar.
- **El cuadro tiene margen.** Todo el decorado del campo son **tres** llamadas de
  dibujo, el arco de puntería **una** y el proyectil **dos**; los vehículos van a
  nueve cada uno. `calidad.js` baja densidad de píxeles y sombra —nunca efectos,
  nunca física— así que dos móviles distintos siguen jugando la misma partida.
- **Un sonido que falta no rompe nada** (`src/audio/sonidos.js`), que en móvil
  importa: el audio no arranca hasta que hay un gesto del usuario.

---

## 6. En qué orden

1. ~~Base de datos, cuentas, tienda y progreso~~ — **hecho** (§4).
2. ~~Pantallas de acceso y tienda, y guardar la partida al terminar~~ —
   **hecho** (§2.3).
3. **El camuflaje del rival, en red.** Hoy cada uno ve el suyo: el camuflaje no
   viaja en el mensaje `empezar` (§2.4), así que en una partida online el tanque
   de enfrente sale con el color de serie. Es lo siguiente y es pequeño.
4. **Reconexión a la sala** (§3.2). Sin esto no hay lanzamiento en móvil que
   aguante, y no necesita nada de la base de datos.
5. **Billing de tienda** (§5.2), cuando los camuflajes gusten lo bastante.
6. **Escala horizontal** (§3.3), cuando los números lo pidan y no antes.

---

## 7. Lo que falta decidir

Esto no lo decide quien escriba el código:

- Los seis camuflajes de pago, aprobados mirando la fila de comparación con los
  dos bandos en el mismo campo. La banda ya está en código y la vigilan los tests;
  lo que falta es el visto bueno a estos seis colores concretos.
- Los precios: hoy son 1,99 € y 2,99 € puestos a ojo para poder enseñar la
  tienda.
- Si la web es demo sin compras o tienda aparte (§5.2).
- Si el progreso se queda en vitrina o llega a haber clasificación competitiva
  — porque eso obliga a la auditoría de §4.4.
- Si el enlace de repetición lleva los camuflajes (§2.3).
- Cuánto aguanta una sala a un jugador desconectado (§3.2 propone 60 s).
- Si el progreso guardado hoy —sin auditar— se conserva el día que haya
  clasificación, o se recompone desde cero (§4.4).
