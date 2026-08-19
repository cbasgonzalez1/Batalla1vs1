# Plataforma

Normativo. Cubre lo que el juego necesita para **cobrar por camuflajes, aguantar
muchas partidas a la vez, guardar el progreso y publicarse en Android e iOS**.

Este documento **deroga en parte una restricción dura de `AGENTS.md`** (§1), y por
eso existe: en este proyecto una regla no se relaja en silencio. Lo que no aparece
aquí sigue vigente tal cual está escrito.

Nada de esto está implementado todavía. Lo que sí está medido es el punto de
partida: qué aguanta el código de hoy y qué se rompe primero.

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

**0.3 · Se juega sin cuenta.** El código de sala se mantiene como camino rápido:
abrir un enlace, dictar cuatro letras y disparar. La cuenta aparece **solo** donde
es obligatoria —comprar y guardar—, nunca antes de la primera partida. Es lo que
hace bueno a este juego y lo primero que se pierde metiendo un registro delante.

---

## 1. Lo que se deroga

`AGENTS.md` § Restricciones duras dice hoy:

> Sin cuentas, sin login, sin base de datos. Se entra a una sala con un código y
> ya está.

| Decía | Dice | Por qué |
|---|---|---|
| Sin cuentas, sin login | **Cuenta opcional**, nunca para jugar | Una compra tiene que sobrevivir a cambiar de móvil, y eso no se puede hacer sin identidad |
| Sin base de datos | **Base de datos** para cuenta, compras y progreso — y para nada más | Un camuflaje pagado que se pierde al borrar la caché es un reembolso |
| Se entra a una sala con un código y ya está | **Igual**, y esta parte no se toca | §0.3 |

Lo que la línea protegía sigue protegido: **jugar no cuesta un registro**. Lo que
cambia es que ahora hay un sitio donde guardar lo que has comprado.

---

## 2. Camuflajes

### 2.1 Lo que ya está resuelto

El motor de vehículos ya está preparado y no hay que tocarlo:

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
| A | `#7E8B4A` oliva | 72° | 31 % | 42 % |
| B | `#5C7D92` acero | 203° | 23 % | 47 % |

**Propuesta de banda** —pendiente de aprobar mirando la fila de comparación, no
leyendo esta tabla—: un camuflaje del bando A vive en **H 45–105°** y el del B en
**H 175–235°**, los dos con **S ≤ 45 %** y **L 34–54 %**. Fuera de ahí no se
vende, por mucho que se pague. Los dos rangos están separados por 70° de tono a
cada lado, que es lo que sostiene la lectura a 0,55× de zoom.

Un camuflaje que quiera salirse de la banda —un invierno blanco, un desierto muy
claro— **es otra decisión**: hay que probar que los dos bandos se siguen
distinguiendo con los dos puestos en el mismo campo, y pasar
`docs/CHECKLIST-REVISION.md` §3.

### 2.3 Cómo viaja

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

## 4. Base de datos

### 4.1 Qué guarda

- **Cuenta**: identidad y poco más.
- **Compras**: qué se compró, cuándo, con qué recibo, y qué desbloquea.
- **Progreso**: partidas jugadas, ganadas, tiros, mejor impacto. Datos de vitrina.
- **Preferencias**: el camuflaje elegido para cada bando, el idioma si algún día
  hay selector.

### 4.2 Qué NO guarda, nunca

**El estado de una partida en vivo.** Ni el terreno, ni las vidas, ni el turno.
En el momento en que la base de datos tiene una opinión sobre cómo va un combate,
el servidor pasa a ser una segunda verdad y §0.1 se cae. El estado vive en los
móviles; lo único que puede persistir de una partida es su **resumen**, y solo
cuando ha terminado.

### 4.3 Con qué

**Postgres.** Es relacional, es aburrido y aguanta de sobra esto. El despliegue
ya es un contenedor con el servidor sirviendo también el juego desde `dist/`
(ver `Dockerfile`): esto añade **un** servicio más, no una arquitectura nueva.

Cuatro tablas bastan para empezar: `jugador`, `compra`, `desbloqueo` y
`partida` (el resumen). Si hace falta una quinta antes de vender el primer
camuflaje, es que algo se ha ido de madre.

### 4.4 El problema honesto: quién certifica el progreso

Un cliente no es de fiar diciendo «he ganado veinte partidas». Y el servidor no
simula, así que **no puede saberlo mirando**. Esto hay que decidirlo antes de
prometer nada, no después:

- **Lo que ya existe:** cada turno los móviles mandan una huella del estado y el
  servidor avisa si dos no coinciden (`PIDE.checksum`, `DICE.desincronia`). Eso
  detecta divergencia, no mentira: en un 1v1 hay dos huellas y un empate no dice
  quién miente.
- **La salida sancionada, y la única:** el servidor puede **auditar una partida
  terminada** volviéndola a simular a partir de la semilla y los inputs, fuera
  del camino de la partida en vivo y sin prisa. No es simular el combate: es
  repetir uno que ya acabó. El `Dockerfile` de producción ya copia `src/game`,
  `src/core` y `src/net` a la imagen, así que el servidor **ya tiene el motor
  para hacerlo** — falta escribirlo, no montarlo.
- **La recomendación:** mientras el progreso sea de vitrina, no auditar nada y
  guardar lo que diga el cliente. **En el momento en que haya una clasificación
  competitiva, auditar es obligatorio**, y hay que presupuestarlo: una
  clasificación sin verificar dura lo que tarde el primero en abrir la consola.

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

1. **Reconexión a la sala** (§3.2). Sin esto no hay lanzamiento en móvil que
   aguante. No necesita base de datos ni cuentas.
2. **Persistencia local** del nombre y del camuflaje elegido. Hoy no se guarda
   **nada** en el cliente — ni el apodo.
3. **Cuenta opcional y base de datos** (§4). Jugar sigue sin pedirla.
4. **Billing de tienda y desbloqueos** (§5.2).
5. **Escala horizontal** (§3.3), cuando los números lo pidan y no antes.

---

## 7. Lo que falta decidir

Esto no lo decide quien escriba el código:

- La banda de tono y valor de §2.2, aprobada mirando la fila de comparación.
- Si la web es demo sin compras o tienda aparte (§5.2).
- Si el progreso se queda en vitrina o llega a haber clasificación competitiva
  — porque eso obliga a la auditoría de §4.4.
- Si el enlace de repetición lleva los camuflajes (§2.3).
- Cuánto aguanta una sala a un jugador desconectado (§3.2 propone 60 s).
