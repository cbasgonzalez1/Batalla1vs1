# Escenarios

Normativo. Amplía `ARTE.md` §11–§13 con el detalle de decorado y con las familias
de piezas de campo de batalla. Los nueve teatros, sus paletas, las capas de fondo
y los estratos de suelo **siguen definidos en `ARTE.md`** y no se duplican aquí:
si un número está en los dos sitios, manda `ARTE.md`.

---

## 0. Las tres reglas de colocación

Se escriben las primeras porque son las que estaban rotas y las que producían un
campo «mal diseñado» por mucho que cada pieza suelta estuviera bien.

**0.1 · Nada se solapa.** Toda pieza declara el ancho que ocupa en el terreno y
pasa por un registro de tramos ocupados que **niega** la colocación si no cabe.
Se reservan primero los dos emplazamientos y el hito —son intocables— y el
decorado se acomoda a ellos, nunca al revés. Si una pieza no cabe, **no se
coloca**: un campo con tres piezas bien puestas se ve mejor que uno con siete
encaballadas.

El registro reparte además por **huecos reales**, sorteando uno ponderado por su
tamaño. Probar a los lados de una x pedida y rendirse a las cinco unidades —que
es lo que hacía la primera versión— deja el campo vacío, porque con dos
emplazamientos y un hito reservados casi todo cae fuera de ese alcance.

**0.2 · Ninguna pieza tiene base plana.** El borde **inferior** de todo lo que se
apoya se construye con el perfil del terreno (`apoyado()` en `decorado.js`), no
con una recta. Con base recta la pieza toca el suelo en un punto y flota en el
resto, y como el decorado se pinta **después** del terreno el hueco no lo tapa
nada. Hundirla un poco tampoco vale: en una cuesta la esquina de abajo se
entierra y la de arriba sigue en el aire. Aplica a los edificios igual que a un
bidón. La sombra de contacto también sigue el perfil: una elipse se despega por
un lado y delata justo lo que venía a disimular.

**0.2 bis · Lo ancho busca terreno llano.** Un edificio de siete unidades a
caballo de una vaguada tiene que bajar y subir su base, y eso se lee como un
cimiento en V. El motor evalúa varias posiciones dentro del hueco y se queda con
la de menor desnivel.

**0.2 ter · Los vehículos se giran con la pendiente.** Un blindado horizontal
sobre una cuesta apoya una oruga y deja la otra en el aire — es el mismo defecto
que el de las casas, y se corrige midiendo el terreno bajo los dos extremos de la
huella.

En el juego lo hace `cannon.asentar()`, con media huella de 1,7 u y tope de 14°
—a 20° el blindado se lee como un juguete volcado—, y la altura es la **menor**
entre la media de los dos extremos y la del centro: sobre una loma, la media deja
el vientre en el aire. Gira el rig **entero**, casco y arma: con el casco girado
y la torreta a nivel, el anillo se despega en cuanto hay dos grados de cuesta.

> **El fondo tampoco puede competir con el suelo.** Las tres crestas de
> `ARTE.md` §13 arrancaban a 5,2 u con el terreno jugable a 3–5 u, y como van más
> claras que el suelo se leían como la hierba de delante: todo lo plantado en el
> terreno parecía hundido en una loma que en realidad estaba detrás. Ahora
> arrancan a 6,6 / 9,2 / 12,4 u y mezclan 0,46 / 0,64 / 0,80 hacia el cielo. Fue
> **la causa real** de las «casas flotando», y no se encontró mirando la escena:
> se encontró superponiendo el perfil del terreno en magenta
> (`globalThis.__DEPURA_SUELO`).

**0.3 · Se coloca de mayor a menor.** El seto de 6 u tiene un solo sitio posible
en el campo y las cajas de 2 u tienen diez. Colocando primero las pequeñas, éstas
ocupan el único vano ancho y la pieza que **define** el teatro se queda fuera.

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

