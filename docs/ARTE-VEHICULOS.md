# Guía de arte — vehículos

Normativo. **Sustituye a `ARTE.md` §5 y §8 para todo lo que sea un vehículo.**
`ARTE.md` sigue mandando en escenas, cielo, suelo, fondo, movimiento y
presupuesto de cuadro. Las seis reglas invariables de `ARTE.md` §1 siguen
vigentes; lo que cambia es **cuánto detalle** se permite y **de qué piezas** se
construye un vehículo.

Objetivo: mallas de Three.js con aspecto de cartoon vectorial de contorno grueso
—tipo *Hills of Steel* / *Angry Birds*— vistas de perfil con cámara ortográfica.
No es 3D realista y no es un sprite plano: es una silueta 2D construida en 3D
para que la luz, el contorno y la sombra sean coherentes con el resto de la
escena.

---

## 0. Por qué existe este documento

La versión anterior de la guía mandaba «3 a 6 formas por objeto», «fuera todo
detalle por debajo de 8 px» y «2 bandas de tono en sprite». Cumpliéndola al pie
de la letra sale exactamente lo que hay hoy: siete cajas con un tubo, correctas
y sin carácter. El error no fue de ejecución, fue de guía.

La regla nueva no es «más detalle». Es **detalle jerarquizado**: la silueta
sigue mandando, pero por debajo de ella hay dos niveles más que antes estaban
prohibidos y ahora son obligatorios.

---

## 1. Los tres niveles de detalle

Todo vehículo se lee en tres pasadas. Cada nivel solo se dibuja si el anterior
está resuelto.

| Nivel | Qué es | Piezas | Se ve a |
|---|---|---|---|
| **A. Silueta** | Casco, torreta o casamata, tubo, tren de rodaje | 4–6 | cualquier zoom |
| **B. Forma** | Mantelete, freno de boca, escape, cofre de herramientas, faldón, azadón, depósito, escotilla, guardabarros | 6–10 | zoom ≥ 0,8× |
| **C. Superficie** | Líneas de panel, filas de remaches, banda de camuflaje, número de torreta, marcas de rodadura | 0 mallas — calcomanías planas | zoom ≥ 1,4× |

**Presupuesto: 12 a 18 piezas de nivel A + B por vehículo.** Menos de 12 y
vuelve a ser una caja; más de 18 y deja de leerse a 0,55× de zoom, que es el
plano al que se juega la mitad del tiempo.

El nivel C **no cuenta** en el presupuesto porque no añade mallas: son quads
coplanares con `polygonOffset`, fusionados en la misma geometría que el casco.
Pero sí cuenta en la revisión: un vehículo sin nivel C se ve tan vacío como uno
sin nivel B.

### El mínimo visible, calculado

Con cámara ortográfica el tamaño en pantalla de una unidad es constante y se
puede calcular:

```
px_por_unidad = ancho_viewport_px / (ancho_encuadre_u / zoom)
```

Sustituye `ancho_encuadre_u` por el valor real de `CONFIG` (no lo inventes: lee
`src/world/gamecamera.js` y mídelo con `render_game_to_text`). Con un móvil de
390 px y un encuadre de 34 u a zoom 1 salen ~11,5 px/u, y de ahí:

| Zoom | px por unidad | Detalle mínimo legible (8 px) |
|---|---|---|
| 0,55× | 6,3 | 1,27 u |
| 1,0× | 11,5 | 0,70 u |
| 2,6× | 30,0 | 0,27 u |

Reglas que salen de la tabla, y son duras:

- **Nivel A: nada por debajo de 1,3 u** en su dimensión menor. Se ve siempre.
- **Nivel B: nada por debajo de 0,7 u.** Si una pieza no llega, no se reduce:
  se elimina o se fusiona con la vecina hasta que llegue.
