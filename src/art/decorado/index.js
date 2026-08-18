import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, hashSeed } from '../../core/rng.js';
import { materialRelleno, materialContorno } from '../vehiculo/toon.js';
import { tonosDe } from './paleta.js';
import { FAMILIAS, sacos } from './piezas.js';
import { ANCHO_HITO, plantarHito } from './hitos.js';
import { crearReserva, cola, llano } from './colocar.js';

/**
 * Lo que hace que el campo sea un SITIO y no un perfil de ruido.
 *
 * Muro suelto, viga retorcida, coche quemado, tranvia volcado, escombro,
 * barricada, erizo, alambrada, via, bidones, cajas, arbol quemado, farola y
 * poste — mas el hito que le pone nombre a la ciudad. Sin esto el juego se ve
 * limpio y vacio: la paleta puede ser perfecta, pero un cerro pelado no cuenta
 * que hay una guerra.
 *
 * Es decorado PURO. No estorba al proyectil, no colisiona y no entra en la
 * simulacion — lo que colisiona son las trampas, y esas tienen su propio
 * lenguaje visual para que se lean como tales (`docs/ESCENARIOS.md` §2). Esa
 * separacion es lo unico que evita el «me lo ha parado un arbusto».
 *
 * Sale del `rng` con semilla, asi que los seis moviles ven el mismo campo sin
 * que el servidor mande nada.
 *
 * ── COSTE ───────────────────────────────────────────────────────────────
 * TRES llamadas de dibujo para todo el campo: cuerpos, su shell de contorno y
 * las calcomanias. El tope de `docs/ESCENARIOS.md` §1 son catorce. Cada pieza
 * conserva su geometria por separado para poder reconstruir SOLO la que un
 * crater ha descalzado, y se refunde el conjunto.
 */

/**
 * Detras del plano de vuelo, y CASI pegado a la cara frontal del terreno.
 *
 * A camara ortografica de 15 grados, cada unidad de z baja el objeto 0,26 u en
 * pantalla. Con el decorado a -1,3 —donde vivia el atrezo viejo— la cara frontal
 * del terreno, que esta en z = 0, tapaba un tercio de unidad de cada pieza y
 * TODAS se veian medio enterradas por mucho que su base siguiera el perfil.
 * A -0,6 el frente de la pieza cae practicamente en el mismo plano que el
 * terreno, y el proyectil (z = +0,25) le sigue pasando por delante.
 */
const Z_DECORADO = -0.6;

/** Lo que la plancha encuadra. Las `veces` de la tabla son por este ancho. */
const ANCHO_PLANCHA = 38;

/** Se reasienta lo que este a menos de esto del impacto (`ESCENARIOS.md` §2). */
const ALCANCE_REASENTAR = 8;

/**
 * @param {object} opciones
 * @param {string} opciones.semilla       texto del que cuelga todo el azar
 * @param {object} opciones.biome         uno de los dieciseis de `direction.js`
 * @param {(x:number) => number} opciones.alturaEn
 * @param {number[]} opciones.emplazamientos  la x de cada blindado
 */
