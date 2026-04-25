const APP_SCROLL_RESTORE_EVENT = 'campus:app-scroll-restore-state';

let _isAppScrollRestoring = false;

function emitAppScrollRestoreState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_SCROLL_RESTORE_EVENT, {
    detail: { restoring: _isAppScrollRestoring },
  }));
}

export function isAppScrollRestoring() {
  return _isAppScrollRestoring;
}

export function setAppScrollRestoring(restoring) {
  const nextValue = Boolean(restoring);
  if (_isAppScrollRestoring === nextValue) return;

  _isAppScrollRestoring = nextValue;

  if (typeof document !== 'undefined') {
    if (nextValue) {
      document.documentElement.dataset.appScrollRestoring = 'true';
    } else {
      delete document.documentElement.dataset.appScrollRestoring;
    }
  }

  emitAppScrollRestoreState();
}

export function subscribeAppScrollRestoreState(listener) {
  if (typeof window === 'undefined') {
    listener({ restoring: _isAppScrollRestoring });
    return () => {};
  }

  const handleStateChange = (event) => {
    listener(event.detail || { restoring: _isAppScrollRestoring });
  };

  window.addEventListener(APP_SCROLL_RESTORE_EVENT, handleStateChange);
  listener({ restoring: _isAppScrollRestoring });

  return () => window.removeEventListener(APP_SCROLL_RESTORE_EVENT, handleStateChange);
}
