# Trampas

Normativo. Define el aspecto de las tres trampas y —lo más importante— **el
lenguaje visual que las separa del decorado**. Las reglas de juego (qué hace
cada una, el rebote de 0,60, cómo salen de la semilla) están en `README.md` y en
`src/game/`; aquí no se cambian.

---

## 0. El problema que este documento resuelve

Con el decorado nuevo de `ESCENARIOS.md` el campo se llena de objetos: sacos,
alambradas, tocones, vagones, búnkeres. Ninguno para el proyectil. Tres sí lo
paran. Si una mina se parece a un bidón del decorado, el jugador aprende que el
juego le engaña y deja de leer el campo.

Por eso las trampas comparten **tres marcas que ningún decorado puede usar**:

1. **Acento.** Toda trampa lleva el color `acento` (`#d94f2b`) en una pieza
   visible. Ninguna pieza de decorado lo lleva nunca, en ningún teatro.
2. **Contorno más gordo.** 4 px en lugar de 2,5–3,5. Se leen como más
   importantes, y lo son.
3. **No se tiñen del teatro.** El decorado se mezcla 0,35 hacia el terreno
   (`ESCENARIOS.md` §2); las trampas mantienen su color íntegro. En Alamein la
   alambrada es arenosa y la mina no.

Las tres son **objetos de gameplay** y por eso están exentas de la calidad
adaptativa: `ARTE.md` §15 ya lo dice y aquí se subraya. Una trampa que no se
pinta en un móvil viejo es una partida distinta.

---

## 1. Presupuesto

| Trampa | Piezas | Llamadas de dibujo | Cuántas hay |
|---|---|---|---|
| Mina | 6–8 | 1 + shell | hasta 3 con `?trampas=1` |
| Deflector | 8–10 | 1 + shell + 1 (marco animado) | la mitad del total |
| Muro | 7–9 | 1 + shell | 1–2 |

Tope: **6 trampas en el campo con `?trampas=1`**, como hoy. El presupuesto de
dibujo sale del hueco reservado en `ESCENARIOS.md` §1, no del de los vehículos.

---

## 2. Mina

Apoyada en la pista. Detona donde está, no donde apuntabas.

**Silueta:** disco achatado con tapa central, como una lata. Se lee a 0,55× de
zoom porque es la única forma circular baja del campo.

| Pieza | Detalle |
|---|---|
| Cuerpo | Cilindro de 0,9 u de diámetro, 0,35 u de alto, canto biselado |
| Tapa | Disco superior de 0,55 u, más alto 0,1 u, color `metal` |
| Pulsador | Cruz de presión sobre la tapa, en **`acento`**. La marca |
| Aros | 2 aros de refuerzo en el canto, nivel C como calcomanía |
| Asa | Asa de transporte plegada a un lado — la asimetría que la hace objeto |
| Tierra | Reborde de tierra removida alrededor: **dice que está enterrada** |
| Antena | Solo en el 30 %, según `rng`: varilla de 0,45 u con punta de `acento` |

**Estado y aviso.** La mina **no está oculta**: se ve, y eso es a propósito —
esquivarla es la decisión, encontrarla no es el juego. Pero **no destaca**
tampoco: la cruz de `acento` es lo único vivo, y el resto es `metal` bajo.

- **Armada:** el pulsador de `acento` en su color pleno.
- **A punto de detonar** (el proyectil entra en su radio): el pulsador **pasa a
  `claro(acento)` durante 120 ms** y vuelve. Un solo pulso, no un parpadeo
  continuo. La duración cumple el mínimo de 60 ms de `ARTE.md` §14.
- **Detonada:** desaparece. El cráter y la onda son los del impacto normal
  (`ARTE.md` §14), con **radio de labio un 20 % mayor** porque el reventón está
  a nivel de suelo.

**Prohibido:** que la mina se hunda en el terreno hasta esconderse. Se reasienta
con el suelo como el decorado (`ESCENARIOS.md` §2), pero siempre con la tapa
completa visible. Si un alud la tapa, se destruye y desaparece.

---

## 3. Deflector

En el aire, cortando la parábola. Invierte el tiro: vuelve hacia ti, y si te cae
encima te lo comes. Es la trampa que más castiga y la que más tiene que avisar.

**Silueta:** placa inclinada colgada de un mástil, con marco. La única forma
plana y grande a media altura del campo.

| Pieza | Detalle |
|---|---|
| Placa | Panel de 1,8 × 1,2 u, grosor 0,12 u, inclinado 35°, esquinas redondeadas |
| Marco | Bastidor perimetral en **`acento`**, 0,14 u de canto. La marca |
| Refuerzos | Dos diagonales en la cara posterior, `contorno(metal)` |
| Mástil | Poste vertical de 2,2 u hasta el suelo, o **cable al techo** si está alto |
| Tirantes | 2 cables tensores desde el mástil a las esquinas de la placa |
| Base | Trípode apoyado, con sombra de contacto propia |
| Cara de impacto | Cara frontal en `claro(metal)` — **más clara que el resto**, es la que hay que acertar o evitar |
| Rótulo | Franja diagonal de `acento` sobre la placa, nivel C |

