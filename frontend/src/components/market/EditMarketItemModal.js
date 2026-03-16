// ===== FILE: EditMarketItemModal.js =====
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Sparkles, MapPin, Check, Lock } from 'lucide-react';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from '../shared/SwipeableModal';
import { updateMarketItem } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import imageCompression from 'browser-image-compression';
import { Z_MODAL_MARKET_DETAIL } from '../../constants/zIndex';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { resolveImageUrl } from '../../utils/mediaUrl';

const MAX_IMAGES = 3;

const CONDITIONS = [
  { id: 'new',      label: 'Новое',      icon: '✨' },
  { id: 'like_new', label: 'Как новое',  icon: '⭐' },
  { id: 'good',     label: 'Хорошее',    icon: '👍' },
  { id: 'fair',     label: 'Нормальное', icon: '👌' },
];

const CATEGORIES_MAP = {
  textbooks:   { label: 'Учебники',  icon: '📚' },
  electronics: { label: 'Техника',   icon: '💻' },
  clothing:    { label: 'Одежда',    icon: '👕' },
  furniture:   { label: 'Мебель',    icon: '🛋️' },
  dorm:        { label: 'Общага',    icon: '🛋️' },
  sports:      { label: 'Спорт',     icon: '⚽' },
  appliances:  { label: 'Техника',   icon: '🔌' },
  hobby:       { label: 'Хобби',     icon: '🎸' },
  tutor:       { label: 'Репетитор', icon: '👨‍🏫' },
  homework:    { label: 'Курсачи',   icon: '📝' },
  repair:      { label: 'Ремонт',    icon: '🛠️' },
  design:      { label: 'Дизайн',    icon: '🎨' },
  delivery:    { label: 'Курьер',    icon: '🏃' },
  other_g:     { label: 'Другое',    icon: '📦' },
  other_s:     { label: 'Другое',    icon: '✨' },
};

const extractImageKey = (value) => {
  const raw = String(value ?? '');
  if (!raw) return '';
  const clean = raw.split('#')[0].split('?')[0].replace(/\\/g, '/');
  if (!clean.includes('/')) return clean;
  return clean.split('/').pop() || '';
};

