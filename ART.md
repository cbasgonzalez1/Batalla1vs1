# ART.md — dirección de arte

Fuente de verdad de todo valor de color, luz, material y tiempo. Si un número
de arte no está aquí, no debería estar en el código.

---

## 0. El encargo

Un duelo de artillería de la Primera y la Segunda Guerra Mundial, contado con
la simpleza de los dos juegos de referencia: **Angry Birds 2** y **Mario Kart
Tour**. Ni uno ni otro tienen una sola zona apagada. Las dos ideas que gobiernan
todo lo demás:

1. **La sombra es más fría, no más oscura.** Bajar el valor para dar volumen
   deja el juego sombrío. Girar el tono hacia el cielo lo mantiene alegre.
2. **Silueta antes que detalle.** A 4 cm de alto en un móvil llega la forma, no
   los remaches. Todo el modelado se decide mirando el contorno.

Realismo hasta donde ayuda —las paletas salen de frentes reales y cada teatro
trae su época—; se para donde estorba: si los dos bandos fueran fieles de verdad
serían dos manchas verde-gris indistinguibles en pantalla.

---

## 1. Luz

| | Valor |
|---|---|
| Key, color | `#FFE9BD` (cálida, 5200 K) |
| Key, intensidad | 2.40 |
| Key, azimut | −45° (desde la izquierda) |
| Key, elevación | 48° |
| Relleno, color | `#86A8CC` (frío) |
| Relleno, intensidad | 0.50 |
| Rebote, cielo | `#A8C8E6` |
| Rebote, suelo | el del teatro activo |
| Rebote, intensidad | 0.85 |
| Exposición del tonemapper | 1.06 |
| Sombra, radio | 5 (baja a 4 y a 3 con la calidad) |

El relleno y el rebote son **más del doble** de lo que tenía el primer montaje
(0.34 y 0.42). Con aquello, todo lo que no daba la key caía a un gris sucio.

La sombra viaja con la cámara y solo cubre lo visible: con un mapa fijo para
todo el mundo saldrían 6 cm por texel y el contacto se perdería.

## 2. Materiales

**`metalness` es 0 en todo.** El metal se lee por rugosidad, no por reflejo —
que además es lo que hace un blindado pintado con mate antirreflejo.

| Código | Uso | Color | Roughness |
|---|---|---|---|
| M01 | Casco bando A, caqui aliado | `#838B3A` | 0.66 |
| M02 | Casco bando B, gris de campaña | `#47616F` | 0.66 |
| M03 | Óptica (periscopio) | `#54718C` | 0.16 |
| M04 | Acero pintado (tubo, herrajes) | `#8E8A7C` | 0.34 |
| M05 | Oruga | `#2E3238` | 0.90 |
| M06 | Lona, sacos, cajas | `#B0A173` | 0.94 |
| M07 | Hormigón (casamata, dientes de dragón) | `#9D9A90` | 0.92 |

**No hay banda de reconocimiento.** Hubo una, saturada, cruzando el casco de
cada bando, y se quitó: a la escala de juego se leía como una pegatina puesta
encima, no como pintura. La identidad de bando la lleva **solo el color del
casco**, y por eso M01 y M02 están apartados en tono *y* en valor — caqui cálido
y claro contra gris azulado frío y oscuro. Los dos siguen siendo colores de
campaña reales; lo que se hizo fue coger los dos extremos del rango en vez de
dos vecinos.

Comprobado con los dos vehículos en el mismo encuadre en los seis teatros,
incluido Stalingrado, que es el peor caso porque su propio terreno ya es gris.

Terreno: roughness **0.94**, extrusión **4.2 u**, bisel **0.30 u**.

## 3. Acentos

| | Hex | Qué es |
|---|---|---|
| Trazadora | `#FF7A1A` | trazadora ámbar (aliada) |
| Fósforo | `#4FD8FF` | trazadora blanco-azul (alemana) |
| Anillo del proyectil | `#0A0D14` | |

**Regla cruzada:** el teatro cálido dispara la trazadora fría y al revés. El
acento que sobra se queda en el HUD.

**El anillo oscuro del proyectil es obligatorio.** Separa por *valor*, así que
el proyectil se sigue leyendo aunque el tono falle contra el fondo.

## 4. Teatros

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

## 5. El suelo, por estratos

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

## 6. Fondo y decorado

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

## 7. Motion spec

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

## 8. Presupuesto de cuadro

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
