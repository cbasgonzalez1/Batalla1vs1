# Catálogo de vehículos

Quince fichas. Cada una es un objeto de números en `src/art/vehiculo/fichas/` y
**no importa Three**: la geometría la monta `ensamblar.js` con las primitivas de
`ARTE-VEHICULOS.md` §2.

Cómo leer las tablas:

- **u** = unidad de mundo, la misma del terreno y de la balística.
- **Piezas** = mallas de nivel A + B. El tope es 18 y no se negocia
  (`ARTE-VEHICULOS.md` §1).
- **Boca** = todos tienen la boca a la misma Y de `CONFIG`. La columna dice
  **cómo** se consigue en ese vehículo, que es lo que cambia.
- Los números de balance (daño, vida, depósito de avance) están marcados
  **propuesta**: hay que aprobarlos y escribirlos literales en
  `tests/game/combat.test.js` como los cuatro que ya hay.

---

> **Construcción: `ARTE-VEHICULOS.md` §12, «un cuerpo, un contorno».** Es la
> sección aprobada sobre MEDIA 1942 y manda sobre todo lo demás. Un vehículo de
> este catálogo dibujado como piezas apiladas está mal aunque sus medidas sean
> correctas.

## 0 bis. Correcciones salidas de dibujar las quince

Las planchas de `diseno/` levantaron cuatro cosas que este catálogo daba por
buenas y no lo eran. Están corregidas arriba y abajo; se dejan escritas para que
nadie las «arregle» de vuelta.

| Decía | Dice | Por qué |
|---|---|---|
| Rodadura de **1,3 u** en la MEDIA | **0,13 L de diámetro**, o sea 0,73 u | 1,3 u sobre un casco de 5,6 u son 0,23 L: cinco ruedas de ese tamaño se solapan y el tren de rodaje se lee como una fila de monedas. Manda `ARTE-VEHICULOS.md` §12 |
| MEDIA con **5** ruedas de rodadura | **6** | Las de la imagen de referencia aprobada. Con cinco quedan huecos y el casco parece flotar |
| La cinta de oruga, holgada sobre la rueda | **+0,03 u por lado** cuando no hay rodillos | Medido en la referencia. Con más holgura el tren de rodaje engorda y el vehículo pierde 0,1 L de altura útil de casco |
| Nada sobre hacia dónde mira | **El vehículo mira a la derecha** | Ahí va el glacis y de ahí sale el tubo. Con el morro a la izquierda y el tubo a la derecha el vehículo se lee marcha atrás aunque cada pieza esté bien, y es un fallo que no salta en la revisión de una pieza |

Y una que cambia el invariante: lo que está a la misma Y en los quince es el
**pivote de elevación**, no la boca. Ver `ARTE-VEHICULOS.md` §8. Las columnas
«Boca» de las fichas de abajo describen cómo se resolvía con la regla vieja;
con la nueva **ninguna ficha necesita corrección de anclaje** y las cinco
excepciones documentadas dejan de existir.

---

## 0. Reglas de familia

Antes de la primera ficha, lo que comparten los quince. Esto es lo que hace que
puestos en fila parezcan del mismo juego:

| Medida | Valor | Por qué |
|---|---|---|
| Ancho de vía (eje Z) | 2,4 u en todos | De perfil no se ve, y variarlo descuadra la sombra de contacto |
| Alto de rueda de rodadura | 0,9–1,4 u de diámetro | Por debajo de 0,9 el buje se cae del mínimo de nivel B |
| Grosor de contorno | 3 px nivel A, 2 px nivel B | Constante en pantalla, `ARTE-VEHICULOS.md` §3 |
| Eslabones de oruga | 24–30 | Menos se lee como cadena de bicicleta |
| Comba de la oruga | 0,12 u entre rodillos | Cero comba = recta tensa = juguete |
| Bisel de arista | 0,06 u | Cero esquinas vivas, `ARTE.md` §1.5 |
| Sombra de contacto | `ry` 0,18 u, ancho = largo del casco × 0,92 | Más ancha y parece un charco |

Y las tres piezas que **todos** llevan sin excepción, porque su ausencia es lo
que hacía que los siete de hoy parezcan cajas: **mantelete** (o collar de tubo
si no hay torreta), **buje de rueda**, y **banda oscura de barcaza** entre casco
y tren de rodaje.

---

## 1. Los siete actuales, rehechos

### ROMBO — 1916

Teatros: Somme, Flandes.

