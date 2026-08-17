# ART.md — dirección de arte

Fuente de verdad de todo valor de color, luz, material y tiempo. Si un número
de arte no está aquí, no debería estar en el código.

Las secciones 1 a 4 **recogen lo que ya estaba decidido** en
`src/art/direction.js` desde el principio del proyecto. La 5, el motion spec,
es lo que faltaba.

---

## 1. Luz

| | Valor |
|---|---|
| Key, color | `#FFE3A8` (cálida, 5200 K) |
| Key, intensidad | 2.35 |
| Key, azimut | −45° (desde la izquierda) |
| Key, elevación | 48° |
| Relleno, color | `#6E8FB8` (frío) |
| Relleno, intensidad | 0.34 |
| Rebote, cielo | `#8FB4D8` |
| Rebote, suelo | el del bioma activo |
| Rebote, intensidad | 0.42 |
| Sombra, radio | 5 |
| Sombra, opacidad de referencia | 0.30 |

La sombra viaja con la cámara y solo cubre lo visible: con un mapa fijo para
todo el mundo saldrían 6 cm por texel y el contacto se perdería.

## 2. Materiales

**`metalness` es 0 en todo.** El metal se lee por rugosidad, no por reflejo.

| Código | Uso | Color | Roughness |
|---|---|---|---|
| M01 | Chasis bando A | `#F2622F` | 0.62 |
| M02 | Chasis bando B | `#17B6E0` | 0.62 |
| M03 | Plástico brillo | `#54718C` | 0.16 |
| M04 | Metal pintado | `#8E8A7C` | 0.34 |
| M05 | Goma mate | `#343A42` | 0.90 |

Terreno: roughness **0.94**, extrusión **4.2 u**, bisel **0.30 u**
(equivale a 10–12 px a 1080 de ancho).

## 3. Acentos

| | Hex |
|---|---|
| Magma | `#FF6B2C` |
| Plasma | `#16E0FF` |
| Anillo del proyectil | `#0A0D14` |

**Regla cruzada:** el bioma cálido dispara plasma; los fríos y los verdes
disparan magma. El acento que sobra se queda en el HUD.

**El anillo oscuro del proyectil es obligatorio.** Separa por *valor*, así que
el proyectil sigue leyéndose aunque el tono falle contra el fondo.

## 4. Biomas

Cielo de cuatro paradas, de arriba abajo. Tres tonos de terreno más el rebote.

| Bioma | Cresta | Cuerpo | Socavón | Proyectil |
|---|---|---|---|---|
| **Dunas de Kerch** `?biome=dunas` | `#F2C97D` | `#D9974A` | `#8A5326` | plasma |
| **Placa Vostok** `?biome=placa` | `#DCEEF7` | `#9FC6DE` | `#4E7793` | magma |
| **Salar de Aral** `?biome=salar` | `#EEF2F3` | `#C3CED6` | `#7D8B98` | magma |
| **Caldera Ígnea** `?biome=caldera` | `#6B6A72` | `#40404A` | `#22222A` | plasma |
| **Mar de la Tranquilidad** `?biome=tranquilidad` | `#9AA3AD` | `#69727E` | `#39404A` | magma |
| **Selva de Ceniza** `?biome=selva` | `#7FB04A` | `#4E7A34` | `#2E4327` | magma |

Los tres nuevos cubren los huecos que quedaban en el rango de valor:

- **Salar de Aral** es el más claro que hay. Por eso dispara magma: el plasma se
  perdería sobre tanto valor alto.
- **Caldera Ígnea** es el más oscuro, con rescoldo en el horizonte. Dispara
  plasma para que el proyectil no se confunda con esa brasa.
- **Mar de la Tranquilidad** no tiene atmósfera: su cielo no aclara por abajo,
  se queda negro. Es el único bioma donde la silueta del terreno se lee contra
  la nada.

## 5. Motion spec

Las curvas se llaman igual aquí que en `src/core/easing.js`, para que un cambio
de diseño se trace hasta el código sin traducir nada.

### Disparo

| Momento | Duración | Curva | Qué hace |
|---|---|---|---|
| Retroceso del cañón | 90 ms | `easeOutExpo` | El tubo se hunde 0,35 u |
| Vuelta del cañón | 260 ms | `easeOutBack` | Regresa y se pasa un pelo |
| Fogonazo | 70 ms | `easeOutExpo` | Destello en la boca, opacidad 1 → 0 |
| Humo de boca | 900 ms | `easeOutQuad` | Se expande a 2,2 u y se desvanece |
| Estela | 220 ms | `linear` | Vida de cada punto |

El retroceso es casi instantáneo porque es lo que da peso al disparo: si se ve
viajar, parece un muelle. El fogonazo dura menos de 4 cuadros a 60 fps; más
largo y es una bengala. La estela va lineal a propósito — cualquier easing
acumularía los puntos en un extremo.

### Impacto

| Momento | Duración | Curva | Qué hace |
|---|---|---|---|
| Onda expansiva | 380 ms | `easeOutExpo` | Anillo que crece a 3× el radio del cráter |
| Hundimiento del cráter | 180 ms | `easeOutCubic` | El terreno baja hasta su nueva altura |
| Escombros | 700 ms | `easeOutQuad` | 12–18 fragmentos con caída propia |
| Sacudida de pantalla | 260 ms | `easeOutExpo` | Amplitud 0,15–0,60 u **según daño** |
| Barra de vida | 260 ms | `easeOutCubic` | Baja al valor nuevo |
| Fantasma de la barra | 400 ms de retardo | `easeOutCubic` | Enseña cuánto acabas de perder |

La onda concentra casi todo el crecimiento en el primer tercio: así se lee como
presión y no como una burbuja. La sacudida es proporcional al daño, no fija,
para que un roce y un impacto directo no se sientan igual. Los escombros
terminan antes de que empiece a caer la arena, para no competir con la pluma.

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
- Los efectos decorativos usan un PRNG **sembrado**, no `Math.random()`. No es
  por determinismo de simulación —son decorativos— sino para que un replay se
  vea idéntico y no solo dé el mismo resultado.
- `prefers-reduced-motion` apaga la sacudida de pantalla y deja el resto.
