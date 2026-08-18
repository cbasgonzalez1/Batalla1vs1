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
