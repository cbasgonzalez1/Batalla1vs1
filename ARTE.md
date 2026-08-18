# Guía de arte — estilo cartoon vectorial

Este documento es normativo. Todo el arte del juego (escenas, props, HUD ilustrado)
debe cumplirlo. Si un cambio de código dibuja algo en pantalla, se valida contra la
checklist del final antes de darlo por terminado.

Referencia visual: cartoon vectorial tipo Angry Birds / Rayman Origins.
Formas gruesas y legibles, contorno oscuro, sombreado por bandas planas.

---

## 1. Reglas invariables

Estas seis reglas no se negocian y aplican a **todo** objeto dibujado:

1. **Contorno.** Todo objeto del plano medio y del primer plano lleva contorno de
   `2.5px` (plano medio) o `3.5px` (primer plano). El color del contorno es el color
   base del objeto oscurecido un **65%**, nunca `#000` ni un gris neutro.
   Los objetos del fondo lejano **no llevan contorno**.
   El 65% no es una elección: sale de medir la imagen de referencia aprobada
   (casco `#7D8B4E`, contorno `#2B3419` — un factor de −0,645). El 55% de la
   primera versión daba un contorno verdoso que no cerraba la silueta.
2. **Tres tonos por objeto.** Base + banda clara + banda oscura. Nunca un objeto de
   un solo color plano.
3. **Luz fija.** La fuente de luz está siempre arriba-izquierda. La banda clara va
   arriba/izquierda, la oscura abajo/derecha. Sin excepciones dentro de una escena.
4. **Sombra de contacto.** Todo objeto apoyado en el suelo lleva una elipse oscura
   semitransparente bajo su base. Sin sombra, el objeto flota.
5. **Esquinas redondeadas.** `rx` mínimo de 6 en cajas y estructuras, 10–14 en
   objetos orgánicos o cilíndricos. Cero esquinas vivas.
6. **Sin degradados.** El sombreado se hace con bandas de color plano superpuestas.
   Nada de `linearGradient`, `blur`, `drop-shadow` ni `filter`.

---

## 2. Tokens de color

Todo color sale de este módulo. Prohibido escribir hex sueltos en el código de una
escena.

```js
export const PALETA = {
  cielo:    { alto: '#3d6d96', medio: '#6fa0c2', bajo: '#a9c9d9' },
  lejano:   '#93b0b6',
  suelo:    { fondo: '#cbb888', medio: '#b8a06b', frente: '#967f4c' },
  madera:   '#b07f43',
  metal:    '#4a5a62',
  caucho:   '#3f3f3f',
  follaje:  '#5f7040',
  lona:     '#8a7a52',
  acento:   '#d94f2b',
};

// Un solo color base por bando. Contorno, bandas de sombra y camuflaje se
// calculan de el, asi que anadir un tercer bando es una linea y ningun bando
// puede salir con el contorno del otro. `docs/ARTE-VEHICULOS.md` §6.
export const BANDOS = {
  A: { base: '#7e8b4a', nombre: 'oliva' },
  B: { base: '#5c7d92', nombre: 'acero' },
};
```

Los tonos derivados se calculan, no se escriben a mano. Una sola función:

```js
// f > 0 aclara, f < 0 oscurece. Trabajar en HSL, no en RGB.
export function tono(base, f) { /* ... */ }

export const claro    = c => tono(c,  0.18);
export const camuflaje = c => tono(c, -0.13);  // mancha, nivel C: apenas se separa
export const oscuro   = c => tono(c, -0.24);
export const contorno = c => tono(c, -0.65);
```

Regla de valor tonal: entre fondo, suelo y objetos debe haber al menos un 20% de
diferencia de luminosidad. Si la escena se lee como una mancha uniforme, es que esta
regla se ha roto.

---

## 3. Capas de la escena

Toda escena se compone de cinco planos, dibujados en este orden:

