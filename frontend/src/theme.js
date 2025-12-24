// src/theme.js
export const theme = {
  colors: {
    // Основные
    primary: '#8774e1',
    primaryHover: '#7664d0',
    accent: '#ff3b5c',
    accentHover: '#ff527a',
    
    // Фоны
    bg: '#121212',
    bgSecondary: '#1a1a1a',
    card: '#1e1e1e',
    cardHover: '#2a2a2a',
    
    // Текст
    text: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    textDisabled: '#666666',
    
    // Границы
    border: '#333333',
    borderLight: '#2a2a2a',
    
    // Категории
    news: '#3b82f6',
    events: '#f59e0b',
    confessions: '#ec4899',
    lostFound: '#10b981',
    
    // Статусы
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',

    // ProfileCard:
    info: '#64c8ff',           // Для цветных тегов
    overlay: 'rgba(0,0,0,0.5)', // Для теней
  
    // Градиенты
    gradientStart: '#667eea',
    gradientEnd: '#764ba2',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  
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
  
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.1)',
    md: '0 4px 12px rgba(0,0,0,0.15)',
    lg: '0 8px 24px rgba(0,0,0,0.2)',
  },
  
  transitions: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
  
  zIndex: {
    base: 0,
    dropdown: 10,
    modal: 100,
    overlay: 1000,
    toast: 10000,
  },
};

export default theme;