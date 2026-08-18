# Decisiones de arte, y qué se derogó para llegar a ellas

Este documento es el **registro de lo que se probó y no funcionó**. Existe porque
la mitad de los defectos del arte de este juego venían de reglas escritas en los
otros documentos, no de errores de ejecución: una guía que dice «3 a 6 formas por
objeto» produce cajas con un tubo por mucho cuidado que se ponga al modelarlas.

Sin este registro, alguien lee la regla vieja en un `git log`, la reintroduce «para
arreglar» algo y vuelve el mismo defecto seis meses después.

Regla del documento: **cada fila dice qué decía, qué dice ahora y por qué cambió.**
Si el «por qué» no cabe en una línea, va debajo con su nota.

---

## 1. Vehículos

| Dónde | Decía | Dice | Por qué |
|---|---|---|---|
| `ARTE.md` §5 | 3 a 6 formas por objeto; fuera detalle bajo 6 px | Derogada; remite a `ARTE-VEHICULOS.md` §1 | Era la causa **directa** de las cajas con tubo, no un fallo de ejecución |
| `ARTE.md` §8 | El vehículo como *sprite*: 2 bandas, mínimo 8 px | Derogada; el vehículo es malla, no imagen | El mínimo se mide en unidades de mundo a partir del encuadre |
| `ARTE.md` §1 y §2 | contorno = base oscurecida 55 % | **65 %** | Medido: `#7D8B4E` → `#2B3419` es −0,645. El 55 % daba un contorno verdoso que no cerraba la silueta |
| `ARTE-VEHICULOS.md` §6 | bandos `#8FA33C` y `#7E9BB8` | `#7D8B4E` y `#5C7D92` | Chocaban con el ejemplar aprobado de su propia §12 |
| `ARTE-VEHICULOS.md` §12.5 | fuera remaches y manchas de camuflaje | Fuera solo lo que tenga **contorno propio** | La imagen de referencia lleva las dos cosas |
| `ARTE.md` §9 · `ARTE-VEHICULOS.md` §8 | la **boca** a la misma Y en toda elevación | el **pivote** de elevación a la misma Y | Un tubo que gira describe un arco: lo otro es geométricamente imposible y obligaba a enterrar la cuna del mortero bajo la oruga |
| `CATALOGO` §1 | rodadura de 1,3 u en la MEDIA | 0,13 L de diámetro | 1,3 u sobre 5,6 u son 0,23 L: cinco ruedas así se solapan |
| — | nada sobre orientación | **el vehículo mira a la derecha** | Con el morro a la izquierda y el tubo a la derecha se lee marcha atrás aunque cada pieza esté bien |

**La prueba en negro hace su trabajo.** ROMBO y TRINCHERAS estaban aprobados por
separado y eran la misma silueta en la fila de comparación. TRINCHERAS pasó a
llevar cabina de mando alta y rodillo antizanja: la checklist manda cambiar casco
o rodaje, **nunca color ni calcomanía**.

---

## 2. Escenarios

| Dónde | Decía | Dice | Por qué |
|---|---|---|---|
| `ARTE.md` §11 | seis teatros de campo con el mismo decorado | dieciséis ciudades destruidas, cada una con sus familias | Un teatro no es una paleta; con el mismo decorado eran uno repintado |
| `ARTE.md` §12 | diez franjas de suelo con el brillo alternando | **cuatro**, y contraste bajo entre las de abajo | Diez bandas onduladas convierten media pantalla en un mapa topográfico |
| `ARTE.md` §13 | fondo de tres crestas de colina a 5 / 9 / 13 u | tres capas de manzanas rotas a 6,6 / 9,2 / 12,4 u | Una ciudad no tiene colinas detrás: tiene más ciudad. Y a 5 u el fondo se entrelazaba con el campo |
| `ESCENARIOS.md` §2 | «toda pieza se asienta en el terreno» | + nada se solapa, nada flota, de mayor a menor | La regla estaba escrita pero no había nada que la hiciera cumplir |
| `README.md` | `?biome=dunas\|placa\|salar…` | los teatros de `ARTE.md` §11 | Eran los biomas de la versión lunar anterior |
| `README.md` | «Sin el motion spec todavía» | `ARTE.md` §14 lo especifica y está implementado | La nota era falsa desde que se escribió §14 |

### La causa real de las «casas flotando»

Se buscó tres veces en el sitio equivocado. Las piezas **sí** seguían el terreno;
lo que engañaba era que las crestas de fondo arrancaban a 5,2 u con el terreno
jugable entre 3 y 5 —entrelazados— y, al ir más claras que el suelo, se leían como
la hierba de delante. Todo lo plantado parecía hundido en una loma que estaba
detrás.

No se encontró mirando la escena. Se encontró **superponiendo el perfil del
terreno en magenta**, que sigue en el código como `globalThis.__DEPURA_SUELO`. Una
línea, y cualquier defecto de apoyo se ve al momento en vez de discutirse.

### Piezas que no se entendían

