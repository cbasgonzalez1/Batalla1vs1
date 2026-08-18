# Catálogo de vehículos

Quince fichas. Cada una es un objeto de **números** y no importa Three: la
geometría la monta `ensamblar.js` con las primitivas de `ARTE-VEHICULOS.md` §2.
Los valores de abajo son los que hay hoy en `diseno/vehiculos.js`, con los que se
generan las planchas; el modelo 3D tiene que salir de éstos y no de otros.

Cómo leer las tablas:

- **u** = unidad de mundo, la misma del terreno y de la balística.
- **L** = largo del casco. **Alto** = altura del cuerpo sobre el tren de rodaje.
- **y0** = altura del tren de rodaje, o sea dónde apoya el casco.
- **Piezas** = mallas de nivel A + B. El tope es 18 y no se negocia.
- Vida, daño y avance están **propuestos**: hay que aprobarlos y escribirlos
  literales en `tests/game/combat.test.js`.

> **Construcción: `ARTE-VEHICULOS.md` §12, «un cuerpo, un contorno».** Un vehículo
> dibujado como piezas apiladas está mal aunque sus medidas sean correctas.

---

## 0. El invariante, y de dónde sale todo lo demás

**`Y_PIVOTE` = 2,32 u.** El eje sobre el que gira el tubo está a esa altura en
los quince, es una constante del módulo y **no sale de la ficha**: una ficha no
puede romperlo ni queriendo. La boca se calcula como
`pivote + R(elevación)·[largo, 0]` con el largo que declara la ficha.

La regla anterior decía que era **la boca** la que estaba a la misma Y «en toda
elevación». Un tubo que gira describe un arco, no una horizontal, así que eso no
se puede cumplir: obligaba a enterrar la cuna del mortero por debajo de la oruga.
Ver `ARTE-VEHICULOS.md` §8.

---

## 0 bis. Correcciones salidas de dibujar las quince

Cuatro cosas que este catálogo daba por buenas y no lo eran. Están corregidas
abajo; se dejan escritas para que nadie las «arregle» de vuelta.

| Decía | Dice | Por qué |
|---|---|---|
| Rodadura de **1,3 u** en la MEDIA | **0,13 L de diámetro** (0,64 u de radio × 2) | 1,3 u sobre un casco de 5,6 u son 0,23 L: cinco ruedas de ese tamaño se solapan y el tren de rodaje se lee como una fila de monedas |
| MEDIA con **5** ruedas | **6** | Las de la imagen de referencia aprobada. Con cinco quedan huecos y el casco parece flotar |
| Cinta holgada sobre la rueda | **+0,03 u por lado** cuando no hay rodillos | Medido en la referencia. Con más holgura el tren de rodaje engorda y el casco pierde altura útil |
| Nada sobre hacia dónde mira | **El vehículo mira a la derecha** | Ahí va el glacis y de ahí sale el tubo. Con el morro a la izquierda se lee marcha atrás aunque cada pieza esté bien |

---

## 1. Reglas de familia

Lo que comparten los quince, y lo que hace que puestos en fila parezcan del mismo
juego:

| Medida | Valor | Por qué |
|---|---|---|
| Ancho de vía (eje Z) | 2,4 u en todos | De perfil no se ve, y variarlo descuadra la sombra de contacto |
| Diámetro de rodadura | 0,13 L | De ahí sale el radio de cada ficha |
| Radio de la cinta | rueda + 0,03 u sin rodillos; rueda × 1,42 con ellos | Sin rodillos la cinta apoya en la rodadura, que es la marca de la MEDIA |
| Motriz y tensor | Primera y última de la fila, 12 % mayores, seis tornillos | Dibujadas **además** de la fila se solapan y parecen monedas apiladas |
| Grosor de contorno | 0,066 u de silueta (13 px medidos en la referencia) | Constante en pantalla a cualquier zoom |
| Eslabones de oruga | 22–30 | Menos se lee como cadena de bicicleta |
| Comba de la oruga | 0,07 u sin rodillos, 0,16 u con ellos | Cero comba = recta tensa = juguete |
| Costura y banda oscura | `min(alto × 0,42, 0,62)` desde `y0` | Al 50 % de un casco alto parte el vehículo en dos colores |
| Sombra de contacto | `ry` 0,18 u, ancho = L × 0,92 | Más ancha y parece un charco |

Las tres piezas que **todos** llevan sin excepción: **mantelete** (o collar de
tubo si no hay torreta), **buje de rueda** y **banda oscura de barcaza** entre el
casco y el tren de rodaje.

---

## 2. Las quince fichas

