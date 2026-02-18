// ===== 📄 ФАЙЛ: frontend/src/components/market/EditMarketItemModal.js =====

import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Trash2, Plus, MapPin } from 'lucide-react';
import { updateMarketItem } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import imageCompression from 'browser-image-compression';
import { Z_MODAL_MARKET_DETAIL } from '../../constants/zIndex';
import { 
  CharCounter, 
  FieldHint,
  PLACEHOLDERS,
  ERROR_MESSAGES,
  getBorderColor,
} from '../shared/FormValidation';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import { resolveImageUrl } from '../../utils/mediaUrl';

const MARKET_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 500,
  LOCATION_MAX: 100,
  CUSTOM_CATEGORY_MAX: 50,
  IMAGES_MIN: 1,
  IMAGES_MAX: 3,
};

const IMAGE_SETTINGS = {
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_SIZE_MB: 1,
  MAX_DIMENSION: 1200,
};

const MAX_TITLE_LENGTH = MARKET_LIMITS.TITLE_MAX;
const MAX_DESCRIPTION_LENGTH = MARKET_LIMITS.DESCRIPTION_MAX;
const MAX_LOCATION_LENGTH = MARKET_LIMITS.LOCATION_MAX;
const MAX_CUSTOM_CATEGORY_LENGTH = MARKET_LIMITS.CUSTOM_CATEGORY_MAX;
const MAX_IMAGES = MARKET_LIMITS.IMAGES_MAX;
const ALLOWED_FORMATS = IMAGE_SETTINGS.ALLOWED_FORMATS;

const MARKET_COLOR = theme.colors.market;

const normalizeText = (value) => String(value ?? '').trim();

const normalizePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const CATEGORIES = [
  { id: 'textbooks', label: 'Учебники', emoji: '📚' },
  { id: 'electronics', label: 'Электроника', emoji: '💻' },
  { id: 'furniture', label: 'Мебель', emoji: '🛋️' },
  { id: 'clothing', label: 'Одежда', emoji: '👕' },
  { id: 'sports', label: 'Спорт', emoji: '⚽' },
  { id: 'appliances', label: 'Техника', emoji: '🔌' },
];

const CONDITIONS = [
  { value: 'new', label: 'Новое', emoji: '✨' },
  { value: 'like_new', label: 'Как новое', emoji: '🌟' },
  { value: 'good', label: 'Хорошее', emoji: '👍' },
  { value: 'fair', label: 'Нормальное', emoji: '👌' },
];