- **Nivel C: nada por debajo de 0,27 u de grosor, y nunca aislado.** Un remache
  de 0,12 u no existe. Lo que existe es **la fila de remaches**: un trazo
  discontinuo de 1,5 u de largo que a lo lejos se lee como una línea y de cerca
  como remaches. Igual con las líneas de panel: siempre cruzan una cara entera,
  nunca hay una línea de 3 cm en el centro de nada.

---

## 2. Módulo único de primitivas

Ningún vehículo modela geometría a pelo. Todo sale de `src/art/vehiculo/`, y ahí
es donde viven las reglas.

```
src/art/vehiculo/
  paleta.js        bandos, tono(), claro/oscuro/contorno  (ya existe en ARTE.md §2)
  primitivas.js    las piezas de abajo, y nada más
  toon.js          material de bandas + shell de contorno
  ensamblar.js     coge una ficha del catálogo y devuelve el Object3D
  fichas/           una por vehículo: solo números, cero geometría
```

Primitivas obligatorias. Un vehículo que necesite una forma que no está aquí
**añade la primitiva**, no la forma:

```js
casco(perfil, ancho, base, { bisel })     // extrusión de un polígono de perfil
casamata(perfil, ancho, base, { techo })  // casco con superestructura fija
torreta(r, alto, base, { forma })         // 'redonda' | 'cuadrada' | 'conica'
mantelete(r, base)                        // la unión torreta-tubo, nunca ausente
tubo(largo, r, base, { frenoBoca })       // cilindro + boca; devuelve el ancla `boca`
rueda(r, base, { radios, buje })          // llanta, buje y aro oscuro modelado
rodillo(r, base)                          // rueda de retorno, va arriba
tensor(r, base)                           // rueda guía delantera, mayor que el rodillo
oruga(camino, nEslabones, base)           // InstancedMesh sobre el camino cerrado
faldon(perfil, base, { recortes })
escape(largo, base, { protector })
cofre(w, h, d, base)                      // herramientas / munición
deposito(r, largo, base, { aros })
azadon(base)                              // pala de anclaje trasera
escotilla(r, base)                        // solo si supera 0,7 u
lineaPanel(a, b)                          // calcomanía nivel C
filaRemaches(a, b, n)                     // calcomanía nivel C
mancha(perfil)                            // banda de camuflaje, nivel C
sombraContacto(ancho)                     // ARTE.md §1.4, sigue siendo obligatoria
```

`ensamblar.js` es lo único que compone. Una ficha de catálogo **no puede
importar Three**: es un objeto de números. Así el catálogo se prueba sin escena
y `tests/arquitectura.test.js` sigue verde.

---

## 3. Sombreado: las bandas de `ARTE.md`, en 3D

Cero degradados sigue vigente. En 3D eso se traduce en **`MeshToonMaterial` con
un `gradientMap` de tres paradas**, y las tres paradas son exactamente las de
`ARTE.md` §2:

| Parada | Color | Dónde cae con la key a 45° arriba-izquierda |
|---|---|---|
| 1 | `claro(base)` = `tono(base, +0.18)` | techo y flanco izquierdo |
| 2 | `base` | cuerpo |
| 3 | `oscuro(base)` = `tono(base, -0.24)` | bajo el casco, tras la torreta |

La mancha de camuflaje es un cuarto valor, `camuflaje(base)` = `tono(base, -0.13)`,
y **no** es una parada del `gradientMap`: va en el color por vértice, por debajo del
sombreado. Medido en la referencia: base `#7D8B4E`, clara `#96A560`, oscura
`#5E6A38`, camuflaje `#6B7A41`.

El `gradientMap` es una textura de 3×1 px, `NearestFilter`, **una sola para todo
el juego**. El color por vértice hace el resto: así un vehículo entero es una
geometría fusionada con un único material.

- `flatShading: true` en todo. El bisel de una arista se modela; no se
  interpola.
- Prohibido `MeshStandardMaterial`, `roughness`, `metalness`, `envMap`,
  `normalMap`, cualquier `filter` o `postprocessing` de brillo.
