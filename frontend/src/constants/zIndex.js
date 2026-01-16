// ===== 📄 ФАЙЛ: frontend/src/constants/zIndex.js (ИСПРАВЛЕННЫЙ) =====

/**
 * Централизованная система z-index для всех слоёв приложения
 * Используется для предотвращения конфликтов перекрытия элементов
 * 
 * Иерархия (от меньшего к большему):
 * 0-99: Базовые элементы
 * 100-999: Sticky элементы (header, navigation)
 * 1000-1999: Overlay и dropdown
 * 2000-2999: Модальные окна
 * 3000-3999: Onboarding flows
 * 4000-4999: Photo/Media viewers
 * 5000+: Critical UI (toast, alerts)
 */

// ========== BASE LAYERS (0-99) ==========
export const Z_BASE = 0;
export const Z_CONTENT = 1;
export const Z_ELEVATED_CARD = 10;

// ========== STICKY ELEMENTS (100-999) ==========
export const Z_HEADER = 100;
export const Z_NAVIGATION = 150;
export const Z_TAB_BAR = 200;
export const Z_FLOATING_BUTTON = 250;

// ========== DROPDOWNS & OVERLAYS (1000-1999) ==========
export const Z_DROPDOWN = 1000;
export const Z_POPOVER = 1100;
export const Z_TOOLTIP = 1200;
export const Z_OVERLAY = 1500;

// ========== MODALS - Main App (2000-2499) ==========
export const Z_MODAL_BASE = 2000;
export const Z_MODAL_CREATE_POST = 2100;
export const Z_MODAL_EDIT_POST = 2200;
export const Z_MODAL_POST_DETAIL = 2300;
export const Z_MODAL_CREATE_REQUEST = 2400;
export const Z_MODAL_REQUEST_DETAIL = 2450;

// ========== MODALS - Profile (2500-2699) ==========
export const Z_MODAL_PROFILE_MENU = 2500;
export const Z_MODAL_USER_POSTS = 2550;
export const Z_MODAL_EDIT_PROFILE = 2600;

// ========== MODALS - Dating (2700-2899) ==========
export const Z_MODAL_DATING_BASE = 2700;
export const Z_MODAL_MY_DATING_PROFILE = 2750;
export const Z_MODAL_EDIT_DATING_PROFILE = 2800;
export const Z_MODAL_LIKES_LIST = 2850;

// ========== MODALS - Market (2900-2999) ==========
export const Z_MODAL_CREATE_MARKET_ITEM = 2900;
export const Z_MODAL_MARKET_DETAIL = 2950;
export const Z_MODAL_MARKET_FILTERS = 2980;

// ========== ONBOARDING FLOWS (3000-3999) ==========
export const Z_ONBOARDING_MAIN = 3000;
export const Z_ONBOARDING_DATING = 3100;
export const Z_AUTH_MODAL = 3200;

// ========== PHOTO/MEDIA VIEWERS (4000-4999) ==========
export const Z_PHOTO_VIEWER = 4000;
export const Z_VIDEO_PLAYER = 4100;

// ========== SPECIAL MODALS (5000-5999) ==========
export const Z_MATCH_MODAL = 5000;      // Dating match notification
export const Z_CONFIRMATION_DIALOG = 5100;
export const Z_ALERT_DIALOG = 5200;

// ========== CRITICAL UI (10000+) ==========
export const Z_TOAST = 10000;
export const Z_LOADING_OVERLAY = 10100;
export const Z_ERROR_BOUNDARY = 10200;

// ========== BACKWARD COMPATIBILITY ALIASES ==========
// Старые имена констант для существующих компонентов
// TODO: Постепенно мигрировать все компоненты на новые имена

export const Z_CREATE_POST = Z_MODAL_CREATE_POST;           // CreatePost.js
export const Z_EDIT_POST = Z_MODAL_EDIT_POST;               // EditPost.js
export const Z_EDIT_PROFILE = Z_MODAL_EDIT_PROFILE;         // EditProfile.js
export const Z_USER_POSTS = Z_MODAL_USER_POSTS;             // UserPosts.js
export const Z_CREATE_MARKET_ITEM = Z_MODAL_CREATE_MARKET_ITEM;  // CreateMarketItem.js
export const Z_MARKET_DETAIL = Z_MODAL_MARKET_DETAIL;       // MarketDetail.js
export const Z_MARKET_FILTERS = Z_MODAL_MARKET_FILTERS;     // MarketFilters.js

