// ===== 📄 ФАЙЛ: frontend/src/components/dating/PromptAnswerModal.js =====
import React, { useState, useEffect } from 'react';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import { PROMPT_MAX_LENGTH } from '../../constants/datingConstants';
import { hapticFeedback } from '../../utils/telegram';


const PromptAnswerModal = ({ isOpen, onClose, prompt, onSave }) => {
  const [answer, setAnswer] = useState('');
  
  useEffect(() => {
    if (isOpen && prompt) {
      setAnswer(prompt.answer || prompt.tempAnswer || '');
    }
  }, [isOpen, prompt]);


  const handleSave = () => {
    const trimmed = answer.trim();
    
    if (trimmed.length < 10) {
      hapticFeedback('error');
      return;
    }
    
    hapticFeedback('success');
    onSave(trimmed);
    onClose();
  };


  if (!prompt) return null;


  const charCount = answer.length;
  const isValid = charCount >= 10 && charCount <= PROMPT_MAX_LENGTH;
  const isNearLimit = charCount > PROMPT_MAX_LENGTH * 0.9;


  return (
    <SwipeableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Твой ответ"
      showHeaderDivider={false}
    >
      <div style={styles.container}>
        
        {/* Карточка вопроса */}
        <div style={styles.questionCard}>
          <div style={styles.questionIcon}>💬</div>
          <div style={styles.questionText}>{prompt.question}</div>
        </div>


        {/* Hint */}
        <div style={styles.hintBox}>
          <span style={styles.hintIcon}>💡</span>
          <span style={styles.hintText}>
            Пиши искренне — это поможет начать диалог
          </span>
        </div>


        {/* Поле ввода */}
        <div style={styles.textareaWrapper}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={prompt.placeholder || "Например: Люблю ночные прогулки по городу и кофе в уютных местах..."}
            maxLength={PROMPT_MAX_LENGTH}
            style={{
              ...styles.textarea,
              borderColor: isNearLimit 
                ? theme.colors.warning 
                : theme.colors.border,
            }}
            onTouchStart={(e) => e.stopPropagation()} 
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
          
          {/* Счетчик снизу */}
          <div style={{
            ...styles.charCounter,
            color: isNearLimit 
              ? theme.colors.warning 
              : theme.colors.textTertiary,
          }}>
            {charCount} / {PROMPT_MAX_LENGTH}
            {charCount < 10 && (
              <span style={styles.minHint}> · Минимум 10 символов</span>
            )}
          </div>
        </div>


        {/* Кнопка */}
        <button
          onClick={handleSave}
          disabled={!isValid}
          style={{
            ...styles.saveButton,
            opacity: isValid ? 1 : 0.5,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}
        >
          Сохранить
        </button>
      </div>
    </SwipeableModal>
  );
};


const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  
  // ===== КАРТОЧКА ВОПРОСА =====
  questionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    background: theme.colors.dating.light,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.colors.dating.primary,
  },
  questionIcon: {
    fontSize: 32,
    lineHeight: 1,
  },
  questionText: {
    ...theme.typography.bodyLarge,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.dating.primary,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  
  // ===== HINT BOX =====
  hintBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.borderLight,
  },
  hintIcon: {
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
  },
  hintText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
  },
  
  // ===== TEXTAREA =====
  textareaWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  textarea: {
    width: '100%',
    minHeight: 140,
    padding: theme.spacing.lg,
    background: theme.colors.card,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    color: theme.colors.text,
    ...theme.typography.bodyLarge,
    lineHeight: 1.6,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${theme.transitions.normal}`,
  },
  charCounter: {
    ...theme.typography.caption,
    textAlign: 'right',
    fontWeight: theme.fontWeight.medium,
    transition: `color ${theme.transitions.normal}`,
  },
  minHint: {
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.normal,
  },
  
  // ===== КНОПКА =====
  saveButton: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderWidth: 0,
    borderStyle: 'none',
    background: theme.colors.dating.gradient,
    color: '#fff',
    ...theme.typography.buttonLarge,
    fontWeight: theme.fontWeight.bold,
    cursor: 'pointer',
    marginTop: theme.spacing.sm,
    transition: `all ${theme.transitions.normal}`,
    boxShadow: `0 4px 16px ${theme.colors.dating.glow}`,
  },
};


export default PromptAnswerModal;
