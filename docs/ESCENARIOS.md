# Escenarios

Normativo. Amplía `ARTE.md` §11–§13 con el detalle de decorado que faltaba y con
las ocho familias de piezas de campo de batalla. Los seis teatros, sus paletas,
las capas de fondo y los estratos de suelo **siguen definidos en `ARTE.md`** y no
se duplican aquí: si un número está en los dos sitios, manda `ARTE.md`.

> **Incoherencia detectada, arreglar antes de empezar.** `README.md` documenta
> `?biome=dunas|placa|salar|caldera|tranquilidad|selva` y `ARTE.md` §11 define
> `?biome=somme|flandes|alamein|rzhev|stalingrado|ardenas`. Son dos juegos de
> biomas distintos. Los teatros de `ARTE.md` son los buenos —los de `README.md`
> son de la versión lunar anterior—; hay que corregir la tabla del `README` y
> comprobar qué acepta de verdad el parseo de la URL.

---

## 1. Nivel de detalle en el campo

`ARTE-VEHICULOS.md` sube el detalle de los vehículos a 12–18 piezas. El decorado
**no puede quedarse atrás**: un tanque de 15 piezas sobre un suelo con tres
bidones se ve peor que el tanque de antes, porque el contraste de acabado
delata a los dos.

Presupuesto por escena, y es un tope de **piezas fusionadas**, no de mallas:

| Familia | Instancias por escena | Piezas por instancia | Llamadas de dibujo |
|---|---|---|---|
| Trincheras y parapetos | 2–4 | 8–14 | 1 por trinchera (fusionada) |
| Alambrada | 3–6 tramos | 5–8 | 1 total (todas fusionadas en una malla) |
| Ruinas | 1–2 | 10–16 | 1 por ruina |
| Cráteres y barro | 4–10 | 3–5 | 0 — son deformación del heightmap + color por vértice |
| Nieve / hielo | manto | — | 0 — banda de color del terreno |
| Bosque astillado | 4–8 tocones | 4–7 | 1 total |
| Vías y vagones | 1 tramo + 1–2 vagones | 12–18 el vagón | 2 |
| Búnkeres | 1 | 10–14 | 1 |

**Tope duro: 14 llamadas de dibujo para todo el decorado**, más las 8 × 6 de los
vehículos, más terreno, cielo y fondo. Si una escena se pasa, se quitan
instancias, nunca detalle: cuatro tocones buenos son mejores que doce pobres.

Las seis reglas de `ARTE.md` §1 aplican tal cual: contorno 2,5 px en plano medio
y 3,5 px en primer plano, tres tonos, luz arriba-izquierda, sombra de contacto,
esquinas redondeadas, cero degradados. El contorno del decorado usa la **misma
técnica de shell** que los vehículos (`ARTE-VEHICULOS.md` §3), no una segunda
implementación.

---

## 2. Reglas comunes de colocación

- Todo sale del **`rng` sembrado**. Ninguna pieza de decorado usa
  `Math.random()`: dos móviles con el mismo código de sala tienen que ver el
  mismo campo, y el servidor no manda nada de esto.
- Toda pieza se **asienta en el terreno**: su Y sale de muestrear el heightmap en
  su x, y su rotación de la pendiente local. Una pieza plantada a Y fija flota en
  cuanto el terreno cambia, y el terreno cambia cada turno.
- Toda pieza **se reasienta tras un cráter cercano**. Si el suelo baja bajo una
  alambrada, la alambrada baja con él o queda colgando en el aire. Umbral: se
  reasienta lo que esté a menos de 8 u del impacto.
- **Tinte de teatro obligatorio:** el color base de cada pieza se mezcla un 0,35
  hacia el `cuerpo` del terreno del teatro. Una viga de madera igual en el Somme
  y en Alamein no pertenece a ninguno de los dos.
- **Nada bloquea la línea de tiro sin avisar.** El decorado es decoración: no
  colisiona con el proyectil. Lo que colisiona son las trampas
  (`TRAMPAS.md`), y esas tienen su propio lenguaje visual para que se lean como
  tales. Esta separación es lo que evita el «me lo ha parado un arbusto».

---

## 3. Las ocho familias

### 3.1 Trincheras y parapetos

La pieza de decorado más importante del juego: es lo que dice que esto es la
Primera y la Segunda Guerra y no un juego de tanques en el desierto.

- **Corte en el terreno**, no una caja encima. La trinchera se hace **bajando el
  heightmap** en un tramo de 4–7 u con paredes de pendiente 70°, y encima se
  monta la geometría.
- Piezas: **entibado de tablones** en la pared frontal (5–8 tablones verticales
  de `madera`, anchura desigual — iguales se leen como valla), **parapeto de
  sacos** en el labio (6–10 sacos, dos filas escalonadas, `lona`), **peldaño de
  fuego**, **una viga transversal**, **un poste de esquina**.
- Los sacos son cápsulas achatadas de 0,55 × 0,32 u con **una banda clara arriba
  y contorno propio**. Un saco sin contorno individual convierte el parapeto en
  un churro.