export function crearDecorado({
  semilla,
  biome,
  alturaEn,
  anchoMundo = 140,
  emplazamientos = [],
  composicion = 'avenida',
}) {
  const T = tonosDe(biome);
  const grupo = new THREE.Group();
  grupo.name = 'decorado';
  grupo.position.z = Z_DECORADO;

  const limite = anchoMundo / 2 - 4;
  const reserva = crearReserva(-limite, limite);

  // 1. Lo intocable, PRIMERO. Se reserva la huella del blindado y la de su
  //    parapeto —no el hueco donde cabria entero con el tubo: reservando ocho
  //    unidades por vehiculo no cabe nada en todo el campo— y el decorado se
  //    acomoda a ellas, nunca al reves.
  const parapetos = [];
  for (const x of emplazamientos) {
    reserva.ocupar(x, 7.0);
    // El parapeto va DELANTE del canon, mirando al centro del campo: detras lo
    // tapa la propia pieza y el jugador no lo ve nunca.
    const px = x + (x < 0 ? 3.2 : -3.2);
    reserva.ocupar(px, 3.6);
    parapetos.push(px);
  }

  // 2. El hito, DESCENTRADO. Centrado parte el campo en dos huecos estrechos
  //    donde no cabe nada grande; a un lado deja un vano ancho. Y se planta
  //    donde el terreno es llano, midiendo el desnivel bajo su huella.
  const rngSitio = mulberry32(hashSeed(`${semilla}:sitio`));
  const anchoHito = ANCHO_HITO[biome.hito] ?? 11;
  const lado = rngSitio() < 0.5 ? -1 : 1;
  const alcance = Math.max(
    anchoHito,
    Math.min(limite - anchoHito / 2, Math.abs(emplazamientos[0] ?? 44) - 7 - anchoHito / 2),
  );
  // Con monton central el hito va ENCIMA del monton: es lo que hace que coronar
  // el monton sea la jugada y no un capricho — se ve desde el otro lado del
  // campo y dice donde esta la altura. En las otras dos va descentrado y en lo
  // llano, midiendo el desnivel bajo su huella.
  const xHito = composicion === 'monton'
    ? lado * 2.2
    : lado * llano(alturaEn, alcance * 0.3, alcance * 0.7, anchoHito, 10);
  reserva.ocupar(xHito, anchoHito);

  // 3. El decorado: SOLO las familias que este teatro declara. Un teatro no es
  //    una paleta, es un sitio, y lo que lo dice son sus piezas. De mayor a
  //    menor, porque el tranvia de 5 u tiene un solo sitio posible y las cajas
  //    de 2,2 tienen diez.
  const densidad = (anchoMundo - 2 * 7) / ANCHO_PLANCHA;
  const rngCola = mulberry32(hashSeed(`${semilla}:cola`));
  const encargos = [];

  for (const parapeto of parapetos) {
    encargos.push({ x: parapeto, construir: (ctx, x) => sacos(ctx, x, 3.0) });
  }
  encargos.push({ x: xHito, construir: (ctx, x) => plantarHito(ctx, biome.hito, x) });

  for (const fam of cola(biome.props ?? ['escombro'], FAMILIAS, densidad)) {
    const x = reserva.colocar(fam.ancho, rngCola, 0.45, alturaEn);
    if (x === null) continue;          // no cabe: no se mete a la fuerza
    reserva.ocupar(x, fam.ancho);
    encargos.push({ x, construir: fam.construir });
  }

  // 4. Construir. Cada pieza lleva SU hilo de azar, sembrado con su indice: es
  //    lo que permite reconstruir una sola pieza tras un crater y que salga
  //    exactamente igual que estaba.
  const piezas = encargos.map((encargo, i) => ({
    ...encargo,
    rng: () => mulberry32(hashSeed(`${semilla}:pieza:${i}`)),
    cuerpos: null,
    detalles: null,
  }));

  const construirPieza = (p) => {
    for (const g of p.cuerpos ?? []) g.dispose();
    for (const g of p.detalles ?? []) g.dispose();
    const ctx = { suelo: alturaEn, rng: p.rng(), T, cuerpos: [], detalles: [] };
    p.construir(ctx, p.x);
    p.cuerpos = ctx.cuerpos;
    p.detalles = ctx.detalles;
  };

  const relleno = new THREE.Mesh(new THREE.BufferGeometry(), materialRelleno());
  // Sin sombra proyectada, y no por presupuesto: la superficie superior del
  // terreno son 4,2 unidades de profundidad vistas a 15 grados, asi que la
  // sombra de cualquier pieza la cubre ENTERA y sale una franja negra pegada al
  // perfil que se lee como un agujero. La pieza ya se ancla al suelo por donde
  // se ancla de verdad: su base es el perfil del terreno.
  relleno.receiveShadow = true;
  // Contorno de plano medio: 2,5 px (`docs/ESCENARIOS.md` §1). Es el mismo shell
  // que los vehiculos y no una segunda implementacion — dos tecnicas de contorno
  // se ven distintas en cuanto una pieza y un tanque comparten cuadro.
  const shell = new THREE.Mesh(relleno.geometry, materialContorno(2.5));
  const calcos = new THREE.Mesh(new THREE.BufferGeometry(), materialRelleno());
  grupo.add(shell, relleno, calcos);

  const refundir = () => {
    const cuerpos = piezas.flatMap((p) => p.cuerpos ?? []);
    const detalles = piezas.flatMap((p) => p.detalles ?? []);
    relleno.geometry.dispose();
    calcos.geometry.dispose();
    const geoCuerpos = cuerpos.length ? mergeGeometries(cuerpos, false) : new THREE.BufferGeometry();
    relleno.geometry = geoCuerpos;
    shell.geometry = geoCuerpos;
    calcos.geometry = detalles.length
      ? mergeGeometries(detalles, false)
      : new THREE.BufferGeometry();
  };

  for (const p of piezas) construirPieza(p);
  refundir();

  return {
    grupo,

    /**
     * Vuelve a apoyar el decorado sobre el terreno.
     *
     * Hace falta porque el terreno se MUEVE: un crater al lado de una alambrada
     * la dejaria colgando en el aire, y la arena que cae encima la enterraria a
     * medias. Se reconstruyen solo las piezas a menos de ocho unidades del
     * impacto — reconstruir el campo entero cada disparo cuesta el cuadro.
     *
     * @param {number} [cx] donde cayo. Sin x, se reasienta todo.
     * @param {number} [alcance] radio tocado. La arena de la pluma llega mas
     *   lejos que un crater, asi que quien la suelta pasa su propio alcance.
     */
    reasentar(cx, alcance = ALCANCE_REASENTAR) {
      let alguna = false;
      for (const p of piezas) {
        if (cx !== undefined && Math.abs(p.x - cx) > alcance) continue;
        construirPieza(p);
        alguna = true;
      }
      if (alguna) refundir();
    },

    /** Solo para pruebas y para el presupuesto de cuadro. */
    _piezas: piezas,
  };
}
