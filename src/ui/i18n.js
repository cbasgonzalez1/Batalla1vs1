/**
 * Idioma de la interfaz: espanol si el dispositivo esta en espanol, ingles en
 * cualquier otro caso.
 *
 * La eleccion es pura y se puede probar sin navegador; solo `idiomaDelNavegador`
 * toca el entorno. La interfaz no ofrece selector: el idioma del movil manda,
 * que es lo que espera alguien que abre un enlace y se pone a jugar.
 */

export const IDIOMA_POR_DEFECTO = 'en';
export const IDIOMAS = ['es', 'en'];

const TEXTOS = {
  es: {
    titulo: 'Artillería 1v1',
    viento: 'Viento',
    turno: 'Turno',
    angulo: 'Ángulo',
    potencia: 'Potencia',
    otear: 'Otear',
    otearAria: 'Otear al rival',
    reaccion: 'Reacción',
    reaccionAria: 'Reacción en vuelo',
    escudo: 'Escudo',
    salto: 'Salto',
    objetivoDestruido: 'Objetivo destruido',
    gana: 'Gana {bando}',
    revancha: 'Revancha',
    compartir: 'Copiar enlace',
    copiado: 'Copiado',
    pista: 'Arrastra hacia atrás y suelta',
    resumen: '{disparos} disparos · {vida} de vida',
    empate: 'Empate',
    corto: 'Corto {distancia}',
    largo: 'Largo {distancia}',
    arena: 'Arena +{pico} a {distancia}',
    arenaEncima: 'Arena +{pico} encima',
    pronostico: 'luego {flecha} {viento}',
    salaTitulo: 'Jugar con amigos',
    crearSala: 'Crear sala',
    unirse: 'Entrar',
    dictaCodigo: 'Dicta este código a tus amigos',
    bandoA: 'Bando A',
    bandoB: 'Bando B',
    cambiarBando: 'Cambiar de bando',
    estoyListo: 'Estoy listo',
    esperando: 'Esperando',
    hueco: 'libre',
    faltaRival: 'Hace falta alguien en los dos bandos',
    faltanListos: 'Faltan {cuantos} por confirmar',
    faltaUno: 'Falta 1 por confirmar',
    sinConexion: 'Sin conexión con el servidor',
    tuNombre: 'Tu nombre',
    avanzarIzq: 'Avanzar a la izquierda',
    avanzarDer: 'Avanzar a la derecha',
    encerrado: 'Sin paso',
  },
  en: {
    titulo: 'Artillery 1v1',
    viento: 'Wind',
    turno: 'Turn',
    angulo: 'Angle',
    potencia: 'Power',
    otear: 'Scout',
    otearAria: 'Scout the enemy',
    reaccion: 'Reaction',
    reaccionAria: 'In-flight reaction',
    escudo: 'Shield',
    salto: 'Hop',
    objetivoDestruido: 'Target destroyed',
    gana: '{bando} wins',
    revancha: 'Rematch',
    compartir: 'Copy link',
    copiado: 'Copied',
    pista: 'Drag back and release',
    resumen: '{disparos} shots · {vida} HP left',
    empate: 'Draw',
    corto: 'Short {distancia}',
    largo: 'Long {distancia}',
    arena: 'Sand +{pico} at {distancia}',
    arenaEncima: 'Sand +{pico} on target',
    pronostico: 'next {flecha} {viento}',
    salaTitulo: 'Play with friends',
    crearSala: 'Create room',
    unirse: 'Join',
    dictaCodigo: 'Read this code out to your friends',
    bandoA: 'Side A',
    bandoB: 'Side B',
    cambiarBando: 'Switch side',
    estoyListo: "I'm ready",
    esperando: 'Waiting',
    hueco: 'open',
    faltaRival: 'Both sides need at least one player',
    faltanListos: '{cuantos} still to confirm',
    faltaUno: '1 still to confirm',
    sinConexion: 'No connection to the server',
    tuNombre: 'Your name',
    avanzarIzq: 'Move left',
    avanzarDer: 'Move right',
    encerrado: 'Blocked in',
  },
};

/**
 * Elige idioma a partir de la lista de preferencias del dispositivo.
 *
 * Manda el primer idioma si es uno de los dos que hay. Si no lo es, se sigue
 * mirando la lista: un movil en catalan suele declarar ['ca-ES', 'es-ES'], y
 * para esa familia el espanol es mucho mejor eleccion que el ingles. Si no
 * aparece ninguno de los dos, ingles.
 */
export function elegirIdioma(preferencias) {
  const lista = Array.isArray(preferencias) ? preferencias : [preferencias];

  for (const entrada of lista) {
    if (typeof entrada !== 'string') continue;
    const base = entrada.trim().toLowerCase().split(/[-_]/)[0];
    if (IDIOMAS.includes(base)) return base;
  }

  return IDIOMA_POR_DEFECTO;
}

/** Lo que declara el navegador, en orden de preferencia. */
export function idiomaDelNavegador(nav = globalThis.navigator) {
  if (!nav) return IDIOMA_POR_DEFECTO;
  const preferencias = nav.languages?.length ? nav.languages : [nav.language];
  return elegirIdioma(preferencias);
}

/**
 * Devuelve la funcion de traduccion. Una clave que no existe se devuelve tal
 * cual en vez de romper la pantalla: en un juego, un texto raro es mucho menos
 * grave que un HUD en blanco.
 */
export function crearTraductor(idioma) {
  const tabla = TEXTOS[idioma] ?? TEXTOS[IDIOMA_POR_DEFECTO];

  return function t(clave, valores) {
    const plantilla = tabla[clave] ?? TEXTOS[IDIOMA_POR_DEFECTO][clave] ?? clave;
    if (!valores) return plantilla;
    return plantilla.replace(/\{(\w+)\}/g, (coincidencia, nombre) =>
      Object.hasOwn(valores, nombre) ? String(valores[nombre]) : coincidencia
    );
  };
}

/**
 * Rellena el marcado: `data-i18n` para el contenido y `data-i18n-aria` para la
 * etiqueta accesible. Los textos siguen escritos en el HTML, asi que la pagina
 * es legible aunque el modulo no llegue a cargar.
 */
export function aplicarTraduccion(raiz, t) {
  for (const nodo of raiz.querySelectorAll('[data-i18n]')) {
    nodo.textContent = t(nodo.dataset.i18n);
  }
  for (const nodo of raiz.querySelectorAll('[data-i18n-aria]')) {
    nodo.setAttribute('aria-label', t(nodo.dataset.i18nAria));
  }
  return raiz;
}
