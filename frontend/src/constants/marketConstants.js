// ===== FILE: marketConstants.js =====
// Общие константы для CreateMarketItem и EditMarketItemModal

export const MARKET_CATEGORIES = [
  { id: 'textbooks',   label: 'Учебники',  icon: '📚', type: 'product' },
  { id: 'electronics', label: 'Техника',   icon: '💻', type: 'product' },
  { id: 'clothing',    label: 'Одежда',    icon: '👕', type: 'product' },
  { id: 'dorm',        label: 'Общага',    icon: '🛋️', type: 'product' },
  { id: 'hobby',       label: 'Хобби',     icon: '🎸', type: 'product' },
  { id: 'other_g',     label: 'Другое',    icon: '📦', type: 'product' },
  { id: 'tutor',       label: 'Репетитор', icon: '👨‍🏫', type: 'service' },
  { id: 'homework',    label: 'Курсачи',   icon: '📝', type: 'service' },
  { id: 'repair',      label: 'Ремонт',    icon: '🛠️', type: 'service' },
  { id: 'design',      label: 'Дизайн',    icon: '🎨', type: 'service' },
  { id: 'delivery',    label: 'Курьер',    icon: '🏃', type: 'service' },
  { id: 'other_s',     label: 'Другое',    icon: '✨', type: 'service' },
];

export const MARKET_CATEGORIES_MAP = {
  textbooks:   { label: 'Учебники',  icon: '📚' },
  electronics: { label: 'Техника',   icon: '💻' },
  clothing:    { label: 'Одежда',    icon: '👕' },
  furniture:   { label: 'Мебель',    icon: '🛋️' },
  dorm:        { label: 'Общага',    icon: '🛋️' },
  sports:      { label: 'Спорт',     icon: '⚽' },
  appliances:  { label: 'Техника',   icon: '🔌' },
  hobby:       { label: 'Хобби',     icon: '🎸' },
  tutor:       { label: 'Репетитор', icon: '👨‍🏫' },
  homework:    { label: 'Курсачи',   icon: '📝' },
  repair:      { label: 'Ремонт',    icon: '🛠️' },
  design:      { label: 'Дизайн',    icon: '🎨' },
  delivery:    { label: 'Курьер',    icon: '🏃' },
  other_g:     { label: 'Другое',    icon: '📦' },
  other_s:     { label: 'Другое',    icon: '✨' },
};

export const MARKET_CONDITIONS = [
  { id: 'new',      label: 'Новое',     icon: '✨' },
  { id: 'like_new', label: 'Как новое', icon: '⭐' },
  { id: 'good',     label: 'Хорошее',   icon: '👍' },
  { id: 'fair',     label: 'Нормальное',icon: '👌' },
];
