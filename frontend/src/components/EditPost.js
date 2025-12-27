import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, Plus, Check, AlertCircle, MapPin, Calendar, Lock } from 'lucide-react';
import { updatePost } from '../api';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import theme from '../theme';
import { Z_EDIT_POST } from '../constants/zIndex';

// ===== КОНСТАНТЫ (DRY) =====
const CATEGORIES = [
  { value: 'news', label: 'Новости', icon: '📰', color: theme.colors.news },
  { value: 'events', label: 'События', icon: '🎉', color: theme.colors.events },
  { value: 'confessions', label: 'Признания', icon: '💭', color: theme.colors.confessions },
  { value: 'lost_found', label: 'Находки', icon: '🔍', color: theme.colors.lostFound }
];

const POPULAR_TAGS = ['python', 'react', 'помощь', 'курсовая', 'сопромат'];

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 500;
const MAX_TAGS = 5;

function EditPost({ post, onClose, onUpdate }) {
  // ===== STATE (инициализация из post) =====
  const [title, setTitle] = useState(post.title || '');
  const [body, setBody] = useState(post.body || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(post.tags || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [images, setImages] = useState(
    (post.images || []).map(url => ({
      url,           // URL старого фото
      isNew: false   // Флаг старого фото
    }))
  );
  const [imageHeight, setImageHeight] = useState(300);

  const MAX_IMAGES = 3;

  // Категория READONLY
  const category = post.category;

  // Специфичные поля (инициализация из post)
  const isAnonymous = post.is_anonymous || false;
  const [lostOrFound, setLostOrFound] = useState(post.lost_or_found || 'lost');
  const [itemDescription, setItemDescription] = useState(post.item_description || '');
  const [location, setLocation] = useState(post.location || '');
  const [eventName, setEventName] = useState(post.event_name || '');
  const [eventDate, setEventDate] = useState(
    post.event_date ? new Date(post.event_date).toISOString().slice(0, 16) : ''
  );
  const [eventLocation, setEventLocation] = useState(post.event_location || '');
  const [isImportant, setIsImportant] = useState(post.is_important || false);

  // Оригинальные значения для сброса
  const originalValues = useRef({
    title: post.title || '',
    body: post.body || '',
    tags: post.tags || [],
    images: (post.images || []).map(url => ({ url, isNew: false })),
    lostOrFound: post.lost_or_found || 'lost',
    itemDescription: post.item_description || '',
    location: post.location || '',
    eventName: post.event_name || '',
    eventDate: post.event_date ? new Date(post.event_date).toISOString().slice(0, 16) : '',
    eventLocation: post.event_location || '',
    isImportant: post.is_important || false
  });

  const titleInputRef = useRef(null);

  // ===== EFFECTS =====

  // Монтирование с анимацией
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
    if (window.innerWidth >= 768 && titleInputRef.current) {
      setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, []);

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

  // Получить данные категории
  const getCategoryData = () => {
    return CATEGORIES.find(cat => cat.value === category) || CATEGORIES[0];
  };

  // ===== ПРОГРЕСС-БАР ЗАПОЛНЕНИЯ =====
  const calculateProgress = () => {
    let totalFields = 2; // title + body
    let filledFields = 0;

    if (isTitleValid) filledFields++;
    if (isBodyValid) filledFields++;

    if (category === 'lost_found') {
      totalFields += 2;
      if (itemDescription.trim().length >= 5) filledFields++;
      if (location.trim().length >= 3) filledFields++;
    }

    if (category === 'events') {
      totalFields += 3;
      if (eventName.trim().length >= 3) filledFields++;
      if (eventDate) filledFields++;
      if (eventLocation.trim().length >= 3) filledFields++;
    }

    return Math.round((filledFields / totalFields) * 100);
  };

  // ===== HANDLERS =====

  const hasChanges = () => {
    const orig = originalValues.current;
    return (
      title !== orig.title ||
      body !== orig.body ||
      JSON.stringify(tags) !== JSON.stringify(orig.tags) ||
      JSON.stringify(images) !== JSON.stringify(orig.images) ||
      lostOrFound !== orig.lostOrFound ||
      itemDescription !== orig.itemDescription ||
      location !== orig.location ||
      eventName !== orig.eventName ||
      eventDate !== orig.eventDate ||
      eventLocation !== orig.eventLocation ||
      isImportant !== orig.isImportant
    );
  };

  const isFormValid = () => {
    const basicValid = title.trim().length >= 3 && body.trim().length >= 10;
    
    if (category === 'lost_found') {
      return basicValid && itemDescription.trim().length >= 5 && location.trim().length >= 3;
    }
    
    if (category === 'events') {
      return basicValid && eventName.trim().length >= 3 && eventDate && eventLocation.trim().length >= 3;
    }
    
    return basicValid;
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

  const handleClose = () => {
    if (hasChanges() && !isSubmitting) {
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
      onClose();
    }, 300);
  };

  const cancelClose = () => {
    hapticFeedback('light');
    setShowConfirmation(false);
  };

  // ===== РАБОТА С ИЗОБРАЖЕНИЯМИ =====
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const remainingSlots = MAX_IMAGES - images.length;
    
    if (remainingSlots <= 0) {
      alert(`Максимум ${MAX_IMAGES} изображения`);
      return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert('Можно загружать только изображения');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Максимальный размер файла: 5 МБ');
        return;
      }
      
      // Создаём URL для превью + сохраняем сам File
      const imageUrl = URL.createObjectURL(file);
      
      setImages(prev => [...prev, {
        url: imageUrl,       // Для показа
        file: file,          // Сам файл
        isNew: true          // Флаг нового фото
      }]);
      
      hapticFeedback('light');
    });
  };

  const handleRemoveImage = (index) => {
    hapticFeedback('light');
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    
    let height;
    if (aspectRatio >= 1.5) {
      height = 180;
    } else if (aspectRatio >= 1.1) {
      height = 220;
    } else if (aspectRatio >= 0.7) {
      height = 280;
    } else {
      height = 320;
    }
    
    setImageHeight(height);
  };

  // ===== СБРОС ИЗМЕНЕНИЙ =====
  const handleReset = () => {
    hapticFeedback('medium');
    const orig = originalValues.current;
    setTitle(orig.title);
    setBody(orig.body);
    setTags(orig.tags);
    setImages(orig.images);
    setLostOrFound(orig.lostOrFound);
    setItemDescription(orig.itemDescription);
    setLocation(orig.location);
    setEventName(orig.eventName);
    setEventDate(orig.eventDate);
    setEventLocation(orig.eventLocation);
    setIsImportant(orig.isImportant);
    setAttemptedSubmit(false);
    setError('');
  };

  // ===== БЫСТРЫЕ КНОПКИ ДЛЯ ДАТЫ =====
  const setQuickDate = (type) => {
    hapticFeedback('light');
    const now = new Date();
    let targetDate = new Date();

    if (type === 'today') {
      targetDate.setHours(18, 0, 0, 0);
    } else if (type === 'tomorrow') {
      targetDate.setDate(now.getDate() + 1);
      targetDate.setHours(18, 0, 0, 0);
    } else if (type === 'week') {
      targetDate.setDate(now.getDate() + 7);
      targetDate.setHours(18, 0, 0, 0);
    }

    const formatted = targetDate.toISOString().slice(0, 16);
    setEventDate(formatted);
  };

  const handleSave = async () => {
    setAttemptedSubmit(true);
    setError('');
    
    if (!isFormValid) {
      hapticFeedback('error');
      if (category === 'lost_found') {
        setError('Заполните обязательные поля: название, описание, местоположение, детали предмета');
      } else if (category === 'events') {
        setError('Заполните обязательные поля: название, описание, дата и место события');
      } else {
        setError('Пожалуйста, заполните все обязательные поля. Заголовок мин. 3 символа. Описание мин. 10 символов');
      }
      return;
    }
    
    hapticFeedback('medium');
    setIsSubmitting(true);
    
    try {
      // Формируем FormData
      const formData = new FormData();
      
      // Базовые поля
      formData.append('title', title.trim());
      formData.append('body', body.trim());
      formData.append('tags', JSON.stringify(tags));
      
      // Специфичные поля по категориям
      if (category === 'lost_found') {
        formData.append('lost_or_found', lostOrFound);
        formData.append('item_description', itemDescription.trim());
        formData.append('location', location.trim());
      }
      
      if (category === 'events') {
        formData.append('event_name', eventName.trim());
        formData.append('event_date', new Date(eventDate).toISOString());
        formData.append('event_location', eventLocation.trim());
      }
      
      if (category === 'news') {
        formData.append('is_important', isImportant);
      }
      
      // Разделяем старые и новые фото
      const oldImages = [];  // Имена файлов для keep_images
      const newFiles = [];   // File объекты для new_images
      
      images.forEach(img => {
        if (typeof img === 'string') {
          // Старое фото (URL) → извлекаем имя файла
          const filename = img.split('/').pop();
          oldImages.push(filename);
        } else if (img.isNew && img.file) {
          // Новое фото (File объект)
          newFiles.push(img.file);
        } else if (img.url && !img.isNew) {
          // Старое фото (объект с url)
          const filename = img.url.split('/').pop();
          oldImages.push(filename);
        }
      });
      
      // Добавляем keep_images (JSON)
      formData.append('keep_images', JSON.stringify(oldImages));
      
      // Добавляем новые файлы
      newFiles.forEach(file => {
        formData.append('new_images', file);
      });
      
      // Отправляем
      const updatedPost = await updatePost(post.id, formData);
      
      hapticFeedback('success');
      onUpdate(updatedPost);
      
      // Success анимация (0.5s)
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        confirmClose();
      }, 500);
      
    } catch (error) {
      console.error('Ошибка обновления:', error);
      hapticFeedback('error');
      setError('Не удалось обновить пост. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== ВАЛИДАЦИЯ =====
  const isTitleValid = title.trim().length >= 3;
  const isBodyValid = body.trim().length >= 10;
  const canAddTag = tagInput.trim().length > 0 && 
                    tags.length < MAX_TAGS && 
                    !tags.includes(tagInput.trim().toLowerCase()) &&
                    tagInput.trim().length <= 20;

  const progress = calculateProgress();
  const categoryData = getCategoryData();

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
            <h2 style={styles.title}>Редактировать пост</h2>
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
            
            {/* ===== КАТЕГОРИЯ READONLY ===== */}
            <div style={styles.section}>
              <label style={styles.label}>Категория</label>
              <div 
                style={{
                  ...styles.categoryReadonly,
                  borderColor: categoryData.color,
                  background: `${categoryData.color}15`
                }}
              >
                <Lock size={16} style={{ color: categoryData.color }} />
                <span style={styles.categoryIcon}>{categoryData.icon}</span>
                <span style={styles.categoryText}>{categoryData.label}</span>
                <span style={styles.categoryHintText}>(нельзя изменить)</span>
              </div>
              
              {/* Статус анонимности (нельзя изменить) */}
              {category !== 'confessions' && (
                <div style={isAnonymous ? styles.anonymousBadge : styles.publicBadge}>
                  {isAnonymous ? (
                    <>
                      <span style={styles.badgeIcon}>🔒</span>
                      <span style={styles.badgeText}>Анонимный пост</span>
                    </>
                  ) : (
                    <>
                      <span style={styles.badgeIcon}>👤</span>
                      <span style={styles.badgeText}>Публичный пост</span>
                    </>
                  )}
                </div>
              )}

              {/* Hint для confessions */}
              {category === 'confessions' && (
                <div style={styles.confessionHint}>
                  <span style={styles.badgeIcon}>💭</span>
                  <span style={styles.badgeText}>Все признания публикуются анонимно</span>
                </div>
              )}
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
                  placeholder="Минимум 3 символа"
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
                  placeholder="Расскажите подробнее... (минимум 10 символов)"
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

            {/* ИЗОБРАЖЕНИЯ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Изображения (опционально)
                <span style={styles.charCount}>{images.length}/{MAX_IMAGES}</span>
              </label>
              
              {/* Превью изображений */}
              {images.length > 0 && (
                <div style={styles.imagesPreview}>
                  {images.map((img, index) => (
                    <div key={index} style={{...styles.imagePreviewItem, height: imageHeight}}>
                      <img 
                        src={typeof img === 'string' ? img : img.url}
                        alt={`Фото ${index + 1}`}
                        style={styles.previewImage}
                        onLoad={handleImageLoad}
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        style={styles.removeImageBtn}
                        type="button"
                        disabled={isSubmitting}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Кнопка добавления */}
              {images.length < MAX_IMAGES && (
                <label style={{
                  ...styles.uploadButton,
                  opacity: isSubmitting ? 0.5 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}>
                  <Plus size={20} />
                  <span>Добавить фото ({images.length}/{MAX_IMAGES})</span>
                  <input 
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    disabled={isSubmitting}
                  />
                </label>
              )}
              
              <div style={styles.hint}>
                💡 Максимум 3 фото, до 5 МБ каждое
              </div>
            </div>

            {/* LOST & FOUND дополнительные поля */}
            {category === 'lost_found' && (
              <>
                <div style={styles.section}>
                  <label style={styles.label}>Что случилось?</label>
                  <div style={styles.toggleWrapper}>
                    <button
                      onClick={() => {
                        setLostOrFound('lost');
                        hapticFeedback('light');
                      }}
                      style={
                        lostOrFound === 'lost'
                          ? { ...styles.toggleButton, ...styles.toggleButtonActive }
                          : styles.toggleButton
                      }
                      disabled={isSubmitting}
                    >
                      😢 Потерял
                    </button>
                    <button
                      onClick={() => {
                        setLostOrFound('found');
                        hapticFeedback('light');
                      }}
                      style={
                        lostOrFound === 'found'
                          ? { ...styles.toggleButton, ...styles.toggleButtonActive }
                          : styles.toggleButton
                      }
                      disabled={isSubmitting}
                    >
                      🎉 Нашёл
                    </button>
                  </div>
                </div>

                <div style={styles.section}>
                  <label style={styles.label}>
                    Что именно?*
                    <span style={styles.charCount}>{itemDescription.length}/100</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="Например: Чёрный рюкзак Adidas"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    style={{
                      ...styles.input,
                      borderColor: attemptedSubmit && itemDescription.trim().length < 5 ? theme.colors.error : 
                                   itemDescription.length > 0 ? theme.colors.primary : theme.colors.border
                    }}
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={styles.section}>
                  <label style={styles.label}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} />
                      Где?*
                    </span>
                    <span style={styles.charCount}>{location.length}/100</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="Например: Главный корпус, 3 этаж"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{
                      ...styles.input,
                      borderColor: attemptedSubmit && location.trim().length < 3 ? theme.colors.error : 
                                   location.length > 0 ? theme.colors.primary : theme.colors.border
                    }}
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            {/* EVENTS дополнительные поля */}
            {category === 'events' && (
              <>
                <div style={styles.section}>
                  <label style={styles.label}>
                    Название события*
                    <span style={styles.charCount}>{eventName.length}/100</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="Например: Хакатон StartupHub 2025"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    style={{
                      ...styles.input,
                      borderColor: attemptedSubmit && eventName.trim().length < 3 ? theme.colors.error : 
                                   eventName.length > 0 ? theme.colors.primary : theme.colors.border
                    }}
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={styles.section}>
                  <label style={styles.label}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      Дата и время*
                    </span>
                  </label>
                  
                  {/* Быстрые кнопки выбора даты */}
                  <div style={styles.quickDateButtons}>
                    <button 
                      onClick={() => setQuickDate('today')} 
                      style={styles.quickDateBtn}
                      disabled={isSubmitting}
                      type="button"
                    >
                      Сегодня
                    </button>
                    <button 
                      onClick={() => setQuickDate('tomorrow')} 
                      style={styles.quickDateBtn}
                      disabled={isSubmitting}
                      type="button"
                    >
                      Завтра
                    </button>
                    <button 
                      onClick={() => setQuickDate('week')} 
                      style={styles.quickDateBtn}
                      disabled={isSubmitting}
                      type="button"
                    >
                      Через неделю
                    </button>
                  </div>
                  
                  <input 
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{
                      ...styles.input,
                      marginTop: theme.spacing.sm,
                      borderColor: attemptedSubmit && !eventDate ? theme.colors.error : 
                                   eventDate ? theme.colors.primary : theme.colors.border
                    }}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={styles.section}>
                  <label style={styles.label}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} />
                      Место проведения*
                    </span>
                    <span style={styles.charCount}>{eventLocation.length}/100</span>
                  </label>
                  <input 
                    type="text"
                    placeholder="Например: Актовый зал, главный корпус"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    style={{
                      ...styles.input,
                      borderColor: attemptedSubmit && eventLocation.trim().length < 3 ? theme.colors.error : 
                                   eventLocation.length > 0 ? theme.colors.primary : theme.colors.border
                    }}
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            {/* NEWS дополнительные поля */}
            {category === 'news' && (
              <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isImportant}
                    onChange={(e) => {
                      setIsImportant(e.target.checked);
                      hapticFeedback('light');
                    }}
                    style={styles.checkbox}
                    disabled={isSubmitting}
                  />
                  <span style={styles.checkboxText}>⭐ Важная новость (будет закреплена)</span>
                </label>
              </div>
            )}

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
                  placeholder="python, react, помощь..."
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
                  {tags.map((tag, index) => (
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

          {/* ===== FOOTER ===== */}
          <div style={styles.footer}>
            <div style={styles.footerButtons}>
              {/* Кнопка "Сбросить" ВСЕГДА видна */}
              <button
                onClick={handleReset}
                disabled={!hasChanges() || isSubmitting}
                style={{
                  ...styles.resetButton,
                  opacity: hasChanges() ? 1 : 0.4,
                  cursor: hasChanges() ? 'pointer' : 'not-allowed'
                }}
                type="button"
              >
                Сбросить
              </button>
              
              {/* Кнопка "Сохранить" */}
              <button
                onClick={handleSave}
                disabled={!isFormValid() || isSubmitting}
                style={
                  isFormValid() && !isSubmitting
                    ? styles.saveButtonActive
                    : styles.saveButtonDisabled
                }
              >
                {isSubmitting ? (
                  <>
                    <span style={styles.spinner} />
                    Сохранение...
                  </>
                ) : !isFormValid() ? (
                  'Заполните все поля ⬆️'
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast (упрощённый) */}
      {showSuccess && (
        <div style={{
          ...styles.successOverlay,
          opacity: showSuccess ? 1 : 0
        }}>
          <div style={styles.successCard}>
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>Изменения сохранены!</h3>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div style={styles.confirmationOverlay}>
          <div style={styles.confirmationDialog}>
            <h3 style={styles.confirmationTitle}>Отменить изменения?</h3>
            <p style={styles.confirmationText}>Несохранённые изменения будут потеряны</p>
            <div style={styles.confirmationButtons}>
              <button
                onClick={cancelClose}
                style={styles.confirmationCancel}
              >
                Продолжить
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

  @keyframes quickFade {
    0% { opacity: 0; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1); }
  }
`;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_EDIT_POST,
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
  // ===== КАТЕГОРИЯ READONLY =====
  categoryReadonly: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  categoryIcon: {
    fontSize: '20px',
    lineHeight: 1
  },
  categoryText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1
  },
  categoryHintText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
    fontStyle: 'italic'
  },
  anonymousCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    cursor: 'pointer'
  },
  confessionHint: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    background: `${theme.colors.confessions}15`,
    border: `1px solid ${theme.colors.confessions}40`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: theme.colors.primary
  },
  checkboxText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    cursor: 'pointer'
  },
  toggleWrapper: {
    display: 'flex',
    gap: theme.spacing.md
  },
  toggleButton: {
    flex: 1,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal
  },
  toggleButtonActive: {
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    color: theme.colors.text,
    border: 'none',
    boxShadow: `0 4px 12px ${theme.colors.primary}40`
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
  quickDateButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  quickDateBtn: {
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
  footerButtons: {
    display: 'flex',
    gap: theme.spacing.md,
    width: '100%'
  },
  resetButton: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: 100
  },
  saveButtonActive: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    border: `2px solid ${theme.colors.primary}`,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    boxShadow: `0 4px 16px ${theme.colors.primary}40`
  },
  saveButtonDisabled: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    border: `2px dashed ${theme.colors.textDisabled}`,
    background: `rgba(${parseInt(theme.colors.primary.slice(1,3), 16)}, ${parseInt(theme.colors.primary.slice(3,5), 16)}, ${parseInt(theme.colors.primary.slice(5,7), 16)}, 0.2)`,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    cursor: 'not-allowed',
    opacity: 0.6,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: theme.colors.text,
    borderRadius: theme.radius.full,
    animation: 'spin 0.6s linear infinite'
  },
  // Badges для анонимности
  anonymousBadge: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    background: `${theme.colors.primary}15`,
    border: `1px solid ${theme.colors.primary}40`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  publicBadge: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    background: `${theme.colors.textSecondary}10`,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  badgeIcon: {
    fontSize: '16px',
    lineHeight: 1
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium
  },
  // ===== УПРОЩЁННЫЙ SUCCESS =====
  successOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: Z_EDIT_POST + 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    transition: 'opacity 0.3s ease'
  },
  successCard: {
    background: `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bgSecondary} 100%)`,
    borderRadius: theme.radius.xl,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xxxl}px`,
    border: `2px solid ${theme.colors.primary}`,
    boxShadow: `0 20px 60px ${theme.colors.primary}40`,
    textAlign: 'center',
    animation: 'quickFade 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.full,
    background: `linear-gradient(135deg, ${theme.colors.success} 0%, ${theme.colors.primary} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold
  },
  successTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: 0
  },
  confirmationOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: Z_EDIT_POST + 2,
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
  },
  imagesPreview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  imagePreviewItem: {
    position: 'relative',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    border: 'none',
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: theme.transitions.fast,
    zIndex: 2
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    borderRadius: theme.radius.md,
    border: `2px dashed ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal
  },
};

export default EditPost;