- Contra cada cañón hay **siempre** un parapeto de sacos (ya está en `ARTE.md`
  §13). Con la trinchera, ese parapeto pasa a ser su labio.

### 3.2 Alambrada y caballos de Frisia

- **Piquete**: poste de 1,4 u con extremo superior en espiral, o cruz de aspas.
  Uno cada 2,2 u, con **altura e inclinación variadas por el `rng`**: una fila
  recta y regular parece una valla de jardín.
- **Alambre**: 3 hilos entre piquetes, no rectos — **cuelgan** (catenaria de 0,15
  u). Grosor 0,05 u, que está por debajo del mínimo, así que se dibujan como
  cinta plana orientada a cámara, nunca como cilindro.
- **Púas**: no se modelan. Se resuelven como **trazos discontinuos** del propio
  hilo, alternando color base y `contorno`. A cualquier zoom se lee como
  espinoso y cuesta cero.
- **Caballo de Frisia**: tres cruces de aspas unidas por dos travesaños,
  6 piezas, apoyado y **girado 8–15°** respecto a la línea de tiro. Uno recto
  parece un decorado colocado.
- Tramos rotos: 1 de cada 3 tramos lleva un piquete **caído** y el alambre suelto
  arrastrando. Es lo que lo diferencia de una obra recién hecha.

### 3.3 Ruinas de edificio

Vale como hito de teatro (`ARTE.md` §13) o como pieza suelta.

- **Nunca una caja con agujeros.** Se construye por muros sueltos: 2–3 muros en
  pie de altura desigual, con el **borde superior astillado** (perfil en zigzag
  de 4–6 dientes, no una línea recta ni un arco suave).
- Piezas: muros (2–3), **hueco de ventana con dintel** (2), **esquina expuesta
  con ladrillo visible** en `oscuro`, **montón de escombro al pie** (obligatorio:
  un muro sin escombro parece a medio construir), **viga de techo caída en
  diagonal**, **1 chimenea o pilar** en pie.
- El escombro se resuelve con 5–7 bloques irregulares fusionados, con biseles
  grandes. Piedras redondas se leen como bolas.
- Interior: **una sola cara oscura** al fondo del hueco. Sin más geometría
  dentro: no se ve y cuesta.
- Adaptación por teatro: ladrillo rojo tintado (Somme, Flandes), adobe claro
  (Alamein), madera de isba (Frente del Este), hormigón y hierro (Stalingrado),
  piedra con nieve en las cornisas (Ardenas).

### 3.4 Cráteres y barro

Los cráteres de partida son deformación del heightmap y ya funcionan. Lo que
falta es que **se vean como cráteres y no como ondulaciones**.

- **Labio elevado**: el cráter no solo hunde, **levanta un anillo** de 0,25 u
  alrededor. Es lo que da la lectura de impacto. La masa sale de la que se
  excavó, así que Sotavento sigue conservándose.
- **Anillo de color**: la banda de terreno del cráter usa `socavón` en el fondo y
  la `cresta` en el labio, con **borde duro**, como los estratos de `ARTE.md`
  §12. Sin cambio de color un cráter es invisible a contraluz.
- **Barro**: los cráteres viejos (los de generación, no los del combate) llevan
  una **elipse plana de agua** en el fondo, color `cielo.medio` mezclado 0,5 con
  el terreno, con un borde claro de 1 px. Cero reflejo, cero transparencia
  animada.
- **Salpicaduras**: 3–5 manchas planas de `socavón` alrededor del labio,
  irregulares y asimétricas. Se pintan en el color por vértice del terreno, sin
  geometría.
- Los cráteres frescos del combate **no llevan agua**. Que se distingan los
  viejos de los nuevos es información de juego: te dice dónde ya has tirado.

### 3.5 Nieve y hielo

Solo Ardenas y Frente del Este. Es tratamiento de terreno, no piezas.

- La **costra** (estrato 0–0,55 u de `ARTE.md` §12) pasa a blanco de la `cresta`
  del teatro, con brillo 1,16 tal cual. Los estratos de debajo **no cambian**:
  la nieve es una capa, no un repinte.
- **Borde de nieve marcado**: la transición nieve→tierra en las paredes de cráter
  y trinchera es una línea de contorno duro, nunca un degradado. Es el detalle
  que hace que el terreno nevado se lea como cartoon y no como niebla.
- **Acumulación sobre las piezas**: todo objeto de decorado lleva una **capa
  plana blanca en su cara superior**, con el borde ligeramente desbordado y
  colgando 0,08 u por los lados. Una pieza sin nieve encima en un campo nevado
  parece pegada en Photoshop.
- **Hielo**: charco de cráter congelado, color `cielo.bajo`, con 2–3 **grietas**
  como líneas discontinuas de `contorno`. Nada de brillo especular.
- Los vehículos **también** llevan la capa: una banda clara en el techo del casco
  y de la torreta cuando el teatro es nevado. Se resuelve con el color por
  vértice, sin geometría extra ni material nuevo.

### 3.6 Bosque astillado