**En el juego van tres.** `src/art/decorado/` funde TODAS las piezas del campo en
dos geometrías —cuerpos y calcomanías— y las pinta con tres llamadas contando el
shell de contorno. Cada pieza conserva su geometría por separado para poder
reconstruir sólo la que un cráter ha descalzado, y se refunde el conjunto. La
tabla de arriba sigue mandando en cuántas piezas y cuánto detalle lleva cada
familia; lo que ya no hace falta racionar son las llamadas.

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

## 3. Las familias, y a quién pertenece cada una

**Un teatro no es una paleta: es un sitio.** Cada uno declara sus familias en
`paleta.js` y **no usa las de los demás**. Con el mismo decorado en los dieciséis,
son uno repintado dieciséis veces.

Las dieciséis ciudades comparten un vocabulario urbano: lo que queda en pie en
Berlín y en Coventry es lo mismo —muro suelto, viga retorcida, escombro, coche
quemado— y lo que cambia es la fábrica con la que está hecho.

| Familia | Ancho | Veces | Teatros |
|---|---|---|---|
| Tranvía volcado | 5,0 u | 1 | Varsovia 39 y 44, Járkov, Budapest |
| Vía y carril retorcido | 7,0 u | 1 | Stalingrado |
| Alambrada | 6,6 u | 1 | Ypres, Verdún, Montecassino |
| Barricada de adoquines | 3,4 u | 2 | Varsovia 44, Berlín |
| Escombro de ladrillo | 3,2 u | 3 | **los dieciséis** |
| Coche quemado | 2,7 u | 1 | Rotterdam, Coventry, Caen, Saint-Lô, Arnhem, Budapest, Dresde |
| Viga retorcida | 2,6 u | 2 | Ypres, Verdún, Rotterdam, Stalingrado, Járkov, Cassino, Saint-Lô, Aquisgrán, Dresde, Berlín |
| Muro suelto | 2,6 u | 2 | casi todos |
| Erizo checo | 2,2 u | 2 | Aquisgrán, Berlín |
| Cajas de munición | 2,2 u | 1 | Ypres, Verdún, Coventry, Cassino, Saint-Lô |
| Bidones | 2,2 u | 1 | Stalingrado |
| Árbol de calle quemado | 1,6 u | 2 | Varsovia 39, Caen, Arnhem, Dresde |
| Farola | 1,3 u | 2 | Varsovia 39 y 44, Rotterdam, Caen, Budapest |
| Poste de telégrafo | 1,2 u | 2 | — |
| Parapeto de sacos | 3,4 u | — | **todos**, automático: uno delante de cada cañón |

El parapeto de sacos no se declara: va siempre, **delante** del cañón y no
detrás, porque detrás lo tapa la propia pieza y el jugador nunca lo ve.

Las `props` de cada teatro viven en `src/art/direction.js`, junto al resto de su
paleta, y las piezas en `src/art/decorado/piezas.js`, con los mismos números que
la plancha. `veces` es **por cada 38 unidades de campo** —lo que encuadra la
plancha—: el campo del juego mide 140 y las repeticiones se multiplican, o el
teatro se queda con nueve piezas perdidas en todo el mapa.

**Y se apila como un muro, con el remate a nivel.** Donde el suelo baja se ponen
más hiladas; no se baja el muro. Colocando cada saco a la cota de su x salía una
sarta de cuentas subiendo la cuesta en diagonal que no se entendía como nada. Las
hiladas van trabadas —cada una desplazada media pieza— porque eso es lo que hace
que se lea como aparejo y no como una rejilla.

**El escombro son BLOQUES, no una mancha.** Un polígono único de tres vértices no
se entiende: puede ser una roca, una rampa o una sombra. Lo que se lee como
cascote es ver las piedras sueltas, cada una con su contorno, amontonadas —
tocándose— de mayor abajo a menor arriba, sobre un vertido fino que las ata al
suelo. Repartidas por todo el ancho se leen como piedras tiradas.

**Una fachada es una rejilla rígida.** Todos los huecos de un edificio —ventanas
y puerta— se replantean desde la misma cota. La puerta se colocaba a la altura
del terreno *en su x*, así que en cuanto había pendiente se movía respecto a las
ventanas y se veía una ventana bailando según el escenario. Lo que varía con el
terreno es cuánto tapa el suelo la fachada, nunca dónde están sus huecos.

