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
   base del objeto oscurecido un 55%, nunca `#000` ni un gris neutro.
   Los objetos del fondo lejano **no llevan contorno**.
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
```

Los tonos derivados se calculan, no se escriben a mano. Una sola función:

```js
// f > 0 aclara, f < 0 oscurece. Trabajar en HSL, no en RGB.
export function tono(base, f) { /* ... */ }

export const claro    = c => tono(c,  0.18);
export const oscuro   = c => tono(c, -0.22);
export const contorno = c => tono(c, -0.55);
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

---

## 5. Silueta antes que detalle

La prueba de silueta: rellena la forma entera de negro. Si no se reconoce qué es, la
forma está mal y no se arregla con detalle interno.

- Exagera proporciones: ruedas grandes, estructuras panzudas, cañones de tubo largo.
- Cada objeto se lee con **3–6 formas**, no con veinte.
- Fuera detalles por debajo de 6px: no se ven y ensucian.
- Nada de planos técnicos ni vistas de manual. Es una caricatura del objeto.

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

## 8. Sprites de unidad

Los sprites de vehículo son el activo más reutilizado del juego: aparecen en la fila
de comparación, en las fichas y en partida. La consistencia entre ellos importa más
que la calidad de cualquiera por separado.

A tamaño de sprite las reglas se ajustan así:

| Regla | En escena | En sprite |
|---|---|---|
| Contorno | 2.5px | 2px, y nunca menos del 4% del alto del sprite |
| Tonos | 3 bandas | 2 bandas (base + oscura). La banda clara solo si el sprite supera los 120px de ancho |
| Detalle mínimo | 6px | 8px. Lo que no llegue, se elimina; no se reduce |
| Sombra de contacto | Elipse | Elipse achatada, `ry` máximo 4px |

Reglas adicionales, obligatorias:

- **Un solo módulo de sprites.** Todos los vehículos salen del mismo fichero y
  comparten primitivas de casco, torreta, tubo, oruga y rueda. Prohibido que un
  vehículo defina sus propias formas base.
- **Coherencia de familia.** Dos vehículos cualesquiera puestos uno al lado del otro
  deben parecer del mismo juego: mismo grosor de contorno relativo, mismo criterio de
  sombreado, mismo nivel de detalle. Esta es la prueba real, no mirarlos por separado.
- **La silueta distingue.** Lo que diferencia a un vehículo de otro es la forma
  exterior (altura del casco, longitud del tubo, perfil de la oruga), no el detalle
  interno ni el color.
- **El sprite no lleva su propio fondo.** El color de fondo lo pone el contenedor.
  El sprite es transparente y debe leerse sobre cualquier fondo de la paleta.

---

## 9. Invariantes de gameplay

**Estos valores no se tocan al cambiar arte. Nunca. Bajo ningún concepto.**

Son restricciones de simulación disfrazadas de decisiones de dibujo. Modificarlos
rompe la sincronización entre clientes y produce un bug que no se manifiesta como
error visual, sino como partidas que divergen sin explicación.

- **Altura de la boca del arma.** Todos los vehículos tienen la boca del arma en la
  misma coordenada Y exacta. De ahí sale la velocidad inicial del proyectil. Un
  cambio de un solo píxel en la altura del casco, la torreta o el tubo desincroniza
  la partida.
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

La sección 2 define **una** paleta. El juego tiene seis, todas con la misma
forma de tokens. La de la sección 2 es exactamente la de El Alamein.

Cielo de cuatro paradas, de arriba abajo. Tres tonos de terreno más el rebote.

| Teatro | Época | Cresta | Cuerpo | Socavón | Proyectil |
|---|---|---|---|---|---|
| **El Somme** `?biome=somme` | 1916 | `#F3EFE0` | `#CFC6AC` | `#9C9078` | trazadora |
| **Flandes** `?biome=flandes` | 1917 | `#C2CE72` | `#8C9B47` | `#5F6B34` | fósforo |
| **El Alamein** `?biome=alamein` | 1942 | `#FBE1A0` | `#E8A94E` | `#B87438` | fósforo |
| **Frente del Este** `?biome=rzhev` | 1942 | `#FBFDFF` | `#C6DCEE` | `#8AA8C4` | trazadora |
| **Stalingrado** `?biome=stalingrado` | 1942 | `#B9B0A6` | `#8A8078` | `#5D554F` | fósforo |
| **Las Ardenas** `?biome=ardenas` | 1944 | `#E4EEF4` | `#A8BCCB` | `#6E8496` | trazadora |

Todos son de día y todos son claros. La primera versión los pintó de noche o al
atardecer y el juego entero se veía triste; el color de un frente lo pone la
tierra, no la falta de luz. Stalingrado es el único que conserva un cielo
ardiendo, porque ahí el fuego *es* el sitio.

**La época la manda el teatro**, no el jugador: en el Somme y en Flandes se
combate con rombos tipo Mark IV, en el resto con casco de torreta y blindaje
inclinado.

## 12. El suelo, por estratos

La cara frontal del terreno es **la mitad de la pantalla**. Se pintaba como un
degradado que se hundía hasta casi el negro, y eso era lo que ponía el juego
sombrío por muy alegre que fuera el cielo.

Ahora son franjas de color plano con el borde marcado, como el suelo de un
juego de plataformas. El brillo **alterna** de una franja a la siguiente: con un
degradado monótono el subsuelo vuelve a ser una mancha por muchos estratos que
tenga; alternando, cada línea entre franjas se ve.

| Profundidad (u) | Mezcla cuerpo→socavón | Brillo |
|---|---|---|
| 0 – 0.55 (costra) | cresta | 1.16 |
| – 1.7 | 0.10 | 1.04 |
| – 3.2 | 0.28 | 0.93 |
| – 5.4 | 0.20 | 1.09 |
| – 8.4 | 0.52 | 0.90 |
| – 12.5 | 0.36 | 1.06 |
| – 18.0 | 0.70 | 0.88 |
| – 26.0 | 0.50 | 1.04 |
| – 40.0 | 0.86 | 0.87 |
| resto | 0.66 | 1.00 |

Las franjas van apretadas hasta 18 u porque **eso es lo que se ve jugando**: con
el encuadre de apuntado hay unos 17 m de tierra entre la cresta y el borde
inferior. Lo de más abajo solo asoma al abrir plano.

Oclusión de horizonte **0.34** (era 0.62, y ensuciaba de gris toda la ladera).
Hundimiento del fondo **0.14** hasta 26 u (era 0.42 hasta 14, y se comía la
mitad inferior del cuadro).

## 13. Fondo y decorado

**Crestas de fondo:** tres capas con perspectiva aérea, mezcladas hacia la
parada de cielo del horizonte (la 3 y la 2, nunca el cenit — mezclando con el
cenit el horizonte del desierto salía malva). Se arrastran con una fracción del
centro de cámara (0.86 / 0.68 / 0.44): con cámara ortográfica la profundidad no
da paralaje sola.

| Capa | Base | Altura | Mezcla con el cielo |
|---|---|---|---|
| Lejana | 13 u | 11 u | 0.74 |
| Media | 9 u | 8 u | 0.50 (lleva los postes) |
| Cercana | 5 u | 6 u | 0.28 |

Están atadas al relieve del campo (cresta entre 5 y 15 u): una cresta de fondo a
30 u no se lee como lejanía, se lee como un muro gris.

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