- **Tocón**, no árbol. Tronco tronchado de 1,2–2,4 u con la **fractura en
  astillas**: el corte superior es un perfil de 3–5 puntas desiguales, y las
  puntas son piezas, no un dentado plano.
- Piezas: tronco, corona de astillas, 1–2 **raíces expuestas** en la base, 1
  **rama desgajada colgando**, montón de virutas al pie.
- Color `madera`, con la **banda oscura de corteza en el flanco derecho** y el
  **interior de la fractura en `claro(madera)`**: la madera fresca del interior
  es lo que dice que se rompió hace poco.
- Colocación: **agrupados de 2–3 y con uno tumbado**. Tocones repartidos
  uniformemente parecen un huerto.
- Un tocón gigante es el hito de Flandes (`ARTE.md` §13): mismo módulo, escala
  3,5×, y ahí sí se le añade una copa muerta de dos ramas.

### 3.7 Vías de tren y vagones volcados

Buen hito para Stalingrado y para el Somme. Es la familia más caza-presupuesto:
dos llamadas y hay que ganárselas.

- **Vía**: dos carriles como cinta plana continua + **traviesas cada 0,7 u**,
  todas en una malla. Las traviesas son la pieza que se lee; los carriles solos
  se pierden. 2–3 traviesas **sueltas y giradas** en el tramo roto.
- **Terraplén**: la vía va sobre una elevación del heightmap de 0,5 u con la cara
  de balasto en `socavón` y grano marcado como salpicadura de color.
- **Tramo retorcido**: en un extremo, el carril **se levanta y se dobla** hacia
  arriba 1,5 u. Una vía recta y entera no cuenta nada; una doblada cuenta que
  aquí cayó algo.
- **Vagón volcado**: caja de mercancías 4,0 × 2,2 u tumbada 70–90°, con **puerta
  corredera descolgada**, 2 **bogies con ruedas de tren** (ruedas de disco con
  pestaña, sin radios), techo abombado con **tablones separados**, tope
  amortiguador, y escombro bajo el borde apoyado.
- El vagón es el único decorado que puede **tapar parcialmente a un vehículo**.
  Si lo hace, el vehículo se dibuja delante siempre: el jugador no puede perder
  de vista su tanque por una decoración.

### 3.8 Búnkeres de hormigón

- **Masa antes que detalle**: bloque bajo y ancho, 3,5 × 1,6 u, con **paredes
  inclinadas hacia dentro** (talud de 8°). Un búnker de paredes verticales parece
  un garaje.
- Piezas: cuerpo, **tronera horizontal hundida** con dintel y jamba (la pieza que
  lo identifica), **cúpula de observación** achatada, 2–3 **desconchones con
  hierro a la vista** (barra de `metal` cruzando un hueco), montón de tierra en
  un flanco, **puerta de acero** en el lateral, mancha de humedad como
  calcomanía.
- Color: `metal` desaturado hacia el `cuerpo` del teatro, **no gris neutro**. Un
  búnker gris puro rompe la paleta del teatro y es el error clásico de esta
  pieza.
- La tronera es un hueco **negro de verdad** (`contorno(metal)`), sin nada dentro.
  Es el único sitio del juego donde un negro plano está permitido, y funciona
  porque es un agujero.
- **Nunca hay nada asomando por la tronera.** Ni cañón, ni figura, ni ojos.

---

## 4. Hitos por teatro

`ARTE.md` §13 ya asigna uno a cada teatro. Se mantienen, y ahora se construyen
con las familias de arriba:

| Teatro | Hito | Familias que lo componen |
|---|---|---|
| El Somme | Torre de iglesia rota | Ruinas (muro alto + astillado) + escombro |
| Flandes | Tocón gigante | Bosque astillado a escala 3,5× |
| El Alamein | Casa de adobe | Ruinas con muro de adobe + viga caída |
| Frente del Este | Isba | Ruinas de madera + nieve acumulada |
| Stalingrado | Chimenea de fábrica | Ruinas (pilar) + vía y vagón al pie |
| Las Ardenas | Casa nevada | Ruinas + nieve + bosque astillado alrededor |

El hito ocupa entre el 25 % y el 40 % del ancho y rompe la línea del horizonte
(`ARTE.md` §3). Con el detalle nuevo eso significa que el hito es **la pieza más
trabajada de la escena**: 14–16 piezas, tope alto del presupuesto.

---

## 5. Prohibido

- Decorado que colisione con el proyectil. Eso es una trampa, y las trampas se
  ven como trampas.
- Piezas plantadas a Y fija, o que no se reasienten tras un cráter.
- Repartir instancias con espaciado regular.
- Gris neutro en el búnker, negro puro en cualquier sitio que no sea una tronera
  o un hueco.
- Un teatro sin tinte propio en el decorado.
- Añadir detalle a costa del presupuesto de vehículos. Si hay que elegir, gana el
  vehículo: es lo que el jugador mira.
- Figuras, siluetas humanas, cascos, cadáveres, cruces de tumba, botas, cualquier
  presencia de persona. El campo está vacío de gente y así se queda.
