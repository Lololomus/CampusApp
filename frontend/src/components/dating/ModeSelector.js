import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../../store';

const MODES = [
  { id: 'dating', icon: '💜', label: 'Знакомства', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'study', icon: '📚', label: 'Учёба', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'help', icon: '🤝', label: 'Помощь', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'hangout', icon: '🎉', label: 'Движ', gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
];

function ModeSelector() {
  const { datingMode, setDatingMode } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentMode = MODES.find(m => m.id === datingMode) || MODES[0];

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  };

  const handleSelect = (modeId) => {
    setDatingMode(modeId);
    setIsOpen(false);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  };

  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.container}>
        {/* Пилюля */}
        <button
          onClick={handleToggle}
          style={{
            ...styles.pill,
            background: currentMode.gradient,
            transform: isOpen ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          <span style={styles.icon}>{currentMode.icon}</span>
          <span style={styles.label}>{currentMode.label}</span>
          <ChevronDown
            size={18}
            style={{
              ...styles.arrow,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {/* Overlay */}
        {isOpen && (
          <div style={styles.overlay} onClick={() => setIsOpen(false)} />
        )}

        {/* Dropdown */}
        {isOpen && (
          <div style={styles.dropdown}>
            {MODES.map((mode, index) => (
              <button
                key={mode.id}
                onClick={() => handleSelect(mode.id)}
                style={{
                  ...styles.dropdownItem,
                  animationDelay: `${index * 50}ms`,
                  background: mode.id === datingMode 
                    ? `linear-gradient(90deg, ${mode.gradient.match(/#[0-9a-f]{6}/gi)[0]}15, transparent)` 
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  const gradient = MODES.find(m => m.id === mode.id).gradient;
                  const color = gradient.match(/#[0-9a-f]{6}/gi)[0];
                  e.currentTarget.style.background = mode.id === datingMode 
                    ? `linear-gradient(90deg, ${color}25, transparent)` 
                    : `rgba(255, 255, 255, 0.05)`;
                }}
                onMouseLeave={(e) => {
                  const gradient = MODES.find(m => m.id === mode.id).gradient;
                  const color = gradient.match(/#[0-9a-f]{6}/gi)[0];
                  e.currentTarget.style.background = mode.id === datingMode 
                    ? `linear-gradient(90deg, ${color}15, transparent)` 
                    : 'transparent';
                }}
              >
                <span style={styles.dropdownIcon}>{mode.icon}</span>
                <span style={styles.dropdownLabel}>{mode.label}</span>
                {mode.id === datingMode && (
                  <span style={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const keyframes = `
  @keyframes dropdownAppear {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px) scale(0.95);
    }
    60% {
      transform: translateX(-50%) translateY(2px) scale(1.02);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }

  @keyframes itemStagger {
    0% {
      opacity: 0;
      transform: translateX(-10px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const styles = {
  container: {
    position: 'relative',
    zIndex: 100,
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '24px',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    minWidth: '160px',
    justifyContent: 'center',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  icon: {
    fontSize: '18px',
  },
  label: {
    fontWeight: '600',
  },
  arrow: {
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 98,
    animation: 'fadeIn 0.2s ease',
  },

  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '8px',
    minWidth: '200px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(135, 116, 225, 0.15)', // ← Тонкое фиолетовое свечение
    border: '1px solid rgba(135, 116, 225, 0.2)', // ← Тонкая фиолетовая рамка
    animation: 'dropdownAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    zIndex: 99,
    transformOrigin: 'top center',
  },

  dropdownItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    width: '100%',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    cursor: 'pointer',
    borderRadius: '12px',
    transition: 'background 0.2s ease',
    textAlign: 'left',
    animation: 'itemStagger 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    opacity: 0,
  },

  dropdownIcon: {
    fontSize: '20px',
  },
  dropdownLabel: {
    flex: 1,
    fontWeight: '500',
  },
  checkmark: {
    color: '#8774e1',
    fontSize: '18px',
    fontWeight: 'bold',
  },
};

export default ModeSelector;