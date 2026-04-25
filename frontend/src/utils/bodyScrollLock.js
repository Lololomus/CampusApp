// ===== FILE: src/utils/bodyScrollLock.js =====
// Счётчик для вложенных модалок: lock/unlock только при первом/последнем вызове

let _lockCount = 0;
let _savedBodyOverflow = '';
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

    _savedHtmlOverflow = html.style.overflow;
    _savedBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
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

    if (restoreGuard) {
      markRestoringScroll();
    } else {
      clearRestoreMarkers();
      _isRestoringScroll = false;
      delete document.documentElement.dataset.bodyScrollRestoring;
    }

    html.style.overflow = _savedHtmlOverflow;
    body.style.overflow = _savedBodyOverflow;

    _savedHtmlOverflow = '';
    _savedBodyOverflow = '';
    delete document.documentElement.dataset.bodyScrollLocked;

    if (!restoreGuard) emitBodyScrollState();
  }
}
