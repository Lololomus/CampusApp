// ===== FILE: src/utils/bodyScrollLock.js =====
// Счётчик для вложенных модалок: lock/unlock только при первом/последнем вызове

let _lockCount = 0;
let _savedScrollY = 0;
let _savedBodyStyle = null;
let _savedHtmlOverflow = '';
let _isRestoringScroll = false;
let _restoreFrameId = null;
let _restoreTimeoutId = null;

const BODY_SCROLL_STATE_EVENT = 'campus:body-scroll-state';
const RESTORE_GUARD_MS = 360;

function getBodyScrollState() {
  return {
    locked: _lockCount > 0,
    restoring: _isRestoringScroll,
  };
}

function emitBodyScrollState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BODY_SCROLL_STATE_EVENT, { detail: getBodyScrollState() }));
}

function clearRestoreMarkers() {
  if (_restoreFrameId) {
    window.cancelAnimationFrame(_restoreFrameId);
    _restoreFrameId = null;
  }
  if (_restoreTimeoutId) {
    window.clearTimeout(_restoreTimeoutId);
    _restoreTimeoutId = null;
  }
}

function markRestoringScroll() {
  clearRestoreMarkers();
  _isRestoringScroll = true;
  document.documentElement.dataset.bodyScrollRestoring = 'true';

  const finish = () => {
    _isRestoringScroll = false;
    delete document.documentElement.dataset.bodyScrollRestoring;
    clearRestoreMarkers();
    emitBodyScrollState();
  };

  _restoreTimeoutId = window.setTimeout(finish, RESTORE_GUARD_MS);
  emitBodyScrollState();
}

export function isBodyScrollRestoring() {
  return _isRestoringScroll;
}

export function isBodyScrollLocked() {
  return _lockCount > 0;
}

export function subscribeBodyScrollState(listener) {
  const handleStateChange = (event) => {
    listener(event.detail || getBodyScrollState());
  };

  window.addEventListener(BODY_SCROLL_STATE_EVENT, handleStateChange);
  listener(getBodyScrollState());

  return () => window.removeEventListener(BODY_SCROLL_STATE_EVENT, handleStateChange);
}

export function lockBodyScroll() {
  if (_lockCount === 0) {
    clearRestoreMarkers();
    _isRestoringScroll = false;
    delete document.documentElement.dataset.bodyScrollRestoring;

    const body = document.body;
    const html = document.documentElement;

    _savedScrollY = window.scrollY || window.pageYOffset || 0;
    _savedHtmlOverflow = html.style.overflow;
    _savedBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${_savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    document.documentElement.dataset.bodyScrollLocked = 'true';
  }
  _lockCount++;
  if (_lockCount === 1) emitBodyScrollState();
}

export function unlockBodyScroll(options = {}) {
  const { restoreGuard = true } = options;
  if (_lockCount <= 0) return;
  _lockCount--;
  if (_lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const restoreScrollY = _savedScrollY;
    const previousHtmlScrollBehavior = html.style.scrollBehavior;
    const previousBodyScrollBehavior = body.style.scrollBehavior;

    if (restoreGuard) {
      markRestoringScroll();
    } else {
      clearRestoreMarkers();
      _isRestoringScroll = false;
      delete document.documentElement.dataset.bodyScrollRestoring;
    }
    html.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';
    html.style.overflow = _savedHtmlOverflow;

    if (_savedBodyStyle) {
      body.style.overflow = _savedBodyStyle.overflow;
      body.style.position = _savedBodyStyle.position;
      body.style.top = _savedBodyStyle.top;
      body.style.left = _savedBodyStyle.left;
      body.style.right = _savedBodyStyle.right;
      body.style.width = _savedBodyStyle.width;
    } else {
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
    }

    _savedBodyStyle = null;
    _savedHtmlOverflow = '';
    delete document.documentElement.dataset.bodyScrollLocked;
    window.scrollTo(0, restoreScrollY);
    html.style.scrollBehavior = previousHtmlScrollBehavior;
    body.style.scrollBehavior = previousBodyScrollBehavior;
    if (!restoreGuard) emitBodyScrollState();
  }
}