**El muro suelto nunca va solo y recto.** Es la pieza que más se parece a un
muro-trampa (`docs/TRAMPAS.md` §4), así que va girado y acompañado de su montón
de escombro. Una ruina aislada y vertical está prohibida en cualquier escena con
trampas activas.

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

  Hecho (`terrain.carve`): coseno con el máximo pegado al borde del hoyo y cero
  a 1,75 radios, y **nunca más de un quinto de lo excavado** — con un cráter a
  ras de la roca madre apenas se saca tierra y el labio no puede inventársela.
  Lo que sube al borde se **descuenta** del volumen que se devuelve para la
  pluma, y `pnpm verificar:sotavento` sigue cuadrando la masa a 1e-12. Es tierra
  removida, así que cuenta como arena **suelta** y se derrumba como tal.
- **Anillo de color**: la banda de terreno del cráter usa `socavón` en el fondo y
  la `cresta` en el labio, con **borde duro**, como los estratos de `ARTE.md`
  §12. Sin cambio de color un cráter es invisible a contraluz.

  Sale **solo** desde que los estratos hondos cuelgan del lecho y no de la
  superficie (`ARTE.md` §12): el cráter corta las bandas en vez de arrastrarlas,
  así que el fondo enseña la banda honda y el labio sigue siendo costra. Antes no
  había anillo posible — la costra bajaba con el hoyo.
- **Barro**: los cráteres viejos (los de generación, no los del combate) llevan
  una **elipse plana de agua** en el fondo, color `cielo.medio` mezclado 0,5 con
  el terreno, con un borde claro de 1 px. Cero reflejo, cero transparencia
  animada.
- **Salpicaduras**: 3–5 manchas planas de `socavón` alrededor del labio,
  irregulares y asimétricas. Se pintan en el color por vértice del terreno, sin
  geometría.
- Los cráteres frescos del combate **no llevan agua**. Que se distingan los
  viejos de los nuevos es información de juego: te dice dónde ya has tirado.

> **Pendiente:** el agua de los cráteres viejos y las salpicaduras del labio no
> están en el juego todavía. El labio y el anillo de color sí.

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

## 3 bis. Los nueve hitos

Todos salen del **mismo constructor de edificios** —cambia el tejado (dos aguas,
mansarda, plano, roto), el material, el número de plantas y dónde está roto,
nunca la forma de construirlo— más dos casos especiales. Por eso las dieciséis
ciudades parecen del mismo mundo sin parecerse entre sí.

| Hito | Composición | Ancho reservado | Teatros |
|---|---|---|---|
| **Manzana** | Bloque de viviendas destripado (4 plantas, remate roto) + ala baja + escombro | 11,0 u | Varsovia 39 y 44, Rotterdam, Saint-Lô, Budapest, Berlín |
| **Catedral** | Nave rota + torre de 9,4 u + arcada del claustro delante | 13,0 u | Coventry, Aquisgrán, Dresde |
| **Lonja** | Cuerpo largo de dos plantas con torre central de 7,4 u | 12,0 u | Ypres |
| **Abadía** | Bloque largo (3 filas de celdas) + campanario de esquina + terraza arcada | 10,5 u | Montecassino |
| **Estación** | Cuerpo bajo de tejado plano + nave de andenes con los arcos abiertos | 12,0 u | Járkov |
| **Fuerte** | Hormigón bajo y ancho, tejado plano, con un cuerpo de mando encima | 9,5 u | Verdún |
| **Puente** | Dos pilas y el tablero partido en dos tramos que no se tocan | 10,5 u | Arnhem |
| **Iglesia** | Torre sola de 8,0 u con el remate astillado | 5,6 u | Caen |
| **Fábrica** | Nave de dientes de sierra + chimenea de 7,2 u | 11,5 u | Stalingrado |

