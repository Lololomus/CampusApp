// ===== FILE: LinkText.js =====
// Компонент для рендера текста с кликабельными внешними ссылками.
// Ссылки подсвечиваются лаймом, при клике — предупреждение через ConfirmationDialog.

import React, { useState, useCallback, Fragment } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import theme from '../../theme';

const URL_REGEX = /((https?:\/\/)[^\s<>"')\]]+)/gi;

function LinkText({ text, style }) {
  const [pendingUrl, setPendingUrl] = useState(null);

  const stopEvent = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleLinkClick = useCallback((e, url) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingUrl(url);
  }, []);

  const handleLinkKeyDown = useCallback((e, url) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleLinkClick(e, url);
    }
  }, [handleLinkClick]);

  const handleConfirm = useCallback(() => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
    setPendingUrl(null);
  }, [pendingUrl]);

  const handleCancel = useCallback(() => {
    setPendingUrl(null);
  }, []);

  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'link', value: match[0] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  const hasLinks = parts.some(p => p.type === 'link');
  if (!hasLinks) {
    return <span style={style}>{text}</span>;
  }

  return (
    <>
      <span style={style}>
        {parts.map((part, i) =>
          part.type === 'link' ? (
            <span
              key={i}
              onClick={(e) => handleLinkClick(e, part.value)}
              onMouseDown={stopEvent}
              onTouchStart={stopEvent}
              onPointerDown={stopEvent}
              onKeyDown={(e) => handleLinkKeyDown(e, part.value)}
              style={linkStyle}
              role="link"
              tabIndex={0}
            >
              {part.value}
            </span>
          ) : (
            <Fragment key={i}>{part.value}</Fragment>
          )
        )}
      </span>

      <ConfirmationDialog
        isOpen={!!pendingUrl}
        title="Внешняя ссылка"
        message={`Вы переходите на внешний сайт. Мы не несём ответственности за его содержимое — будьте осторожны.\n\n${pendingUrl || ''}`}
        confirmText="Перейти"
        cancelText="Отмена"
        confirmType="primary"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

const linkStyle = {
  color: theme.colors.premium.primary,
  textDecoration: 'underline',
  textDecorationColor: 'rgba(212, 255, 0, 0.4)',
  cursor: 'pointer',
  wordBreak: 'break-all',
};

export default React.memo(LinkText);
