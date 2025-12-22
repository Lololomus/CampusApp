import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, Plus, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { createPost } from '../api';
import { hapticFeedback } from '../utils/telegram';

function CreatePost() {
  const { setShowCreateModal, addNewPost } = useStore();
  
  // Состояние формы
  const [category, setCategory] = useState('study');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [startDrawing, setStartDrawing] = useState(false);
  const [checkDrawn, setCheckDrawn] = useState(false);
  
  // Refs
  const titleInputRef = useRef(null);

  // Монтирование с анимацией
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
    
    // Автофокус на заголовок (desktop)
    if (window.innerWidth >= 768 && titleInputRef.current) {
      setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, []);

  // Проверка есть ли контент в форме
  const hasContent = () => {
    return title.trim().length >= 3 || body.trim().length >= 10;
  };

  // Валидация формы
  const isFormValid = () => {
    return title.trim().length >= 3 && body.trim().length >= 10;
  };

  // Обработка добавления тега
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5 && trimmedTag.length <= 20) {
      hapticFeedback('light');
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  // Удаление тега
  const handleRemoveTag = (tagToRemove) => {
    hapticFeedback('light');
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Обработка Enter в поле тегов
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Закрытие модального окна с подтверждением
  const handleClose = () => {
    if (hasContent() && !isSubmitting) {
      hapticFeedback('light');
      setShowConfirmation(true);
    } else {
      confirmClose();
    }
  };

  // Подтверждённое закрытие
  const confirmClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => {
      setShowCreateModal(false);
    }, 300);
  };

  // Отмена закрытия
  const cancelClose = () => {
    hapticFeedback('light');
    setShowConfirmation(false);
  };

  // Публикация поста
  const handlePublish = async () => {
    setAttemptedSubmit(true);
    setError('');

    // Валидация
    if (!isFormValid()) {
      hapticFeedback('error');
      setError('Заполните заголовок (мин. 3 символа) и описание (мин. 10 символов)');
      return;
    }

    hapticFeedback('medium');
    setIsSubmitting(true);

    try {
      const newPost = await createPost({
        category,
        title: title.trim(),
        body: body.trim(),
        tags
      });

      addNewPost(newPost);
      hapticFeedback('success');
      
      // Показываем SUCCESS анимацию
      setShowSuccess(true);
      
      // Запускаем прорисовку галочки
      setTimeout(() => setStartDrawing(true), 100);
      
      // После прорисовки — БОЛЬШОЙ pulse
      setTimeout(() => setCheckDrawn(true), 1000);

      // Начинаем fade-out через 2.0s (дольше держим галочку)
      setTimeout(() => {
        setShowSuccess(false);
        setStartDrawing(false);
        setCheckDrawn(false);
      }, 2000);

      // Полное закрытие через 2.05s
      setTimeout(() => {
        confirmClose();
      }, 2050);
      
    } catch (error) {
      console.error('Ошибка при создании поста:', error);
      hapticFeedback('error');
      setError('Не удалось опубликовать пост. Проверьте интернет и попробуйте снова.');
      setIsSubmitting(false);
    }
  };

  // Категории
  const categories = [
    { value: 'study', label: '📚 Учёба', color: '#3b82f6' },
    { value: 'help', label: '🤝 Помощь', color: '#10b981' },
    { value: 'hangout', label: '🎉 Движ', color: '#f59e0b' },
    { value: 'dating', label: '💕 Знакомства', color: '#ec4899' }
  ];

  // Проверка валидности полей
  const isTitleValid = title.trim().length >= 3;
  const isBodyValid = body.trim().length >= 10;
  const canAddTag = tagInput.trim().length > 0 && 
                    tags.length < 5 && 
                    !tags.includes(tagInput.trim().toLowerCase()) &&
                    tagInput.trim().length <= 20;

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
            <h2 style={styles.title}>Создать пост</h2>
            <div style={{ width: 40 }} />
          </div>

          {/* Content */}
          <div style={styles.content}>
            
            {/* Категории (горизонтальные чипы) */}
            <div style={styles.section}>
              <label style={styles.label}>Категория</label>
              <div style={styles.categoriesWrapper}>
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setCategory(cat.value);
                      hapticFeedback('light');
                    }}
                    style={
                      category === cat.value
                        ? {
                            ...styles.categoryChip,
                            background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
                            color: '#fff',
                            border: 'none',
                            boxShadow: `0 4px 12px ${cat.color}40`
                          }
                        : styles.categoryChip
                    }
                    disabled={isSubmitting}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Заголовок */}
            <div style={styles.section}>
              <label style={styles.label}>
                Заголовок*
                <span style={styles.charCount}>
                  {title.length}/100
                  {isTitleValid && <Check size={14} style={styles.checkIcon} />}
                </span>
              </label>
              <div style={styles.inputWrapper}>
                <input 
                  ref={titleInputRef}
                  type="text"
                  placeholder="Минимум 3 символа"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    ...styles.input,
                    borderColor: attemptedSubmit && !isTitleValid ? '#ef4444' : 
                                 title.length > 0 ? '#667eea' : '#2a2a2a'
                  }}
                  maxLength={100}
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
                <span style={styles.charCount}>
                  {body.length}/500
                  {isBodyValid && <Check size={14} style={styles.checkIcon} />}
                </span>
              </label>
              <div style={styles.inputWrapper}>
                <textarea 
                  placeholder="Расскажите подробнее... (минимум 10 символов)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{
                    ...styles.textarea,
                    borderColor: attemptedSubmit && !isBodyValid ? '#ef4444' : 
                                 body.length > 0 ? '#667eea' : '#2a2a2a'
                  }}
                  rows={6}
                  maxLength={500}
                  disabled={isSubmitting}
                />
                {isBodyValid && (
                  <Check size={20} style={styles.textareaCheckIcon} />
                )}
              </div>
            </div>

            {/* Теги */}
            <div style={styles.section}>
              <label style={styles.label}>
                Теги (опционально)
                <span style={styles.charCount}>{tags.length}/5</span>
              </label>
              <div style={styles.tagInputWrapper}>
                <Hash size={18} style={{ color: '#667eea', flexShrink: 0 }} />
                <input 
                  type="text"
                  placeholder="сопромат, помощь, срочно"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  style={styles.tagInput}
                  disabled={isSubmitting || tags.length >= 5}
                  maxLength={20}
                />
                <button
                  onClick={handleAddTag}
                  disabled={!canAddTag || isSubmitting}
                  style={
                    canAddTag
                      ? {
                          ...styles.addTagButton,
                          opacity: 1,
                          cursor: 'pointer',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }
                      : {
                          ...styles.addTagButton,
                          opacity: 0.3,
                          cursor: 'not-allowed'
                        }
                  }
                  aria-label="Добавить тег"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              {/* Список тегов */}
              {tags.length > 0 && (
                <div style={styles.tagsList}>
                  {tags.map((tag, index) => (
                    <span 
                      key={tag} 
                      style={{
                        ...styles.tag,
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      #{tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        style={styles.tagRemove}
                        disabled={isSubmitting}
                        aria-label={`Удалить тег ${tag}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
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
          {error && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Sticky Footer с кнопкой */}
          <div style={styles.footer}>
            <button
              onClick={handlePublish}
              disabled={!isFormValid() || isSubmitting}
              style={
                isFormValid() && !isSubmitting
                  ? {
                      ...styles.publishButton,
                      opacity: 1,
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }
                  : {
                      ...styles.publishButton,
                      opacity: 0.5,
                      cursor: 'not-allowed'
                    }
              }
            >
              {isSubmitting ? (
                <>
                  <span style={styles.spinner} />
                  Публикация...
                </>
              ) : !isFormValid() ? (
                'Заполните форму'
              ) : (
                'Опубликовать'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Toast with Animated Checkmark */}
      {showSuccess && (
        <div style={{
          ...styles.successOverlay,
          opacity: showSuccess ? 1 : 0
        }}>
          {/* Success Card */}
          <div style={styles.successCard}>
            {/* SVG Checkmark с прорисовкой и БОЛЬШИМ ПУЛЬСОМ */}
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
                {/* Галочка */}
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
                
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <h3 style={styles.successTitle}>Пост опубликован! 🎉</h3>
            <p style={styles.successText}>Ваш пост появится в ленте через несколько секунд</p>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div style={styles.confirmationOverlay}>
          <div style={styles.confirmationDialog}>
            <h3 style={styles.confirmationTitle}>Отменить создание поста?</h3>
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
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transition: 'opacity 0.3s ease'
  },
  modal: {
    width: '100%',
    maxWidth: '100%',
    height: '80vh',
    background: '#1a1a1a',
    borderRadius: '24px 24px 0 0',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden'
  },
  swipeIndicator: {
    padding: '12px 0 8px',
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0
  },
  swipeBar: {
    width: '40px',
    height: '4px',
    borderRadius: '2px',
    background: '#404040'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0
  },
  closeButton: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: '#252525',
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.3px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '20px 20px 0',
    WebkitOverflowScrolling: 'touch'
  },
  section: {
    marginBottom: '24px'
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#a0a0a0',
    marginBottom: '10px',
    letterSpacing: '0.3px'
  },
  charCount: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  checkIcon: {
    color: '#10b981',
    marginLeft: '4px'
  },
  categoriesWrapper: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none'
  },
  categoryChip: {
    padding: '10px 18px',
    borderRadius: '12px',
    border: '2px solid #2a2a2a',
    background: '#252525',
    color: '#999',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  inputWrapper: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '40px',
    borderRadius: '16px',
    border: '2px solid #2a2a2a',
    background: '#252525',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease'
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '40px',
    borderRadius: '16px',
    border: '2px solid #2a2a2a',
    background: '#252525',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    resize: 'none',
    lineHeight: '1.6',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'all 0.2s ease'
  },
  inputCheckIcon: {
    position: 'absolute',
    right: '14px',
    top: '14px',
    color: '#10b981'
  },
  textareaCheckIcon: {
    position: 'absolute',
    right: '14px',
    top: '14px',
    color: '#10b981'
  },
  tagInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '16px',
    border: '2px solid #2a2a2a',
    background: '#252525',
    transition: 'all 0.2s ease'
  },
  tagInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none'
  },
  addTagButton: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: 'none',
    background: '#333',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s ease'
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px'
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
    animation: 'tagAppear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  tagRemove: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '6px',
    width: '20px',
    height: '20px',
    color: '#fff',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    marginTop: '10px',
    lineHeight: '1.5'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: '#ef444420',
    borderTop: '2px solid #ef4444',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: '500',
    animation: 'shake 0.5s ease'
  },
  footer: {
    padding: '16px 20px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    borderTop: '1px solid #2a2a2a',
    background: '#1a1a1a',
    flexShrink: 0
  },
  publishButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: '#333',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
    letterSpacing: '0.3px'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite'
  },
  // SUCCESS TOAST STYLES
  successOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    transition: 'opacity 0.5s ease'
  },
  successCard: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    borderRadius: '24px',
    padding: '40px 32px',
    maxWidth: '340px',
    width: '100%',
    border: '2px solid #667eea',
    boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
    textAlign: 'center',
    animation: 'successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    position: 'relative'
  },
  successIconWrapper: {
    width: '120px',
    height: '120px',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  checkmarkSvg: {
    filter: 'drop-shadow(0 0 20px rgba(102, 126, 234, 0.8))'
  },
  successTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 12px',
    letterSpacing: '-0.3px'
  },
  successText: {
    fontSize: '15px',
    color: '#a0a0a0',
    margin: 0,
    lineHeight: '1.5'
  },
  // CONFIRMATION DIALOG
  confirmationOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    animation: 'fadeIn 0.2s ease'
  },
  confirmationDialog: {
    background: '#1a1a1a',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '340px',
    width: '100%',
    border: '1px solid #2a2a2a',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
    animation: 'successPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  confirmationTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 12px',
    textAlign: 'center'
  },
  confirmationText: {
    fontSize: '14px',
    color: '#999',
    margin: '0 0 24px',
    textAlign: 'center',
    lineHeight: '1.5'
  },
  confirmationButtons: {
    display: 'flex',
    gap: '12px'
  },
  confirmationCancel: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: '2px solid #2a2a2a',
    background: '#252525',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  confirmationConfirm: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
};

export default CreatePost;