- Prohibido más de una fuente de luz direccional. La key de la escena a 45°
  arriba-izquierda es la única, y es la misma que ya usa el terreno.

### Contorno

Shell de casco invertido, no postprocesado: el `OutlinePass` cuesta una pasada
de pantalla entera y el presupuesto son 16,7 ms.

- Copia de la geometría, `side: THREE.BackSide`, `MeshBasicMaterial` de color
  `contorno(base)` = `tono(base, -0.65)`. Nunca `#000`. El factor sale de medir la
  referencia (`#7D8B4E` → `#2B3419`), no de redondear el −0,55 antiguo.
- El desplazamiento va **en el vertex shader, a lo largo de la normal en espacio
  de vista, en píxeles**, no escalando el objeto. Con ortográfica eso da grosor
  constante en pantalla a cualquier zoom, que es la única forma de que el
  contorno no engorde al hacer zoom:

```glsl
// grosorPx uniforme; unidadesPorPixel viene de la cámara ortográfica
vec3 p = (modelViewMatrix * vec4(position, 1.0)).xyz;
vec3 n = normalize(normalMatrix * normal);
gl_Position = projectionMatrix * vec4(p + n * grosorPx * unidadesPorPixel, 1.0);
```

- **`grosorPx = 3.0`** en casco, torreta, tubo y faldón. **`2.0`** en piezas de
  nivel B. Nada por debajo de 2: a 1 px el contorno parpadea con el antialias y
  el vehículo se ve sucio en movimiento.
- **Ruedas y eslabones no llevan shell.** Su contorno es geometría: un aro
  oscuro modelado en la propia llanta. Con seis vehículos en pantalla el shell
  de cada rueda serían 40 llamadas de dibujo por nada.

---

## 4. Anatomía obligatoria del tren de rodaje

Es lo que más distingue la referencia de lo que hay hoy, y es donde se va la
mitad del presupuesto de piezas. Un vehículo de oruga lleva **todo** esto:

1. **Rueda motriz**, trasera o delantera, con dentado visible (6–8 dientes
   modelados, no calcomanía). Mayor que las de rodadura.
2. **Ruedas de rodadura**, 4 a 7 según ficha, todas iguales, con **buje central
   más oscuro** y **radios o aligeramientos** en la llanta. Sin buje una rueda es
   un círculo y se lee como un agujero.
3. **Tensor delantero**, del tamaño de la motriz o algo menor.
4. **Rodillos de retorno**, 2 a 4, arriba, pequeños. Son lo que separa un tren de
   rodaje de una fila de monedas.
5. **Oruga**: cinta cerrada de 24 a 30 eslabones sobre el camino que envuelve
   motriz, tensor, rodillos y rodadura. Comba entre rodillos: la parte de arriba
   **cuelga**, nunca es una recta tensa. Un `InstancedMesh`, una llamada.
6. **Sombra bajo la barcaza**: la banda `oscuro(base)` entre el casco y la
   oruga. Sin ella el casco parece flotar sobre las ruedas.

Las ruedas **giran** con la x recorrida y la oruga **avanza** con el mismo
parámetro. Se calcula de la posición, no del reloj: `s = x_recorrida / paso`.
Si se calcula del reloj, dos móviles ven las orugas desfasadas y —lo que
importa— deja de haber una sola verdad para el replay.

Vehículos de ruedas: mismos puntos 2 y 6, con neumático `caucho` de flanco
grueso, dibujo de banda como calcomanía nivel C y **guardabarros obligatorio**.

---

## 5. La silueta sigue mandando

El presupuesto sube a 12–18 piezas, pero la prueba no cambia: **rellena el
vehículo de negro. Si no se distingue de sus catorce hermanos, está mal, y no se
arregla con nivel B ni con nivel C.**

Lo que distingue a un vehículo de otro, por orden de fuerza:

1. Perfil del casco: cuña, caja, rombo, panza.
2. Longitud y grosor del tubo, y su altura de anclaje.
3. Presencia y forma de la torreta — o su ausencia.
4. Perfil del tren de rodaje: número y tamaño de ruedas, faldón sí o no.
5. Una silueta añadida: azadón, bastidor de cohetes, depósito, mástil.

