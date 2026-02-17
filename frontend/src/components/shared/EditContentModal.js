// ===== 📄 ФАЙЛ: frontend/src/components/shared/EditContentModal.js =====

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Hash, Plus, Check, AlertCircle, MapPin, Calendar, 
  Image as ImageIcon, Trash2, BarChart2, Clock, EyeOff, Eye,
  Star, Lock, Info, Gift
} from 'lucide-react';
import { toast } from './Toast';
import { updatePost, updateRequest } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_EDIT_POST, Z_CONFIRMATION_DIALOG } from '../../constants/zIndex';
import imageCompression from 'browser-image-compression';
import { REWARD_TYPES, REWARD_TYPE_LABELS, REWARD_TYPE_ICONS, CATEGORIES } from '../../types';
import { useTelegramScreen } from './telegram/useTelegramScreen';
import DrilldownHeader from './DrilldownHeader';

// ===== CONSTANTS =====
const POPULAR_TAGS = ['python', 'react', 'помощь', 'курсовая', 'сопромат'];
const REQUEST_TAGS = ['помощь', 'срочно', 'курсовая', 'спорт', 'подвезти'];

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 1000;
const MAX_TAGS = 5;
const MAX_IMAGES = 3;
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const API_URL = 'http://localhost:8000'; 

// Категории
const POST_CATEGORIES = CATEGORIES.map(cat => ({
  ...cat,
  color: theme.colors[cat.value] || theme.colors.primary
}));

const REQUEST_CATEGORIES = [
  { value: 'study', label: 'Учёба', icon: '📚', color: '#3b82f6' },
  { value: 'help', label: 'Помощь', icon: '🤝', color: '#10b981' },
  { value: 'hangout', label: 'Движ', icon: '🎉', color: '#f59e0b' }
];

const normalizeText = (value) => String(value ?? '').trim();

const normalizeTags = (rawTags) => {
  let parsedTags = rawTags;

  if (typeof rawTags === 'string') {
    try {
      parsedTags = JSON.parse(rawTags);
    } catch {
      parsedTags = [];
    }
  }

  if (!Array.isArray(parsedTags)) return [];

  return parsedTags
    .map((tag) => normalizeText(tag).toLowerCase())
    .filter(Boolean);
};

const extractImageKey = (value) => {
  const raw = String(value ?? '');
  if (!raw) return '';

  const withoutHash = raw.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const normalized = withoutQuery.replace(/\\/g, '/');

  if (!normalized) return '';
  if (!normalized.includes('/')) return normalized;
  return normalized.split('/').pop() || '';
};

const normalizeInitialImageKeys = (rawImages) => {
  let parsedImages = rawImages;

  if (typeof rawImages === 'string') {
    try {
      parsedImages = JSON.parse(rawImages);
    } catch {
      parsedImages = [];
    }
  }

  if (!Array.isArray(parsedImages)) return [];

  return parsedImages
    .map((img) => {
      if (typeof img === 'object' && img !== null) {
        return extractImageKey(img.filename || img.url);
      }
      return extractImageKey(img);
    })
    .filter(Boolean);
};

const getBorderColor = (isValid, attemptedSubmit) => {
  if (!attemptedSubmit) return theme.colors.border;
  return isValid ? theme.colors.success : theme.colors.error;
};

