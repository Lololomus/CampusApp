// ===== FILE: src/utils/bodyScrollLock.js =====
// Счётчик для вложенных модалок: lock/unlock только при первом/последнем вызове

let _lockCount = 0;
let _savedScrollY = 0;
let _savedBodyStyle = null;
let _savedHtmlOverflow = '';

export function lockBodyScroll() {
  if (_lockCount === 0) {
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
  }
  _lockCount++;
}

export function unlockBodyScroll() {
  if (_lockCount <= 0) return;
  _lockCount--;
  if (_lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    const restoreScrollY = _savedScrollY;

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
    window.scrollTo(0, restoreScrollY);
  }
}