| Plano | Contenido | Tratamiento |
|---|---|---|
| 1. Cielo | 3 bandas horizontales | Más claro cerca del horizonte |
| 2. Fondo lejano | Colinas, edificios lejanos | Desaturado y azulado, sin contorno, sin sombreado |
| 3. Suelo | 2–3 bandas con borde curvo (`path`, no `rect`) | Más oscuro según se acerca |
| 4. Objetos | Hito principal + piezas sueltas | Contorno 2.5px, 3 tonos, sombra de contacto |
| 5. Primer plano | Hierba, piedras, siluetas | Silueta oscura casi plana, contorno 3.5px |

El **hito** de cada escena ocupa entre el 25% y el 40% del ancho y rompe la línea del
horizonte. Las piezas sueltas nunca superan el 40% de la altura del hito.

---

## 4. Primitivas compartidas

Ninguna escena dibuja formas a pelo. Todo pasa por este módulo, que es donde viven
las seis reglas. Cambiar el look del juego entero = tocar solo este fichero.

```js
sombraContacto(x, y, ancho)          // elipse bajo el objeto
cuerpo(x, y, w, h, base, { rx })     // rect con contorno + banda clara + banda oscura
cilindro(x, y, w, h, base, { aros }) // bidón: tapa elíptica, franja de luz, aros
rueda(cx, cy, r, base)               // llanta + buje + brillo de arco
bandaCielo(paleta)
bandaSuelo(paleta)
siluetaFrente(puntos, base)
```

Toda primitiva aplica sombra de contacto y contorno por defecto. Desactivarlos exige
pasar una opción explícita y dejar un motivo en el código.

Los vehículos tienen su propio juego de primitivas en `src/art/vehiculo/primitivas.js`
(`docs/ARTE-VEHICULOS.md` §2) porque son mallas 3D y estas son formas de escena. Son
dos módulos, no dos estilos: las seis reglas de §1 mandan en los dos.

---

## 5. Silueta antes que detalle

La prueba de silueta: rellena la forma entera de negro. Si no se reconoce qué es, la
forma está mal y no se arregla con detalle interno.

- Exagera proporciones: ruedas grandes, estructuras panzudas, cañones de tubo largo.
- Nada de planos técnicos ni vistas de manual. Es una caricatura del objeto.
- El detalle está **jerarquizado, no racionado**: silueta primero, luego forma,
  luego superficie. Cuánto detalle admite cada familia lo dice su documento.

> **Para vehículos manda `docs/ARTE-VEHICULOS.md`, que sustituye a esta sección.**
> Allí el presupuesto es de 12–18 piezas por vehículo con tres niveles de detalle.
> La regla vieja de «3 a 6 formas por objeto» y «fuera detalles por debajo de 6 px»
> **queda derogada**: era exactamente lo que producía siete cajas con un tubo.
> Para decorado manda `docs/ESCENARIOS.md`; para trampas, `docs/TRAMPAS.md`.

---

## 6. Prohibido

- Degradados, blur, glow, sombras difuminadas.
- Objetos sin contorno en los planos 4 y 5.
- Objetos sin sombra de contacto apoyados en el suelo.
- Esquinas vivas.
- Hex escritos directamente en una escena.
- Dos objetos de la misma escena con la luz desde lados distintos.
- Texto pequeño como sustituto de forma legible.

---

## 7. Checklist de aceptación

Una escena no está terminada hasta que las diez respuestas son sí:

- [ ] ¿Los cinco planos están presentes?
- [ ] ¿Todo objeto del plano 4 y 5 tiene contorno del color correcto?
- [ ] ¿Todo objeto tiene tres tonos?
- [ ] ¿La luz viene de arriba-izquierda en toda la escena?
- [ ] ¿Todo objeto apoyado tiene sombra de contacto?
- [ ] ¿Cero esquinas vivas?
- [ ] ¿Cero degradados y cero filtros?
- [ ] ¿El fondo lejano está desaturado y sin contorno?
- [ ] ¿El hito ocupa entre el 25% y el 40% del ancho?
- [ ] ¿Pasa la prueba de silueta en negro?

---

## 8. Vehículos — derogada, ver `docs/ARTE-VEHICULOS.md`

Esta sección definía los vehículos como *sprites*: 2 bandas de tono, detalle mínimo
de 8 px, contorno del 4 % del alto. **Ya no vale.** Los vehículos no son sprites: son
mallas de Three.js con cámara ortográfica de perfil, y el detalle mínimo se calcula
en unidades de mundo a partir del encuadre, no en píxeles de una imagen.

