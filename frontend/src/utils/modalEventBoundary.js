export const MODAL_EVENT_BOUNDARY_ATTR = 'data-modal-event-boundary';
export const MODAL_EVENT_BOUNDARY_SELECTOR = `[${MODAL_EVENT_BOUNDARY_ATTR}="true"]`;

export const modalBoundaryProps = {
  [MODAL_EVENT_BOUNDARY_ATTR]: 'true',
  'data-no-edge-swipe': 'true',
};

const stopEventPropagation = (event) => {
  event.stopPropagation();
};

export const modalTouchBoundaryHandlers = {
  onTouchStart: stopEventPropagation,
  onTouchMove: stopEventPropagation,
  onTouchEnd: stopEventPropagation,
  onTouchCancel: stopEventPropagation,
};

export const isEventFromModalBoundary = (event) =>
  Boolean(event?.target?.closest?.(MODAL_EVENT_BOUNDARY_SELECTOR));

export const isBodyGestureLocked = () => {
  if (typeof document === 'undefined') return false;
  const { body } = document;
  return body.style.overflow === 'hidden' || body.style.position === 'fixed';
};

export const shouldIgnoreBackgroundGesture = (event) =>
  isEventFromModalBoundary(event) || isBodyGestureLocked();
