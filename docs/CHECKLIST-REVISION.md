# Checklist de revisión

Cómo se valida un vehículo o una escena **antes** de decir que está terminado.
Ninguna de estas pruebas es opcional y todas se pueden automatizar con el cliente
Playwright que ya existe (`AGENTS.md`, bucle de test).

Regla que gobierna el documento: **una pieza no está terminada hasta que las
pruebas de su sección pasan todas.** «Casi» no cuenta, y «se ve bien en mi
captura» tampoco: la mitad de estas pruebas existen porque el ojo perdona lo que
la fila de comparación no.

---

## 1. Antes de modelar nada

- [ ] `src/art/vehiculo/` existe con `paleta.js`, `primitivas.js`, `toon.js`,
      `ensamblar.js` y `fichas/` vacío.
- [ ] `tono()`, `claro()`, `oscuro()` y `contorno()` tienen test unitario con
      valores esperados escritos literales.
- [ ] El `gradientMap` de 3 paradas es **uno solo** para todo el juego y hay un
      test que falla si aparece un segundo material toon.
- [ ] El shell de contorno da **grosor constante en píxeles** a zoom 0,55× y a
      2,6×. Se mide contando píxeles en dos capturas, no a ojo.
- [ ] `tests/world/cannon.test.js` está ampliado a **las quince fichas** del
      catálogo y falla si alguna boca se sale de la Y de referencia. Este test se
      escribe **antes** del primer vehículo, no después.
- [ ] `tests/arquitectura.test.js` prohíbe que una ficha de `fichas/` importe
      Three.

---

## 2. Por vehículo

### 2.1 Silueta

- [ ] **Prueba en negro.** Captura del vehículo con todos los materiales a
      `#000` sobre fondo claro. ¿Se reconoce qué es? ¿Se distingue de los otros
      catorce en la misma prueba?
- [ ] **Prueba a 0,55×.** A zoom mínimo, ¿sigue siendo reconocible el tipo de
      vehículo? Si a ese zoom solo se ve «un tanque», la silueta no basta.
- [ ] **Prueba de 8 px.** Ninguna pieza de nivel B por debajo de 0,7 u; ninguna
      de nivel A por debajo de 1,3 u. Se comprueba sobre la ficha, con un test
      que recorre las medidas: es aritmética, no requiere render.

### 2.2 Un cuerpo, un contorno (§12 de ARTE-VEHICULOS.md)

- [ ] **Prueba de la figura suelta.** ¿Se distingue el borde de alguna pieza
      dentro del cuerpo? Torreta, mantelete, tubo y freno tienen que salir de una
      silueta continua. Si se ve la costura de una pieza pegada, está mal.
- [ ] **Prueba de la línea flotante.** Recorrer cada línea interior: ¿sus dos
      extremos tocan el borde de la silueta? Un extremo en el aire es un defecto.
- [ ] El contorno exterior se pinta **después** del sombreado y está en todo el
      perímetro, sin huecos.
- [ ] Cero elementos sobrepuestos: ni cofres, ni faros, ni remaches, ni manchas,
      ni números.
- [ ] Las bandas de tono coinciden con la costura del sobrepatín, sin desfase.
- [ ] El rodaje es el aprobado, sin rediseñar.

### 2.3 Detalle

- [ ] Piezas de nivel A + B entre **12 y 18**. Contadas por `ensamblar.js`, con
      test.
- [ ] Lleva **mantelete o collar de tubo**. Sin excepción.
- [ ] Toda rueda lleva **buje** y **radios o aligeramientos**.
- [ ] El tren de rodaje lleva los seis elementos de `ARTE-VEHICULOS.md` §4:
      motriz dentada, rodadura, tensor, rodillos, oruga con comba, banda oscura
      de barcaza.
- [ ] La oruga **cuelga** entre rodillos. Una recta tensa es un fallo.
- [ ] Hay al menos **una asimetría grande** (escape, cofre, repuesto, azadón).
- [ ] Hay nivel C: al menos 2 líneas de panel y 1 fila de remaches o 1 mancha.
- [ ] Ninguna calcomanía de nivel C flota: todas cruzan una cara entera o forman
      una fila de 1,5 u.

### 2.4 Sombreado y contorno

- [ ] Un solo material. Una sola luz direccional.
- [ ] `flatShading: true`. Cero `MeshStandardMaterial`, cero mapas, cero
      postprocesado.
- [ ] Las tres bandas de tono se corresponden **exactamente** con
      `claro(base)` / `base` / `oscuro(base)`, comprobado leyendo el píxel.
- [ ] Contorno de color `contorno(base)`, nunca `#000` ni gris.
- [ ] Grosor 3 px en nivel A, 2 px en nivel B, constante a cualquier zoom.
- [ ] Ruedas y eslabones **sin shell**: su contorno es geometría.
- [ ] Sombra de contacto presente, `ry` 0,18 u.

### 2.5 Invariante

- [ ] El ancla `boca` existe, se llama así y la balística lee **solo** eso.
- [ ] La Y mundial de `boca` coincide con la de MEDIA hasta la última cifra, en
      elevación mínima y máxima del tubo.
- [ ] Si la ficha corrige el anclaje del tubo, la corrección está **escrita en la
      ficha con su motivo** (mortero, cohetes, antiaéreo, obús, asalto pesado).

### 2.6 Coste

- [ ] **8 llamadas de dibujo o menos** (6 si no tiene torreta). Se cuenta con
      `renderer.info.render.calls` antes y después de añadir el vehículo, no
      estimando.
- [ ] Las ruedas son un `InstancedMesh`, los eslabones otro.
- [ ] Las piezas de nivel B están **fusionadas** con el casco, no añadidas como
      hijos con material propio.