Lo que sí sobrevive de aquí, y sigue siendo obligatorio, está recogido en
`docs/ARTE-VEHICULOS.md` §2, §5 y §7:

- **Un solo módulo.** Todos los vehículos salen de `src/art/vehiculo/` y comparten
  primitivas. Una ficha de catálogo no modela geometría a pelo.
- **Coherencia de familia.** La prueba real es la fila de comparación con los quince
  al mismo zoom, no mirar uno por separado (`docs/CHECKLIST-REVISION.md` §3).
- **La silueta distingue.** Perfil del casco, tubo, torreta y tren de rodaje. Ni el
  color ni la calcomanía distinguen a dos vehículos.
- **El vehículo no lleva su propio fondo** y tiene que leerse sobre los seis teatros.

---

## 9. Invariantes de gameplay

**Estos valores no se tocan al cambiar arte. Nunca. Bajo ningún concepto.**

Son restricciones de simulación disfrazadas de decisiones de dibujo. Modificarlos
rompe la sincronización entre clientes y produce un bug que no se manifiesta como
error visual, sino como partidas que divergen sin explicación.

- **Altura del pivote de elevación.** Todos los vehículos tienen el eje sobre el que
  gira el tubo en la misma coordenada Y exacta, y la boca sale de ese pivote más el
  largo de tubo que declara la ficha. De ahí sale el punto de salida del proyectil.
  Un cambio en la altura del casco, la torreta o el tubo que mueva el pivote
  desincroniza la partida.
  (Antes esta regla hablaba de **la boca** «a la misma Y en toda elevación». Un tubo
  que gira describe un arco, así que eso no se puede cumplir; ver
  `docs/ARTE-VEHICULOS.md` §8.)
- Antes de dar por buena cualquier modificación de un sprite, verificar que la boca
  sigue en la Y de referencia. Si el proyecto no tiene un test que lo compruebe,
  escribirlo antes de tocar el primer sprite.
- El resto —tamaño, forma, ruedas, torreta, color— es libre.

Si al aplicar esta guía surge un conflicto entre una regla estética y un invariante,
gana siempre el invariante y se documenta la excepción.

---

## 10. Migración

Orden obligatorio al aplicar esta guía a escenas existentes:

1. Crear `paleta.js` y `primitivas.js`. Nada más.
2. Migrar **una** escena de referencia entera. Parar y revisar.
3. Solo con la referencia aprobada, migrar el resto de escenas una a una,
   reutilizando las primitivas sin añadir formas nuevas a pelo.
4. Cualquier forma que no encaje en las primitivas se añade **a las primitivas**,
   no a la escena.

---

# Anexo — lo absorbido de ART.md

`ART.md` ya no existe: hay un solo documento de arte y es este. Lo que sigue son
las decisiones que aquel tenía y que las diez secciones de arriba no cubren.
Valores, no estilo: la estética la manda todo lo anterior, y en cualquier
conflicto gana lo anterior.

## 11. Teatros

La sección 2 define **una** paleta. El juego tiene dieciséis, todas con la misma
forma de tokens.

**Los dieciséis son una ciudad destruida de verdad.** El campo abierto con
colinas se ha ido: la guerra que cuenta este juego se peleó en calles, y una
ciudad arrasada da lo que el campo no daba — un fondo con silueta (el perfil de
ruinas), obstáculos con forma reconocible y una excusa física para que el suelo
sea cascote y no césped.

Un teatro no es una paleta: es un sitio. Lo que dice dónde estás es de qué está
hecha la ciudad —`FABRICA`: ladrillo, piedra, creta, hormigón, granito, estuco,
arenisca— y qué piezas quedaron en pie. Cada teatro declara sus familias
(`docs/ESCENARIOS.md` §3) y **no usa las de los demás**.