function EditMarketItemModal({ item, onClose, onSuccess }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isTelegramActionsVisible, setIsTelegramActionsVisible] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice] = useState(item?.price || '');
  
  // Проверяем, если category не входит в стандартные — значит custom
  const isCustomCategory = item?.category && !CATEGORIES.some(c => c.id === item.category);
  const [category, setCategory] = useState(isCustomCategory ? 'custom' : (item?.category || 'textbooks'));
  const [customCategory, setCustomCategory] = useState(isCustomCategory ? item.category : '');
  
  const [condition, setCondition] = useState(item?.condition || 'good');
  const [location, setLocation] = useState(item?.location || '');

  const [images, setImages] = useState(() => {
    const rawImages = item?.images || [];
    let parsedImages = Array.isArray(rawImages) ? rawImages : [];
    
    return parsedImages.map(img => {
      const filename = (typeof img === 'object' && img?.url) ? img.url : img;
      const fullUrl = resolveImageUrl(filename, 'images');
      
      return {
        url: fullUrl,
        filename: filename,
        isNew: false
      };
    });
  });

  const [processingImages, setProcessingImages] = useState([]);

  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  useEffect(() => {
    if (window.innerWidth >= 768 && !isSubmitting && titleInputRef.current) {
      setTimeout(() => titleInputRef.current.focus(), 300);
    }
  }, [isSubmitting]);

  const hasChanges = () => {
    if (normalizeText(title) !== normalizeText(item?.title)) return true;
    if (normalizeText(description) !== normalizeText(item?.description)) return true;

    const currentPrice = normalizePrice(price);
    const initialPrice = normalizePrice(item?.price);
    if (currentPrice !== initialPrice) return true;

    const finalCategory = category === 'custom' ? customCategory : category;
    if (normalizeText(finalCategory) !== normalizeText(item?.category)) return true;

    if (normalizeText(condition) !== normalizeText(item?.condition)) return true;
    if (normalizeText(location) !== normalizeText(item?.location)) return true;

    const hasNewImages = images.some((img) => img?.isNew);
    if (hasNewImages) return true;

    const currentExistingImageKeys = images
      .filter((img) => !img?.isNew)
      .map((img) => extractImageKey(img?.filename || img?.url))
      .filter(Boolean);

    const initialImageKeys = (item?.images || [])
      .map((img) => extractImageKey(typeof img === 'object' ? img?.url : img))
      .filter(Boolean);

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

    const remainingSlots = MAX_IMAGES - images.length - processingImages.length;
    if (remainingSlots <= 0) {
      hapticFeedback('error');
      toast.warning(`Максимум ${MAX_IMAGES} фотографии`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const newProcessors = filesToProcess.map(() => ({ 
      id: Math.random().toString(36).substr(2, 9), 
      progress: 0 
    }));
    
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
            setProcessingImages(prev => 
              prev.map(p => p.id === procId ? { ...p, progress: prog } : p)
            );
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
      toast.error('Ошибка загрузки изображений');
      setProcessingImages([]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    hapticFeedback('light');
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = () => {
    const finalCategory = category === 'custom' ? customCategory.trim() : category;
    
    return (
      title.trim().length >= 3 &&
      description.trim().length >= 10 &&
      price > 0 &&
      images.length >= 1 &&
      finalCategory.length > 0
    );
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
    setIsTelegramActionsVisible(false);
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
      setError('Заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', parseFloat(price));
      
      // Финальная категория
      const finalCategory = category === 'custom' ? customCategory.trim() : category;
      formData.append('category', finalCategory);
      
      formData.append('condition', condition);
      
      if (location.trim()) {
        formData.append('location', location.trim());
      }

      const oldImages = [];
      images.forEach(img => {
        if (img.isNew && img.file) {
          formData.append('new_images', img.file);
        } else if (!img.isNew && img.filename) {
          let cleanName = img.filename;
          if (cleanName.includes('/')) cleanName = cleanName.split('/').pop();
          if (cleanName) oldImages.push(cleanName);
        }
      });
      
      formData.append('keep_images', JSON.stringify(oldImages));

      setUploadProgress(50);

      const updatedItem = await updateMarketItem(
        item.id, 
        formData,
        (pe) => setUploadProgress(Math.round(40 + (pe.loaded / pe.total) * 50))
      );

      if (onSuccess) onSuccess(updatedItem);

      hapticFeedback('success');
      toast.success('Изменения сохранены');

      setUploadProgress(100);
      setTimeout(confirmClose, 100);
      
    } catch (e) {
      console.error(e);
      const errorMsg = e.response?.data?.detail || 'Ошибка сохранения';
      toast.error(errorMsg);
      hapticFeedback('error');
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const canSubmit = isFormValid();
  const hasUnsavedChanges = hasChanges();

  useTelegramScreen({
    id: `edit-market-item-modal-${item?.id || 'unknown'}`,
    title: 'Редактировать товар',
    priority: 120,
    back: {
      visible: isTelegramActionsVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: !hasUnsavedChanges && !showConfirmation ? { visible: false } : showConfirmation
      ? {
          visible: isTelegramActionsVisible,
          text: 'Выйти',
          onClick: confirmClose,
          enabled: !isSubmitting,
          loading: false,
          color: theme.colors.error,
        }
      : {
          visible: isTelegramActionsVisible,
          text: 'Сохранить изменения',
          onClick: handleSubmit,
          enabled: hasUnsavedChanges && canSubmit && !isSubmitting,
          loading: isSubmitting,
          color: MARKET_COLOR,
        },
    secondary: {
      visible: isTelegramActionsVisible && showConfirmation,
      text: 'Вернуться',
      onClick: () => setShowConfirmation(false),
      enabled: !isSubmitting,
      loading: false,
    },
  });

  return (
    <>
        <div
          style={{
            ...styles.overlay,
            opacity: isVisible ? 1 : 0,
            pointerEvents: showConfirmation ? 'none' : 'auto',
          }}
          onClick={handleClose}
        >
        <div
          style={{
            ...styles.modal,
            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
            opacity: isVisible ? 1 : 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
        
        {/* TOP PROGRESS BAR */}
        {isSubmitting && (
          <div style={styles.topProgressBar}>
            <div style={{
              ...styles.topProgressFill,
              width: `${uploadProgress}%`,
            }} />
          </div>
        )}

        <DrilldownHeader title="Редактировать товар" onBack={handleClose} />

        {/* ERROR */}
        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* CONTENT */}
        <div style={styles.contentWrapper}>
          <div style={styles.formScrollContent}>
            
            {/* НАЗВАНИЕ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Название товара*
                <CharCounter 
                  current={title.length} 
                  min={3} 
                  max={MAX_TITLE_LENGTH}
                  isValid={title.length >= 3}
                />
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder={PLACEHOLDERS.marketTitle}
                maxLength={MAX_TITLE_LENGTH}
                disabled={isSubmitting}
                style={{
                  ...styles.input,
                  borderColor: getBorderColor(title.length >= 3, attemptedSubmit),
                }}
              />
              <FieldHint 
                show={attemptedSubmit && title.length < 3}
                message={ERROR_MESSAGES.titleTooShort(3)}
              />
            </div>

            {/* ОПИСАНИЕ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Описание*
                <CharCounter 
                  current={description.length} 
                  min={10} 
                  max={MAX_DESCRIPTION_LENGTH}
                  isValid={description.length >= 10}
                />
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                placeholder={PLACEHOLDERS.marketDescription}
                maxLength={MAX_DESCRIPTION_LENGTH}
                disabled={isSubmitting}
                rows={6}
                style={{
                  ...styles.textarea,
                  borderColor: getBorderColor(description.length >= 10, attemptedSubmit),
                }}
              />
              <FieldHint 
                show={attemptedSubmit && description.length < 10}
                message={ERROR_MESSAGES.descriptionTooShort(10)}
              />
            </div>

            {/* ЦЕНА */}
            <div style={styles.section}>
              <label style={styles.label}>
                Цена*
              </label>
              <div style={{
                ...styles.priceWrapper,
                borderColor: getBorderColor(price > 0, attemptedSubmit),
              }}>
                <span style={styles.priceSymbol}>₽</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="35000"
                  min="0"
                  step="100"
                  disabled={isSubmitting}
                  style={styles.priceInput}
                />
              </div>
              <FieldHint 
                show={attemptedSubmit && (!price || price <= 0)}
                message={ERROR_MESSAGES.priceInvalid}
              />
            </div>

            {/* КАТЕГОРИЯ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Категория*
              </label>
              <div style={styles.categoriesGrid}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      hapticFeedback('light');
                    }}
                    disabled={isSubmitting}
                    style={{
                      ...styles.categoryBtn,
                      background: category === cat.id ? MARKET_COLOR : theme.colors.card,
                      borderColor: category === cat.id ? MARKET_COLOR : theme.colors.border,
                      transform: category === cat.id ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <span style={styles.categoryEmoji}>{cat.emoji}</span>
                    <span style={{
                      ...styles.categoryLabel,
                      color: category === cat.id ? '#fff' : theme.colors.text,
                    }}>
                      {cat.label}
                    </span>
                  </button>
                ))}
                
                {/* ДРУГАЯ КАТЕГОРИЯ */}
                <button
                  onClick={() => {
                    setCategory('custom');
                    hapticFeedback('light');
                  }}
                  disabled={isSubmitting}
                  style={{
                    ...styles.categoryBtn,
                    background: category === 'custom' ? MARKET_COLOR : theme.colors.card,
                    borderColor: category === 'custom' ? MARKET_COLOR : theme.colors.border,
                    transform: category === 'custom' ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span style={styles.categoryEmoji}>💡</span>
                  <span style={{
                    ...styles.categoryLabel,
                    color: category === 'custom' ? '#fff' : theme.colors.text,
                  }}>
                    Другая...
                  </span>
                </button>
              </div>
              
              {/* КАСТОМНАЯ КАТЕГОРИЯ ИНПУТ */}
              {category === 'custom' && (
                <>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value.slice(0, MAX_CUSTOM_CATEGORY_LENGTH))}
                    placeholder={PLACEHOLDERS.marketCustomCategory}
                    maxLength={MAX_CUSTOM_CATEGORY_LENGTH}
                    disabled={isSubmitting}
                    style={{
                      ...styles.input,
                      marginTop: '12px',
                      borderColor: getBorderColor(customCategory.trim().length > 0, attemptedSubmit),
                    }}
                  />
                  <FieldHint 
                    show={attemptedSubmit && customCategory.trim().length === 0}
                    message={ERROR_MESSAGES.categoryRequired}
                  />
                </>
              )}
            </div>

            {/* СОСТОЯНИЕ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Состояние*
              </label>
              <div style={styles.conditionsGrid}>
                {CONDITIONS.map(cond => (
                  <button
                    key={cond.value}
                    onClick={() => {
                      setCondition(cond.value);
                      hapticFeedback('light');
                    }}
                    disabled={isSubmitting}
                    style={{
                      ...styles.conditionBtn,
                      background: condition === cond.value ? `${MARKET_COLOR}20` : theme.colors.card,
                      borderColor: condition === cond.value ? MARKET_COLOR : theme.colors.border,
                      borderWidth: condition === cond.value ? '2px' : '1px',
                    }}
                  >
                    <span style={styles.conditionEmoji}>{cond.emoji}</span>
                    <span style={{
                      ...styles.conditionLabel,
                      color: condition === cond.value ? MARKET_COLOR : theme.colors.text,
                    }}>
                      {cond.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ФОТОГРАФИИ */}
            <div style={styles.section}>
              <label style={styles.label}>
                Фотографии*
                <span style={styles.charCount}>
                  {images.length + processingImages.length}/{MAX_IMAGES}
                </span>
              </label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* ЕСЛИ ЕСТЬ ИЗОБРАЖЕНИЯ - СЕТКА */}
              {(images.length > 0 || processingImages.length > 0) && (
                <div style={styles.imagesPreview}>
                  {images.map((img, idx) => (
                    <div key={idx} style={styles.imagePreviewItem}>
                      <img src={img.url} alt="" style={styles.previewImage} />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        disabled={isSubmitting}
                        style={styles.removeImageButton}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {processingImages.map(proc => (
                    <div key={proc.id} style={styles.imagePreviewItem}>
                      <div style={styles.loadingOverlay}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: MARKET_COLOR }} />
                        <span style={styles.loadingPercent}>{Math.round(proc.progress)}%</span>
                      </div>
                    </div>
                  ))}

                  {(images.length + processingImages.length) < MAX_IMAGES && (
                    <div style={styles.imagePreviewItem}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        style={styles.addImagePlaceholder}
                      >
                        <Plus size={28} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ЕСЛИ НЕТ ИЗОБРАЖЕНИЙ - ДЛИННАЯ КНОПКА */}
              {images.length === 0 && processingImages.length === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={styles.addImageButton}
                >
                  <Plus size={20} />
                  <span>Добавить фото</span>
                </button>
              )}

              <FieldHint 
                show={attemptedSubmit && images.length === 0}
                message={ERROR_MESSAGES.imagesRequired}
              />
            </div>

            {/* ЛОКАЦИЯ (ОПЦИОНАЛЬНО) */}
            <div style={styles.section}>
              <label style={styles.label}>
                Примерное место
                <span style={styles.labelHint}>(опционально)</span>
              </label>
              <div style={styles.locationWrapper}>
                <MapPin size={20} style={styles.locationIcon} />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.slice(0, MAX_LOCATION_LENGTH))}
                  placeholder={PLACEHOLDERS.marketLocation}
                  maxLength={MAX_LOCATION_LENGTH}
                  disabled={isSubmitting}
                  style={styles.locationInput}
                />
              </div>
              <div style={styles.locationHint}>
                💡 Точное место обсудите в личке
              </div>
            </div>

            <div style={{ height: theme.spacing.xl }} />
          </div>
        </div>

        </div>
      </div>

        {/* CONFIRMATION DIALOG */}
        <ConfirmationDialog
        isOpen={showConfirmation}
        title="Отменить изменения?"
        message="Все правки будут потеряны."
        confirmText="Отменить"
        cancelText="Продолжить"
        confirmType="danger"
        onConfirm={confirmClose}
        onCancel={() => setShowConfirmation(false)}
        />

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </>
  );
}

// ===== STYLES =====
// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_MODAL_MARKET_DETAIL + 9,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transition: 'opacity 0.3s ease',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.bg,
    zIndex: Z_MODAL_MARKET_DETAIL + 10,
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflowY: 'auto',
  },
  topProgressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: theme.colors.bgSecondary,
    zIndex: 1000,
  },
  topProgressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${MARKET_COLOR} 0%, ${theme.colors.success} 100%)`,
    transition: 'width 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.text,
    padding: '8px',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: 0,
  },
  contentWrapper: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  formScrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: `calc(${theme.spacing.lg}px + var(--screen-bottom-offset))`,
  },
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
  labelHint: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.normal,
    color: theme.colors.textSecondary,
    marginLeft: '8px',
  },
  charCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
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
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
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
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
  },
  priceWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    background: theme.colors.bgSecondary,
  },
  priceSymbol: {
    fontSize: '20px',
    color: theme.colors.textSecondary,
  },
  priceInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    outline: 'none',
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.sm,
  },
  categoryBtn: {
    padding: '16px 8px',
    borderRadius: theme.radius.md,
    borderWidth: '1px',
    borderStyle: 'solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  categoryEmoji: {
    fontSize: '24px',
  },
  categoryLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  conditionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
  },
  conditionBtn: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  conditionEmoji: {
    fontSize: '20px',
  },
  conditionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  imagesPreview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  imagePreviewItem: {
    position: 'relative',
    paddingTop: '100%',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bgSecondary,
  },
  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    padding: '4px',
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: `${theme.colors.bgSecondary}CC`,
    zIndex: 5,
  },
  loadingPercent: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginTop: '4px',
  },
  addImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    padding: 0,
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.bgSecondary,
  },
  addImageButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    transition: 'all 0.2s ease',
    width: '100%',
    justifyContent: 'center',
  },
  fieldError: {
    marginTop: '8px',
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  locationWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: theme.colors.bgSecondary,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    transition: 'border-color 0.2s ease',
  },
  locationIcon: {
    color: theme.colors.textSecondary,
  },
  locationInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    outline: 'none',
  },
  locationHint: {
    marginTop: '8px',
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    background: `${theme.colors.error}15`,
    border: `1px solid ${theme.colors.error}`,
    borderRadius: theme.radius.md,
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  publishButton: {
    width: '100%',
    padding: '14px',
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    background: `linear-gradient(135deg, ${MARKET_COLOR} 0%, #059669 100%)`,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
  },
};

export default EditMarketItemModal;