// Z_MODAL_FORMS - использовался для форм (PostDetail, RequestDetail, CreateRequestModal)
// Маппим на базовый уровень модалок
export const Z_MODAL_FORMS = Z_MODAL_BASE;

// ========== HELPER FUNCTIONS ==========

/**
 * Получить z-index для overlay конкретной модалки
 * Overlay всегда на 1 уровень ниже модалки
 */
export const getOverlayZIndex = (modalZIndex) => modalZIndex - 1;

/**
 * Проверить, что z-index корректен для модалки
 */
export const isValidModalZIndex = (zIndex) => {
  return zIndex >= Z_MODAL_BASE && zIndex < Z_ONBOARDING_MAIN;
};

/**
 * Экспорт всех констант в объекте (для удобства импорта)
 */
export const zIndex = {
  // Base
  base: Z_BASE,
  content: Z_CONTENT,
  elevatedCard: Z_ELEVATED_CARD,
  
  // Sticky
  header: Z_HEADER,
  navigation: Z_NAVIGATION,
  tabBar: Z_TAB_BAR,
  floatingButton: Z_FLOATING_BUTTON,
  
  // Dropdowns
  dropdown: Z_DROPDOWN,
  popover: Z_POPOVER,
  tooltip: Z_TOOLTIP,
  overlay: Z_OVERLAY,
  
  // Modals - Main
  modalBase: Z_MODAL_BASE,
  modalCreatePost: Z_MODAL_CREATE_POST,
  modalEditPost: Z_MODAL_EDIT_POST,
  modalPostDetail: Z_MODAL_POST_DETAIL,
  modalCreateRequest: Z_MODAL_CREATE_REQUEST,
  modalRequestDetail: Z_MODAL_REQUEST_DETAIL,
  
  // Modals - Profile
  modalProfileMenu: Z_MODAL_PROFILE_MENU,
  modalUserPosts: Z_MODAL_USER_POSTS,
  modalEditProfile: Z_MODAL_EDIT_PROFILE,
  
  // Modals - Dating
  modalDatingBase: Z_MODAL_DATING_BASE,
  modalMyDatingProfile: Z_MODAL_MY_DATING_PROFILE,
  modalEditDatingProfile: Z_MODAL_EDIT_DATING_PROFILE,
  modalLikesList: Z_MODAL_LIKES_LIST,
  
  // Modals - Market
  modalCreateMarketItem: Z_MODAL_CREATE_MARKET_ITEM,
  modalMarketDetail: Z_MODAL_MARKET_DETAIL,
  modalMarketFilters: Z_MODAL_MARKET_FILTERS,
  
  // Onboarding
  onboardingMain: Z_ONBOARDING_MAIN,
  onboardingDating: Z_ONBOARDING_DATING,
  authModal: Z_AUTH_MODAL,
  
  // Media
  photoViewer: Z_PHOTO_VIEWER,
  videoPlayer: Z_VIDEO_PLAYER,
  
  // Special
  matchModal: Z_MATCH_MODAL,
  confirmationDialog: Z_CONFIRMATION_DIALOG,
  alertDialog: Z_ALERT_DIALOG,
  
  // Critical
  toast: Z_TOAST,
  loadingOverlay: Z_LOADING_OVERLAY,
  errorBoundary: Z_ERROR_BOUNDARY,
  
  // Legacy aliases (for backward compatibility)
  createPost: Z_CREATE_POST,
  editPost: Z_EDIT_POST,
  editProfile: Z_EDIT_PROFILE,
  userPosts: Z_USER_POSTS,
  createMarketItem: Z_CREATE_MARKET_ITEM,
  marketDetail: Z_MARKET_DETAIL,
  marketFilters: Z_MARKET_FILTERS,
  modalForms: Z_MODAL_FORMS,
};

export default zIndex;