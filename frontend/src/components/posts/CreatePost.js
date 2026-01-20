import React, { useState, useEffect, useRef } from 'react';
import { X, Hash, Plus, Check, AlertCircle, MapPin, Calendar, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useStore } from '../../store';
import { createPost } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_CREATE_POST } from '../../constants/zIndex';
import imageCompression from 'browser-image-compression';

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
const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function CreatePost() {
  const { setShowCreateModal, addNewPost } = useStore();

  const [category, setCategory] = useState('news');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [startDrawing, setStartDrawing] = useState(false);
  const [checkDrawn, setCheckDrawn] = useState(false);

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [lostOrFound, setLostOrFound] = useState('lost');
  const [itemDescription, setItemDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [isImportant, setIsImportant] = useState(false);

  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
    if (window.innerWidth >= 768 && titleInputRef.current) {
      setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (title.trim() || body.trim()) {
        const draft = {
          category, title, body, tags, isAnonymous,
          lostOrFound, itemDescription, location,
          eventName, eventDate, eventLocation, isImportant,
          timestamp: Date.now()
        };
        localStorage.setItem('createPostDraft', JSON.stringify(draft));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [category, title, body, tags, isAnonymous, lostOrFound, itemDescription, location, eventName, eventDate, eventLocation, isImportant]);

  useEffect(() => {
    const draft = localStorage.getItem('createPostDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          if (window.confirm('Восстановить несохранённый черновик?')) {
            setCategory(parsed.category || 'news');
            setTitle(parsed.title || '');
            setBody(parsed.body || '');
            setTags(parsed.tags || []);
            setIsAnonymous(parsed.isAnonymous || false);
            setLostOrFound(parsed.lostOrFound || 'lost');
            setItemDescription(parsed.itemDescription || '');
            setLocation(parsed.location || '');
            setEventName(parsed.eventName || '');
            setEventDate(parsed.eventDate || '');
            setEventLocation(parsed.eventLocation || '');
            setIsImportant(parsed.isImportant || false);
            hapticFeedback('success');
          } else {
            localStorage.removeItem('createPostDraft');
          }
        }
      } catch (e) {
        console.error('Ошибка восстановления черновика:', e);
      }
    }
  }, []);

  useEffect(() => {
    setItemDescription('');
    setLocation('');
    setEventName('');
    setEventDate('');
    setEventLocation('');
    setIsImportant(false);
    
    if (category === 'confessions') {
      setIsAnonymous(true);
      if (images.length > 0) {
        setImages([]);
        setImageFiles([]);
        setError('');
      }
    } else {
      setIsAnonymous(false);
    }
  }, [category]);

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

  const calculateProgress = () => {
    let totalFields = 2;
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

  const hasContent = () => {
    return title.trim().length >= 3 || body.trim().length >= 10;
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

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    if (category === 'confessions') {
      hapticFeedback('error');
      setError('В категории Confessions нельзя прикреплять изображения (деанонимизация)');
      return;
    }

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots === 0) {
      hapticFeedback('error');
      setError(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const compressedFiles = [];
    const previews = [];

    try {
      for (const file of filesToProcess) {
        if (!ALLOWED_FORMATS.includes(file.type)) {
          setError('Формат не поддерживается. Используйте JPG, PNG, WebP или GIF');
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          setError(`Файл "${file.name}" слишком большой (макс 5MB)`);
          return;
        }

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: file.type
        };

        const compressedFile = await imageCompression(file, options);
        compressedFiles.push(compressedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
          previews.push(event.target.result);
          if (previews.length === filesToProcess.length) {
            setImages(prev => [...prev, ...previews]);
            setImageFiles(prev => [...prev, ...compressedFiles]);
            hapticFeedback('light');
            setError('');
          }
        };
        reader.readAsDataURL(compressedFile);
      }
    } catch (error) {
      console.error('Ошибка сжатия изображения:', error);
      setError('Ошибка обработки изображения. Попробуйте другой файл');
      hapticFeedback('error');
    }

    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    hapticFeedback('light');
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setError('');
  };

  const handleAddImageClick = () => {
    if (category === 'confessions') {
      hapticFeedback('error');
      setError('В категории Confessions нельзя прикреплять изображения');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      hapticFeedback('error');
      setError(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }
    fileInputRef.current?.click();
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
      setShowCreateModal(false);
      localStorage.removeItem('createPostDraft');
    }, 300);
  };

  const cancelClose = () => {
    hapticFeedback('light');
    setShowConfirmation(false);
  };

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

  const handlePublish = async () => {
    setAttemptedSubmit(true);
    setError('');

    if (!isFormValid()) {
      hapticFeedback('error');
      
      if (category === 'lost_found') {
        setError('Заполните все поля: заголовок, описание, что потеряли/нашли, и где');
      } else if (category === 'events') {
        setError('Заполните все поля: заголовок, описание, название события, дату и место');
      } else {
        setError('Заполните заголовок (мин. 3 символа) и описание (мин. 10 символов)');
      }
      return;
    }

    hapticFeedback('medium');
    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('title', title.trim());
      formData.append('body', body.trim());
      formData.append('tags', JSON.stringify(tags));
      formData.append('is_anonymous', isAnonymous);
      formData.append('enable_anonymous_comments', category === 'confessions' ? true : isAnonymous);

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

      imageFiles.forEach((file) => {
        formData.append('images', file);
      });

      setUploadProgress(40);

      const newPost = await createPost(formData, (progressEvent) => {
        const percentCompleted = Math.round(40 + (progressEvent.loaded / progressEvent.total) * 50);
        setUploadProgress(percentCompleted);
      });

      addNewPost(newPost);
      
      localStorage.removeItem('createPostDraft');
      setUploadProgress(100);
      
      hapticFeedback('success');
      
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
      console.error('Ошибка при создании поста:', error);
      hapticFeedback('error');
      
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error.code === 'ERR_NETWORK') {
        setError('Нет подключения к интернету. Проверьте соединение и попробуйте снова');
      } else {
        setError('Не удалось опубликовать пост. Попробуйте снова');
      }
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const isTitleValid = title.trim().length >= 3;
  const isBodyValid = body.trim().length >= 10;
  const canAddTag = tagInput.trim().length > 0 && 
                    tags.length < MAX_TAGS && 
                    !tags.includes(tagInput.trim().toLowerCase()) &&
                    tagInput.trim().length <= 20;

  const progress = calculateProgress();

  return (
    <>
      <style>{keyframesStyles}</style>
      
      <div 
        style={{
          ...styles.overlay,
          opacity: isVisible ? 1 : 0,
          pointerEvents: showConfirmation ? 'none' : 'auto'
        }}
        onClick={handleClose}
      >
        <div 
          style={{
            ...styles.modal,
            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
            opacity: isVisible ? 1 : 0
          }}
          onClick={(e) => e.stopPropagation()}
        >
          
          <div style={styles.swipeIndicator}>
            <div style={styles.swipeBar} />
          </div>

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

          <div style={styles.content}>
            
            <div style={styles.section}>
              <label style={styles.label}>Категория</label>
              
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
              
              {category !== 'confessions' && (
                <label style={styles.anonymousCheckbox}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => {
                      setIsAnonymous(e.target.checked);
                      hapticFeedback('light');
                    }}
                    style={styles.checkbox}
                    disabled={isSubmitting}
                  />
                  <span style={styles.checkboxText}>Опубликовать анонимно</span>
                </label>
              )}
              
              {category === 'confessions' && (
                <div style={styles.confessionHint}>
                  💭 Все признания публикуются анонимно (без фото)
                </div>
              )}
            </div>

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

            <div style={styles.section}>
              <label style={styles.label}>
                Изображения (опционально)
                <span style={styles.charCount}>{images.length}/{MAX_IMAGES}</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {images.length > 0 && (
                <div style={styles.imagesPreview}>
                  {images.map((img, index) => (
                    <div key={index} style={styles.imagePreviewItem}>
                      <img src={img} alt={`Превью ${index + 1}`} style={styles.previewImage} />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        style={styles.removeImageButton}
                        disabled={isSubmitting}
                        aria-label="Удалить изображение"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {images.length < MAX_IMAGES && category !== 'confessions' && (
                    <button
                      onClick={handleAddImageClick}
                      style={styles.addImagePlaceholder}
                      disabled={isSubmitting}
                    >
                      <Plus size={24} />
                    </button>
                  )}
                </div>
              )}

              {images.length === 0 && (
                <button
                  onClick={handleAddImageClick}
                  style={{
                    ...styles.addImageButton,
                    opacity: category === 'confessions' ? 0.5 : 1,
                    cursor: category === 'confessions' ? 'not-allowed' : 'pointer'
                  }}
                  disabled={isSubmitting || category === 'confessions'}
                >
                  <ImageIcon size={20} />
                  Добавить фото
                </button>
              )}

              <div style={styles.hint}>
                💡 Максимум {MAX_IMAGES} фото, до 5MB каждое. Авто-сжатие до 1MB
              </div>
            </div>

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

            <div style={{ height: 80 }} />

          </div>

          <ErrorMessage message={error} />

          <div style={styles.footer}>
            {isSubmitting && uploadProgress > 0 && (
              <div style={styles.uploadProgressContainer}>
                <div style={styles.uploadProgressBar}>
                  <div style={{ ...styles.uploadProgressFill, width: `${uploadProgress}%` }} />
                </div>
                <span style={styles.uploadProgressText}>Загрузка: {uploadProgress}%</span>
              </div>
            )}
            
            <button
              onClick={handlePublish}
              disabled={!isFormValid() || isSubmitting}
              style={
                isFormValid() && !isSubmitting
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
                  {uploadProgress < 40 ? 'Подготовка...' : uploadProgress < 90 ? 'Загрузка...' : 'Завершение...'}
                </>
              ) : !isFormValid() ? (
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
            
            <h3 style={styles.successTitle}>Пост опубликован! 🎉</h3>
            <p style={styles.successText}>Ваш пост появится в ленте через несколько секунд</p>
          </div>
        </div>
      )}

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
  // ... (все стили остаются БЕЗ ИЗМЕНЕНИЙ до конца, добавляю только новые)
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_CREATE_POST,
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
  anonymousCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    cursor: 'pointer'
  },
  confessionHint: {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.sm,
    background: `${theme.colors.confessions}15`,
    border: `1px solid ${theme.colors.confessions}30`,
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.sm
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
  uploadProgressContainer: {
    marginBottom: theme.spacing.md
  },
  uploadProgressBar: {
    width: '100%',
    height: 4,
    borderRadius: theme.radius.full,
    background: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs
  },
  uploadProgressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    borderRadius: theme.radius.full,
    transition: 'width 0.3s ease'
  },
  uploadProgressText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium
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
    zIndex: Z_CREATE_POST + 3,
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
    zIndex: Z_CREATE_POST + 2,
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  imagePreviewItem: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  removeImageButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: theme.transitions.fast,
    opacity: 0.9
  },
  addImagePlaceholder: {
    aspectRatio: '1',
    borderRadius: theme.radius.md,
    border: `2px dashed ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textTertiary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: theme.transitions.normal
  },
  addImageButton: {
    width: '100%',
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    borderRadius: theme.radius.md,
    border: `2px dashed ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md
  },
};

export default CreatePost;