- [ ] Con **seis vehículos** en pantalla el cuadro sigue por debajo de 16,7 ms en
      calidad alta. Medido con la ventana real, como se midió el 50 ms original.

### 2.7 Movimiento

- [ ] Las ruedas giran y la oruga avanza en función de **la x recorrida**, nunca
      del reloj.
- [ ] Dos pestañas con la misma semilla y los mismos inputs enseñan las orugas en
      la **misma fase**. `pnpm verificar:determinismo` lo cubre si se le añade la
      fase al texto de `render_game_to_text()`.
- [ ] El retroceso del tubo son 90 ms + 260 ms con las curvas de `ARTE.md` §14.
      Nada de valores nuevos.

---

## 3. La fila de comparación

**La prueba que de verdad decide.** Un vehículo aprobado por separado y suspendido
aquí está suspendido.

Guion `scripts/verificar-familia.mjs`: monta los quince en fila, mismo zoom,
mismo fondo, y saca cuatro capturas.

| Captura | Qué se mira |
|---|---|
| **Color, bando A** | ¿Parecen del mismo juego? ¿Mismo nivel de acabado? |
| **Color, bandos A y B alternos** | ¿Algún vehículo con el contorno del bando contrario? |
| **Negro** | ¿Los quince se distinguen entre sí solo por silueta? |
| **A 0,55×** | ¿Sigue habiendo quince siluetas distintas, o se han vuelto tres? |

Preguntas de la revisión, y hay que contestarlas por escrito:

- [ ] ¿Hay alguno que **destaque por tener más detalle** que los demás? Es un
      fallo: hay que bajarlo, no subir los otros catorce.
- [ ] ¿Hay dos que se confundan en la captura en negro? Si sí, uno de los dos
      cambia de perfil de casco o de tren de rodaje — **no de color y no de
      calcomanía**.
- [ ] ¿El grosor de contorno se ve igual en los quince?
- [ ] ¿Las quince bocas están a la misma altura **en la captura**? Se mide con
      una línea horizontal superpuesta. El test lo garantiza en números; la
      captura lo garantiza de verdad.

---

## 4. Por escena

Sobre la checklist de `ARTE.md` §7, que sigue vigente, se añade:

- [ ] Los cinco planos están presentes y el hito ocupa el 25–40 % del ancho.
- [ ] Decorado **por debajo de 14 llamadas de dibujo**.
- [ ] Todas las familias de `ESCENARIOS.md` presentes en la escena están
      **tintadas 0,35 hacia el terreno del teatro**.
- [ ] Ninguna pieza de decorado usa `acento`.
- [ ] Ninguna pieza flota: todas asentadas por muestreo del heightmap.
- [ ] Tras disparar cerca, las piezas a menos de 8 u **se reasientan**. Se
      comprueba con dos capturas antes y después.
- [ ] Ninguna instancia con espaciado regular.
- [ ] El terreno nevado tiene **borde de nieve duro**, no degradado, y las piezas
      llevan capa blanca en su cara superior.
- [ ] Los cráteres tienen **labio elevado** y cambio de color. Los viejos con
      agua, los frescos sin.
- [ ] Cero figuras humanas, cero elementos antropomórficos, en toda la escena.

---

## 5. Por trampa

- [ ] Lleva las **tres marcas**: `acento` visible, contorno de 4 px, sin tinte de
      teatro.
- [ ] **Prueba de confusión.** Captura de la trampa junto a la pieza de decorado
      que más se le parece (mina/bidón, muro/ruina, deflector/cartel). ¿Se
      distinguen a 0,55×? Si no, la trampa cambia — el decorado no.
- [ ] No hay ninguna ruina aislada y vertical en una escena con muros-trampa.
- [ ] El aviso es **un pulso corto**, no un bucle.
- [ ] Ninguna trampa a menos de 6 u de un cañón, ni oculta tras un hito, ni una
      mina bajo un deflector.
- [ ] Las trampas se pintan igual en calidad `minima` que en `alta`. Se comprueba
      con `?calidad=minima`.
- [ ] `pnpm verificar:trampas` sigue verde y el rebote sigue en 0,60.

---

## 6. Cierre: la consola y las capturas

Igual que en `AGENTS.md`, ningún cambio de arte se da por terminado sin esto:

```bash
pnpm dev
node "$WEB_GAME_CLIENT" --actions-file "$WEB_GAME_ACTIONS" --url http://localhost:5173
pnpm test
pnpm verificar:determinismo
pnpm verificar:trampas
```

- [ ] Cero errores y cero avisos en consola.
- [ ] Las capturas revisadas de verdad, una a una, no solo generadas.
- [ ] Si un valor de arte nuevo ha entrado en el código, está **también** escrito
      en `ARTE.md`, `ARTE-VEHICULOS.md`, `ESCENARIOS.md` o `TRAMPAS.md`. Un
      número de arte que solo vive en el código deja de ser una decisión y pasa a
      ser un accidente.

---

## 7. Lo que no se acepta como respuesta

- «Se ve bien en la captura» sin la fila de comparación.
- «El detalle no se aprecia a ese zoom, pero está» — si no se aprecia, sobra y
  cuesta cuadro.
- «He subido el detalle de este porque es el protagonista» — no hay protagonista;
  los quince salen en la misma fila y en el mismo combate.
- «He movido la boca 2 píxeles porque quedaba raro» — eso es un bug de red y no
  se manifiesta como error visual, sino como partidas que divergen sin
  explicación.
- «Lo he bajado de detalle en móviles lentos» — la calidad adaptativa toca
  píxeles y sombra, nunca piezas.
