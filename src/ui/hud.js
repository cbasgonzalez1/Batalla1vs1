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
  constructor(handlers = {}) {
    const $ = (id) => document.getElementById(id);

    this.el = {
      hp: [$('hp-a'), $('hp-b')],
      fill: [$('fill-a'), $('fill-b')],
      ghost: [$('ghost-a'), $('ghost-b')],
      charges: [$('ch-a'), $('ch-b')],
      wind: $('r-wind'),
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

  setWind(wind) {
    const key = wind.toFixed(1);
    if (this._last.wind === key) return;
    this._last.wind = key;
    const arrow = wind >= 0 ? '→' : '←';
    this.el.wind.textContent = `${arrow} ${Math.abs(wind).toFixed(1)}`;
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
    this.el.vwho.textContent = winnerIndex === 0 ? 'Gana A' : 'Gana B';
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
