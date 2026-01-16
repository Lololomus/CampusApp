// ===== 📄 ФАЙЛ: frontend/src/theme.js (ПОЛНОСТЬЮ ОБНОВЛЁННЫЙ) =====

export const theme = {
  // ========== COLORS ==========
  colors: {
    // Основные (Main App)
    primary: '#8774e1',
    primaryHover: '#7664d0',
    primaryLight: 'rgba(135, 116, 225, 0.1)',
    primaryGlow: 'rgba(135, 116, 225, 0.3)',
    
    accent: '#ff3b5c',
    accentHover: '#ff527a',
    
    // Dating палитра (специальная для знакомств)
    dating: {
      primary: '#ff3b5c',
      primaryHover: '#ff527a',
      secondary: '#ff6b9d',
      gradient: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
      light: 'rgba(255, 59, 92, 0.1)',
      glow: 'rgba(255, 59, 92, 0.3)',
    },
    
    // Фоны
    bg: '#121212',           // Основной фон
    bgSecondary: '#1a1a1a',  // Вторичный фон
    card: '#1e1e1e',         // Карточки
    cardHover: '#2a2a2a',    // Карточки при hover
    elevated: '#252525',     // Модалки, elevated элементы
    
    // Текст
    text: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    textDisabled: '#666666',
    textInverted: '#0a0a0a',
    
    // Границы
    border: '#333333',
    borderLight: '#2a2a2a',
    borderFocus: '#8774e1',
    borderDating: '#ff3b5c',
    
    // Категории постов
    news: '#3b82f6',
    events: '#f59e0b',
    confessions: '#ec4899',
    lostFound: '#10b981',
    
    // Market
    market: '#10b981',
    marketGradientStart: '#059669',
    marketGradientEnd: '#10b981',
    
    // Статусы
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#64c8ff',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayDark: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    
    // Градиенты (для основного приложения)
    gradientStart: '#667eea',
    gradientEnd: '#764ba2',
  },

  // ========== TYPOGRAPHY ==========
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: 20,
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body: {
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.5,
    },
    bodyLarge: {
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.5,
    },
    bodySmall: {
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.4,
    },
    caption: {
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.4,
    },
    button: {
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1,
    },
    buttonLarge: {
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 1,
    },
  },

  // ========== SPACING ==========
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // ========== BORDER RADIUS ==========
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  // ========== FONT SIZE (legacy, используй typography) ==========
  fontSize: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
  },

  // ========== FONT WEIGHT ==========
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // ========== SHADOWS ==========
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
    md: '0 4px 12px rgba(0, 0, 0, 0.15)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.2)',
    xl: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },

  // ========== TRANSITIONS ==========
  transitions: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },

  // ========== ANIMATIONS ==========
  animations: {
    duration: {
      instant: 100,    // 0.1s
      fast: 200,       // 0.2s
      normal: 300,     // 0.3s
      slow: 500,       // 0.5s
      slower: 700,     // 0.7s
    },
    easing: {
      default: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },

  // ========== ICON SIZES ==========
  iconSizes: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
  },

  // ========== TOUCH TARGETS (Mobile-first) ==========
  touchTargets: {
    min: 44,         // Минимальный размер по Apple HIG
    comfortable: 48, // Комфортный размер
    large: 56,       // Большой размер (primary actions)
  },

  // ========== LAYOUT ==========
  layout: {
    headerHeight: 56,
    tabBarHeight: 60,
    safeAreaBottom: 20, // Для iPhone с notch
    maxContentWidth: 600, // Максимальная ширина контента
  },

  // ========== Z-INDEX (базовые слои) ==========
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 100,
    overlay: 1000,
    modal: 2000,
    toast: 10000,
  },
};

export default theme;