| Pieza | El defecto | La corrección |
|---|---|---|
| Parapeto de sacos | Cada saco a la cota de su x → una sarta de cuentas en diagonal | Muro apilado, remate a nivel, hiladas trabadas media pieza. Donde el suelo baja se ponen **más hiladas**, no se baja el muro |
| Escombro | Un polígono de tres vértices | Piedras sueltas, cada una con su contorno, amontonadas y tocándose, sobre un vertido que las ata al suelo |
| Fachadas | La puerta a la altura del terreno *en su x* | Rejilla rígida desde una sola cota. Lo que varía con el terreno es **cuánto tapa el suelo**, no dónde están los huecos |
| Arcada | Seis pilares sueltos con un dintel encima | Un muro con los arcos recortados, dibujado **el último** y por delante del cuerpo |
| Erizo checo | Las vigas se cruzaban a media altura → un asterisco flotando | Las dos inclinadas apoyan sus cuatro extremos en el suelo |
| Postes | Falda que abarcaba toda la inclinación → un contrafuerte al pie | Arrancan hundidos en **su** x |

---

## 2 bis. Modelar la MEDIA en Three

Cinco cosas que se dieron por sabidas y no lo eran. Todas salieron de ver el
vehículo en pantalla, ninguna de leer el código.

| Se creía | Es | Por qué importa |
|---|---|---|
| El color por vértice basta para las bandas | **Interpola** entre anillos de la extrusión | Pintando el casco por altura sale un **degradado**, que `ARTE.md` §1.6 prohíbe. La banda oscura de barcaza va **modelada** como faldón |
| `Color.setHex()` da un color de trabajo listo | Ya convierte de sRGB | Llamando además a `convertSRGBToLinear()` se convierte **dos veces** y el vehículo entero sale apagado y sucio |
| La cinta puede ser un aro y las ruedas verse por el hueco | El hueco mide siempre menos que la rueda | La cinta es una cápsula **maciza** y las ruedas van un poco más cerca de la cámara, encima de ella — como en la plancha |
| El grosor del contorno se mide en píxeles del lienzo | En píxeles **CSS** | En una pantalla 2× salía la mitad de gordo, y el trazo está escrito en px de diseño |
| Escalar el grupo del arma es inofensivo | Dentro cuelga el ancla `boca` | Escalando el grupo, la boca se escala otra vez y el proyectil sale de un sitio que no es. Se escala la **geometría** |

**El presupuesto de dibujo pasa de 8 a 9 llamadas** para un vehículo con torreta.
`ARTE-VEHICULOS.md` §7 fundía tubo y torreta en un bloque «porque giran juntos»,
pero el tubo **retrocede solo** (`ARTE.md` §14) y no puede compartir geometría con
lo que no se mueve. Nueve por vehículo son 54 en un 3v3: sigue sin ser el
problema.

**La escala.** Las planchas tienen la MEDIA a 5,6 u de largo con el pivote a
2,32; el juego tiene el pivote a 1,45 desde que existe. `ESCALA = 1,45 / 2,32`
mete las proporciones aprobadas sin mover el pivote, y por tanto sin tocar el
encuadre ni el arco de apuntado. Si algún día hay que agrandar el parque móvil,
es ese número y ninguno más.

---

## 2 ter. Llevar las ciudades al juego

| Se creía | Es | Por qué importa |
|---|---|---|
| El suelo tenía «franjas de color plano con el borde duro» | Eran un **degradado** | Las 18 filas de la cara frontal llevan color por vértice, y el color por vértice interpola. Las filas van ahora clavadas en los bordes de banda y **dobladas** |
| Cuatro bandas bastan | Seis | La plancha encuadra 9 u de tierra y el juego enseña 45 al abrir plano |
| La cara frontal se ilumina como todo lo demás | **No se ilumina** | Su normal apunta a la cámara y la key entra desde arriba-izquierda a 48°: el producto escalar es casi cero. Con paletas claras colaba; con las de una ciudad, media pantalla se iba a un barro casi negro — medido, el cuerpo `#877C6C` de Berlín salía por pantalla a `#362A0E`. Sin luz, lo que se ve **es** la paleta por su banda, que es lo que especifica la plancha |
| El grano daba materia | Daba plástico | Multiplicaba el color de vértice con una textura de 6 u de lado; sobre banda plana se veían vetas verticales |
| El fondo eran crestas de colina | Tres capas de **manzanas** | Una ciudad arrasada no tiene colinas detrás: tiene más ciudad. El color sale de la `fabrica` del teatro —ladrillo, piedra, arenisca— y no del suelo, y es lo que hace que Varsovia y Caen no se parezcan aunque el cascote de delante sea igual |
| Hacían falta ruinas sueltas detrás del horizonte | Sobran | Las tres capas **ya son** la ruina; superpuestas se veían como una mancha oscura compitiendo con el perfil |

---

## 2 quater. El campo, el suelo y el castigo