| | |
|---|---|
| Casco | Perfil de rombo, 6,4 × 1,9 u. La punta delantera sube 0,8 u sobre el techo |
| Torreta | No. Barbeta lateral (patrocinio) a media altura |
| Tubo | 1,6 u, grueso (r 0,16), sale del patrocinio, no del frente |
| Rodaje | Oruga que **envuelve el casco entero** — la silueta característica. 26 eslabones, 5 rodadura de 0,9 u ocultas tras el faldón |
| Nivel B | Faldón romboidal con 3 recortes, cofre trasero, escape corto derecho, escotilla de techo, cola de dos ruedas de dirección |
| Nivel C | Fila de remaches siguiendo todo el borde del rombo (es la pieza de época), 2 líneas de panel |
| Piezas | 14 |
| Boca | El patrocinio es alto por diseño: la boca cae en la Y de referencia sin trampas |
| Propuesta | Vida 120, daño 38, depósito de avance bajo (0,6×). Lento y duro |

La cola de ruedas y el remachado son lo que dice «1916» sin un texto. Si hay que
cortar algo, se corta el cofre.

### A7V — 1918

Teatros: Somme, Flandes.

| | |
|---|---|
| Casco | Caja alta de flancos verticales, 6,0 × 2,2 u. El vehículo más alto del catálogo |
| Torreta | No. Casamata central de techo plano y bordes biselados |
| Tubo | 2,2 u, r 0,18, frontal, con collar remachado en vez de mantelete |
| Rodaje | Oruga corta y baja **tapada casi entera** por el casco, que vuela por delante y por detrás. 24 eslabones, 6 rodadura de 0,9 u |
| Nivel B | Voladizos delantero y trasero (son piezas, no bisel), escape doble a la derecha, 2 escotillas de techo, cofre lateral, guardabarros trasero |
| Nivel C | Remachado en las cuatro aristas del cajón, 3 líneas de panel verticales |
| Piezas | 15 |
| Boca | Casco alto: se ancla el tubo **por debajo** del centro del frontal para bajar la boca a la Y |
| Propuesta | Vida 130, daño 40, avance 0,5×. El más torpe |

El casco tapando la oruga es su silueta. Si se ve el tren de rodaje entero, está
mal modelado.

### MEDIA — 1942

Teatros: Alamein, Frente del Este, Stalingrado, Ardenas.

| | |
|---|---|
| Casco | Panza redondeada con frontal inclinado 55°, 5,6 × 1,5 u |
| Torreta | Redonda, r 1,0, alto 0,7, con cúpula desplazada a la derecha |
| Tubo | 3,0 u, r 0,13, con mantelete redondo r 0,4 |
| Rodaje | 5 rodadura grandes de 1,3 u, motriz trasera dentada, tensor delantero, 0 rodillos (la oruga apoya en las ruedas: es su marca) |
| Nivel B | Mantelete, cúpula, escape trasero central, 2 cofres laterales, guardabarros delantero, azadón pequeño |
| Nivel C | Número de torreta de 2 dígitos, 1 mancha de camuflaje, fila de remaches en el guardabarros |
| Piezas | 13 |
| Boca | Referencia del catálogo: los demás se ajustan a este |
| Propuesta | Vida 100, daño 46, avance 1,0×. La vara de medir |

Este es el vehículo de referencia. Se modela **primero** y se aprueba antes de
tocar los otros catorce (`ARTE.md` §10, orden de migración).

### PESADO — 1943

Teatros: Frente del Este, Ardenas.

| | |
|---|---|
| Casco | Caja de flancos rectos y frontal poco inclinado, 6,2 × 1,7 u |
| Torreta | Cuadrada de esquinas redondeadas, 1,9 × 0,8, retrasada |
| Tubo | 3,6 u, r 0,16, con **freno de boca de dos cámaras** (pieza de nivel B, no calcomanía) |
| Rodaje | 7 rodadura de 1,1 u **solapadas** en dos filas, motriz delantera, 0 rodillos |
| Nivel B | Freno de boca, mantelete cuadrado, 3 cofres, escape doble con protector, azadón, faldón corto sobre la oruga |
| Nivel C | 4 líneas de panel horizontales, mancha de camuflaje, número |
| Piezas | 17 |
| Boca | Tubo anclado alto en torreta alta: el ancla del tubo baja 0,25 u respecto a MEDIA |
| Propuesta | Vida 140, daño 52, avance 0,55× |

El solape de ruedas es caro de leer y es exactamente lo que hay que exagerar:
dos filas visibles, no una fila apretada.

### CAZACARROS — 1943

Teatros: Stalingrado, Ardenas, Frente del Este.

