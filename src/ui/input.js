import { clamp } from '../core/mathx.js';

/**
 * Control a un pulgar: arrastrar y soltar, tipo tirachinas.
 *
 * Se arrastra HACIA ATRAS: la direccion de disparo es la opuesta al vector de
 * arrastre y la potencia es su longitud. Se puede empezar el arrastre en
 * cualquier punto de la pantalla, no hay que acertarle al canon: en vertical y
 * con una mano, obligar a tocar un objeto pequeno arruina el control.
 *
 * Con dos dedos se entra en modo pellizco para el zoom. Al hacerlo se aborta
 * el arrastre en curso y se marca la secuencia como "no disparable", para que
 * levantar un dedo despues de un pellizco no dispare por accidente.
 */

const MAX_DRAG_PX = 240; // arrastre que equivale a potencia 1

export function attachDragControl(element, handlers) {
  const pointers = new Map();
  let dragId = null;
  let startX = 0;
  let startY = 0;
  let pinchBase = 0;
  let suppressed = false;

  const dragScale = () => {
    // El arrastre se mide en px de CSS del propio elemento, asi que el control
    // se siente igual en un movil de 360 px que en un monitor.
    const r = element.getBoundingClientRect();
    return MAX_DRAG_PX * (r.height / 1920);
  };

  function toAim(dx, dy) {
    // pantalla: +x derecha, +y abajo. mundo: +x derecha, +y arriba.
    // tirachinas -> el disparo va al contrario del arrastre.
    const len = Math.hypot(dx, dy);
    const power = clamp(len / dragScale(), 0, 1);
    // Sin arrastre util no hay direccion fiable; que lo decida quien llama.
    const angle = len < 6 ? null : Math.atan2(dy, -dx);
    return { angle, power, len };
  }

  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function onDown(e) {
    // La captura puede fallar si el puntero se solto entre el evento y el
    // manejador. No es motivo para abortar el arrastre: sin el try/catch la
    // excepcion dejaria el control a medio montar y sin forma de recuperarse.
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      /* seguimos sin captura: los eventos llegan igual mientras no salga */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      dragId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      suppressed = false;
      handlers.onStart?.();
    } else if (pointers.size === 2) {
      // Segundo dedo: se abandona el apuntado y se pasa a zoom.
      dragId = null;
      suppressed = true;
      pinchBase = pinchDistance();
      handlers.onCancel?.();
      handlers.onPinchStart?.();
    }
  }

  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size >= 2) {
      if (pinchBase > 0) handlers.onPinch?.(pinchDistance() / pinchBase);
      return;
    }
    if (e.pointerId !== dragId) return;
    handlers.onDrag?.(toAim(e.clientX - startX, e.clientY - startY));
  }

  function finish(e, cancelled) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try {
      element.releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero ya se solto solo */
    }

    if (pointers.size < 2) pinchBase = 0;

    if (e.pointerId !== dragId) {
      // Se levanta un dedo del pellizco: no se dispara, pero si quedaba uno
      // solo hay que dejar el apuntado inerte hasta que se suelte del todo.
      if (pointers.size === 0) { dragId = null; suppressed = false; }
      return;
    }

    dragId = null;
    if (cancelled || suppressed) {
      handlers.onCancel?.();
    } else {
      handlers.onRelease?.(toAim(e.clientX - startX, e.clientY - startY));
    }
    if (pointers.size === 0) suppressed = false;
  }

  const onUp = (e) => finish(e, false);
  const onCancel = (e) => finish(e, true);

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onCancel);
  element.addEventListener('contextmenu', (e) => e.preventDefault());

  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
  };
}