| Vehículo | Año | Clase | L | Alto | y0 | Perfil |
|---|---|---|---|---|---|---|
| MEDIA | 1942 | Carro medio | 5,6 | 0,95 | 0,70 | panza |
| PESADO | 1943 | Carro pesado | 6,2 | 1,32 | 0,76 | caja |
| CAZACARROS | 1943 | Cazacarros | 5,4 | 1,55 | 0,88 | cuña |
| ASALTO PESADO | 1944 | Cañón de asalto | 6,8 | 1,60 | 0,86 | casamata |
| OBÚS ATP | 1943 | Artillería autopropulsada | 5,8 | 0,55 | 0,97 | bañera |
| MORTERO ATP | 1943 | Mortero autopropulsado | 4,8 | 1,00 | 0,82 | caja |
| LANZALLAMAS | 1943 | Carro lanzallamas | 5,6 | 0,95 | 0,70 | panza |
| ANTIAÉREO | 1943 | Antiaéreo autopropulsado | 5,2 | 0,45 | 0,88 | bañera |
| COHETES | 1943 | Lanzacohetes | 5,4 | 1,20 | 0,80 | cabina |
| SEMIORUGA | 1942 | Transporte semioruga | 5,6 | 1,15 | 0,78 | cabina |
| RUEDAS | 1941 | Coche blindado | 4,6 | 1,15 | 0,72 | coche |
| TANQUETA LIGERA | 1941 | Carro ligero | 3,8 | 1,20 | 0,74 | cuña |
| ROMBO | 1916 | Carro de la Gran Guerra | 6,4 | 2,26 | 0,64 | rombo |
| A7V | 1918 | Carro de la Gran Guerra | 6,0 | 2,11 | 0,66 | caja |
| TRINCHERAS | 1916 | Carro de zanja | 7,0 | 2,02 | 0,64 | rombo |

### Tren de rodaje, torreta y tubo

| Vehículo | Rodaje | Torreta | Tubo |
|---|---|---|---|
| MEDIA | oruga, 6 rodadura r 0,32, **0 rodillos**, 30 eslabones | redonda r 1,0 alto 0,62 en cx −0,5, con cúpula | 3,0 u r 0,13, mantelete 0,40 |
| PESADO | oruga, 7 rodadura r 0,35, 0 rodillos, 30 eslabones | cuadrada r 0,95 alto 0,70 en cx −0,55 | 3,6 u r 0,16, freno de dos cámaras, mantelete 0,44 |
| CAZACARROS | oruga, 6 rodadura r 0,31, 3 rodillos, 28 eslabones | no | **4,2 u** r 0,15, mantelete 0,46 |
| ASALTO PESADO | oruga, 7 rodadura r 0,40, 0 rodillos, 30 eslabones | no | 3,4 u r 0,22, freno de dos cámaras, mantelete 0,62 |
| OBÚS ATP | oruga, 5 rodadura r 0,34, 2 rodillos, 26 eslabones | no | 2,0 u r 0,24 **a 35°**, freno ancho, mantelete 0,44 |
| MORTERO ATP | oruga, 4 rodadura r 0,29, 2 rodillos, 22 eslabones | no | 1,7 u r 0,20 **a 70°** |
| LANZALLAMAS | chasis de MEDIA sin tocar | redonda r 0,90 alto 0,52 | 1,3 u r 0,20, **boquilla acampanada**, mantelete 0,38 |
| ANTIAÉREO | oruga, 5 rodadura r 0,31, 2 rodillos, 26 eslabones | plataforma r 0,85 alto 0,32 | **cuatro** tubos de 1,85–2,0 u r 0,08 **a 60°** |
| COHETES | 4 neumáticas r 0,62 | no | bastidor 1,9 u r 0,38 **a 45°** |
| SEMIORUGA | **mixto**: neumática delante + oruga de 3 detrás | no | 1,1 u r 0,07 |
| RUEDAS | 4 neumáticas r 0,62 | cónica r 0,70 alto 0,62 | 1,9 u r 0,11, mantelete 0,26 |
| TANQUETA LIGERA | oruga, 4 rodadura r 0,26, 1 rodillo, 22 eslabones | cuadrada r 0,55 alto 0,62 | 1,8 u r 0,09, mantelete 0,22 |
| ROMBO | **envolvente**: la cinta rodea el perfil, 0,62 u de ancho | no | 1,6 u r 0,16 en patrocinio, mantelete 0,38 |
| A7V | oruga, 6 rodadura r 0,30, 0 rodillos, 24 eslabones | casamata cuadrada r 1,25 alto 0,50 | 2,2 u r 0,18 frontal, mantelete 0,32 |
| TRINCHERAS | envolvente, con cabina de mando alta y rodillo antizanja | no | 1,8 u r 0,17 en patrocinio, mantelete 0,40 |

### Balance propuesto y teatros