function EditMarketItemModal({ item, onClose, onSuccess }) {
  const [isVisible, setIsVisible]         = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isTgActionsVisible, setIsTgActionsVisible] = useState(true);

  // --- Поля формы ---
  const [title, setTitle]         = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice]         = useState(item?.price || '');
  const [condition, setCondition] = useState(item?.condition || 'good');
  const [location, setLocation]   = useState(item?.location || '');

  // --- Фото ---
  const [images, setImages] = useState(() => {
    const raw = Array.isArray(item?.images) ? item.images : [];
    return raw.map(img => {
      const filename = typeof img === 'object' ? (img?.url || '') : img;
      return { url: resolveImageUrl(filename, 'images'), filename, isNew: false };
    });
  });
  const [processingImages, setProcessingImages] = useState([]);

  // --- Суб-шиты ---
  const [activeSubSheet, setActiveSubSheet] = useState(null); // 'cond' | 'loc' | null

  const fileInputRef = useRef(null);
  const descRef      = useRef(null);
  const sheetRef     = useRef(null);

  // --- Baseline для отслеживания изменений ---
  const baseline = useMemo(() => ({
    title:       (item?.title || '').trim(),
    description: (item?.description || '').trim(),
    price:       Number(item?.price || 0),
    condition:   item?.condition || '',
    location:    (item?.location || '').trim(),
    imageKeys:   (Array.isArray(item?.images) ? item.images : [])
      .map(img => extractImageKey(typeof img === 'object' ? img?.url : img))
      .filter(Boolean),
  }), [item]);

  const hasChanges = useMemo(() => {
    if (title.trim() !== baseline.title) return true;
    if (description.trim() !== baseline.description) return true;
    if (Number(price) !== baseline.price) return true;
    if (condition !== baseline.condition) return true;
    if (location.trim() !== baseline.location) return true;
    if (images.some(img => img.isNew)) return true;
    const currentKeys = images.filter(i => !i.isNew).map(i => extractImageKey(i.filename || i.url)).filter(Boolean);
    if (currentKeys.length !== baseline.imageKeys.length) return true;
    return currentKeys.some((k, i) => k !== baseline.imageKeys[i]);
  }, [title, description, price, condition, location, images, baseline]);

  const isFormValid = useMemo(() =>
    title.trim().length >= 3 &&
    description.trim().length >= 10 &&
    Number(price) > 0 &&
    images.length >= 1,
  [title, description, price, images]);

  const canSend = hasChanges && isFormValid && !isSubmitting;

  // --- Анимация ---
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // --- CSS vars ---
  useEffect(() => {
    if (document.getElementById('edit-market-vars')) return;
    const style = document.createElement('style');
    style.id = 'edit-market-vars';
    style.textContent = `
      .em-spring-btn {
        transition: transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s, background-color 0.2s;
        cursor: pointer;
      }
      .em-spring-btn:active { transform: scale(0.92); opacity: 0.85; }
      .em-hide-scroll::-webkit-scrollbar { display: none; }
      .em-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      .em-grow-wrap { display: grid; }
      .em-grow-wrap::after {
        content: attr(data-replicated-value) " ";
        white-space: pre-wrap;
        visibility: hidden;
        font-size: 16px;
        line-height: 1.4;
        min-height: 80px;
        padding: 4px 0;
        font-family: inherit;
        grid-area: 1/1/2/2;
      }
      .em-grow-wrap > textarea {
        resize: none;
        overflow: hidden;
        grid-area: 1/1/2/2;
        font-family: inherit;
      }
      @keyframes em-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: () => {
      if (showConfirmation) return;
      handleClose();
    },
    isModal: true,
    threshold: 120,
  });

  // --- TelegramScreen ---
  useTelegramScreen({
    id: `edit-market-item-${item?.id || 'unknown'}`,
    title: 'Редактировать товар',
    priority: Z_MODAL_MARKET_DETAIL + 5,
    back: {
      visible: isTgActionsVisible,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: !hasChanges && !showConfirmation ? { visible: false } : showConfirmation
      ? {
          visible: isTgActionsVisible,
          text: 'Выйти',
          onClick: confirmClose,
          enabled: !isSubmitting,
          color: theme.colors.error,
        }
      : {
          visible: isTgActionsVisible,
          text: 'Сохранить',
          onClick: handleSubmit,
          enabled: canSend,
          loading: isSubmitting,
          color: theme.colors.premium.primary,
        },
  });

  // --- Фото ---
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = MAX_IMAGES - images.length - processingImages.length;
    if (slots <= 0) { toast.warning(`Максимум ${MAX_IMAGES} фото`); return; }

    const toProcess = files.slice(0, slots);
    const procs = toProcess.map(() => ({ id: Math.random().toString(36).slice(2), progress: 0 }));
    setProcessingImages(prev => [...prev, ...procs]);
    hapticFeedback('light');

    try {
      for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i];
        const procId = procs[i].id;
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          onProgress: (p) => setProcessingImages(prev => prev.map(x => x.id === procId ? { ...x, progress: p } : x)),
        };
        const compressed = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImages(prev => [...prev, { url: ev.target.result, file: compressed, isNew: true }]);
          setProcessingImages(prev => prev.filter(x => x.id !== procId));
        };
        reader.readAsDataURL(compressed);
      }
      hapticFeedback('success');
    } catch {
      toast.error('Ошибка загрузки фото');
      setProcessingImages([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = useCallback((idx) => {
    hapticFeedback('light');
    setImages(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // --- Описание grow-wrap ---
  const handleDescChange = (e) => {
    setDescription(e.target.value);
    if (descRef.current?.parentElement) {
      descRef.current.parentElement.dataset.replicatedValue = e.target.value;
    }
  };

  // --- Закрытие ---
  function handleClose() {
    if (hasChanges && !isSubmitting) {
      hapticFeedback('light');
      setShowConfirmation(true);
    } else {
      confirmClose();
    }
  }

  function confirmClose() {
    hapticFeedback('light');
    setIsTgActionsVisible(false);
    setIsVisible(false);
    setTimeout(onClose, 320);
  }

  // --- Сохранение ---
  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!isFormValid) { hapticFeedback('error'); return; }

    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', parseFloat(price));
      formData.append('condition', condition);
      if (location.trim()) formData.append('location', location.trim());

      const oldImages = [];
      images.forEach(img => {
        if (img.isNew && img.file) {
          formData.append('new_images', img.file);
        } else if (!img.isNew && img.filename) {
          let name = img.filename;
          if (name.includes('/')) name = name.split('/').pop();
          if (name) oldImages.push(name);
        }
      });
      formData.append('keep_images', JSON.stringify(oldImages));

      setUploadProgress(50);
      const updated = await updateMarketItem(
        item.id,
        formData,
        (pe) => setUploadProgress(Math.round(40 + (pe.loaded / pe.total) * 50)),
      );

      if (onSuccess) onSuccess(updated);
      hapticFeedback('success');
      toast.success('Изменения сохранены');
      setUploadProgress(100);
      setTimeout(confirmClose, 100);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка сохранения');
      hapticFeedback('error');
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }

  // --- Информация о категории ---
  const catInfo = CATEGORIES_MAP[item?.category] || { label: item?.category || '', icon: '📦' };
  const condLabel = CONDITIONS.find(c => c.id === condition);

  const modal = (
    <>
      <div
        style={{
          ...s.overlay,
          opacity: isVisible ? 1 : 0,
          pointerEvents: showConfirmation ? 'none' : 'auto',
        }}
        onClick={handleClose}
      >
        <div
          ref={sheetRef}
          style={{
            ...s.modal,
            transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Прогресс-бар */}
          {isSubmitting && (
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${uploadProgress}%` }} />
            </div>
          )}

          {/* Drag handle */}
          <DragHandle handlers={swipeHandlers} gap={0} />

          {/* Заблокированная категория */}
          <div style={s.categoryLocked}>
            <span style={{ fontSize: 18 }}>{catInfo.icon}</span>
            <span style={s.categoryLockedLabel}>{catInfo.label}</span>
            <Lock size={14} color={theme.colors.premium.textMuted} style={{ marginLeft: 'auto' }} />
          </div>

          {/* Скролл-область */}
          <div className="em-hide-scroll" style={s.scroll}>

            {/* Цена */}
            <div style={s.priceRow}>
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <span style={s.priceSizer}>{price || 'Цена'}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Цена"
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/\D/g, ''))}
                  style={s.priceInput}
                  disabled={isSubmitting}
                />
              </div>
              {price && <span style={s.priceCurrency}>₽</span>}
            </div>

            {/* Название */}
            <input
              type="text"
              placeholder="Название товара..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              style={{
                ...s.titleInput,
                borderBottom: attemptedSubmit && title.trim().length < 3
                  ? `1px solid ${theme.colors.error}`
                  : '1px solid transparent',
              }}
              disabled={isSubmitting}
            />

            {/* Описание */}
            <div
              className="em-grow-wrap"
              data-replicated-value={description}
              style={s.growWrap}
            >
              <textarea
                ref={descRef}
                placeholder="Опишите состояние, комплектацию и причины продажи..."
                value={description}
                onChange={handleDescChange}
                style={s.descTextarea}
                disabled={isSubmitting}
              />
            </div>

            {/* Фото-миниатюры */}
            {(images.length > 0 || processingImages.length > 0) && (
              <div className="em-hide-scroll" style={s.photosRow}>
                {images.map((img, i) => (
                  <div key={i} style={s.photoThumb}>
                    <img src={img.url} alt="" style={s.photoImg} />
                    {!isSubmitting && (
                      <button
                        className="em-spring-btn"
                        style={s.photoRemove}
                        onClick={() => removeImage(i)}
                      >
                        <X size={12} />
                      </button>
                    )}
                    {i === 0 && <div style={s.coverBadge}>Обложка</div>}
                  </div>
                ))}
                {processingImages.map(proc => (
                  <div key={proc.id} style={{ ...s.photoThumb, background: '#222' }}>
                    <div style={s.photoLoading}>
                      <div style={s.spinner} />
                      <span style={{ fontSize: 10, color: theme.colors.premium.textMuted }}>{Math.round(proc.progress)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Чипы метаданных */}
            <div style={s.metaChips}>
              {condition && (
                <div
                  className="em-spring-btn"
                  style={s.metaChip}
                  onClick={() => !isSubmitting && setActiveSubSheet('cond')}
                >
                  {condLabel?.icon} {condLabel?.label}
                </div>
              )}
              {location && (
                <div
                  className="em-spring-btn"
                  style={s.metaChip}
                  onClick={() => !isSubmitting && setActiveSubSheet('loc')}
                >
                  <MapPin size={14} color="var(--cm-primary, #D4FF00)" style={{ marginRight: 4 }} />
                  {location}
                </div>
              )}
            </div>
          </div>

          {/* Нижний тулбар */}
          <div style={s.toolbar}>
            <div style={s.toolGroup}>
              {/* Фото */}
              <button
                className="em-spring-btn"
                style={{
                  ...s.toolBtn,
                  color: images.length === 0 ? theme.colors.premium.textMuted : theme.colors.premium.primary,
                  border: images.length > 0 ? '1px solid rgba(212,255,0,0.3)' : 'none',
                }}
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
              >
                <ImageIcon size={20} />
              </button>

              {/* Состояние */}
              <button
                className="em-spring-btn"
                style={{
                  ...s.toolBtn,
                  color: condition ? theme.colors.premium.primary : theme.colors.premium.textMuted,
                  border: condition ? '1px solid rgba(212,255,0,0.3)' : 'none',
                  background: activeSubSheet === 'cond' ? 'rgba(212,255,0,0.15)' : theme.colors.premium.surfaceHover,
                }}
                onClick={() => !isSubmitting && setActiveSubSheet(activeSubSheet === 'cond' ? null : 'cond')}
              >
                <Sparkles size={20} />
              </button>

              {/* Локация */}
              <button
                className="em-spring-btn"
                style={{
                  ...s.toolBtn,
                  color: location ? theme.colors.premium.primary : theme.colors.premium.textMuted,
                  border: location ? '1px solid rgba(212,255,0,0.3)' : 'none',
                  background: activeSubSheet === 'loc' ? 'rgba(212,255,0,0.15)' : theme.colors.premium.surfaceHover,
                }}
                onClick={() => !isSubmitting && setActiveSubSheet(activeSubSheet === 'loc' ? null : 'loc')}
              >
                <MapPin size={20} />
              </button>
            </div>

            {/* Кнопка сохранения */}
            <button
              className="em-spring-btn"
              style={{
                ...s.sendBtn,
                background: canSend ? theme.colors.premium.primary : theme.colors.premium.surfaceHover,
                color: canSend ? '#000' : theme.colors.premium.textMuted,
              }}
              disabled={!canSend}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? <div style={s.spinner} />
                : <Check size={20} />
              }
            </button>
          </div>

          {/* Sub-sheet: состояние */}
          <div style={{
            ...s.subSheet,
            transform: activeSubSheet === 'cond' ? 'translateY(0)' : 'translateY(100%)',
          }}>
            <div style={s.subSheetHeader}>
              <span style={s.subSheetTitle}>Состояние</span>
              <button className="em-spring-btn" style={s.subSheetClose} onClick={() => setActiveSubSheet(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="em-hide-scroll" style={{ overflowY: 'auto' }}>
              {CONDITIONS.map(c => (
                <button
                  key={c.id}
                  className="em-spring-btn"
                  onClick={() => { hapticFeedback('light'); setCondition(c.id); setActiveSubSheet(null); }}
                  style={{
                    ...s.condBtn,
                    background: condition === c.id ? 'rgba(212,255,0,0.1)' : theme.colors.premium.surfaceHover,
                    color: condition === c.id ? theme.colors.premium.primary : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    {c.label}
                  </div>
                  {condition === c.id && <Check size={20} color={theme.colors.premium.primary} />}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-sheet: локация */}
          <div style={{
            ...s.subSheet,
            transform: activeSubSheet === 'loc' ? 'translateY(0)' : 'translateY(100%)',
          }}>
            <div style={s.subSheetHeader}>
              <span style={s.subSheetTitle}>Где забирать?</span>
              <button className="em-spring-btn" style={s.subSheetClose} onClick={() => setActiveSubSheet(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <MapPin size={20} color={theme.colors.premium.textMuted} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Аудитория, общага или метро..."
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={s.locInput}
              />
            </div>
            <button className="em-spring-btn" style={s.locSaveBtn} onClick={() => setActiveSubSheet(null)}>
              Сохранить
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
      </div>

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
    </>
  );

  return createPortal(modal, document.body);
}

// ===== СТИЛИ =====
const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_MODAL_MARKET_DETAIL + 10,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    transition: 'opacity 0.3s ease',
  },
  modal: {
    background: theme.colors.premium.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: theme.colors.premium.surfaceHover,
    zIndex: 100,
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${theme.colors.premium.primary} 0%, #a3d900 100%)`,
    transition: 'width 0.3s ease',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.2)',
    margin: '12px auto 16px',
    flexShrink: 0,
  },
  categoryLocked: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '0 20px 16px',
    padding: '10px 14px',
    background: theme.colors.premium.surfaceHover,
    borderRadius: 14,
    border: `1px solid ${theme.colors.premium.border}`,
    flexShrink: 0,
  },
  categoryLockedLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 150px',
    display: 'flex',
    flexDirection: 'column',
  },

  // Цена
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 4,
  },
  priceSizer: {
    fontSize: 36,
    fontWeight: 800,
    visibility: 'hidden',
    whiteSpace: 'pre',
    display: 'block',
  },
  priceInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    fontSize: 36,
    fontWeight: 800,
    background: 'transparent',
    border: 'none',
    color: theme.colors.premium.primary,
    outline: 'none',
    padding: 0,
  },
  priceCurrency: {
    fontSize: 36,
    fontWeight: 800,
    color: theme.colors.premium.primary,
    marginLeft: 8,
  },

  // Название
  titleInput: {
    fontSize: 22,
    fontWeight: 700,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid transparent',
    color: '#fff',
    outline: 'none',
    marginTop: 16,
    width: '100%',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    paddingBottom: 4,
  },

  // Описание
  growWrap: { marginTop: 12 },
  descTextarea: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: theme.colors.premium.textBody,
    fontSize: 16,
    outline: 'none',
    minHeight: 80,
    lineHeight: 1.4,
    padding: 0,
  },

  // Фото
  photosRow: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  photoThumb: {
    position: 'relative',
    width: 64,
    height: 64,
    flexShrink: 0,
    borderRadius: 12,
    overflow: 'visible',
    background: '#333',
  },
  photoImg: {
    width: 64,
    height: 64,
    objectFit: 'cover',
    borderRadius: 12,
    display: 'block',
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    background: theme.colors.error,
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
    cursor: 'pointer',
    zIndex: 2,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    background: 'rgba(212,255,0,0.85)',
    color: '#000',
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 4,
    textAlign: 'center',
    padding: '1px 2px',
  },
  photoLoading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
  },

  // Чипы
  metaChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  metaChip: {
    background: theme.colors.premium.surfaceHover,
    border: `1px solid ${theme.colors.premium.border}`,
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },

  // Тулбар
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 'calc(10px) 16px calc(10px + env(safe-area-inset-bottom, 20px))',
    background: `rgba(28,28,30,0.9)`,
    backdropFilter: 'blur(20px)',
    borderTop: `1px solid ${theme.colors.premium.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  toolGroup: {
    display: 'flex',
    gap: 12,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: theme.colors.premium.surfaceHover,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    flexShrink: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },

  // Sub-sheet
  subSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    background: theme.colors.premium.surfaceElevated,
    borderTop: `1px solid ${theme.colors.premium.border}`,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '24px 16px calc(env(safe-area-inset-bottom,20px) + 24px)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70%',
    boxShadow: '0 -20px 40px rgba(0,0,0,0.5)',
    transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)',
    gap: 8,
  },
  subSheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subSheetTitle: { fontSize: 18, fontWeight: 800, color: '#fff' },
  subSheetClose: {
    background: theme.colors.premium.surfaceHover,
    border: 'none',
    width: 32,
    height: 32,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
  },
  condBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    border: 'none',
    marginBottom: 4,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  },
  locInput: {
    width: '100%',
    background: theme.colors.premium.surfaceHover,
    border: `1px solid ${theme.colors.premium.border}`,
    color: '#fff',
    fontSize: 16,
    padding: '16px 20px 16px 52px',
    borderRadius: 16,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  locSaveBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    background: theme.colors.premium.primary,
    color: '#000',
    fontWeight: 700,
    fontSize: 16,
    border: 'none',
    marginTop: 12,
    cursor: 'pointer',
  },

  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'em-spin 0.8s linear infinite',
  },
};

export default EditMarketItemModal;
