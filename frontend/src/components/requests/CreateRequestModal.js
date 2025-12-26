import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, Plus, Check, AlertCircle, Clock } from 'lucide-react';
import { useStore } from '../../store';
import { createRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_FORMS } from '../../constants/zIndex';

// ===== КОНСТАНТЫ (DRY) =====
const CATEGORIES = [
  { value: 'study', label: 'Учёба', icon: '📚', color: '#3b82f6' },
  { value: 'help', label: 'Помощь', icon: '🤝', color: '#10b981' },
  { value: 'hangout', label: 'Движ', icon: '🎉', color: '#f59e0b' }
];

const POPULAR_TAGS = ['помощь', 'срочно', 'курсовая', 'спорт', 'подвезти'];

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 500;
const MAX_TAGS = 5;

function CreateRequestModal() {
  const { setShowCreateRequestModal, addNewRequest } = useStore();

  // ===== STATE =====
  const [category, setCategory] = useState('study');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [startDrawing, setStartDrawing] = useState(false);
  const [checkDrawn, setCheckDrawn] = useState(false);

  const titleInputRef = useRef(null);

  // ===== EFFECTS =====

  // Монтирование с анимацией
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
    if (window.innerWidth >= 768 && titleInputRef.current) {
      setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, []);

  // ===== АВТОСОХРАНЕНИЕ ЧЕРНОВИКА (каждые 3 секунды) =====
  useEffect(() => {
    const interval = setInterval(() => {
      if (title.trim() || body.trim()) {
        const draft = {
          category, title, body, tags, expiresAt,
          timestamp: Date.now()
        };
        localStorage.setItem('createRequestDraft', JSON.stringify(draft));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [category, title, body, tags, expiresAt]);

  // Восстановление черновика при открытии
  useEffect(() => {
    const draft = localStorage.getItem('createRequestDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        // Проверяем что черновик свежий (< 24 часов)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          if (window.confirm('Восстановить несохранённый черновик?')) {
            setCategory(parsed.category || 'study');
            setTitle(parsed.title || '');
            setBody(parsed.body || '');
            setTags(parsed.tags || []);
            setExpiresAt(parsed.expiresAt || '');
            hapticFeedback('success');
          } else {
            localStorage.removeItem('createRequestDraft');
          }
        }
      } catch (e) {
        console.error('Ошибка восстановления черновика:', e);
      }
    }
  }, []);

  // Дефолтный expires при смене категории (если пусто)
  useEffect(() => {
    if (!expiresAt) {
      const hours = category === 'study' ? 72 : 24;
      const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
      setExpiresAt(targetDate.toISOString());
    }
  }, [category, expiresAt]);

  // ===== SHARED UTILITIES =====

  const TagBadge = ({ tag, onRemove }) => (
    <span style={styles.tag}>
      #{tag}
      <button 
        style={styles.tagRemove}
        onClick={(e) => {
          e.stopPropagation();
          hapticFeedback('light');
          onRemove(tag);
        }}
        disabled={isSubmitting}
        aria-label={`Удалить тег ${tag}`}
      >
        <X size={14} />
      </button>
    </span>
  );

  const ErrorMessage = ({ message }) => message ? (
    <div style={styles.errorAlert}>
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;

  const CharCounter = ({ current, max, isValid }) => (
    <span style={{
      ...styles.charCount,
      color: isValid ? theme.colors.textTertiary : theme.colors.error
    }}>
      {current}/{max}
      {isValid && <Check size={14} style={styles.checkIcon} />}
    </span>
  );

  // ===== ПРОГРЕСС-БАР ЗАПОЛНЕНИЯ =====
  const calculateProgress = () => {
    let totalFields = 3; // title + body + expiresAt
    let filledFields = 0;

    if (isTitleValid) filledFields++;
    if (isBodyValid) filledFields++;
    if (isExpiresValid) filledFields++;

    return Math.round((filledFields / totalFields) * 100);
  };

  // ===== HANDLERS =====

  const hasContent = () => {
    return title.trim().length >= 10 || body.trim().length >= 20;
  };

  const handleAddTag = (tag = null) => {
    const trimmedTag = (tag || tagInput).trim().toLowerCase();
    
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < MAX_TAGS && trimmedTag.length <= 20) {
      hapticFeedback('light');
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    hapticFeedback('light');
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // ===== БЫСТРЫЕ КНОПКИ ДЛЯ ВРЕМЕНИ =====
  const setQuickTime = (hours) => {
    hapticFeedback('light');
    const targetDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    setExpiresAt(targetDate.toISOString());
  };

  const handleClose = () => {
    if (hasContent() && !isSubmitting) {
      hapticFeedback('light');
      setShowConfirmation(true);
    } else {
      confirmClose();
    }
  };

  const confirmClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => {
      setShowCreateRequestModal(false);
      localStorage.removeItem('createRequestDraft');
    }, 300);
  };

  const cancelClose = () => {
    hapticFeedback('light');
    setShowConfirmation(false);
  };

  const handlePublish = async () => {
    setAttemptedSubmit(true);
    setError('');

    if (!isFormValid) {
      hapticFeedback('error');
      setError('Заполните все обязательные поля: заголовок (мин. 10 символов), описание (мин. 20 символов) и время истечения');
      return;
    }

    hapticFeedback('medium');
    setIsSubmitting(true);

    try {
      // ✅ ПРАВИЛЬНЫЙ формат данных для API
      const requestData = {
        category,
        title: title.trim(),
        body: body.trim(),
        tags,
        expires_at: expiresAt // ISO string
      };

      console.log('📤 Отправка запроса:', requestData);

      const newRequest = await createRequest(requestData);
      
      console.log('✅ Запрос создан:', newRequest);

      addNewRequest(newRequest);
      
      localStorage.removeItem('createRequestDraft');
      
      hapticFeedback('success');
      
      // Success animation
      setShowSuccess(true);
      setTimeout(() => setStartDrawing(true), 100);
      setTimeout(() => setCheckDrawn(true), 1000);
      setTimeout(() => {
        setShowSuccess(false);
        setStartDrawing(false);
        setCheckDrawn(false);
      }, 2000);
      setTimeout(() => {
        confirmClose();
      }, 2050);
      
    } catch (error) {
      console.error('❌ Ошибка при создании запроса:', error);
      console.error('Детали:', error.response?.data);
      hapticFeedback('error');
      setError(error.response?.data?.detail || 'Не удалось создать запрос. Проверьте интернет и попробуйте снова.');
      setIsSubmitting(false);
    }
  };

  // ===== ВАЛИДАЦИЯ =====
  const isTitleValid = title.trim().length >= 10 && title.trim().length <= MAX_TITLE_LENGTH;
  const isBodyValid = body.trim().length >= 20 && body.trim().length <= MAX_BODY_LENGTH;
  const isExpiresValid = !!expiresAt;
  const isFormValid = category && isTitleValid && isBodyValid && isExpiresValid;
  
  const canAddTag = tagInput.trim().length > 0 && 
                    tags.length < MAX_TAGS && 
                    !tags.includes(tagInput.trim().toLowerCase()) &&
                    tagInput.trim().length <= 20;

  const progress = calculateProgress();

  return (
    <>
      <style>{keyframesStyles}</style>
      
      {/* Backdrop overlay */}
      <div 
        style={{
          ...styles.overlay,
          opacity: isVisible ? 1 : 0,
          pointerEvents: showConfirmation ? 'none' : 'auto'
        }}
        onClick={handleClose}
      >
        {/* Modal container */}
        <div 
          style={{
            ...styles.modal,
            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
            opacity: isVisible ? 1 : 0
          }}
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Swipe indicator */}
          <div style={styles.swipeIndicator}>
            <div style={styles.swipeBar} />
          </div>

          {/* Header */}
          <div style={styles.header}>
            <button 
              onClick={handleClose} 
              style={styles.closeButton}
              disabled={isSubmitting}
              aria-label="Закрыть"
            >
              <X size={24} />
            </button>
            <h2 style={styles.title}>Создать запрос</h2>
            <div style={{ width: 40 }} />
          </div>

          {/* ===== ПРОГРЕСС-БАР (STICKY) ===== */}
          <div style={styles.progressBarContainer}>
            <div style={styles.progressBarWrapper}>
              <div 
                style={{
                  ...styles.progressBarFill,
                  width: `${progress}%`,
                  background: progress === 100 
                    ? `linear-gradient(90deg, ${theme.colors.success} 0%, ${theme.colors.primary} 100%)`
                    : `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`
                }}
              />
            </div>
            <span style={styles.progressText}>
              {progress === 100 ? '✓ Готово!' : `${progress}% заполнено`}
            </span>
          </div>

          {/* Content */}
          <div style={styles.content}>
            
            {/* ===== КАТЕГОРИИ 2×2 GRID ===== */}
            <div style={styles.section}>
              <label style={styles.label}>Категория</label>
              
              {/* Grid для 3 категорий (2 в первом ряду, 1 во втором) */}
              <div style={styles.categoriesGrid}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setCategory(cat.value);
                      hapticFeedback('light');
                    }}
                    style={
                      category === cat.value
                        ? {
                            ...styles.categoryButton,
                            background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
                            color: '#fff',
                            border: 'none',
                            boxShadow: `0 4px 12px ${cat.color}40`
                          }
                        : styles.categoryButton
                    }
                    disabled={isSubmitting}
                  >
                    <span style={styles.categoryIcon}>{cat.icon}</span>
                    <span style={styles.categoryLabel}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Заголовок */}
            <div style={styles.section}>
              <label style={styles.label}>
                Заголовок*
                <CharCounter current={title.length} max={MAX_TITLE_LENGTH} isValid={isTitleValid} />
              </label>
              <div style={styles.inputWrapper}>
                <input 
                  ref={titleInputRef}
                  type="text"
                  placeholder="Минимум 10 символов"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    ...styles.input,
                    borderColor: attemptedSubmit && !isTitleValid ? theme.colors.error : 
                                 title.length > 0 ? theme.colors.primary : theme.colors.border
                  }}
                  maxLength={MAX_TITLE_LENGTH}
                  disabled={isSubmitting}
                />
                {isTitleValid && (
                  <Check size={20} style={styles.inputCheckIcon} />
                )}
              </div>
            </div>

            {/* Описание */}
            <div style={styles.section}>
              <label style={styles.label}>
                Описание*
                <CharCounter current={body.length} max={MAX_BODY_LENGTH} isValid={isBodyValid} />
              </label>
              <div style={styles.inputWrapper}>
                <textarea 
                  placeholder="Расскажите подробнее... (минимум 20 символов)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{
                    ...styles.textarea,
                    borderColor: attemptedSubmit && !isBodyValid ? theme.colors.error : 
                                 body.length > 0 ? theme.colors.primary : theme.colors.border
                  }}
                  rows={6}
                  maxLength={MAX_BODY_LENGTH}
                  disabled={isSubmitting}
                />
                {isBodyValid && (
                  <Check size={20} style={styles.textareaCheckIcon} />
                )}
              </div>
            </div>

            {/* ===== ВРЕМЯ ИСТЕЧЕНИЯ ===== */}
            <div style={styles.section}>
              <label style={styles.label}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} />
                  Время истечения*
                </span>
              </label>
              
              {/* Быстрые кнопки выбора времени */}
              <div style={styles.quickTimeButtons}>
                <button 
                  onClick={() => setQuickTime(3)} 
                  style={styles.quickTimeBtn}
                  disabled={isSubmitting}
                  type="button"
                >
                  3 часа
                </button>
                <button 
                  onClick={() => setQuickTime(24)} 
                  style={styles.quickTimeBtn}
                  disabled={isSubmitting}
                  type="button"
                >
                  24 часа
                </button>
                <button 
                  onClick={() => setQuickTime(72)} 
                  style={styles.quickTimeBtn}
                  disabled={isSubmitting}
                  type="button"
                >
                  3 дня
                </button>
              </div>
              
              <input 
                type="datetime-local"
                value={expiresAt ? new Date(expiresAt).toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setExpiresAt(new Date(e.target.value).toISOString());
                  }
                }}
                style={{
                  ...styles.input,
                  marginTop: theme.spacing.sm,
                  borderColor: attemptedSubmit && !isExpiresValid ? theme.colors.error : 
                               expiresAt ? theme.colors.primary : theme.colors.border
                }}
                disabled={isSubmitting}
              />
              
              <div style={styles.hint}>
                ⏰ Запрос автоматически закроется после указанного времени
              </div>
            </div>

            {/* ===== ТЕГИ С ПОПУЛЯРНЫМИ ===== */}
            <div style={styles.section}>
              <label style={styles.label}>
                Теги (опционально)
                <span style={styles.charCount}>{tags.length}/{MAX_TAGS}</span>
              </label>
              
              <div style={styles.tagInputWrapper}>
                <Hash size={18} style={{ color: theme.colors.primary, flexShrink: 0 }} />
                <input 
                  type="text"
                  placeholder="помощь, срочно..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  style={styles.tagInput}
                  disabled={isSubmitting || tags.length >= MAX_TAGS}
                  maxLength={20}
                />
                <button
                  onClick={() => handleAddTag()}
                  disabled={!canAddTag || isSubmitting}
                  style={
                    canAddTag
                      ? {
                          ...styles.addTagButton,
                          opacity: 1,
                          cursor: 'pointer',
                          background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`
                        }
                      : {
                          ...styles.addTagButton,
                          opacity: 0.3,
                          cursor: 'not-allowed'
                        }
                  }
                  type="button"
                  aria-label="Добавить тег"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              {/* Популярные теги */}
              {tags.length < MAX_TAGS && (
                <div style={styles.popularTagsSection}>
                  <span style={styles.popularLabel}>Популярные:</span>
                  <div style={styles.popularTags}>
                    {POPULAR_TAGS.filter(tag => !tags.includes(tag)).map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        style={styles.popularTag}
                        disabled={isSubmitting || tags.length >= MAX_TAGS}
                        type="button"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Список добавленных тегов */}
              {tags.length > 0 && (
                <div style={styles.tagsList}>
                  {tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} onRemove={handleRemoveTag} />
                  ))}
                </div>
              )}
              
              <div style={styles.hint}>
                💡 Максимум 20 символов на тег. Нажмите + или Enter для добавления
              </div>
            </div>

            {/* Отступ для sticky footer */}
            <div style={{ height: 80 }} />

          </div>

          {/* Error Alert */}
          <ErrorMessage message={error} />

          {/* ===== УЛУЧШЕННЫЙ STICKY FOOTER ===== */}
          <div style={styles.footer}>
            <button
              onClick={handlePublish}
              disabled={!isFormValid || isSubmitting}
              style={
                isFormValid && !isSubmitting
                  ? {
                      ...styles.publishButton,
                      opacity: 1,
                      cursor: 'pointer',
                      background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
                      border: `2px solid ${theme.colors.primary}`
                    }
                  : {
                      ...styles.publishButton,
                      opacity: 0.6,
                      cursor: 'not-allowed',
                      background: `rgba(${parseInt(theme.colors.primary.slice(1,3), 16)}, ${parseInt(theme.colors.primary.slice(3,5), 16)}, ${parseInt(theme.colors.primary.slice(5,7), 16)}, 0.2)`,
                      border: `2px dashed ${theme.colors.textDisabled}`
                    }
              }
            >
              {isSubmitting ? (
                <>
                  <span style={styles.spinner} />
                  Публикация...
                </>
              ) : !isFormValid ? (
                <>
                  Заполните все поля ⬆️
                </>
              ) : (
                'Опубликовать'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div style={{
          ...styles.successOverlay,
          opacity: showSuccess ? 1 : 0
        }}>
          <div style={styles.successCard}>
            <div style={{
              ...styles.successIconWrapper,
              transform: checkDrawn ? 'scale(1.0)' : 'scale(0.8)',
              animation: checkDrawn ? 'bigPulse 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
            }}>
              <svg 
                width="120" 
                height="120" 
                viewBox="0 0 120 120" 
                fill="none"
                style={styles.checkmarkSvg}
              >
                <path
                  d="M 25 60 L 50 85 L 95 35"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  style={{
                    strokeDasharray: 120,
                    strokeDashoffset: startDrawing ? 0 : 120,
                    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.65, 0, 0.35, 1)'
                  }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={theme.colors.primary} />
                    <stop offset="100%" stopColor={theme.colors.primaryHover} />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <h3 style={styles.successTitle}>Запрос опубликован! 🎉</h3>
            <p style={styles.successText}>Вы получите уведомление об откликах</p>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div style={styles.confirmationOverlay}>
          <div style={styles.confirmationDialog}>
            <h3 style={styles.confirmationTitle}>Отменить создание запроса?</h3>
            <p style={styles.confirmationText}>Весь введённый текст будет потерян</p>
            <div style={styles.confirmationButtons}>
              <button
                onClick={cancelClose}
                style={styles.confirmationCancel}
              >
                Остаться
              </button>
              <button
                onClick={confirmClose}
                style={styles.confirmationConfirm}
              >
                Да, отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// CSS Keyframes
const keyframesStyles = `
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes tagAppear {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  @keyframes successPop {
    0% {
      opacity: 0;
      transform: scale(0.8);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes bigPulse {
    0% {
      transform: scale(0.8);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1.0);
    }
  }
`;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_MODAL_FORMS,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transition: 'opacity 0.3s ease'
  },
  modal: {
    width: '100%',
    maxWidth: '100%',
    height: '85vh',
    background: theme.colors.bg,
    borderRadius: '24px 24px 0 0',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: theme.shadows.lg,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden'
  },
  swipeIndicator: {
    padding: `${theme.spacing.md}px 0 ${theme.spacing.sm}px`,
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0
  },
  swipeBar: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.sm,
    background: theme.colors.border
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    border: 'none',
    background: theme.colors.bgSecondary,
    color: theme.colors.textTertiary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: theme.transitions.normal
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: 0,
    letterSpacing: '-0.3px'
  },
  // ===== ПРОГРЕСС-БАР (STICKY) =====
  progressBarContainer: {
    padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.bg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexShrink: 0
  },
  progressBarWrapper: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.full,
    background: theme.colors.border,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.radius.full,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease'
  },
  progressText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    whiteSpace: 'nowrap',
    minWidth: 90
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: `${theme.spacing.xl}px ${theme.spacing.xl}px 0`,
    WebkitOverflowScrolling: 'touch'
  },
  section: {
    marginBottom: theme.spacing.xxl
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    letterSpacing: '0.3px'
  },
  charCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
    fontWeight: theme.fontWeight.medium,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  checkIcon: {
    color: theme.colors.success,
    marginLeft: theme.spacing.xs
  },
  // ===== КАТЕГОРИИ GRID =====
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  categoryButton: {
    padding: `${theme.spacing.lg}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    minHeight: 64,
    textAlign: 'center'
  },
  categoryIcon: {
    fontSize: '24px',
    lineHeight: 1
  },
  categoryLabel: {
    fontSize: theme.fontSize.sm,
    lineHeight: 1.2
  },
  inputWrapper: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
    paddingRight: 40,
    borderRadius: theme.radius.lg,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    outline: 'none',
    boxSizing: 'border-box',
    transition: theme.transitions.normal
  },
  textarea: {
    width: '100%',
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
    paddingRight: 40,
    borderRadius: theme.radius.lg,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    outline: 'none',
    resize: 'none',
    lineHeight: 1.6,
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: theme.transitions.normal
  },
  inputCheckIcon: {
    position: 'absolute',
    right: theme.spacing.lg,
    top: theme.spacing.lg,
    color: theme.colors.success
  },
  textareaCheckIcon: {
    position: 'absolute',
    right: theme.spacing.lg,
    top: theme.spacing.lg,
    color: theme.colors.success
  },
  quickTimeButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  quickTimeBtn: {
    flex: 1,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.fast
  },
  tagInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.lg,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    transition: theme.transitions.normal
  },
  tagInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    outline: 'none'
  },
  addTagButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    border: 'none',
    background: theme.colors.border,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: theme.transitions.normal
  },
  popularTagsSection: {
    marginTop: theme.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm
  },
  popularLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.medium
  },
  popularTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  popularTag: {
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.fast
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    boxShadow: `0 2px 8px ${theme.colors.primary}30`,
    animation: 'tagAppear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    cursor: 'pointer'
  },
  tagRemove: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: theme.radius.sm,
    width: 20,
    height: 20,
    color: theme.colors.text,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.fast
  },
  hint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
    marginTop: theme.spacing.md,
    lineHeight: 1.5
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
    background: `${theme.colors.error}20`,
    borderTop: `2px solid ${theme.colors.error}`,
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    animation: 'shake 0.5s ease'
  },
  footer: {
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    paddingBottom: `max(${theme.spacing.lg}px, env(safe-area-inset-bottom))`,
    borderTop: `1px solid ${theme.colors.border}`,
    background: theme.colors.bg,
    flexShrink: 0
  },
  publishButton: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    border: 'none',
    background: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    boxShadow: `0 4px 16px ${theme.colors.primary}40`,
    letterSpacing: '0.3px'
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: theme.colors.text,
    borderRadius: theme.radius.full,
    animation: 'spin 0.6s linear infinite'
  },
  successOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: Z_MODAL_FORMS + 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    transition: 'opacity 0.5s ease'
  },
  successCard: {
    background: `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bgSecondary} 100%)`,
    borderRadius: theme.radius.xl,
    padding: `${theme.spacing.xxxl}px ${theme.spacing.xxxl}px`,
    maxWidth: 340,
    width: '100%',
    border: `2px solid ${theme.colors.primary}`,
    boxShadow: `0 20px 60px ${theme.colors.primary}40`,
    textAlign: 'center',
    animation: 'successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    position: 'relative'
  },
  successIconWrapper: {
    width: 120,
    height: 120,
    margin: `0 auto ${theme.spacing.xxl}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  checkmarkSvg: {
    filter: `drop-shadow(0 0 20px ${theme.colors.primary}80)`
  },
  successTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: `0 0 ${theme.spacing.md}px`,
    letterSpacing: '-0.3px'
  },
  successText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: 1.5
  },
  confirmationOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: Z_MODAL_FORMS + 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    animation: 'fadeIn 0.2s ease'
  },
  confirmationDialog: {
    background: theme.colors.bg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xxl,
    maxWidth: 340,
    width: '100%',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
    animation: 'successPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  confirmationTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: `0 0 ${theme.spacing.md}px`,
    textAlign: 'center'
  },
  confirmationText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    margin: `0 0 ${theme.spacing.xxl}px`,
    textAlign: 'center',
    lineHeight: 1.5
  },
  confirmationButtons: {
    display: 'flex',
    gap: theme.spacing.md
  },
  confirmationCancel: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal
  },
  confirmationConfirm: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: 'none',
    background: theme.colors.error,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal
  }
};

export default CreateRequestModal;