| Vehículo | Vida | Daño | Avance | Piezas | Teatros |
|---|---|---|---|---|---|
| MEDIA | 100 | 46 | 1,0× | 13 | Stalingrado · Járkov · Caen · Saint-Lô |
| PESADO | 140 | 52 | 0,55× | 17 | Aquisgrán · Dresde · Berlín |
| CAZACARROS | 90 | 56 | 0,8× | 12 | Stalingrado · Járkov · Aquisgrán |
| ASALTO PESADO | 170 | 64 | 0,4× | 17 | Berlín · Aquisgrán · Dresde |
| OBÚS ATP | 85 | 60 | 0,7× | 16 | todos |
| MORTERO ATP | 80 | 42 | 0,9× | 14 | todos |
| LANZALLAMAS | 95 | 34 | 1,0× | 15 | Berlín · Aquisgrán · Dresde |
| ANTIAÉREO | 75 | 12 ×4 | 1,1× | 18 | todos |
| COHETES | 65 | 11 × salva de 6 | 1,2× | 15 | todos |
| SEMIORUGA | 60 | 14 | **1,8×** | 18 | todos |
| RUEDAS | 70 | 30 | 1,6× | 15 | Varsovia 39 · Rotterdam · Arnhem |
| TANQUETA LIGERA | 55 | 22 | 1,7× | 12 | todos |
| ROMBO | 120 | 38 | 0,6× | 14 | Ypres · Verdún |
| A7V | 130 | 40 | 0,5× | 15 | Ypres · Verdún |
| TRINCHERAS | 150 | 34 | 0,45× | 14 | Ypres · Verdún |

### Lo que distingue a cada uno, en una línea

- **MEDIA** — la vara de medir. Es el vehículo de la imagen de referencia: panza
  redondeada con meseta y la oruga apoyada en la rodadura, sin rodillos.
- **PESADO** — torreta cuadrada retrasada y freno de dos cámaras. El solape de
  ruedas se exagera hasta que se vean dos filas.
- **CAZACARROS** — la silueta más baja y el tubo más largo. Si el tubo no incomoda
  al mirarlo, es corto.
- **ASALTO PESADO** — el más grande y el que más pega. Su carácter es la masa: se
  exagera el ancho del mantelete, nunca la altura.
- **OBÚS ATP** — bañera abierta y azadón de anclaje clavado. El azadón explica por
  qué pega tan fuerte y no se corta nunca.
- **MORTERO ATP** — tubo casi vertical. Su trayectoria pasa por encima de los
  muros y de los taludes que levanta Sotavento: el único que ignora un encierro.
- **LANZALLAMAS** — chasis de MEDIA sin tocar; la familia se nota más si comparten
  rodaje. Dos depósitos atrás y la manguera que los une a la boquilla.
- **ANTIAÉREO** — cuatro tubos que comparten **un solo pivote**; los otros tres son
  decorado. Separados 0,22 u entre ejes o a 0,55× se leen como uno gordo.
- **COHETES** — sin tubo. Ocho raíles se modelan como **una** rejilla de ocho
  huecos, no como ocho cilindros.
- **SEMIORUGA** — el rodaje mixto es la silueta más reconocible del catálogo. El
  mayor depósito: es el vehículo de reposicionarse, no el de pegar.
- **RUEDAS** — se mueve, no pega. La rueda de repuesto del flanco es la única
  pieza asimétrica grande, y es lo que lo hace leer vivo.
- **TANQUETA LIGERA** — el más pequeño y el mínimo de piezas, y no por elegir: a
  3,8 u de largo, catorce piezas se solapan.
- **ROMBO** — la oruga envuelve el casco entero: ésa es toda la silueta.
- **A7V** — el más alto y el más torpe. Si se ve el tren de rodaje completo, está
  mal modelado.
- **TRINCHERAS** — cruza trincheras y muros bajos sin penalización. Lleva **cabina
  de mando alta y rodillo antizanja** porque sin ellos era la misma silueta que
  ROMBO en la prueba en negro, y la checklist manda cambiar casco o rodaje.

---

## 3. Orden de modelado

Nunca dos vehículos a medias a la vez. Uno terminado y revisado enseña qué
primitiva falta; dos a medias solo enseñan que faltan dos.

1. **MEDIA**, entera, aprobada. **Parar aquí** y revisarla.
2. **CAZACARROS** y **PESADO** — validan casco sin torreta y torreta grande.
3. **ROMBO** y **A7V** — validan 1916 y la oruga envolvente.
4. **RUEDAS** y **SEMIORUGA** — validan el rodaje que no es oruga.
5. El resto, en cualquier orden, reutilizando primitivas.
6. **OBÚS**, **MORTERO**, **ANTIAÉREO** y **COHETES** al final: son los cuatro con
   elevación fija, y conviene tener maduro el test del pivote.

La prueba que decide es **la fila de comparación** con los quince al mismo zoom,
en color y en negro (`CHECKLIST-REVISION.md` §3). Un vehículo aprobado por
separado y suspendido ahí está suspendido: así se cazó que ROMBO y TRINCHERAS
eran la misma silueta.