Y sigue vigente lo que ya funcionaba: **exagerar**. Ruedas más grandes de lo
real, cascos más panzudos, tubos más largos. La referencia no es un plano
técnico.

---

## 6. Los dos bandos

Un solo color base por bando. Todo lo demás —contorno, bandas de sombra,
camuflaje— se calcula de él, así que un bando nunca sale con el contorno del
otro y añadir un tercero es una línea.

```js
export const BANDOS = {
  A: { base: '#7E8B4A', nombre: 'oliva' },
  B: { base: '#5C7D92', nombre: 'acero' },
};
```

Los dos valores son los del ejemplar aprobado de §12 (el oliva literal, y el acero
con el mismo valor tonal y la misma saturación en el azul). La versión anterior de
esta sección decía `#8FA33C` y `#7E9BB8`: eran más claros y más saturados que el
ejemplar, y con ellos el contorno calculado se iba a verde hierba. **Manda §12.**

Piezas que **no** se tiñen del bando, porque son materia y no pintura: oruga y
neumático (`caucho`), tubo interior de la boca (`contorno(metal)`), depósitos de
lona (`lona`), herramienta de madera (`madera`). Que estas piezas mantengan su
color es lo que evita que el vehículo se lea como una figura de un solo color.

Prohibido distinguir bandos con banda de reconocimiento, estrella, cruz o
bandera. El color basta y es legible a 0,55×.

---

## 7. Presupuesto de dibujo

Seis vehículos en pantalla a la vez (3v3). El tope es **8 llamadas de dibujo por
vehículo**:

| # | Contenido |
|---|---|
| 1 | Casco + casamata + nivel B + calcomanías, todo fusionado, color por vértice |
| 2 | Shell de contorno de lo anterior |
| 3 | Torreta + mantelete + tubo fusionados (van juntos porque giran juntos) |
| 4 | Shell de contorno de lo anterior |
| 5 | Ruedas + motriz + tensor + rodillos, `InstancedMesh` |
| 6 | Eslabones de oruga, `InstancedMesh` |
| 7 | Sombra de contacto |
| 8 | Reserva: efecto propio del vehículo (chorro, humo de escape) |

Cazacarros y obús no tienen torreta: gastan 6. Si una ficha necesita la novena
llamada, la pieza se fusiona con otra o se cae. **No hay excepciones aprobadas
por adelantado.**

Y sigue mandando `ARTE.md` §15: la calidad adaptativa toca densidad de píxeles y
sombra, **nunca** el número de piezas de un vehículo. Un vehículo con menos
detalle en un móvil viejo es un vehículo distinto, y en red eso confunde.

---

## 8. El invariante, que no se toca

`ARTE.md` §9 sigue siendo ley, y con 15 vehículos pasa a ser lo más fácil de
romper. Se blinda así:

- `tubo()` cuelga de un `Object3D` vacío llamado **`pivote`** —el eje de
  elevación— y devuelve otro llamado **`boca`** en el extremo. La balística lee
  **solo** `boca`; nunca calcula de la geometría.
- **La Y mundial de `pivote` es la misma en los quince vehículos.** Está en
  `CONFIG`, no en la ficha. La boca sale de `pivote + R(elevación)·[largo, 0]`,
  con `largo` declarado en la ficha: dos clientes obtienen el mismo punto porque
  las dos entradas son datos, no geometría medida.
- La redacción anterior decía que era **la boca** la que estaba a la misma Y «en
  toda elevación de tubo». Eso es geométricamente imposible —un tubo que gira
  describe un arco, no una horizontal— y obligaba a enterrar la cuna del mortero
  por debajo de la oruga para cuadrarlo. **Queda derogada.** Fijar el pivote
  cumple lo que de verdad hacía falta (que la altura del casco no desincronice
  nada) y además deja que el mortero y el antiaéreo se vean como lo que son.
