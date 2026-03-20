// ===== FILE: SplashScreen.js =====

import React, { useState, useEffect, useRef } from 'react';
import { theme } from '../theme';

const LIME = '#D4FF00';
const BG = theme.colors.premium.bg;
const MANIFEST_SLOT_HEIGHT = 120;

// Длительности: первый запуск (с манифестом) и повторные (только лого)
const DURATION_FIRST = 4000;
const FADE_START_FIRST = 3600;
const DURATION_REPEAT = 1800;
const FADE_START_REPEAT = 1400;

const KEYFRAMES = `
  @keyframes splashLetterPop {
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes splashPopMark {
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes splashPopBadge {
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes splashSlideUpFade {
    from { opacity: 0; margin-top: 20px; }
    to { opacity: 1; margin-top: 0; }
  }
`;

export default function SplashScreen({ onFinished, variant = 'auto' }) {
  const hasSeenSplash = localStorage.getItem('campus-splash-seen') === '1';
  const resolvedVariant = variant === 'auto' ? (hasSeenSplash ? 'repeat' : 'first') : variant;
  const isFirstTime = resolvedVariant === 'first';
  const [isExiting, setIsExiting] = useState(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (variant === 'auto' && isFirstTime) {
      localStorage.setItem('campus-splash-seen', '1');
    }

    const fadeDelay = isFirstTime ? FADE_START_FIRST : FADE_START_REPEAT;
    const doneDelay = isFirstTime ? DURATION_FIRST : DURATION_REPEAT;

    const fadeTimer = setTimeout(() => setIsExiting(true), fadeDelay);
    const doneTimer = setTimeout(() => onFinishedRef.current(), doneDelay);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [isFirstTime, variant]);

  const letters = ['C', 'a', 'm', 'p', 'u', 's'];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          backgroundColor: BG,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isExiting ? 0 : 1,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              position: 'relative',
              marginBottom: isFirstTime ? '2.5rem' : 0,
            }}
          >
            <div
              style={{
                fontSize: '70px',
                fontWeight: 900,
                letterSpacing: '-0.05em',
                lineHeight: 1,
                display: 'flex',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              {letters.map((letter, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    color: '#FFFFFF',
                    opacity: 0,
                    transform: 'translateY(30px) scale(0.95)',
                    animation: `splashLetterPop 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                    animationDelay: `${0.1 + i * 0.05}s`,
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>

            <div
              style={{
                width: '51px',
                height: '51px',
                marginLeft: '14px',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '18px 18px 18px 0px',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  opacity: 0,
                  transform: 'scale(0.8) translateY(10px)',
                  transformOrigin: 'left bottom',
                  animation: 'splashPopMark 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: '0.5s',
                }}
              />
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: LIME,
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  opacity: 0,
                  transform: 'scale(0)',
                  boxShadow: `0 0 0 4px ${BG}`,
                  zIndex: 10,
                  animation: 'splashPopBadge 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                  animationDelay: '0.65s',
                }}
              />
            </div>
          </div>

          {isFirstTime && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: `${MANIFEST_SLOT_HEIGHT}px`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  textAlign: 'center',
                  maxWidth: '320px',
                  margin: '0 auto',
                  padding: '0 1rem',
                  opacity: 0,
                  marginTop: '20px',
                  animation: 'splashSlideUpFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: '1.2s',
                }}
              >
                <p
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    color: '#A1A1AA',
                    fontWeight: 400,
                    margin: 0,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    WebkitFontSmoothing: 'antialiased',
                  }}
                >
                  Глобальная сеть студентов.{' '}
                  <span style={{ color: '#FFFFFF', fontWeight: 500 }}>Campus</span>{' '}
                  стирает границы между вузами и факультетами. Здесь{' '}
                  <span style={{ color: LIME }}>ваши связи строят ваше будущее</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