| Teatro | País | Época | Cresta | Cuerpo | Socavón | Fábrica | Hito |
|---|---|---|---|---|---|---|---|
| **Ypres** `?biome=ypres` | Bélgica | 1915 | `#9D9578` | `#7A7358` | `#4F4A38` | ladrillo | Lonja de los Paños |
| **Verdún** `?biome=verdun` | Francia | 1916 | `#DCD6C2` | `#B6AE97` | `#7D766A` | hormigón | Fuerte |
| **Varsovia** `?biome=varsovia39` | Polonia | 1939 | `#C9A877` | `#A2814F` | `#6D5636` | ladrillo | Manzana |
| **Rotterdam** `?biome=rotterdam` | P. Bajos | 1940 | `#9A8F80` | `#776D60` | `#4B453C` | ladrillo oscuro | Manzana |
| **Coventry** `?biome=coventry` | R. Unido | 1940 | `#B9AC93` | `#94886F` | `#615948` | arenisca | Catedral |
| **Stalingrado** `?biome=stalingrado` | URSS | 1942 | `#B9B0A6` | `#8A8078` | `#5D554F` | hormigón | Fábrica |
| **Járkov** `?biome=jarkov` | URSS | 1943 | `#DFE4E4` | `#A8ACA9` | `#6D6F6B` | estuco | Estación |
| **Montecassino** `?biome=cassino` | Italia | 1944 | `#E7E0CB` | `#C0B69C` | `#83795F` | creta | Abadía (bloque + campanario) |
| **Caen** `?biome=caen` | Francia | 1944 | `#DED5BD` | `#B8AD92` | `#7C7360` | piedra | Iglesia |
| **Saint-Lô** `?biome=saintlo` | Francia | 1944 | `#D4CDB9` | `#ABA28C` | `#736B58` | piedra | Manzana |
| **Varsovia, el Levantamiento** `?biome=varsovia44` | Polonia | 1944 | `#B5A58C` | `#8D7F68` | `#5C5342` | ladrillo | Manzana |
| **Arnhem** `?biome=arnhem` | P. Bajos | 1944 | `#C6AC82` | `#9C8459` | `#68583B` | ladrillo | Puente |
| **Aquisgrán** `?biome=aquisgran` | Alemania | 1944 | `#ADABA3` | `#868580` | `#585751` | granito | Catedral |
| **Budapest** `?biome=budapest` | Hungría | 1945 | `#D3BB8E` | `#A89065` | `#6F5F42` | estuco | Manzana |
| **Dresde** `?biome=dresde` | Alemania | 1945 | `#9D9086` | `#75695F` | `#453E38` | quemada | Catedral |
| **Berlín** `?biome=berlin` | Alemania | 1945 | `#B0A493` | `#877C6C` | `#565044` | ladrillo | Manzana |

Todos son de día y todos son claros. La primera versión los pintó de noche y el
juego entero se veía triste; el color de un frente lo pone la fábrica de sus
casas, no la falta de luz. Stalingrado y Dresde son los únicos con el cielo
ardiendo, porque ahí el fuego *es* el sitio.

**La época la manda el teatro**, no el jugador: en Ypres se combate con rombos
tipo Mark IV, en Varsovia del 39 con carros ligeros y coches blindados, y del 42
en adelante con casco de torreta y blindaje inclinado.

**La arcada es un muro con los arcos abiertos en él, no una fila de pilares.** Un
pilar aislado y un poste de telégrafo son la misma silueta en perfil; un arco se
lee por el hueco, no por lo que hay a los lados. Y va siempre **delante** del
cuerpo y más baja, dibujada la última: un muro detrás de un bloque más alto
sencillamente no se ve.

**Los nueve hitos salen del mismo constructor de edificios** —cambia el tejado
(dos aguas, mansarda, plano, roto), el material, el número de plantas y dónde
está roto, nunca la forma de construirlo— más dos casos especiales: la chimenea
de fábrica y la arcada rota. Por eso las dieciséis ciudades parecen del mismo
mundo sin parecerse entre sí.

## 12. El suelo, por estratos

La cara frontal del terreno es **la mitad de la pantalla**. Se pintaba como un
degradado que se hundía hasta casi el negro, y eso era lo que ponía el juego
sombrío por muy alegre que fuera el cielo.

