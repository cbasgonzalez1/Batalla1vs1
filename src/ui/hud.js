import { MAX_HP } from '../game/combat.js';

/**
 * HUD. Todo el DOM vive aqui para que main.js no toque nunca elementos
 * sueltos; expone metodos con nombre de intencion, no de widget.
 *
 * Las animaciones cortas (barra de vida, rebote de botones) van en CSS con
 * las mismas curvas del motion spec. El temporizador de reaccion se escribe
 * cada cuadro porque tiene que ser exacto: es una ventana de reflejos.
 */
export class Hud {
  constructor(handlers = {}, t = (clave) => clave) {
    // El traductor entra por constructor, como el PRNG: el HUD no decide el
    // idioma, lo recibe ya resuelto.
    this.t = t;

    const $ = (id) => document.getElementById(id);

    this.el = {
      hp: [$('hp-a'), $('hp-b')],
      fill: [$('fill-a'), $('fill-b')],
      ghost: [$('ghost-a'), $('ghost-b')],
      charges: [$('ch-a'), $('ch-b')],
      wind: $('r-wind'),
      windNext: $('r-wind-next'),
      lectura: $('lectura'),
      lfallo: $('l-fallo'),
      larena: $('l-arena'),
      turn: $('r-turn'),
      angle: $('r-angle'),
      power: $('r-power'),
      scout: $('scout'),
      reaction: $('reaction'),
      rbar: $('rbar'),
      rsecs: $('rsecs'),
      shield: $('r-shield'),
      hop: $('r-hop'),
      victory: $('victory'),
      vwho: $('v-who'),
      vstats: $('v-stats'),
      again: $('again'),
      hint: $('hint'),
    };

    this._last = {};

    // Los botones viven dentro del escenario, que escucha pointerdown para
    // apuntar. Sin cortar la propagacion, tocar un boton arrancaria tambien
    // un arrastre de apuntado: secuestraria la camara y dispararia al soltar.
    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };

    // Otear: mantener pulsado. Se cubren puntero y teclado por accesibilidad.
    const scout = this.el.scout;
    const down = (e) => { swallow(e); scout.classList.add('on'); handlers.onScoutStart?.(); };
    const up = () => { scout.classList.remove('on'); handlers.onScoutEnd?.(); };
    scout.addEventListener('pointerdown', down);
    scout.addEventListener('pointerup', up);
    scout.addEventListener('pointercancel', up);
    scout.addEventListener('pointerleave', up);
    scout.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') down(e); });
    scout.addEventListener('keyup', up);
    scout.addEventListener('blur', up);

    this.el.shield.addEventListener('pointerdown', (e) => { swallow(e); handlers.onShield?.(); });
    this.el.hop.addEventListener('pointerdown', (e) => { swallow(e); handlers.onHop?.(); });
    this.el.again.addEventListener('pointerdown', (e) => { swallow(e); handlers.onAgain?.(); });
  }

  setHp(index, hp) {
    if (this._last[`hp${index}`] === hp) return;
    this._last[`hp${index}`] = hp;
    const pct = `${Math.max(0, (hp / MAX_HP) * 100)}%`;
    this.el.fill[index].style.width = pct;
    this.el.ghost[index].style.width = pct;
    this.el.hp[index].textContent = String(Math.ceil(hp));
  }

  setCharges(index, n) {
    if (this._last[`ch${index}`] === n) return;
    this._last[`ch${index}`] = n;
    const pips = this.el.charges[index].children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < n);
  }

  /**
   * Viento de ahora y, en fantasma, el del turno que viene.
   *
   * El pronostico no es una ayuda cosmetica: es lo que convierte el viento en
   * un reloj — "me quedan tres turnos para empujarle arena encima antes de que
   * gire". Se puede enseñar porque el PRNG va sembrado y el valor ya esta
   * calculado, no porque se adivine.
   */
  setWind(wind, siguiente = null) {
    const key = `${wind.toFixed(1)}|${siguiente === null ? '' : siguiente.toFixed(1)}`;
    if (this._last.wind === key) return;
    this._last.wind = key;

    const flecha = (v) => (v > 0.05 ? '→' : v < -0.05 ? '←' : '·');
    this.el.wind.textContent = `${flecha(wind)} ${Math.abs(wind).toFixed(1)}`;

    if (!this.el.windNext) return;
    this.el.windNext.textContent =
      siguiente === null
        ? ''
        : this.t('pronostico', {
            flecha: flecha(siguiente),
            viento: Math.abs(siguiente).toFixed(1),
          });
  }

  /**
   * Medio segundo en grande: cuanto fallaste y que construiste.
   *
   * Los dos numeros juntos, y ese es el punto: un fallo de 19 unidades que le
   * levanta el suelo al rival no es un turno perdido, pero sin decirlo el
   * jugador no tiene forma de saberlo — a 88 unidades no ve nada de eso.
   */
  showLectura(lectura, milisegundos = 1400) {
    if (!this.el.lectura) return;

    this.el.lfallo.textContent = this.t(lectura.sentido, {
      distancia: lectura.distancia.toFixed(1),
    });

    const arena = lectura.arena;
    this.el.larena.textContent = !arena
      ? ''
      : arena.encima
        ? this.t('arenaEncima', { pico: arena.pico.toFixed(1) })
        : this.t('arena', {
            pico: arena.pico.toFixed(1),
            distancia: arena.distancia.toFixed(0),
          });
    this.el.larena.classList.toggle('encima', Boolean(arena?.encima));

    this.el.lectura.classList.add('on');
    clearTimeout(this._lecturaTimer);
    this._lecturaTimer = setTimeout(() => this.el.lectura.classList.remove('on'), milisegundos);
  }

  hideLectura() {
    if (!this.el.lectura) return;
    clearTimeout(this._lecturaTimer);
    this.el.lectura.classList.remove('on');
  }

  setShot(turnLabel, angleDeg, powerPct) {
    this.el.turn.textContent = turnLabel;
    this.el.angle.textContent = `${angleDeg}°`;
    this.el.power.textContent = `${powerPct}%`;
  }

  showReaction(on) {
    this.el.reaction.classList.toggle('on', on);
  }

  /** @param {number} fraction 1 al abrirse, 0 al impactar */
  setReactionTimer(fraction, seconds) {
    this.el.rbar.style.width = `${Math.max(0, fraction) * 100}%`;
    this.el.rsecs.textContent = `${Math.max(0, seconds).toFixed(2)}s`;
  }

  setReactionEnabled(enabled) {
    this.el.shield.disabled = !enabled;
    this.el.hop.disabled = !enabled;
  }

  showVictory(winnerIndex, statsText) {
    const bando = winnerIndex === 0 ? 'A' : 'B';
    this.el.vwho.textContent = this.t('gana', { bando });
    this.el.vwho.className = `who ${winnerIndex === 0 ? 'a' : 'b'}`;
    this.el.vstats.textContent = statsText;
    this.el.victory.classList.add('on');
  }

  hideVictory() {
    this.el.victory.classList.remove('on');
  }

  hideHint() {
    this.el.hint.classList.add('gone');
  }
}
