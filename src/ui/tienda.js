import { claro, contorno, oscuro } from '../art/vehiculo/paleta.js';

/**
 * La tienda de camuflajes y la vitrina del jugador.
 *
 * ── LA MUESTRA SE PINTA CON LA PALETA DEL JUEGO ─────────────────────────
 * Un camuflaje es UN color, y de el se calculan el contorno y las bandas de
 * sombra del vehiculo. La muestra usa esas mismas funciones —`claro`, `oscuro` y
 * `contorno` de `art/vehiculo/paleta.js`— en vez de inventarse un borde bonito:
 * asi lo que se ve en la tienda es lo que se vera en el campo. Una tienda que
 * enseña otra cosa vende devoluciones.
 *
 * ── EL PAGO NO EXISTE TODAVIA ───────────────────────────────────────────
 * El servidor manda `comprable: false` en todo y `pagoActivo: false`, y la
 * pantalla lo dice sin disimular. Enseñar el catalogo antes de montar la caja es
 * a proposito: es lo que dira si merece la pena montarla (`PLATAFORMA.md` §2).
 */

/** El catalogo partido por bandos, en el orden en que llega. Pura. */
export function agruparCatalogo(camuflajes = []) {
  return {
    a: camuflajes.filter((c) => c.bando === 'a'),
    b: camuflajes.filter((c) => c.bando === 'b'),
  };
}

/** Precio en euros, o el texto de «ya es tuyo». Pura. */
export function etiquetaDe(camuflaje, t) {
  if (camuflaje.tengo) return t('enTuGaraje');
  if (!camuflaje.centimos) return t('deSerie');
  return `${(camuflaje.centimos / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * La vitrina, en cuatro cifras. Pura.
 *
 * Sin progreso —recien registrado— devuelve la lista con ceros y no un hueco:
 * una vitrina vacia se entiende, una pantalla a medias no.
 */
export function resumirProgreso(progreso, t) {
  const p = progreso ?? {};
  const disparos = Number(p.disparos ?? 0);
  const aciertos = Number(p.aciertos ?? 0);
  return [
    { que: t('partidasJugadas'), cuanto: String(Number(p.partidas ?? 0)) },
    { que: t('partidasGanadas'), cuanto: String(Number(p.ganadas ?? 0)) },
    { que: t('punteria'), cuanto: disparos ? `${Math.round((aciertos / disparos) * 100)} %` : '—' },
    { que: t('mejorImpacto'), cuanto: String(Number(p.mejor_impacto ?? 0)) },
  ];
}

export function crearTienda({ cuenta, t, alCambiar, documento = document }) {
  const $ = (id) => documento.getElementById(id);
  const el = {
    panel: $('tienda'),
    listas: { a: $('t-lista-a'), b: $('t-lista-b') },
    vitrina: $('t-vitrina'),
    cerrar: $('t-cerrar'),
    aviso: $('t-aviso'),
    quien: $('t-quien'),
    salir: $('t-salir'),
  };
  if (!el.panel) return null;

  function muestra(base) {
    const chip = documento.createElement('i');
    chip.className = 'muestra';
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
    // Tres tonos y contorno: exactamente lo que hace el material del vehiculo.
    chip.style.background = `linear-gradient(160deg, ${hex(claro(base))} 0 46%, ${hex(base)} 46% 74%, ${hex(oscuro(base))} 74%)`;
    chip.style.borderColor = hex(contorno(base));
    return chip;
  }

  function tarjeta(c) {
    const li = documento.createElement('li');
    li.className = `camu${c.tengo ? ' tengo' : ''}`;
    const elegido = cuenta.estado.jugador?.camuflajes?.[c.bando] === c.id;
    if (elegido) li.classList.add('puesto');

    li.append(muestra(c.base));

    const texto = documento.createElement('div');
    texto.className = 'datos';
    const nombre = documento.createElement('b');
    nombre.textContent = c.nombre;
    const pie = documento.createElement('span');
    pie.textContent = elegido ? t('enUso') : etiquetaDe(c, t);
    texto.append(nombre, pie);
    li.append(texto);

    const boton = documento.createElement('button');
    boton.type = 'button';
    if (c.tengo) {
      boton.textContent = elegido ? t('enUso') : t('usar');
      boton.disabled = elegido;
      boton.addEventListener('click', () => usar(c));
    } else {
      // Sin caja no hay compra, y la pantalla no finge que la hay.
      boton.textContent = t('proximamente');
      boton.disabled = true;
      boton.classList.add('flojo');
    }
    li.append(boton);
    return li;
  }

  async function usar(c) {
    const r = await cuenta.elegirCamuflaje(c.bando, c.id);
    if (!r.ok) {
      el.aviso.textContent = r.error === 'sinRed' ? t('sinRed') : r.error;
      return;
    }
    el.aviso.textContent = '';
    await pintar();
    alCambiar?.(r.camuflajes);
  }

  async function pintar() {
    el.quien.textContent = cuenta.estado.jugador?.nombre ?? '';
    const r = await cuenta.tienda();
    if (!r.ok) {
      el.aviso.textContent = t('sinRed');
      return;
    }
    const grupos = agruparCatalogo(r.camuflajes);
    for (const bando of ['a', 'b']) {
      el.listas[bando].textContent = '';
      for (const c of grupos[bando]) el.listas[bando].append(tarjeta(c));
    }

    el.vitrina.textContent = '';
    for (const { que, cuanto } of resumirProgreso(cuenta.estado.progreso, t)) {
      const caja = documento.createElement('div');
      const cifra = documento.createElement('b');
      cifra.textContent = cuanto;
      const nombre = documento.createElement('span');
      nombre.textContent = que;
      caja.append(cifra, nombre);
      el.vitrina.append(caja);
    }
  }

  el.cerrar.addEventListener('click', () => api.cerrar());
  el.salir.addEventListener('click', async () => {
    await cuenta.salir();
    api.cerrar();
    alCambiar?.(null, { salio: true });
  });

  const api = {
    async abrir() {
      el.panel.classList.add('on');
      el.aviso.textContent = '';
      await cuenta.recuperar();
      await pintar();
    },
    cerrar() {
      el.panel.classList.remove('on');
    },
    get visible() {
      return el.panel.classList.contains('on');
    },
  };
  return api;
}