La primera corrección fueron **diez** franjas de color plano con el brillo
alternando. Arreglaba el degradado y creaba un problema peor: con diez bandas
onduladas siguiendo el relieve, la mitad inferior del cuadro se convierte en un
**mapa topográfico** que compite con todo lo que se planta encima. Lo que hacía
falta era color plano con borde duro; lo que no hacía falta era *contar* las
capas.

**Cuatro franjas, y el contraste bajo entre las tres de abajo.** La costra clara
manda —es la que dibuja la línea del suelo— y lo demás es masa.

| Profundidad (u) | Mezcla cuerpo→socavón | Brillo |
|---|---|---|
| 0 – 0.42 (costra) | cresta | 1.00 |
| – 2.6 | 0.18 | 0.98 |
| – 6.5 | 0.44 | 0.93 |
| resto | 0.64 | 0.90 |

Encima, una línea de contorno de `0.1` en el perfil: es lo que separa el suelo
del cielo y de las crestas de fondo, y sin ella el terreno se funde con el
horizonte.

Oclusión de horizonte **0.34** (era 0.62, y ensuciaba de gris toda la ladera).
Hundimiento del fondo **0.14** hasta 26 u (era 0.42 hasta 14, y se comía la
mitad inferior del cuadro).

## 13. Fondo y decorado

**El fondo es un perfil de ruinas, no unas colinas.** Tres capas de manzanas con
el remate roto, cada una más mezclada con el cielo y arrancando más arriba que la
de delante, de forma que la lejana asoma por encima de las otras dos. Es lo que da
profundidad sin paralaje —la cámara es ortográfica— y lo que hace que el sitio se
lea como una ciudad antes de mirar una sola pieza del suelo.

| Capa | Base | Alturas | Ancho de manzana | Mezcla con el cielo |
|---|---|---|---|---|
| Lejana | 3.0 u | 5.5 – 9.5 u | 2.6 – 5.5 u | 0.72 |
| Media | 2.0 u | 4.5 – 8.0 u | 2.2 – 4.6 u | 0.52 |
| Cercana | 1.0 u | 3.5 – 6.5 u | 1.8 – 3.8 u | 0.30 (lleva las ventanas) |

Se mezcla hacia la parada de cielo del horizonte, nunca hacia el cenit (con el
cenit los tejados salen malva). El remate roto es **una sola muesca** por manzana:
con tres dientes de medio metro cada bloque se lee como una montaña y el fondo
deja de parecer una ciudad. Y las ventanas de la capa cercana van **en rejilla
dentro de su edificio**: sembradas al azar sobre la silueta se leen como suciedad.

Las tres arrancan muy por encima de la cota del campo. La versión anterior ponía
la cercana a 5 u con el terreno jugable entre 3 y 5: se entrelazaban, y como el
fondo va más claro que el suelo se leía como la hierba de delante — era la causa
real de que todo lo plantado en el terreno pareciera flotar.

**Decorado:** sacos terreros, alambrada, tocones astillados, bidones y cajas de
munición, repartidos con el `rng` de la semilla; un parapeto de sacos pegado a
cada cañón; y **un hito por teatro** — torre de iglesia rota (Somme), tocón
gigante (Flandes), casa de adobe (Alamein), isba (Frente del Este), chimenea de
fábrica (Stalingrado), casa nevada (Ardenas). Los tonos del decorado se tiñen
hacia el terreno del teatro para que pertenezca al sitio.

Cada pieza acaba en **una sola malla** con color por vértice. Veinte piezas de
cinco cajas serían cien llamadas de dibujo.

## 14. Movimiento

Nada de esto está en las diez secciones de arriba, y es lo que separa un dibujo
de un juego.

Las curvas se llaman igual aquí que en `src/core/easing.js`.

### Disparo

| Momento | Duración | Curva | Qué hace |
|---|---|---|---|
| Retroceso del tubo | 90 ms | `easeOutExpo` | Se hunde 0.35 u (0.26 en la pieza de 1916) |
| Vuelta del tubo | 260 ms | `easeOutBack` | Regresa y **se pasa un 10%** — medido, 0.035 u |
| Fogonazo | 70 ms | `easeOutExpo` | Estrella de seis chorros, opacidad 1 → 0 |
| Humo de boca | 900 ms | `easeOutQuad` | Se expande a 2.2 u y se desvanece |
| Casquillo | 900 ms | balístico | Sale por la culata y rebota en el suelo |
| Estela (trazadora) | 220 ms | `linear` | Vida de cada punto, uno cada 12 ms |