| | |
|---|---|
| Casco | **Cuña**: una sola superficie inclinada del morro al techo, 5,4 × 1,3 u. La silueta más baja |
| Torreta | No |
| Tubo | 4,2 u, r 0,15 — el más largo. Sobresale del morro más de un tercio del vehículo |
| Rodaje | 6 rodadura de 1,1 u, motriz delantera, 3 rodillos, oruga con comba marcada |
| Nivel B | Mantelete esférico grande r 0,45 (la única pieza que rompe la cuña), collar de tubo, 2 cofres, escape lateral, azadón |
| Nivel C | 2 líneas de panel siguiendo la inclinación, remaches del mantelete, mancha |
| Piezas | 12 |
| Boca | Casco bajo + tubo largo: el ancla sube 0,3 u sobre MEDIA |
| Propuesta | Vida 90, daño 56, avance 0,8×. Pega fuerte y aguanta poco |

Todo su carácter está en la proporción tubo/casco. Si el tubo no incomoda al
mirarlo, es corto.

### OBÚS ATP — 1943

Teatros: todos.

| | |
|---|---|
| Casco | Bajo con **bañera abierta** trasera de paredes de 0,7 u, 5,8 × 1,4 u |
| Torreta | No. El tubo va montado en la bañera |
| Tubo | 1,8 u, r 0,24 — corto y gordo, elevado 35° en reposo |
| Rodaje | 5 rodadura de 1,0 u, motriz delantera, 2 rodillos |
| Nivel B | Paredes de bañera (3 piezas), **azadón grande de anclaje** bajado al suelo, cuna del tubo, freno de boca ancho, 2 cajas de munición en la bañera, escape |
| Nivel C | Remachado del borde de la bañera, líneas de panel del glacis |
| Piezas | 16 |
| Boca | Tubo corto y elevado: la cuna se monta **baja en la bañera** para que la boca caiga en la Y |
| Propuesta | Vida 85, daño 60 con radio de metralla mayor, avance 0,7× |

El azadón clavado en el suelo es la silueta que lo delata y además explica por
qué pega tan fuerte. No se corta nunca.

### RUEDAS — 1941

Teatros: Alamein, Somme, Ardenas.

| | |
|---|---|
| Casco | Cuerpo de coche blindado con morro caído, 4,6 × 1,4 u. El más corto de los siete |
| Torreta | Pequeña, cónica, r 0,7, alto 0,55 |
| Tubo | 1,9 u, r 0,11 |
| Rodaje | **4 ruedas neumáticas de 1,4 u**, flanco de `caucho` grueso, buje metálico de 5 radios |
| Nivel B | Guardabarros en las cuatro ruedas (obligatorio), rueda de repuesto en el flanco izquierdo, faro protegido, escape bajo, cofre trasero |
| Nivel C | Dibujo de banda del neumático como trazo discontinuo, 2 líneas de panel, número |
| Piezas | 15 |
| Boca | Torreta pequeña sobre casco medio: coincide con MEDIA sin ajuste |
| Propuesta | Vida 70, daño 30, avance **1,6×** y sube pendientes más fuertes. Se mueve, no pega |

La rueda de repuesto es su detalle de identidad. Es la única pieza asimétrica
grande del catálogo y por eso el vehículo se lee vivo.

---

## 2. Los ocho nuevos

### LANZALLAMAS — 1943

| | |
|---|---|
| Base | Chasis de MEDIA sin cambios en el rodaje: la familia se nota más si comparten chasis |
| Casco | Igual que MEDIA pero con techo despejado |
| Torreta | Redonda, r 0,9, más baja (0,6) |
| Tubo | **1,2 u, r 0,20, con boquilla acampanada** en vez de freno de boca |
| Nivel B | **Dos depósitos cilíndricos con aros en el trasero del casco** (la silueta), mangueras como dos tubos gruesos entre depósito y torreta, boquilla, mantelete, escape, cofre |
| Nivel C | Aros de depósito, franja de advertencia como banda oscura, líneas de panel |
| Piezas | 15 |
| Boca | Tubo corto: la torreta baja compensa y la boquilla cae en la Y |
| Propuesta | Daño 34 pero **el impacto deja fuego en el terreno 2 turnos**; alcance corto, avance 1,0× |

La manguera es lo que cuenta la historia: sin ella los depósitos parecen bidones
de carga.

### ANTIAÉREO — 1943

