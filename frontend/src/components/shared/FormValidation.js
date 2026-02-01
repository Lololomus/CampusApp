// ===== 📄 ФАЙЛ: frontend/src/components/shared/FormValidation.js =====

import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import theme from '../../theme';

// ========================================
// CharCounter - счётчик символов с индикатором
// ========================================

export const CharCounter = ({ current, min, max, isValid }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: theme.fontSize.xs,
  }}>
    <span style={{ color: theme.colors.textTertiary }}>
      {current}/{max}
    </span>
    {isValid && <Check size={14} color={theme.colors.success} />}
  </div>
);

// ========================================
// FieldHint - подсказка под полем
// ========================================

export const FieldHint = ({ show, message, type = 'error' }) => {
  if (!show) return null;
  
  const colors = {
    error: theme.colors.error,
    warning: theme.colors.warning,
    info: theme.colors.textSecondary,
  };
  
  return (
    <div style={{
      marginTop: theme.spacing.sm,
      fontSize: theme.fontSize.sm,
      color: colors[type] || colors.error,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      {type === 'error' && <AlertCircle size={14} />}
      <span>{message}</span>
    </div>
  );
};

// ========================================
// ValidatedInput - инпут с валидацией и счётчиком
// ========================================

export const ValidatedInput = ({
  value,
  onChange,
  placeholder,
  min,
  max,
  attemptedSubmit = false,
  errorMessage,
  label,
  required = false,
  ...props
}) => {
  const currentLength = value.length;
  const isValid = value.trim().length >= min && currentLength <= max;
  const showError = attemptedSubmit && !isValid;

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
        }}>
          <label style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
          }}>
            {label}
            {required && <span style={{ color: theme.colors.error }}> *</span>}
          </label>
          <CharCounter current={currentLength} min={min} max={max} isValid={isValid} />
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={max}
        style={{
          width: '100%',
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
          background: theme.colors.bgSecondary,
          border: `2px solid ${showError ? theme.colors.error : isValid && attemptedSubmit ? theme.colors.success : theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontSize: theme.fontSize.md,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
        }}
        {...props}
      />
      {showError && errorMessage && (
        <FieldHint show={true} message={errorMessage} type="error" />
      )}
    </div>
  );
};

// ========================================
// ValidatedTextarea - textarea с валидацией и счётчиком
// ========================================

export const ValidatedTextarea = ({
  value,
  onChange,
  placeholder,
  min,
  max,
  attemptedSubmit = false,
  errorMessage,
  label,
  required = false,
  rows = 4,
  ...props
}) => {
  const currentLength = value.length;
  const isValid = value.trim().length >= min && currentLength <= max;
  const showError = attemptedSubmit && !isValid;

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.sm,
        }}>
          <label style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
          }}>
            {label}
            {required && <span style={{ color: theme.colors.error }}> *</span>}
          </label>
          <CharCounter current={currentLength} min={min} max={max} isValid={isValid} />
        </div>
      )}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={max}
        style={{
          width: '100%',
          padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
          background: theme.colors.bgSecondary,
          border: `2px solid ${showError ? theme.colors.error : isValid && attemptedSubmit ? theme.colors.success : theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontSize: theme.fontSize.md,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
        }}
        {...props}
      />
      {showError && errorMessage && (
        <FieldHint show={true} message={errorMessage} type="error" />
      )}
    </div>
  );
};

// ========================================
// Validators - утилиты для проверки данных
// ========================================

export const validators = {
  minLength: (value, min) => value.trim().length >= min,
  maxLength: (value, max) => value.length <= max,
  lengthInRange: (value, min, max) => {
    const len = value.trim().length;
    return len >= min && len <= max;
  },
  isPositiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },
  isEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  },
  isUrl: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};

// ========================================
// Placeholders для форм
// ========================================

export const PLACEHOLDERS = {
  marketTitle: 'iPhone 13 128GB Space Gray',
  marketDescription: 'Состояние отличное, покупал год назад. В комплекте зарядка и чехол.',
  marketLocation: 'Главный корпус, 2 этаж возле столовой',
  marketCustomCategory: 'Канцтовары, аксессуары...',
  
  postTitle: 'Лучшие места для учёбы в кампусе',
  postBody: 'Хочу поделиться крутыми локациями, где удобно готовиться к экзаменам...',
  
  requestTitle: 'Нужна помощь с курсовой по математике',
  requestBody: 'Не могу разобраться с интегралами, буду благодарен за объяснение...',
  
  eventName: 'Встреча клуба программистов',
  eventLocation: 'Аудитория 305, главный корпус',
  eventContact: '@username или +7 (900) 123-45-67',
  
  lostItemDescription: 'Чёрный рюзак Nike с синими вставками',
  foundItemDescription: 'Нашёл связку ключей с брелком в виде медведя',
  lostFoundLocation: 'Библиотека, 3 этаж возле окна',
  
  tagInput: 'python, react, математика...',
};

// ========================================
// ERROR_MESSAGES - сообщения об ошибках
// ========================================

export const ERROR_MESSAGES = {
  titleTooShort: (min) => `Добавь ещё пару слов (минимум ${min} символа)`,
  descriptionTooShort: (min) => `Опиши подробнее (минимум ${min} символов)`,
  bodyTooShort: (min) => `Напиши подробнее (минимум ${min} символов)`,
  priceRequired: 'Укажи цену товара',
  priceInvalid: 'Цена должна быть больше 0',
  categoryRequired: 'Выбери категорию',
  imagesRequired: 'Добавь хотя бы 1 фотографию',
  imagesTooMany: (max) => `Максимум ${max} фотографии`,
  tagTooLong: (max) => `Тег слишком длинный (максимум ${max} символов)`,
  tooManyTags: (max) => `Максимум ${max} тегов`,
  fieldRequired: 'Это поле обязательно',
  invalidEmail: 'Укажи корректный email',
  invalidUrl: 'Укажи корректную ссылку',
  eventNameTooShort: 'Добавь название события',
  eventDateRequired: 'Укажи дату и время события',
  eventLocationRequired: 'Укажи место проведения',
};

// ========================================
// Хелперы для стилей
// ========================================

export const getBorderColor = (isValid, attemptedSubmit, defaultColor = theme.colors.border) => {
  if (!attemptedSubmit) return defaultColor;
  return isValid ? theme.colors.success : theme.colors.error;
};

export const formFieldStyles = {
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    width: '100%',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  textarea: {
    width: '100%',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
};

export default {
  CharCounter,
  FieldHint,
  ValidatedInput,
  ValidatedTextarea,
  validators,
  PLACEHOLDERS,
  ERROR_MESSAGES,
  getBorderColor,
  formFieldStyles,
};