El retroceso es casi instantáneo porque es lo que da peso al disparo: si se ve
viajar, parece un muelle. El fogonazo dura menos de 4 cuadros a 60 fps; más
largo y es una bengala. La estela va lineal a propósito — cualquier easing
acumularía los puntos en un extremo.

### Impacto

| Momento | Duración | Curva | Qué hace |
|---|---|---|---|
| Onda expansiva | 380 ms | `easeOutExpo` | Anillo que crece a 3× el radio del cráter |
| Hundimiento del cráter | 180 ms | `easeOutCubic` | La **malla** baja a la altura que la física ya tiene |
| Escombros | 700 ms | `easeOutQuad` | 12–18 fragmentos con caída propia |
| Sacudida de pantalla | 260 ms | `easeOutExpo` | Amplitud 0.15–0.60 u **según daño**, 22 Hz |
| Barra de vida | 260 ms | `easeOutCubic` | Baja al valor nuevo |
| Fantasma de la barra | 400 ms de retardo | `easeOutCubic` | Enseña cuánto acabas de perder |

Medido: un roce (3 de daño) sacude 0.11 u y un impacto directo (46) sacude
0.26 u. La proporción es lo que hace que la sacudida *cuente* algo.

El hundimiento del cráter **no espera a la física**: la altura autoritativa baja
en el mismo instante del impacto y solo el dibujo se retrasa. Si esperara, dos
móviles con distinta tasa de cuadros verían trayectorias distintas.

### Cámara y turno

| Momento | Duración | Curva |
|---|---|---|
| Barrido al cambiar turno | 700 ms | `easeInOutCubic` |
| Otear al rival (ida) | 420 ms | `easeInOutCubic` |
| Otear al rival (vuelta) | 380 ms | `easeOutCubic` |
| Encuadre de la pluma | 320 ms | `easeOutCubic` |
| Salto de reacción | 280 ms | `easeOutQuad` |
| Caída de la arena | 1400 ms | 12 tandas |
| Ventana de reacción | 900 ms | lineal |
| Victoria | 900 ms | `easeInOutCubic` |

### Reglas generales

- Nada por debajo de **60 ms**: no se ve y solo produce parpadeo.
- Nada por encima de **1400 ms** salvo la pluma, que es una fase de juego.
- Los efectos decorativos usan un PRNG **sembrado**. No es por determinismo de
  simulación —son decorativos— sino para que una repetición se vea idéntica y no
  solo dé el mismo resultado.
- `prefers-reduced-motion` apaga la sacudida de pantalla y deja el resto.

## 15. Presupuesto de cuadro

**16.7 ms.** Medido con ventana real en el equipo de desarrollo, el juego
costaba 50 ms por cuadro (20 imágenes por segundo) con un reparto **plano** — o
sea coste de pintado, no tirones.

Por eso hay calidad adaptativa. Lo único que se toca es cuántos píxeles se
pintan y cómo de cara es la sombra; nunca los efectos, nunca las trampas y nunca
la física, porque una partida en red entre un móvil bueno y uno viejo tiene que
dar el mismo resultado.

| Nivel | Tope de densidad | Sombra | Radio |
|---|---|---|---|
| alta | 2.0 | 2048² | 5 |
| media | 1.5 | 1024² | 4 |
| baja | 1.15 | 1024² | 3 |
| mínima | 1.0 | sin sombras | — |

Baja tras **30 cuadros** por encima de 21 ms (y tres veces más rápido si pasa
del doble); sube tras **300** por debajo de 11 ms, como mucho dos veces. Bajar es
urgente, subir no lo es, y una pantalla que cambia de nitidez cada segundo se
nota más que jugar siempre un poco borroso.

`?calidad=alta|media|baja|minima` lo clava a mano.