- El mortero, el bastidor de cohetes y el antiaéreo montan su cuna **sobre** el
  pivote común, con la elevación de reposo escrita en la ficha. Ya no hay
  excepciones que documentar: no queda ninguna.
- `tests/world/cannon.test.js` recorre el catálogo entero y compara la Y de
  `boca`. **Ese test se amplía a los quince antes de modelar el primero.**

Si una decisión estética choca con esto, gana el invariante y la excepción se
escribe en la ficha.

---

## 9. Prohibido

Además de lo de `ARTE.md` §6:

- Detalle de nivel C sin nivel B resuelto. Remaches sobre una caja siguen siendo
  una caja.
- Piezas por debajo del mínimo de su nivel «para que se vea de cerca».
- Simetría perfecta. El escape, el cofre y el azadón van a un lado. Un vehículo
  simétrico se lee como un icono.
- Geometría propia en una ficha de catálogo.
- Más de un material por vehículo.
- Torreta con tubo pero sin mantelete: el tubo saliendo de una ranura limpia es
  la marca de un modelo sin acabar.
- Rueda sin buje, oruga sin comba, casco sin banda oscura de barcaza.
- Rostros, ojos, figuras, tripulantes, manos, banderas o cualquier elemento
  antropomórfico. **En ninguna pieza, en ningún nivel de detalle.** El vehículo
  es la máquina y nada más.


---

## 12. Construcción aprobada — un cuerpo, un contorno

**Esta sección es la vara de medir.** Se aprobó sobre MEDIA 1942 y manda sobre
cualquier criterio anterior de esta guía. Los catorce vehículos restantes se
construyen así, sin excepción.

Cinco reglas. Las cinco salen de errores reales que se cometieron y se corrigieron:

1. **Un solo contorno cerrado por vehículo.** Casco, superestructura o torreta,
   cúpula, mantelete, tubo y freno de boca son **una única silueta continua**, no
   piezas apiladas. Un círculo pegado a un rectángulo pegado a un tubo pegado a
   un cuadrado se lee como cuatro figuras juntas, nunca como un tanque.
   En 3D: **una sola geometría fusionada** y **un solo shell de contorno** para
   todo ese conjunto. Si el shell se genera por pieza, reaparecen los bordes
   internos.

2. **El mantelete y el freno de boca son ensanches de la silueta**, no
   apéndices. El mantelete es un abultamiento del frente de torreta el doble de
   grueso que el tubo; el freno es un engrosamiento del propio tubo en su punta.
   Ninguno de los dos lleva contorno propio.

3. **El contorno se dibuja al último, por encima del sombreado.** Este fue el
   fallo que se veía como «líneas flotando en el aire»: el cuerpo tenía costuras
   interiores pero no contorno exterior. Orden obligatorio de pintado:
   relleno base → bandas de sombra recortadas contra la silueta → costuras →
   **contorno**.

4. **Toda línea interior arranca en el borde y muere en el borde.** Una costura
   con un extremo en el aire es un defecto, no un detalle. Siete costuras bastan
   y son siempre las mismas: junta torreta/casco, anillo del mantelete, arranque
   del tubo, culata del freno, plancha de cola, pliegue del sobrepatín y pliegue
   de la nariz. En 3D son **aristas de la propia malla**, no calcomanías.