| | |
|---|---|
| Casco | Bajo, 5,2 × 1,2 u, con bañera abierta de paredes **plegables** (dos plegadas, dos en alto) |
| Torreta | Plataforma giratoria abierta con mástil central |
| Tubo | **Cuatro tubos de 2,2 u, r 0,08, en cuadro**, elevados 60° en reposo |
| Rodaje | 5 rodadura de 1,0 u, 2 rodillos, motriz delantera |
| Nivel B | Paredes de bañera (4), mástil, cuna cuádruple, 2 cargadores de caja, escape, cofre |
| Nivel C | Remachado de bañera, líneas de panel, mancha |
| Piezas | 18 — el tope. No admite ni una pieza más |
| Boca | Los cuatro tubos comparten **un solo ancla `boca`**, el del tubo inferior izquierdo, y ese es el que está en la Y. Los otros tres son decorado |
| Propuesta | Daño 12 × 4 disparos en ráfaga, radio pequeño. Castiga al que se mueve, no al que se atrinchera |

Cuatro tubos finos a 0,55× de zoom se convierten en una mancha. Se separan
0,22 u entre ejes para que se lean como cuatro y no como uno gordo.

### MORTERO ATP — 1943

| | |
|---|---|
| Casco | Caja baja y cerrada con techo abierto de trampilla, 4,8 × 1,3 u |
| Torreta | No |
| Tubo | **2,0 u, r 0,22, a 70° casi vertical**, con placa base visible |
| Rodaje | 4 rodadura de 1,1 u, 2 rodillos, motriz delantera |
| Nivel B | Trampilla de techo abierta (2 hojas), placa base, bípode, 2 estantes de bombas con proyectiles visibles, escape, azadón |
| Nivel C | Aros de refuerzo del tubo, remachado de la trampilla |
| Piezas | 14 |
| Boca | **El caso difícil.** Tubo casi vertical: la placa base se monta **0,9 u por debajo del techo**, hundida en el casco, para que la boca del tubo caiga en la Y de referencia. Declarado como excepción documentada según `ARTE-VEHICULOS.md` §8 |
| Propuesta | Trayectoria muy alta, ignora muros bajos, daño 42, avance 0,9× |

Si al modelarlo alguien sube la placa base «porque queda raro hundida», se rompe
la sincronía de red. Está en el test.

### CAÑÓN DE ASALTO PESADO — 1944

| | |
|---|---|
| Casco | El más grande: casamata de flancos rectos y techo bajo, 6,8 × 2,0 u |
| Torreta | No. Casamata fija de una pieza con el casco |
| Tubo | 3,4 u, r 0,22, en **mantelete redondo enorme** r 0,55 |
| Rodaje | 7 rodadura de 1,2 u solapadas, motriz delantera, 0 rodillos, faldón corto |
| Nivel B | Mantelete, freno de boca, 4 cofres, escape doble con protector, azadón grande, faldón, escotilla de techo |
| Nivel C | 5 líneas de panel, doble fila de remaches del mantelete, mancha grande |
| Piezas | 17 |
| Boca | Casamata alta: ancla del tubo **bajada 0,45 u**, la mayor corrección del catálogo |
| Propuesta | Vida 170, daño 64, avance 0,4×. El más lento y el que más pega |

Su carácter es la masa. Se exagera el ancho del mantelete y el grosor del tubo,
no la altura: alto ya lo es.

### SEMIORUGA — 1942

| | |
|---|---|
| Casco | Cabina delantera + caja de transporte abierta detrás, 5,6 × 1,4 u |
| Torreta | No. Afuste de anillo sobre la caja |
| Tubo | **1,0 u, r 0,07** (ametralladora) con escudo de placa |
| Rodaje | **Mixto: 2 ruedas neumáticas de 1,2 u delante, oruga corta de 18 eslabones detrás** con 3 rodadura de 0,9 u |
| Nivel B | Escudo de placa, afuste de anillo, paredes de la caja (3), guardabarros delantero, faro, rueda de repuesto, escape lateral, banco lateral |
| Nivel C | Remachado de la caja, líneas de panel de la cabina, dibujo del neumático |
| Piezas | 18 — el tope |
| Boca | Afuste alto sobre caja baja: coincide con MEDIA sin corrección |
| Propuesta | Vida 60, daño 14, avance **1,8×**, el mayor depósito. Es el vehículo de reposicionarse |

El rodaje mixto es la silueta más reconocible del catálogo. Se exagera: rueda
delantera claramente mayor que las de oruga.

### TANQUETA LIGERA — 1941

