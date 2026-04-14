// ===== 📄 ФАЙЛ: frontend/src/theme.js =====

const PREMIUM_GRAPHITE = 'rgba(28, 28, 30, 0.5)';
const LEGACY_PREMIUM_SURFACE_ELEVATED = '#1C1C1E'; // legacy

export const theme = {
  // ========== COLORS ==========
  colors: {
    // #New Premium palette
    premium: {
      bg: '#000000',
      primary: '#D4FF00',
      primaryText: '#000000',
      graphite: PREMIUM_GRAPHITE,
      surfaceElevated: PREMIUM_GRAPHITE,
      legacySurfaceElevated: LEGACY_PREMIUM_SURFACE_ELEVATED,
      surfaceHover: '#2C2C2E',
      border: 'rgba(255, 255, 255, 0.08)',
      textMuted: '#888888',
      textBody: '#D1D1D1',
      tagColors: {
        news:        { color: '#4DA6FF', bg: 'rgba(77, 166, 255, 0.15)' },
        memes:       { color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)' },
        events:      { color: '#00C7BE', bg: 'rgba(0, 199, 190, 0.15)' },
        confessions: { color: '#FF4D4D', bg: 'rgba(255, 77, 77, 0.15)' },
        lostFound:   { color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' },
        help:        { color: '#FF6B6B', bg: 'rgba(255, 107, 107, 0.15)' },
      },
    },

    // #Legacy style — Основные (Main App)
    primary: '#8774e1',
    primaryHover: '#7664d0',
    primaryLight: 'rgba(135, 116, 225, 0.1)',
    primaryGlow: 'rgba(135, 116, 225, 0.3)',
    
    accent: '#ff3b5c',
    accentHover: '#ff527a',
    
    // Dating палитра
    dating: {
      primary: '#ff3b5c',
      primaryHover: '#ff527a',
      secondary: '#ff6b9d',
      action: '#ff6b9d',
      actionHover: '#ff82b0',
      gradient: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
      actionGradient: 'linear-gradient(135deg, #ff6b9d 0%, #f093fb 100%)',
      light: 'rgba(255, 59, 92, 0.1)',
      glow: 'rgba(255, 59, 92, 0.3)',
      actionGlow: 'rgba(255, 107, 157, 0.35)',
      // Новые токены из мок-дизайна
      accent: '#D4FF00',
      accentText: '#000000',
      pink: '#FF2D55',
      pinkGlow: 'rgba(255, 45, 85, 0.3)',
      surface: LEGACY_PREMIUM_SURFACE_ELEVATED,
      surfaceHover: '#2C2C2E',
      cardBg: '#121212',
      textMuted: '#8E8E93',
      textLight: '#EAEAEA',
      onlineDot: '#32D74B',
      commonBg: 'rgba(212, 255, 0, 0.15)',
      commonBorder: 'rgba(212, 255, 0, 0.4)',
      commonGlow: '0 0 8px rgba(212, 255, 0, 0.15)',
    },
    
    // Фоны
    bg: '#121212',
    bgSecondary: '#1a1a1a',
    card: '#1e1e1e',
    cardHover: '#2a2a2a',
    elevated: '#252525',
    
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
    memes: '#f97316',
    events: '#00C7BE',
    confessions: '#ec4899',
    lostFound: '#10b981',
    help: '#FF6B6B',
    
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
    overlayDark: 'rgba(0, 0, 0, 0.75)', // ✅ Увеличена непрозрачность
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    
    // Градиенты
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

  // ========== FONT SIZE ==========
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
    ui: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    enter: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    exit: '0.15s ease-out',
  },

  // ========== ANIMATIONS ==========
  animations: {
    duration: {
      instant: 100,
      fast: 200,
      normal: 300,
      slow: 500,
      slower: 700,
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

  // ========== TOUCH TARGETS ==========
  touchTargets: {
    min: 44,
    comfortable: 48,
    large: 56,
  },

  // ========== LAYOUT ==========
  layout: {
    headerHeight: 56,
    tabBarHeight: 60,
    safeAreaBottom: 20,
    maxContentWidth: 680,
  },

  // ========== MODALS ==========
  modals: {
    backdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)', // ✅ БЕЗ backdrop-filter!
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    content: {
      width: '100%',
      maxWidth: '600px',
      backgroundColor: '#121212',
      borderTopLeftRadius: '20px',
      borderTopRightRadius: '20px',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
    },
    dragHandle: {
      width: '40px',
      height: '4px',
      backgroundColor: '#333333',
      borderRadius: '2px',
      margin: '0 auto 16px auto',
    },
  },

  // ========== Z-INDEX ==========
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
