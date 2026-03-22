// ===== FILE: src/utils/bodyScrollLock.js =====
// Счётчик для вложенных модалок: lock/unlock только при первом/последнем вызове

let _lockCount = 0;
let _savedScrollY = 0;

export function lockBodyScroll() {
  if (_lockCount === 0) {
    _savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
  }
  _lockCount++;
}

export function unlockBodyScroll() {
  if (_lockCount <= 0) return;
  _lockCount--;
  if (_lockCount === 0) {
    document.body.style.overflow = '';
    window.scrollTo(0, _savedScrollY);
  }
}