| | |
|---|---|
| Casco | Cuñita baja, 3,8 × 1,1 u. El vehículo más pequeño |
| Torreta | Minúscula, cilíndrica, r 0,55, alto 0,5, desplazada a la izquierda |
| Tubo | 1,4 u, r 0,08 |
| Rodaje | 4 rodadura de 0,9 u, motriz delantera, 1 rodillo, oruga estrecha de 22 eslabones |
| Nivel B | Mantelete pequeño, escotilla de torreta, guardabarros, escape, 1 cofre, faro |
| Nivel C | 1 línea de panel, número, mancha pequeña |
| Piezas | 12 — el mínimo |
| Boca | Casco muy bajo: el ancla sube 0,55 u, la mayor corrección hacia arriba |
| Propuesta | Vida 55, daño 22, avance 1,7×, blanco pequeño (radio de impacto reducido) |

Aquí el presupuesto no se agota por elección: a 3,8 u de largo, catorce piezas se
solapan y ninguna llega al mínimo de nivel B.

### COHETES — 1943

| | |
|---|---|
| Casco | Camión blindado o chasis de oruga (dos variantes de la misma ficha), 5,4 × 1,5 u |
| Torreta | No. **Bastidor de 8 raíles** inclinado 45°, montado atrás |
| Tubo | No hay tubo. El ancla `boca` es el extremo del **raíl inferior** |
| Rodaje | Variante A: 4 neumáticas de 1,3 u. Variante B: 5 rodadura de 1,0 u |
| Nivel B | Bastidor (2 largueros + 8 raíles cuentan como 3 piezas fusionadas), cuna basculante, cabina, guardabarros, cofre, escape, gato de apoyo trasero |
| Nivel C | Remachado del bastidor, dibujo del neumático, líneas de panel de la cabina |
| Piezas | 15 |
| Boca | Bastidor inclinado: se monta **bajo**, apoyado casi en el techo del casco, para que el extremo del raíl inferior caiga en la Y |
| Propuesta | **Salva de 6 cohetes** con dispersión sembrada, 11 de daño cada uno; recarga de 2 turnos. Cubre área, no acierta |

Ocho raíles a 0,08 u de radio están por debajo del mínimo. Se modelan como **una
rejilla de 8 huecos en una placa**, no como ocho cilindros: se lee igual y cuesta
una pieza.

### TRINCHERAS CON FALDONES — 1916

| | |
|---|---|
| Casco | Rombo estirado, 7,0 × 2,0 u. El más largo del catálogo |
| Torreta | No. Cabina de mando pequeña adelantada sobre el techo |
| Tubo | 1,8 u, r 0,17, en patrocinio lateral, más adelantado que ROMBO |
| Rodaje | Oruga que envuelve el casco, **tapada por completo por faldones de una pieza con 4 recortes redondos** por los que se ven eslabones y dos ruedas |
| Nivel B | Faldones (izquierdo visible), cabina de mando, cofre grande de techo, **rodillo antizanja delantero** (cilindro grueso al frente), escape alto de chimenea, 2 escotillas |
| Nivel C | Remachado corrido de todo el faldón, 3 líneas de panel, mancha |
| Piezas | 14 |
| Boca | Patrocinio alto: coincide con ROMBO |
| Propuesta | Vida 150, daño 34, avance 0,45× pero **cruza trincheras y muros bajos sin penalización**. Su razón de existir |

El faldón cerrado con recortes es la silueta más distinta de las quince, y es
gratis: una pieza tapa seis. Cuidado con lo contrario — si los recortes no dejan
ver eslabón y rueda, parece un contenedor.

---

## 3. Fila de comparación

La prueba de familia de `ARTE-VEHICULOS.md` §5 se hace **con los quince en una
fila, al mismo zoom, sobre el mismo fondo, en negro y en color**. Está en
`CHECKLIST-REVISION.md`.

Orden de modelado obligatorio:

1. **MEDIA**, entera, aprobada. Parar aquí.
2. **CAZACARROS** y **PESADO** — validan casco sin torreta y torreta grande.
3. **ROMBO** y **A7V** — validan la época de 1916 y la oruga envolvente.
4. **RUEDAS** y **SEMIORUGA** — validan el rodaje no-oruga.
5. El resto, en cualquier orden, reutilizando primitivas.
6. **OBÚS**, **MORTERO**, **ANTIAÉREO** y **COHETES** al final: son los cuatro
   que tocan el invariante de la boca, y conviene tener el test maduro antes.

Nunca dos vehículos a medias a la vez. Un vehículo terminado y revisado enseña
qué primitiva falta; dos a medias solo enseñan que faltan dos.