**La arcada es un muro con los arcos abiertos en él, no una fila de pilares.** Un
pilar aislado y un poste de telégrafo son la misma silueta en perfil; un arco se
lee por el **hueco**, no por lo que hay a los lados. Y se dibuja **la última**, por
delante del cuerpo y más baja: detrás de un bloque más alto un muro sencillamente
no se ve. Uno de los arcos va cegado — es lo que separa una ruina de una obra
recién hecha.

El hito ocupa entre el 25 % y el 40 % del ancho (`ARTE.md` §3), va **descentrado**
—centrado parte el campo en dos huecos estrechos donde no cabe nada grande— y se
planta donde el terreno es **llano**, midiendo el desnivel bajo su huella en
varias posiciones candidatas.

---

## 3 ter. Las tres composiciones de calle

Lo que cambia entre ellas es **cómo está cortado el suelo**, nada más: mismos
cinco planos, mismo teatro y misma semilla.

| Composición | Trayectoria | Cobertura | Avanzar |
|---|---|---|---|
| **Avenida** | Todo el arco visible | Ninguna: estás al descubierto | Muy útil — hay montón que ganar |
| **Zanja en la calzada** | Hay que pasar por encima del labio propio | Alta: estás metido en el suelo | Caro — salir cuesta arriba |
| **Montón central** | Por encima del montón o rodeando | Media: el montón tapa el tiro raso | Decisivo — quien lo corona domina |

Las tres están en el juego (`src/world/terrain.js`), las sortea la semilla y
`?suelo=avenida|zanja|monton` las clava. Los números del corte están en
`ARTE.md` §12; lo que sigue es lo que cambian en la partida.

**Caro no es imposible.** El primer labio de la zanja tenía 0,95 u de alto
derramados en 0,9 de ancho: pendiente 1,05, por encima del 0,9 que sube una
oruga. El blindado podía moverse dentro del foso y no salir de él jamás. El labio
se derrama ahora hasta 10,5 u —cara exterior 0,35— y salir cuesta unos dos
depósitos. Lo mismo con el montón: su altura se mide **contra el emplazamiento
más alto** y no en absoluto, con tope de 8 u, porque su pendiente máxima es
`alto · π / (2 · 15)` y por encima de 8,6 deja de ser una decisión para ser una
pared. Las dos cosas las vigila `tests/world/composicion.test.js`, midiendo con
`mover()` y no con la pendiente cruda: el relieve generado trae laderas naturales
de hasta 72°, así que medir la pendiente total mide el ruido y no la
composición.

Y las tres pasan `pnpm verificar:sotavento` por separado —200 combates de 16
disparos cada una—, porque la zanja mete a los dos blindados en un hoyo y un
blindado en un hoyo es justo el que Sotavento puede tapiar con dos paladas.

- **Avenida.** La calle despejada entre dos manzanas. Es la que mejor enseña la
  trayectoria y la que se entiende sola en el primer turno. En contra: sin nada
  entre los dos, la partida se decide en dos turnos de ajuste; es la que más
  necesita los modificadores de `TRAMPAS.md`.
- **Zanja en la calzada.** Las dos piezas están **dentro** del terreno: un corte
  real en el mapa de alturas con las paredes entibadas y el labio levantado con el
  cascote excavado. El tiro plano se estrella contra tu propio parapeto. **El foso
  tiene que ser más ancho que la pieza que va dentro**: con 5 u de foso y un casco
  de 6,4 el blindado se apoya en los dos labios y la trinchera desaparece.
- **Montón central.** Escombro amontonado en el centro con la ruina grande encima.
  El decorado no colisiona —eso son las trampas— pero el montón **sí es terreno**,
  y por eso avanzar hacia él es la jugada. En contra: media trayectoria acaba
  contra cascote y el jugador puede leerlo como que el juego le engaña; hay que
  enseñar su altura en el arco de apuntado.

---

## 4. Hitos por teatro — derogada, ver §3 bis

Esta sección repartía los hitos entre los seis teatros de campo abierto (Somme,
Flandes, Alamein, Frente del Este, Stalingrado, Ardenas). Esos teatros ya no
existen: los dieciséis son ciudades destruidas y el reparto está en §3 bis y en
`ARTE.md` §11.

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