function EditContentModal({ contentType = 'post', initialData, onClose, onSuccess }) {
  // ===== GLOBAL STATE =====
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // ===== DATA INITIALIZATION =====
  const isPost = contentType === 'post';
  const category = initialData.category || 'general';

  // Common Fields
  const [title, setTitle] = useState(() => initialData?.title || '');
  const [body, setBody] = useState(() => initialData?.body || '');
  const [tags, setTags] = useState(() => {
    if (!initialData) return [];
    if (Array.isArray(initialData.tags)) return initialData.tags;
    try { return JSON.parse(initialData.tags); } catch { return []; }
  });
  const [tagInput, setTagInput] = useState('');

  // Images (для постов И запросов)
  const [images, setImages] = useState(() => {
    const rawImages = initialData.images || [];
    let parsedImages = rawImages;
    
    if (typeof rawImages === 'string') {
        try { parsedImages = JSON.parse(rawImages); } catch { parsedImages = []; }
    }
    if (!Array.isArray(parsedImages)) parsedImages = [];

    return parsedImages.map(img => {
      let rawFilename = (typeof img === 'object' && img !== null) ? img.url : img;
      const fullUrl = rawFilename.startsWith('http') ? rawFilename : `${API_URL}/uploads/images/${rawFilename}`;
      return {
        url: fullUrl,
        filename: rawFilename,
        isNew: false
      };
    });
  });
  
  const [processingImages, setProcessingImages] = useState([]); // { id, progress }

  // Flags
  const [isAnonymous, setIsAnonymous] = useState(() => initialData?.is_anonymous || false);
  const [isImportant, setIsImportant] = useState(() => initialData?.is_important || false);
  
  // Lost & Found
  const [lostOrFound, setLostOrFound] = useState(() => initialData?.lost_or_found || 'lost');
  const [itemDescription, setItemDescription] = useState(() => initialData?.item_description || '');
  const [location, setLocation] = useState(() => initialData?.location || '');
  const [rewardType, setRewardType] = useState(() => initialData?.reward_type || REWARD_TYPES.NONE);
  const [rewardValue, setRewardValue] = useState(() => initialData?.reward_value || '');

  // Events
  const [eventName, setEventName] = useState(() => initialData?.event_name || '');
  const [eventDate, setEventDate] = useState(() => 
    initialData?.event_date ? new Date(initialData.event_date).toISOString().slice(0, 16) : ''
  );
  const [eventLocation, setEventLocation] = useState(() => initialData?.event_location || '');
  const [eventContact, setEventContact] = useState(() => initialData?.event_contact || '');
  const [activeEventDateBtn, setActiveEventDateBtn] = useState(null);

  // Polls
  const poll = initialData?.poll || null;

  // Request Specific
  const [expiresAt, setExpiresAt] = useState(() => initialData?.expires_at || '');
  const [activeTimeBtn, setActiveTimeBtn] = useState(() => {
    if (!initialData || !initialData.expires_at) return 72;
    
    const now = new Date();
    const expires = new Date(initialData.expires_at);
    const diffHours = Math.round((expires - now) / (1000 * 60 * 60));
    
    if (Math.abs(diffHours - 24) < 2) return 24;
    if (Math.abs(diffHours - 72) < 2) return 72;
    if (Math.abs(diffHours - 168) < 2) return 168;
    
    return 0;
  });

  // Refs
  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ===== EFFECTS =====

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 768 && !isSubmitting && titleInputRef.current) {
       setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, [isSubmitting]);

  // ===== HANDLERS =====

  const hasChanges = () => {
    if (normalizeText(title) !== normalizeText(initialData?.title)) return true;
    if (normalizeText(body) !== normalizeText(initialData?.body)) return true;

    const currentTags = normalizeTags(tags);
    const initialTags = normalizeTags(initialData?.tags);
    if (JSON.stringify(currentTags) !== JSON.stringify(initialTags)) return true;

    if (isPost) {
      if (Boolean(isAnonymous) !== Boolean(initialData?.is_anonymous)) return true;
      if (Boolean(isImportant) !== Boolean(initialData?.is_important)) return true;

      if (category === 'lost_found') {
        if (normalizeText(lostOrFound) !== normalizeText(initialData?.lost_or_found || 'lost')) return true;
        if (normalizeText(itemDescription) !== normalizeText(initialData?.item_description)) return true;
        if (normalizeText(location) !== normalizeText(initialData?.location)) return true;
        if (normalizeText(rewardType) !== normalizeText(initialData?.reward_type || REWARD_TYPES.NONE)) return true;
        if (normalizeText(rewardValue) !== normalizeText(initialData?.reward_value)) return true;
      }

      if (category === 'events') {
        const initialEventDate = initialData?.event_date
          ? new Date(initialData.event_date).toISOString().slice(0, 16)
          : '';

        if (normalizeText(eventName) !== normalizeText(initialData?.event_name)) return true;
        if (normalizeText(eventDate) !== normalizeText(initialEventDate)) return true;
        if (normalizeText(eventLocation) !== normalizeText(initialData?.event_location)) return true;
        if (normalizeText(eventContact) !== normalizeText(initialData?.event_contact)) return true;
      }
    } else {
      if (normalizeText(rewardType) !== normalizeText(initialData?.reward_type || REWARD_TYPES.NONE)) return true;
      if (normalizeText(rewardValue) !== normalizeText(initialData?.reward_value)) return true;
      if (normalizeText(expiresAt) !== normalizeText(initialData?.expires_at)) return true;
    }

    if (images.some((img) => img?.isNew)) return true;

    const currentExistingImageKeys = images
      .filter((img) => !img?.isNew)
      .map((img) => extractImageKey(img?.filename || img?.url))
      .filter(Boolean);

    const initialImageKeys = normalizeInitialImageKeys(initialData?.images);

    if (currentExistingImageKeys.length !== initialImageKeys.length) return true;

    for (let index = 0; index < currentExistingImageKeys.length; index += 1) {
      if (currentExistingImageKeys[index] !== initialImageKeys[index]) {
        return true;
      }
    }

    return false;
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (category === 'confessions' || category === 'polls') {
      hapticFeedback('error');
      toast.error(`В категории ${category === 'confessions' ? 'Признания' : 'Опросы'} нельзя менять изображения`);
      return;
    }

    const remainingSlots = MAX_IMAGES - images.length - processingImages.length;
    if (remainingSlots <= 0) {
      hapticFeedback('error');
      toast.error(`Максимум ${MAX_IMAGES} изображений`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const newProcessors = filesToProcess.map(() => ({ id: Math.random().toString(36).substr(2, 9), progress: 0 }));
    setProcessingImages(prev => [...prev, ...newProcessors]);
    hapticFeedback('light');

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const procId = newProcessors[i].id;

        if (!ALLOWED_FORMATS.includes(file.type)) {
          setProcessingImages(prev => prev.filter(p => p.id !== procId));
          continue;
        }

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          onProgress: (prog) => {
            setProcessingImages(prev => prev.map(p => p.id === procId ? { ...p, progress: prog } : p));
          }
        };

        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImages(prev => [...prev, {
              url: ev.target.result,
              file: compressedFile, 
              isNew: true
          }]);
          setProcessingImages(prev => prev.filter(p => p.id !== procId));
        };
        reader.readAsDataURL(compressedFile);
      }
      hapticFeedback('success');
    } catch (err) { 
      console.error(err);
      setProcessingImages([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    hapticFeedback('light');
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = (tag) => {
    const val = (tag || tagInput).trim().toLowerCase();
    if (val && !tags.includes(val) && tags.length < MAX_TAGS && val.length <= 20) {
      setTags([...tags, val]);
      setTagInput('');
      hapticFeedback('light');
    }
  };

  const setQuickDate = (type) => {
    hapticFeedback('light');
    const now = new Date();
    let targetDate = new Date();
    if (type === 'today') targetDate.setHours(18, 0, 0, 0);
    else if (type === 'tomorrow') { targetDate.setDate(now.getDate() + 1); targetDate.setHours(18, 0, 0, 0); }
    else if (type === 'week') { targetDate.setDate(now.getDate() + 7); targetDate.setHours(18, 0, 0, 0); }
    
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    
    setEventDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    setActiveEventDateBtn(type);
  };

  // ===== VALIDATION =====
  const isFormValid = () => {
    if (category === 'polls') {
      return title.trim().length >= 3;
    }
    const basicValid = title.trim().length >= 3 && body.trim().length >= 10;
    if (category === 'lost_found') {
      return basicValid && itemDescription.trim().length >= 3 && location.trim().length >= 3;
    }
    if (category === 'events') {
      return basicValid && eventName.trim().length >= 3 && eventDate && eventLocation.trim().length >= 3;
    }
    return basicValid;
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

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    setError('');

    if (!isFormValid()) {
        hapticFeedback('error');
        setError('Пожалуйста, заполните все обязательные поля');
        return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);

    try {
        if (isPost) {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('body', body.trim());
            formData.append('tags', JSON.stringify(tags));
            formData.append('is_anonymous', isAnonymous);
            // ✅ FIX: Отправляем is_important всегда
            formData.append('is_important', isImportant);
            
            if (category === 'lost_found') {
                formData.append('lost_or_found', lostOrFound);
                formData.append('item_description', itemDescription);
                formData.append('location', location);
                if (lostOrFound === 'lost' && rewardType !== REWARD_TYPES.NONE) {
                    formData.append('reward_type', rewardType);
                    formData.append('reward_value', rewardValue);
                }
            }
            if (category === 'events') {
                formData.append('event_name', eventName);
                formData.append('event_date', new Date(eventDate).toISOString());
                formData.append('event_location', eventLocation);
                if (eventContact) formData.append('event_contact', eventContact);
            }

            // Изображения: разделяем старые (keep) и новые (new)
            const oldImages = [];
            
            images.forEach(img => {
                if (img.isNew && img.file) {
                    // Новые файлы
                    formData.append('new_images', img.file);
                } else if (!img.isNew && img.filename) {
                    // Старые файлы
                    let cleanName = img.filename;
                    if (cleanName.includes('/')) cleanName = cleanName.split('/').pop();
                    if (cleanName) oldImages.push(cleanName);
                }
            });
            formData.append('keep_images', JSON.stringify(oldImages));

            setUploadProgress(50);
            const updatedPost = await updatePost(initialData.id, formData, (pe) => setUploadProgress(Math.round(40 + (pe.loaded / pe.total) * 50)));
            
            if (onSuccess) onSuccess(updatedPost);
            hapticFeedback('success');
            toast.success('Пост обновлён!');

        } else {
                // REQUEST UPDATE
                const requestData = {
                title: title.trim(),
                body: body.trim(),
                tags: tags,
                reward_type: rewardType,           
                reward_value: rewardValue || '',   
                expires_at: expiresAt              
            };
            
            const updatedReq = await updateRequest(initialData.id, requestData);
            if (onSuccess) onSuccess(updatedReq);
            hapticFeedback('success');
            toast.success('Запрос обновлён!');
        }

        setUploadProgress(100);
        setTimeout(confirmClose, 100);

      } catch (e) {
        console.error(e);
        
        let errorMsg = 'Ошибка сохранения';
        if (e.response?.data?.detail) {
          const detail = e.response.data.detail;
          if (Array.isArray(detail)) {
            errorMsg = detail.map(err => err.msg || err.type).join(', ');
          } else if (typeof detail === 'string') {
            errorMsg = detail;
          }
        }
        
        toast.error(errorMsg);
        setIsSubmitting(false);
        setUploadProgress(0);
      }
  };

  // ===== RENDER HELPERS =====
  
  const TagBadge = ({ tag, onRemove }) => (
    <span style={styles.tag}>
      #{tag}
      <button style={styles.tagRemove} onClick={(e) => { e.stopPropagation(); onRemove(tag); }} disabled={isSubmitting}>
        <X size={16} />
      </button>
    </span>
  );

  const CharCounter = ({ current, min, max, isValid }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: theme.fontSize.xs }}>
        {!isValid && <span style={{ color: theme.colors.textTertiary }}>мин. {min}</span>}
        <span style={{color: isValid ? theme.colors.textTertiary : theme.colors.error}}>
            {current}/{max} 
        </span>
        {isValid && <Check size={14} color={theme.colors.success} />}
    </div>
  );

  const CircularProgress = ({ progress }) => (
    <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle 
          cx="20" cy="20" r="16" fill="none" stroke={theme.colors.primary} strokeWidth="4" 
          strokeDasharray={`${2 * Math.PI * 16}`} 
          strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`} 
          strokeLinecap="round" 
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
    </div>
  );
  
  const categoryData = isPost 
      ? (POST_CATEGORIES.find(c => c.value === category) || POST_CATEGORIES[0])
      : (REQUEST_CATEGORIES.find(c => c.value === category) || REQUEST_CATEGORIES[0]);

  const editorTitle = isPost ? 'Редактирование поста' : 'Редактирование запроса';
  const hasUnsavedChanges = hasChanges();

  useTelegramScreen({
    id: `edit-content-modal-${contentType}-${initialData?.id || 'unknown'}`,
    title: editorTitle,
    priority: 120,
    back: {
      visible: isVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: showConfirmation
      ? {
          visible: isVisible,
          text: 'Выйти',
          onClick: confirmClose,
          enabled: !isSubmitting,
          loading: false,
          color: theme.colors.error,
        }
      : {
          visible: isVisible && hasUnsavedChanges,
          text: 'Сохранить изменения',
          onClick: handleSubmit,
          enabled: hasUnsavedChanges && !isSubmitting,
          loading: isSubmitting,
        },
    secondary: {
      visible: isVisible && showConfirmation,
      text: 'Вернуться',
      onClick: () => setShowConfirmation(false),
      enabled: !isSubmitting,
      loading: false,
    },
  });

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
          {isSubmitting && (
            <div style={styles.topProgressBar}>
              <div style={{ ...styles.topProgressFill, width: `${uploadProgress}%` }} />
            </div>
          )}

                    {/* Telegram/local header */}
          <DrilldownHeader title={editorTitle} onBack={handleClose} />

          {/* CONTENT */}
          <div style={styles.contentWrapper}>
             <div style={styles.formScrollContent}>
                  
                  {/* Category (LOCKED) */}
                  <div style={styles.section}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                         <label style={styles.label}>Категория (нельзя изменить)</label>
                         
                         {/* ANONYMITY STATUS - STATUS ONLY */}
                         <div style={{
                             display: 'flex', alignItems: 'center', gap: 6,
                             opacity: 0.8,
                             background: isAnonymous ? `${theme.colors.textSecondary}15` : `${theme.colors.primary}15`,
                             padding: '4px 8px',
                             borderRadius: 6
                         }}>
                            {isAnonymous ? 
                                <><EyeOff size={14} color={theme.colors.textSecondary}/> <span style={{fontSize: 12, fontWeight: 600, color: theme.colors.textSecondary}}>Анонимно</span></> 
                                : 
                                <><Eye size={14} color={theme.colors.primary}/> <span style={{fontSize: 12, fontWeight: 600, color: theme.colors.primary}}>Публично</span></>
                            }
                            <Lock size={10} color={theme.colors.textTertiary} style={{marginLeft: 2}}/>
                         </div>
                    </div>

                    <div 
                        style={{
                            ...styles.categoryReadonly,
                            borderColor: categoryData.color,
                            background: `${categoryData.color}10`
                        }}
                    >
                        <span style={styles.categoryIcon}>{categoryData.icon}</span>
                        <span style={styles.categoryText}>{categoryData.label}</span>
                        <Lock size={14} style={{ color: theme.colors.textTertiary }} />
                    </div>

                    {category === 'confessions' && (
                        <div style={styles.infoHint}>
                            <Info size={14} />
                            Посты в "Подслушано" всегда анонимны.
                        </div>
                    )}
                  </div>

                  {/* Main Inputs */}
                  {category !== 'polls' ? (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>
                          {isPost ? 'Заголовок' : 'Суть запроса'}
                          <CharCounter current={title.length} min={3} max={MAX_TITLE_LENGTH} isValid={title.trim().length >= 3} />
                        </label>
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          style={{
                            ...styles.input,
                            borderColor: getBorderColor(title.trim().length >= 3, attemptedSubmit)
                          }}
                          maxLength={MAX_TITLE_LENGTH}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div style={styles.section}>
                        <label style={styles.label}>
                          {isPost ? 'Текст поста' : 'Подробности'}
                          <CharCounter current={body.length} min={10} max={MAX_BODY_LENGTH} isValid={body.trim().length >= 10} />
                        </label>
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          style={{
                            ...styles.textarea,
                            borderColor: getBorderColor(body.trim().length >= 10, attemptedSubmit)
                          }}
                          rows={6}
                          maxLength={MAX_BODY_LENGTH}
                          disabled={isSubmitting}
                        />
                      </div>
                    </>
                  ) : (
                       <div style={styles.section}>
                         <label style={styles.label}>Заголовок опроса</label>
                         <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />
                         
                         <div style={{marginTop: 12}}>
                             <label style={styles.label}>Описание (опционально)</label>
                             <textarea value={body} onChange={(e)=>setBody(e.target.value)} style={styles.textarea} rows={3} />
                         </div>
                       </div>
                  )}

                  {/* POLL WIDGET (LOCKED) */}
                  {category === 'polls' && poll && (
                      <div style={styles.section}>
                          <label style={styles.label}>Варианты ответов (изменить нельзя)</label>
                          <div style={styles.pollLocked}>
                              {poll?.options?.map((opt, i) => (
                                  <div key={i} style={styles.pollOptionLocked}>
                                      <div style={styles.pollCircle} />
                                      <span>{opt}</span>
                                  </div>
                              ))}
                              <div style={styles.lockOverlay}>
                                  <Lock size={16} /> Структура зафиксирована
                              </div>
                          </div>
                      </div>
                  )}
                  
                  {/* LOST & FOUND */}
                  {isPost && category === 'lost_found' && (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>Статус</label>
                        <div style={styles.toggleWrapper}>
                            <button onClick={()=>{setLostOrFound('lost'); hapticFeedback('light');}} style={lostOrFound==='lost' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}>😢 Потерял</button>
                            <button onClick={()=>{setLostOrFound('found'); hapticFeedback('light');}} style={lostOrFound==='found' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}>🎉 Нашёл</button>
                        </div>
                      </div>
                      <div style={styles.section}>
                        <label style={styles.label}>Что именно?*</label>
                        <input type="text" value={itemDescription} onChange={e=>setItemDescription(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                      <div style={styles.section}>
                         <label style={styles.label}><div style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={14}/> Где?*</div></label>
                         <input type="text" value={location} onChange={e=>setLocation(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                    </>
                  )}

                  {/* EVENTS */}
                  {isPost && category === 'events' && (
                    <>
                      <div style={styles.section}>
                        <label style={styles.label}>Название события*</label>
                        <input type="text" value={eventName} onChange={e=>setEventName(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                      <div style={styles.section}>
                         <label style={styles.label}><div style={{display:'flex',alignItems:'center',gap:6}}><Calendar size={14}/> Дата и время*</div></label>
                         <div style={styles.quickDateButtons}>
                             <button onClick={()=>setQuickDate('today')} style={activeEventDateBtn === 'today' ? styles.quickDateBtnActive : styles.quickDateBtn} type="button">Сегодня</button>
                             <button onClick={()=>setQuickDate('tomorrow')} style={activeEventDateBtn === 'tomorrow' ? styles.quickDateBtnActive : styles.quickDateBtn} type="button">Завтра</button>
                             <button onClick={()=>setQuickDate('week')} style={activeEventDateBtn === 'week' ? styles.quickDateBtnActive : styles.quickDateBtn} type="button">Через неделю</button>
                         </div>
                         <input
                          type="datetime-local"
                          value={eventDate}
                          onChange={(e) => { setEventDate(e.target.value); setActiveEventDateBtn(null); }}
                          style={{
                            ...styles.input,
                            marginTop: theme.spacing.sm,
                            borderColor: getBorderColor(!!eventDate, attemptedSubmit)
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div style={styles.section}>
                         <label style={styles.label}><div style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={14}/> Место*</div></label>
                         <input type="text" value={eventLocation} onChange={e=>setEventLocation(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                      <div style={styles.section}>
                          <label style={styles.label}>Контакт (опционально)</label>
                          <input type="text" value={eventContact} onChange={e=>setEventContact(e.target.value)} style={styles.input} disabled={isSubmitting} />
                      </div>
                    </>
                  )}

                  {/* IMAGES (Скрыты для Polls и Confessions) */}
                  {isPost && category !== 'polls' && category !== 'confessions' && (
                    <div style={styles.section}>
                      <label style={styles.label}>
                          Изображения 
                          <span style={styles.charCount}>{images.length + processingImages.length}/{MAX_IMAGES}</span>
                      </label>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                      
                      {(images.length > 0 || processingImages.length > 0) ? (
                        <div style={styles.imagesPreview}>
                            {images.map((img, i) => (
                            <div key={i} style={styles.imagePreviewItem}>
                                <img src={img.url} style={styles.previewImage} alt="" />
                                <button onClick={() => handleRemoveImage(i)} style={styles.removeImageButton}><Trash2 size={16} /></button>
                                {/* Бейдж "Новое" - ФИОЛЕТОВЫЙ */}
                                {img.isNew && <div style={styles.newBadge}>NEW</div>}
                            </div>
                            ))}
                            
                            {/* Загрузка */}
                            {processingImages.map((proc) => (
                                <div key={proc.id} style={styles.imagePreviewItem}>
                                    <div style={styles.loadingOverlay}>
                                        <CircularProgress progress={proc.progress} />
                                        <span style={styles.loadingPercent}>{Math.round(proc.progress)}%</span>
                                    </div>
                                </div>
                            ))}

                            {/* Кнопка Добавить внутри сетки */}
                            {(images.length + processingImages.length) < MAX_IMAGES && (
                            <button onClick={()=>fileInputRef.current?.click()} style={styles.addImagePlaceholder} disabled={isSubmitting}>
                                <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <Plus size={24} />
                                </div>
                            </button>
                            )}
                        </div>
                      ) : (
                          // Кнопка "Добавить фото" когда нет изображений (Как в CreateContentModal)
                          <button onClick={()=>fileInputRef.current?.click()} style={styles.addImageButton} disabled={isSubmitting}>
                              <ImageIcon size={20} /> Добавить фото
                          </button>
                      )}
                    </div>
                  )}
                  {/* ПОЛЯ ДЛЯ ЗАПРОСОВ */}
                  {!isPost && (
                    <>
                      {/* НАГРАДА */}
                      <div style={styles.section}>
                        <label style={styles.label}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <Gift size={16}/> Награда
                          </div>
                          <span style={{fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, fontWeight: 400}}>опционально</span>
                        </label>
                        <div style={{
                          padding: theme.spacing.md,
                          borderRadius: theme.radius.lg,
                          background: `linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(255,165,0,0.08) 100%)`,
                          border: `2px dashed rgba(255,215,0,0.25)`
                        }}>
                          <select 
                            value={rewardType} 
                            onChange={e=>setRewardType(e.target.value)} 
                            style={{...styles.input, marginBottom: rewardType !== REWARD_TYPES.NONE ? theme.spacing.sm : 0}}
                            disabled={isSubmitting}
                          >
                            {Object.entries(REWARD_TYPE_LABELS).map(([k,l])=>(
                              <option key={k} value={k}>{REWARD_TYPE_ICONS[k]} {l}</option>
                            ))}
                          </select>
                          {rewardType !== REWARD_TYPES.NONE && (
                            <input 
                              type="text" 
                              placeholder={
                                rewardType==='money' ? "Например: 500₽" :
                                rewardType==='help_back' ? "Например: Помогу с программированием" :
                                rewardType==='food' ? "Например: Кофе в буфете" :
                                "Опишите награду"
                              }
                              value={rewardValue} 
                              onChange={e=>setRewardValue(e.target.value)} 
                              style={styles.input}
                              maxLength={100}
                              disabled={isSubmitting}
                            />
                          )}
                        </div>
                      </div>

                      {/* ИЗОБРАЖЕНИЯ ДЛЯ ЗАПРОСОВ */}
                      <div style={styles.section}>
                        <label style={styles.label}>
                            Изображения (опционально)
                            <span style={styles.charCount}>{images.length + processingImages.length}/{MAX_IMAGES}</span>
                        </label>
                        <input 
                          ref={fileInputRef} 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={handleFileSelect} 
                          style={{ display: 'none' }} 
                        />
                        
                        {(images.length > 0 || processingImages.length > 0) ? (
                          <div style={styles.imagesPreview}>
                              {images.map((img, i) => (
                              <div key={i} style={styles.imagePreviewItem}>
                                  <img src={img.url} style={styles.previewImage} alt="" />
                                  <button 
                                    onClick={() => handleRemoveImage(i)} 
                                    style={styles.removeImageButton}
                                    disabled={isSubmitting}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  {img.isNew && <div style={styles.newBadge}>NEW</div>}
                              </div>
                              ))}
                              
                              {processingImages.map((proc) => (
                                  <div key={proc.id} style={styles.imagePreviewItem}>
                                      <div style={styles.loadingOverlay}>
                                          <CircularProgress progress={proc.progress} />
                                          <span style={styles.loadingPercent}>{Math.round(proc.progress)}%</span>
                                      </div>
                                  </div>
                              ))}
                              
                              {(images.length + processingImages.length) < MAX_IMAGES && (
                              <button 
                                onClick={() => fileInputRef.current?.click()} 
                                style={styles.addImagePlaceholder} 
                                disabled={isSubmitting}
                              >
                                  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                      <Plus size={24} />
                                  </div>
                              </button>
                              )}
                          </div>
                        ) : (
                            <button 
                              onClick={() => fileInputRef.current?.click()} 
                              style={styles.addImageButton} 
                              disabled={isSubmitting}
                            >
                                <ImageIcon size={20} /> Добавить фото
                            </button>
                        )}
                      </div>

                      {/* ВРЕМЯ ИСТЕЧЕНИЯ */}
                      <div style={styles.section}>
                        <label style={styles.label}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <Clock size={16}/> Актуально до*
                          </div>
                        </label>
                        <div style={styles.quickDateButtons}>
                          {[24, 72, 168].map(h => (
                              <button 
                                key={h}
                                onClick={() => { 
                                  const now = new Date();
                                  const future = new Date(now.getTime() + h * 60 * 60 * 1000);
                                  setExpiresAt(future.toISOString()); 
                                  setActiveTimeBtn(h); 
                                  hapticFeedback('light');
                                }} 
                                style={activeTimeBtn === h ? styles.quickDateBtnActive : styles.quickDateBtn}
                                type="button"
                                disabled={isSubmitting}
                              >
                                  {h === 24 ? '24ч' : h === 72 ? '3 дня' : 'Неделя'}
                              </button>
                          ))}
                        </div>
                        <input
                          type="datetime-local"
                          value={expiresAt ? new Date(expiresAt).toISOString().slice(0, 16) : ''}
                          onChange={(e) => {
                            setExpiresAt(new Date(e.target.value).toISOString());
                            setActiveTimeBtn(0);
                          }}
                          style={{
                            ...styles.input,
                            marginTop: theme.spacing.sm,
                            borderColor: getBorderColor(!!expiresAt, attemptedSubmit)
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                    </>
                  )}
                  {/* TAGS */}
                  <div style={styles.section}>
                    <label style={styles.label}>Теги</label>
                    <div style={styles.tagInputWrapper}>
                      <Hash size={18} style={{ color: theme.colors.primary, flexShrink: 0 }} />
                      <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} style={styles.tagInput} placeholder="добавить тег..." onKeyPress={(e) => e.key === 'Enter' && addTag()} disabled={isSubmitting || tags.length>=MAX_TAGS} />
                      <button onClick={() => addTag()} style={tagInput.trim() ? styles.addTagButtonActive : styles.addTagButton} disabled={!tagInput.trim()}><Plus size={18} /></button>
                    </div>
                    {tags.length > 0 && (
                        <div style={styles.tagsList}>
                        {tags.map(tag => <TagBadge key={tag} tag={tag} onRemove={(t) => setTags(p => p.filter(x => x !== t))} />)}
                        </div>
                    )}
                  </div>
                  
                  <div style={{ height: theme.spacing.xl }} />
             </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={styles.errorAlert}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

                  </div>
      </div>

      {/* CONFIRMATION DIALOG */}
      {showConfirmation && (
        <div style={styles.confirmationOverlay}>
          <div style={styles.confirmationDialog}>
            <h3 style={styles.confirmationTitle}>Отменить изменения?</h3>
            <p style={styles.confirmationText}>Все правки будут потеряны</p>
            <div style={styles.confirmationButtons}>
              <button onClick={() => setShowConfirmation(false)} style={styles.confirmationCancel}>Вернуться</button>
              <button onClick={confirmClose} style={styles.confirmationConfirm}>Выйти</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
    zIndex: Z_EDIT_POST, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    transition: 'opacity 0.3s ease',
  },
  modal: {
    position: 'fixed', inset: 0,
    background: theme.colors.bg,
    display: 'flex', flexDirection: 'column',
    boxShadow: theme.shadows.lg,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  },
  topProgressBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: theme.colors.bgSecondary, zIndex: 1000,
  },
  topProgressFill: {
    height: '100%', background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.success} 100%)`,
    transition: 'width 0.3s ease',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderBottom: `1px solid ${theme.colors.border}`, flexShrink: 0,
  },
  closeButton: {
    background: 'none', border: 'none', color: theme.colors.text,
    padding: 8, borderRadius: theme.radius.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text, margin: 0,
  },
  contentWrapper: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
  },
  formScrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: `calc(${theme.spacing.lg}px + var(--screen-bottom-offset))`,
  },

  // FORM ELEMENTS
  section: { marginBottom: theme.spacing.lg },
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text, marginBottom: theme.spacing.sm,
  },
  input: {
    width: '100%', padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary, 
    borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border,
    borderRadius: theme.radius.md, color: theme.colors.text, fontSize: theme.fontSize.md,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s ease',
  },
  textarea: {
    width: '100%', padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary, 
    borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border,
    borderRadius: theme.radius.md, color: theme.colors.text, fontSize: theme.fontSize.md,
    outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
    boxSizing: 'border-box', transition: 'border-color 0.2s ease',
  },
  
  // CATEGORY LOCKED
  categoryReadonly: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    opacity: 0.9
  },
  categoryIcon: { fontSize: '20px', lineHeight: 1 },
  categoryText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1
  },
  infoHint: {
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: theme.colors.textSecondary,
      paddingLeft: 4
  },

  // POLL LOCKED
  pollLocked: {
      position: 'relative',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      background: theme.colors.bgSecondary
  },
  pollOptionLocked: {
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 8, opacity: 0.6
  },
  pollCircle: {
      width: 18, height: 18, borderRadius: '50%', border: `2px solid ${theme.colors.textTertiary}`
  },
  lockOverlay: {
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, color: theme.colors.textSecondary, fontWeight: 600, fontSize: 13,
      backdropFilter: 'blur(1px)'
  },

  // LOST & FOUND TOGGLE
  toggleWrapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm },
  toggleButton: {
      padding: theme.spacing.md, 
      borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.border, 
      borderRadius: theme.radius.md,
      background: theme.colors.bgSecondary, color: theme.colors.text, cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium, transition: 'all 0.2s ease'
  },
  toggleButtonActive: { borderColor: theme.colors.primary, background: `${theme.colors.primary}15`, color: theme.colors.primary },

  // IMAGES
  imagesPreview: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  imagePreviewItem: { position: 'relative', paddingTop: '100%', borderRadius: theme.radius.md, overflow: 'hidden', backgroundColor: theme.colors.bgSecondary },
  previewImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  removeImageButton: {
    position: 'absolute', top: 4, right: 4,
    padding: 4, background: 'rgba(0,0,0,0.7)', border: 'none',
    borderRadius: 4, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
  },
  newBadge: {
    position: 'absolute', bottom: 4, right: 4,
    padding: '2px 6px', background: theme.colors.primary, color: '#fff', // ✅ FIOL
    borderRadius: 4, fontSize: 10, fontWeight: 'bold'
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: `${theme.colors.bgSecondary}CC`, zIndex: 5
  },
  loadingPercent: { fontSize: 10, fontWeight: 'bold', color: theme.colors.textSecondary, marginTop: 4 },
  addImagePlaceholder: {
    paddingTop: '100%', position: 'relative', border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md, background: theme.colors.bgSecondary,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.textTertiary,
    cursor: 'pointer', transition: 'all 0.2s ease', padding: 0
  },
  addImageButton: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    border: `2px dashed ${theme.colors.border}`, borderRadius: theme.radius.md, background: 'transparent',
    color: theme.colors.textSecondary, cursor: 'pointer', fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.medium,
    transition: 'all 0.2s ease', width: '100%', justifyContent: 'center'
  },

  // TAGS
  tagInputWrapper: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.md}px`, background: theme.colors.bgSecondary,
    border: `2px solid ${theme.colors.border}`, borderRadius: theme.radius.md, transition: 'border-color 0.2s ease',
  },
  tagInput: { flex: 1, background: 'transparent', border: 'none', color: theme.colors.text, fontSize: theme.fontSize.md, outline: 'none' },
  addTagButton: { padding: 6, background: theme.colors.bgTertiary, border: 'none', borderRadius: 4, color: theme.colors.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  addTagButtonActive: { padding: 6, background: theme.colors.primary, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tagsList: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', background: `${theme.colors.primary}15`,
    color: theme.colors.primary, borderRadius: 4, fontSize: 13,
    fontWeight: 500
  },
  tagRemove: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' },

  // DATE BUTTONS
  quickDateButtons: { display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  quickDateBtn: {
    flex: 1, padding: `12px 14px`, background: theme.colors.bgSecondary, 
    borderWidth: '1px', borderStyle: 'solid', borderColor: theme.colors.border,
    borderRadius: theme.radius.sm, color: theme.colors.textSecondary, 
    fontSize: theme.fontSize.sm, cursor: 'pointer', transition: 'all 0.2s ease',
  },
  quickDateBtnActive: {
      flex: 1, padding: `12px 14px`, background: theme.colors.primary,
      borderWidth: '1px', borderStyle: 'solid', borderColor: theme.colors.primary, 
      borderRadius: theme.radius.sm, color: '#fff',
      fontSize: theme.fontSize.sm, cursor: 'pointer', transition: 'all 0.2s ease',
  },

  // FOOTER & ERROR
  errorAlert: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    padding: theme.spacing.md, background: `${theme.colors.error}15`,
    border: `1px solid ${theme.colors.error}`, borderRadius: theme.radius.md,
    color: theme.colors.error, fontSize: theme.fontSize.sm, margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
    animation: 'shake 0.3s ease',
  },
  footer: { padding: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}`, flexShrink: 0 },
  publishButton: {
    width: '100%', padding: 14,
    borderRadius: theme.radius.md, fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.bold,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.2s ease',
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    color: '#fff', border: 'none'
  },

  // CONFIRMATION
  confirmationOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_CONFIRMATION_DIALOG,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease',
  },
  confirmationDialog: {
    background: theme.colors.bg, borderRadius: theme.radius.xl,
    padding: theme.spacing.xl, margin: theme.spacing.lg, maxWidth: 300, width: '100%',
    textAlign: 'center'
  },
  confirmationTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  confirmationText: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20 },
  confirmationButtons: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  confirmationCancel: { padding: 10, background: theme.colors.bgSecondary, border: 'none', borderRadius: 8, color: theme.colors.text, fontWeight: '600' },
  confirmationConfirm: { padding: 10, background: theme.colors.error, border: 'none', borderRadius: 8, color: '#fff', fontWeight: '600' },
};

const keyframesStyles = `
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  .animate-spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export default EditContentModal;
