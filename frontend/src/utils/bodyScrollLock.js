// ===== FILE: src/utils/bodyScrollLock.js =====
// Счётчик для вложенных модалок: lock/unlock только при первом/последнем вызове

let _lockCount = 0;
let _savedBodyOverflow = '';
let _savedHtmlOverflow = '';
let _savedBodyPosition = '';
let _savedBodyTop = '';
let _savedBodyLeft = '';
let _savedBodyRight = '';
let _savedBodyWidth = '';
let _savedHtmlScrollBehavior = '';
let _savedScrollY = 0;
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
    _savedBodyPosition = body.style.position;
    _savedBodyTop = body.style.top;
    _savedBodyLeft = body.style.left;
    _savedBodyRight = body.style.right;
    _savedBodyWidth = body.style.width;
    _savedHtmlScrollBehavior = html.style.scrollBehavior;
    _savedScrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);

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

    if (restoreGuard) {
      markRestoringScroll();
    } else {
      clearRestoreMarkers();
      _isRestoringScroll = false;
      delete document.documentElement.dataset.bodyScrollRestoring;
    }

    html.style.overflow = _savedHtmlOverflow;
    body.style.overflow = _savedBodyOverflow;
    body.style.position = _savedBodyPosition;
    body.style.top = _savedBodyTop;
    body.style.left = _savedBodyLeft;
    body.style.right = _savedBodyRight;
    body.style.width = _savedBodyWidth;

    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, _savedScrollY);
    html.style.scrollBehavior = _savedHtmlScrollBehavior;

    _savedHtmlOverflow = '';
    _savedBodyOverflow = '';
    _savedBodyPosition = '';
    _savedBodyTop = '';
    _savedBodyLeft = '';
    _savedBodyRight = '';
    _savedBodyWidth = '';
    _savedHtmlScrollBehavior = '';
    _savedScrollY = 0;
    delete document.documentElement.dataset.bodyScrollLocked;

    if (!restoreGuard) emitBodyScrollState();
  }
}