| Se creía | Es | Por qué importa |
|---|---|---|
| El decorado del juego era el de las ciudades | Era el de los **seis teatros de campo abierto** | `art/atrezo.js` repartía sacos, alambrada, tocones y bidones con un repertorio indexado por `biome.id`. Al pasar a las dieciséis ciudades ninguna id casaba, así que **las dieciséis caían en el repertorio del Somme**: el mismo campo con la misma torre, dieciséis veces. Las catorce familias urbanas sólo existían en la plancha |
| Los estratos con el borde duro daban un corte de terreno | Daban una **tarta de capas** | Las seis bandas calcaban el perfil, así que la mitad inferior del cuadro eran seis líneas paralelas ondulando a la vez — una forma que no existe en ningún sitio. Las hondas cuelgan ahora del **lecho**, la media móvil de ±12 u del perfil generado, que **no se actualiza nunca** |
| «Se ve cuánto ha excavado un cráter porque se ve cuántas capas ha atravesado» (`ARTE.md` §12, desde el principio) | Era **falso** | Con las bandas midiendo profundidad bajo la superficie *local*, la costra bajaba con el hoyo y el cráter salía del mismo color que el borde. Con el lecho quieto, un cráter **corta** los estratos y la frase pasa a ser verdad |
| La superficie superior se ilumina con su normal | Con la normal **enderezada al 60 %** | Una ladera que cae a la derecha apunta al lado contrario de la key y la franja se iba a negro: en pantalla salía una raya oscura pegada al perfil que se leía como un agujero |
| El decorado va detrás, a z = −1,3 | A **z = −0,6** | A 15° de cámara cada unidad de z baja el objeto 0,26 u en pantalla: a −1,3 la cara frontal del terreno tapaba un tercio de unidad de cada pieza y todas se veían medio enterradas por mucho que su base siguiera el perfil |
| El decorado proyecta sombra de contacto | **No proyecta** | La superficie superior del terreno son 4,2 u de profundidad vistas a 15°, así que la sombra de cualquier pieza la cubre entera: salía una franja negra pegada al perfil que se leía como un agujero. La pieza ya se ancla por donde se ancla de verdad — su base **es** el perfil |
| El labio de la zanja son 0,95 u derramados en 0,9 | Derramados hasta **10,5 u** | Pendiente 1,05 contra los 0,9 que sube una oruga: el blindado podía moverse dentro del foso y no salir jamás. Eso no es «caro», es una jaula |
| El montón central se define por su altura | Por lo que **corona** sobre el emplazamiento más alto | Sumar 5 u al relieve que salga del ruido dejaba el montón por debajo de los dos cañones la mitad de las veces: entonces no es un montón central, es una loma |
| El daño se ve en la barra de vida | Se ve **en el blindado** | Un vehículo con 4 de vida se veía igual que uno nuevo. Tizne por vértice, cinco cicatrices y humo del motor — y las cicatrices **dentro de la geometría del casco**, porque en malla aparte suben el vehículo de nueve llamadas de dibujo a diez |
| El teatro por defecto era `alamein` | Es **`berlin`** | Al cambiar los seis teatros de campo por las dieciséis ciudades, ni el valor por defecto ni el respaldo se movieron: `BIOMES['alamein'] ?? BIOMES.alamein` daba `undefined`, y abrir el juego **sin `?biome=`** reventaba en `projectileAccent(undefined)` antes de exponer los ganchos. Lo cazó `pnpm verificar:determinismo`, no una captura: todas las capturas pasaban un `?biome=` |
| El cráter del combate solo hunde | Hunde **y levanta el labio** | Sin anillo levantado un cráter es una hondonada natural. La masa sale de lo excavado y se descuenta del volumen que vuela a sotavento, así que la conservación sigue cuadrando a 1e-12 |
| El blindado se apoya horizontal en el terreno | **Se gira con la pendiente** | Horizontal sobre una cuesta apoya una oruga y deja la otra en el aire. Gira el rig entero y no solo el casco: con la torreta a nivel, el anillo se despega a dos grados de cuesta |
| La barra de vida de B se pintaba | Medía **dos píxeles** | El lado B alineaba sus tarjetas con `align-items:flex-end`, y eso encoge los hijos a su contenido: la barra está vacía —relleno y fantasma van absolutos dentro— así que se quedaba en el ancho del borde. El nombre y las cargas ya se alineaban solos con `justify-content` |

---

## 3. Mecánica

| Decía | Dice | Por qué |
|---|---|---|
| Tres propuestas de pieza: blindado, cañón de campaña y mortero de sitio | **Nueve trampas y modificadores** (`TRAMPAS.md`) | Lo que le falta a un duelo de artillería por turnos no es otra silueta de cañón: es que el turno tenga una decisión más allá de ángulo y potencia |

Dos de los nueve —**placa de blindaje** y **nido de munición**— se recogen
avanzando. Es lo que engancha el sistema de modificadores con `src/game/avance.js`,
que hoy solo sirve para colocarse.

---

## 4. Cómo se usa este documento

- Antes de reintroducir una regla que veas en un commit antiguo, búscala aquí.
- Al derogar algo nuevo, **añade la fila**: qué decía, qué dice, por qué.
- Si una corrección salió de una medición —un hex muestreado, un fotograma, un
  contador— escribe el número. «Se veía mejor» no es un motivo reutilizable.
