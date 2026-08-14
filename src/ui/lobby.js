import { MAX_POR_BANDO, BANDOS } from '../game/roster.js';
import { DICE, normalizarCodigo, LARGO_CODIGO } from '../net/protocolo.js';

/**
 * La pantalla de sala.
 *
 * Ocupa toda la pantalla porque mientras se monta la partida no hay nada que
 * mirar detras, y porque el codigo tiene que leerse de lejos: alguien lo esta
 * dictando en voz alta a la familia.
 *
 * Solo pinta y recoge pulsaciones. Quien habla con el servidor es el cliente de
 * red, y quien decide si se puede empezar es el servidor: aqui no se duplica
 * ninguna regla, para que no haya dos versiones de la verdad.
 */

/** Decide que enseñar a partir del estado de la sala. Pura, y por eso probable. */
export function resumirSala({ jugadores = [], yo = null }, t) {
  const porBando = Object.fromEntries(
    BANDOS.map((b) => [b, jugadores.filter((j) => j.bando === b)])
  );

  const faltanListos = jugadores.filter((j) => !j.listo).length;
  const bandoVacio = BANDOS.some((b) => porBando[b].length === 0);

  let aviso = '';
  if (jugadores.length < 2 || bandoVacio) aviso = t('faltaRival');
  else if (faltanListos === 1) aviso = t('faltaUno');
  else if (faltanListos > 1) aviso = t('faltanListos', { cuantos: faltanListos });

  return {
    porBando,
    aviso,
    // El boton de listo no decide nada: el servidor arranca cuando le consta
    // que estan todos. Aqui solo se evita ofrecerlo cuando es imposible.
    puedePulsarListo: jugadores.length >= 2 && !bandoVacio,
    yoListo: Boolean(jugadores.find((j) => j.id === yo)?.listo),
    miBando: jugadores.find((j) => j.id === yo)?.bando ?? null,
  };
}

export function crearLobby({ cliente, t, alEmpezar, documento = document }) {
  const $ = (id) => documento.getElementById(id);

  const el = {
    panel: $('sala'),
    entrada: $('s-entrada'),
    dentro: $('s-dentro'),
    codigo: $('s-codigo'),
    input: $('s-codigo-input'),
    nombre: $('s-nombre'),
    crear: $('s-crear'),
    unir: $('s-unir'),
    cambiar: $('s-cambiar'),
    listo: $('s-listo'),
    aviso: $('s-aviso'),
    listas: { a: $('s-lista-a'), b: $('s-lista-b') },
  };

  let nombre = null;
  const jugadoresEnSala = () => cliente.estado.jugadores.length;

  const mostrarAviso = (texto) => {
    el.aviso.textContent = texto ?? '';
  };

  function pintar() {
    const resumen = resumirSala(cliente.estado, t);

    el.codigo.textContent = cliente.estado.sala ?? '····';
    el.codigo.classList.toggle('vacio', !cliente.estado.sala);

    for (const bando of BANDOS) {
      const lista = el.listas[bando];
      lista.textContent = '';

      for (const jugador of resumen.porBando[bando]) {
        const fila = documento.createElement('li');
        fila.className = `${jugador.listo ? 'listo' : ''} ${jugador.id === cliente.estado.yo ? 'yo' : ''}`.trim();

        const quien = documento.createElement('span');
        quien.textContent = jugador.nombre;

        const marca = documento.createElement('span');
        marca.className = 'marca';
        marca.textContent = jugador.listo ? '◆' : '◇';

        fila.append(quien, marca);
        lista.append(fila);
      }

      // Los huecos se dibujan: se ve de un vistazo cuanta gente cabe todavia,
      // que es justo lo que preguntan los que estan esperando.
      for (let i = resumen.porBando[bando].length; i < MAX_POR_BANDO; i++) {
        const hueco = documento.createElement('li');
        hueco.className = 'hueco';
        hueco.textContent = t('hueco');
        lista.append(hueco);
      }
    }

    el.listo.disabled = !resumen.puedePulsarListo;
    el.listo.classList.toggle('listo', resumen.yoListo);
    el.listo.textContent = resumen.yoListo ? t('esperando') : t('estoyListo');
    mostrarAviso(resumen.aviso);
  }

  async function entrar(codigo) {
    const limpio = normalizarCodigo(codigo);
    if (limpio.length !== LARGO_CODIGO) {
      mostrarAviso(`${t('unirse')}: ${LARGO_CODIGO}`);
      return;
    }

    try {
      if (!cliente.estado.conectado) await cliente.conectar();
    } catch {
      mostrarAviso(t('sinConexion'));
      return;
    }

    // El nombre lo teclea quien juega; si lo deja en blanco se le pone uno
    // corto y distinto, porque en la lista tiene que poder reconocerse.
    const tecleado = el.nombre?.value.trim();
    nombre = tecleado || nombre || `${t('tuNombre')} ${1 + (jugadoresEnSala() % 9)}`;
    cliente.unir(limpio, nombre);
    el.entrada.hidden = true;
    el.dentro.hidden = false;
  }

  el.crear.addEventListener('click', async () => {
    try {
      const codigo = await cliente.crearSala();
      el.input.value = codigo;
      await entrar(codigo);
    } catch {
      mostrarAviso(t('sinConexion'));
    }
  });

  el.unir.addEventListener('click', () => entrar(el.input.value));
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrar(el.input.value);
  });

  el.cambiar.addEventListener('click', () => {
    const resumen = resumirSala(cliente.estado, t);
    cliente.elegirBando(resumen.miBando === 'a' ? 'b' : 'a');
  });

  el.listo.addEventListener('click', () => {
    cliente.listo(!resumirSala(cliente.estado, t).yoListo);
  });

  cliente.on(DICE.sala, pintar);
  cliente.on(DICE.error, (m) => mostrarAviso(m.motivo));
  cliente.on('cerrado', () => mostrarAviso(t('sinConexion')));
  cliente.on(DICE.empezar, (m) => {
    ocultar();
    alEmpezar?.(m);
  });

  function mostrar(codigoPrevio = null) {
    el.panel.classList.add('on');
    if (el.nombre) el.nombre.placeholder = t('tuNombre');
    pintar();
    if (codigoPrevio) {
      el.input.value = codigoPrevio;
      entrar(codigoPrevio);
    }
  }

  function ocultar() {
    el.panel.classList.remove('on');
  }

  return {
    mostrar,
    ocultar,
    pintar,
    /** Deja un aviso a la vista sin cerrar la sala. */
    avisar(texto) {
      el.panel.classList.add('on');
      mostrarAviso(texto);
    },
    ponerNombre(valor) {
      nombre = valor;
    },
  };
}