**Orientación legible.** La inclinación de la placa **es** la información: dice
hacia dónde volverá el tiro. Se modela con la inclinación real que usa la física,
nunca con una placa vertical de adorno. Si el jugador no puede deducir el rebote
mirando la placa, la trampa es injusta y no difícil.

**No hay deflectores tumbados** (ya está en `README.md`): devolverían el tiro
contra el propio suelo. El modelo solo existe en la inclinación de la ficha.

**Estados:**

- **En reposo:** placa quieta, marco en `acento` pleno.
- **Proyectil dentro de 12 u:** el marco **bascula ±3° en 200 ms** con
  `easeOutQuad` y se queda. Un aviso, no una animación en bucle.
- **Rebote:** destello de 70 ms en la cara de impacto (`easeOutExpo`, la misma
  curva del fogonazo de `ARTE.md` §14), la placa **retrocede 0,18 u y vuelve en
  260 ms** con `easeOutBack`, igual que el retroceso del tubo. Reutilizar esas
  dos curvas es lo que hace que el rebote se sienta parte del mismo juego.
- El deflector **no se destruye**. Aguanta toda la partida: es relieve táctico,
  y si desapareciera al primer rebote no habría nada que planificar.

---

## 4. Muro

Apoyado en la pista, cerrando el tiro raso. Se traga el proyectil: no duele, pero
pierdes el turno.

**Silueta:** bloque vertical alto y estrecho, más alto que ancho. Es la única
forma vertical maciza del campo — el búnker es baja y ancha, y por eso no se
confunden.

| Pieza | Detalle |
|---|---|
| Cuerpo | Bloque de 1,0 × 2,6 u, canto de 0,1 u biselado |
| Sillares | 3–4 bandas horizontales con junta marcada, no lisas |
| Coronación | Remate más ancho que el cuerpo, con **borde astillado** de 3 dientes |
| Puntal | 2 vigas en diagonal apoyadas al pie, un lado solo (asimetría) |
| Grapa | Fleje metálico en **`acento`** rodeando el cuerpo a media altura. La marca |
| Desconchón | Un hueco con hierro a la vista, como el búnker |
| Base | Escombro al pie, obligatorio |

**Diferenciación del decorado, que es su riesgo:** un muro de trampa y un muro de
ruina (`ESCENARIOS.md` §3.3) son la misma forma. Tres diferencias no negociables:

1. La grapa de `acento`. La ruina nunca la lleva.
2. El contorno de 4 px frente a 2,5.
3. El muro-trampa **está solo y de pie recto**; la ruina va acompañada de otros
   muros y **girada**. Una ruina aislada y vertical está prohibida en cualquier
   escena que tenga trampas activas.

**Estados:**

- **Intacto:** el descrito.
- **Absorbe un tiro:** sacudida de 260 ms con `easeOutExpo` y amplitud 0,10 u
  (la del roce, `ARTE.md` §14), polvo de 900 ms desde el pie con `easeOutQuad`, y
  **un desconchón nuevo permanente** — un hueco de `contorno` en el punto de
  impacto. Al tercero, el muro **se derrumba en 700 ms** (`easeOutQuad`,
  escombros) y deja de existir.
- Que el desconchón sea permanente es lo que convierte al muro en un recurso
  gastable: se puede abrir a cañonazos, y el jugador lo ve venir.

---

## 5. Colocación

Manda `README.md`: seis con `?trampas=1`, la mitad deflectores, salidas de la
semilla, unas en el aire cortando parábolas y otras apoyadas cerrando el tiro
raso. Lo que este documento añade:

- **Ninguna trampa a menos de 6 u de un cañón.** Una mina pegada a tu tanque no
  es una decisión, es un impuesto.
- **Ninguna trampa oculta detrás de un hito o un vagón.** Antes de aceptar una
  colocación, se comprueba que la trampa es visible desde el plano de otear
  (`ARTE.md` §14, 420 ms de ida). Si no lo es, se desplaza — no se borra, porque
  eso cambiaría el número de trampas de la semilla.
- **Ninguna mina bajo un deflector.** Saltar para esquivar y caer en una mina es
  bueno (`README.md`); que la caída forzada por un rebote acabe siempre en mina
  es una cadena que el jugador no puede leer.
- Las trampas se dibujan **siempre por delante** del decorado y por detrás del
  vehículo activo.

---

## 6. Prohibido

- Que una trampa se parezca a una pieza de decorado sin sus tres marcas.
- Usar `acento` en cualquier pieza de decorado o de vehículo. El naranja del
  juego significa «esto te afecta», y basta un bidón naranja para romper eso.
- Parpadeos en bucle, halos, glows o pulsos continuos. Un aviso es un pulso
  único y corto.
- Trampas afectadas por la calidad adaptativa.
- Trampas invisibles, semienterradas o camufladas. La dificultad está en la
  balística, no en la vista.
- Curvas de animación nuevas. Las de `ARTE.md` §14 cubren todo lo de arriba y
  reutilizarlas es lo que hace que las trampas se sientan del mismo juego.
- Calaveras, señales de peligro con figura, cualquier iconografía humana.