5. **Cero elementos con contorno propio pegados encima.** No es «cero detalle»:
   es que nada tenga un borde que compita con la silueta única.

   - Lo que aporta bulto —cúpula, escotilla, cofre de techo, escape— **crece del
     propio borde superior** y comparte el contorno del cuerpo. En la referencia
     hay tres de estos bultos en el techo y uno en la cola, y no rompen nada
     porque el contorno los rodea a ellos y al casco de una sola pasada.
   - Lo que es superficie —fila de remaches, mancha de camuflaje, línea de
     panel— va **sin contorno ninguno**, en `camuflaje(base)` o en un trazo
     discontinuo, recortado contra la silueta. Es el nivel C de §1 y es
     **obligatorio**: la referencia lleva una fila de remaches discontinua que
     cruza el casco entero y tres manchas ovaladas.
   - Lo que se prohíbe de verdad: faros, ganchos, planchas de repuesto, números y
     cualquier pieza que **sobresalga del perímetro** con su propio borde.

   **La vara es la imagen de referencia aprobada** (casco `#7D8B4E`, contorno
   `#2B3419`, oruga `#4A4A42`). La primera redacción de esta regla decía «fuera
   filas de remaches y manchas de camuflaje» y contradice la referencia punto por
   punto; queda derogada por lo de arriba.

### El rodaje, aprobado y congelado

El tren de rodaje **no se rediseña**. Se reutiliza tal cual en los quince, y es
lo único que puede llevar contorno por pieza, porque las ruedas son piezas de
verdad y giran:

| Pieza | Construcción exacta |
|---|---|
| Rueda de rodadura | Llanta exterior + **aro interior más claro** + **4 tornillos** + buje central oscuro |
| Motriz y tensor | Igual, un 15 % mayores que la rodadura |
| Rodillos de retorno | Disco pequeño + buje, arriba, 3 unidades |
| Oruga | Cinta cerrada de contorno grueso + **línea discontinua interior** que hace de eslabón |
| Comba | La cinta cuelga entre rodillos. Recta tensa = juguete |

### Tres tonos, recortados

Base, banda clara y banda oscura. Las dos bandas van **recortadas contra la
silueta** (en 3D: el `gradientMap` de tres paradas de §3), nunca dibujadas
encima a ojo — de ahí salían las líneas desfasadas. La banda clara recorre el
borde superior con un offset constante; la banda oscura ocupa desde el pliegue
del sobrepatín hasta el bajo del casco, **con el borde superior en la misma
coordenada que la costura**, para que coincidan exactamente.

Paleta del ejemplar aprobado; de aquí salen las de los dos bandos por §6:

Medida sobre la imagen de referencia, no estimada. Entre paréntesis, el factor de
`tono()` que la reproduce; es ese factor el que se escribe en el código, nunca el hex.

| Rol | Valor | Factor |
|---|---|---|
| Base | `#7D8B4E` | — |
| Banda clara | `#96A560` | `+0,18` |
| Mancha de camuflaje | `#6B7A41` | `−0,13` |
| Banda oscura | `#5E6A38` | `−0,24` |
| Contorno | `#2B3419` | `−0,65` |
| Caucho y oruga | `#4A4A42` | — |
| Buje y hueco de rueda | `#292A24` | `−0,24` sobre caucho |
| Contorno de oruga | `#1E2118` | `−0,65` sobre caucho |

### Proporciones del ejemplar aprobado

Medidas relativas al largo total del casco (L). Cualquier vehículo nuevo parte
de aquí y solo cambia lo que su ficha diga:

| Medida | Valor |
|---|---|
| Alto de casco | 0,18 L |
| Alto de torreta sobre el techo | 0,17 L |
| Largo del tubo desde el mantelete | 0,38 L |
| Grosor del tubo | 0,07 L |
| Grosor del freno de boca | 0,13 L (el doble del tubo) |
| Grosor del mantelete | 0,14 L |
| Diámetro de rueda de rodadura | 0,13 L |
| Contorno | silueta 13 px, costura 7 px, constante a cualquier zoom |

### Cómo se hace el vehículo número dos

1. Copiar la silueta aprobada.
2. Cambiar **solo** lo que la ficha del catálogo manda: perfil del casco, altura
   de torreta, largo del tubo, número de ruedas.
3. No añadir nada. Si el vehículo nuevo necesita una silueta añadida (azadón,
   bastidor de cohetes, depósito), esa silueta **se integra en el path del
   cuerpo**, no se pega encima.
4. Verificar la Y de la boca (§8) y pasar la fila de comparación.
