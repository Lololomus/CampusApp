/**
 * ===========================================
 *     Z-INDEX ИЕРАРХИЯ ПРИЛОЖЕНИЯ
 * ===========================================
 * 
 * ПРИНЦИП: Чем выше по стеку, тем больше z-index
 * 
 * СЛОИ (от нижнего к верхнему):
 * -------------------------------------------
 * 0-99:      Контент страниц (Feed, Profile и т.д.)
 * 100-999:   Навигация и фиксированные элементы
 * 1000-1999: Модальные окна первого уровня
 * 2000-2999: Модальные окна второго уровня
 * 3000-3999: Системные оверлеи
 * 4000+:     Критические уведомления
 * 
 * ===========================================
 */

// Контент
export const Z_CONTENT = 1;
export const Z_CARD = 1;

// Фиксированные элементы страниц
export const Z_DATING_ACTIONS = 5;
export const Z_HEADER_STICKY = 10;
export const Z_BOTTOM_ACTION_BAR = 100;

// Навигация
export const Z_NAVIGATION = 1000;

// Модальные окна (формы, редактирование)
export const Z_MODAL_FORMS = 1500;
export const Z_EDIT_PROFILE = 1500;
export const Z_CREATE_POST = 1500;
export const Z_EDIT_POST = 2500;

// Модальные окна (аутентификация)
export const Z_AUTH_MODAL = 2000;
export const Z_USER_POSTS = 1100;

// Модальные окна (dating)
export const Z_DATING_MODALS = 2500;
export const Z_MATCH_MODAL = 2500;
export const Z_LIKES_MODAL = 2500;
export const Z_RESPONSE_MODAL = 2500;

// Системные оверлеи
export const Z_ONBOARDING = 3000;

// Критические уведомления (не используются пока)
export const Z_CRITICAL = 4000;


/**
 * ИСПОЛЬЗОВАНИЕ:
 * 
 * import { Z_NAVIGATION, Z_EDIT_PROFILE } from '../constants/zIndex';
 * 
 * const styles = {
 *   nav: {
 *     zIndex: Z_NAVIGATION
 *   }
 * }
 */