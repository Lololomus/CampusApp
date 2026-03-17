// ===== FILE: CreateMarketItem.js =====
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Sparkles, MapPin, Check, Play } from 'lucide-react';
import { useStore } from '../../store';
import { createMarketItem } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { processImageFiles } from '../../utils/media';
import { isVideoFileCandidate, validateVideoFile } from '../../utils/videoValidation';
import { toast } from '../shared/Toast';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from '../shared/SwipeableModal';
import ConfirmationDialog from '../shared/ConfirmationDialog';

const MAX_IMAGES = 3;
const MIN_TITLE_LEN = 3;
const MIN_DESC_LEN = 10;
const TOOL_ICON_SIZE = 26;

// Категории товаров и услуг
const CATEGORIES = [
  { id: 'textbooks',   label: 'Учебники',  icon: '📚', type: 'goods' },
  { id: 'electronics', label: 'Техника',   icon: '💻', type: 'goods' },
  { id: 'clothing',    label: 'Одежда',    icon: '👕', type: 'goods' },
  { id: 'dorm',        label: 'Общага',    icon: '🛋️', type: 'goods' },
  { id: 'hobby',       label: 'Хобби',     icon: '🎸', type: 'goods' },
  { id: 'other_g',     label: 'Другое',    icon: '📦', type: 'goods' },
  { id: 'tutor',       label: 'Репетитор', icon: '👨‍🏫', type: 'services' },
  { id: 'homework',    label: 'Курсачи',   icon: '📝', type: 'services' },
  { id: 'repair',      label: 'Ремонт',    icon: '🛠️', type: 'services' },
  { id: 'design',      label: 'Дизайн',    icon: '🎨', type: 'services' },
  { id: 'delivery',    label: 'Курьер',    icon: '🏃', type: 'services' },
  { id: 'other_s',     label: 'Другое',    icon: '✨', type: 'services' },
];

const CONDITIONS = [
  { id: 'new',      label: 'Новое',     icon: '✨' },
  { id: 'like_new', label: 'Как новое', icon: '⭐' },
  { id: 'good',     label: 'Хорошее',   icon: '👍' },
  { id: 'fair',     label: 'Нормальное',icon: '👌' },
];

const CreateMarketItem = ({ onClose, onSuccess }) => {
  const { user, addMarketItem } = useStore();

  // --- Основной стейт ---
  const [itemType, setItemType] = useState('goods');
  const [cat, setCat]           = useState('');
  const [title, setTitle]       = useState('');
  const [price, setPrice]       = useState('');
  const [desc, setDesc]         = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos]     = useState([]);   // { file, preview }
  const [videoFile, setVideoFile] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
  const [loading, setLoading]   = useState(false);

  // --- Суб-шиты ---
  const [activeSubSheet, setActiveSubSheet] = useState(null); // 'cond' | 'loc' | null

  // --- Анимация видимости ---
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const fileInputRef  = useRef(null);
  const descRef       = useRef(null);
  const sheetRef      = useRef(null);
  const mediaProcessingTasksRef = useRef(new Set());
  const photosRef = useRef(photos);
  const videoFileRef = useRef(videoFile);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const registerMediaTask = (taskPromise) => {
    mediaProcessingTasksRef.current.add(taskPromise);
    taskPromise.finally(() => {
      mediaProcessingTasksRef.current.delete(taskPromise);
    });
    return taskPromise;
  };

  const waitForMediaTasks = async () => {
    while (mediaProcessingTasksRef.current.size > 0) {
      await Promise.allSettled(Array.from(mediaProcessingTasksRef.current));
    }
  };

  // Сброс категории и состояния при смене типа
  useEffect(() => {
    setCat('');
    if (itemType === 'services') setCondition('');
  }, [itemType]);

  // Закрыть суб-шит при закрытии
  useEffect(() => {
    if (!isVisible) setActiveSubSheet(null);
  }, [isVisible]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    videoFileRef.current = videoFile;
  }, [videoFile]);

  // Инжектируем CSS-переменные и анимации (как в CreateContentModal)
  useEffect(() => {
    if (document.getElementById('create-market-vars')) return;
    const style = document.createElement('style');
    style.id = 'create-market-vars';
    style.textContent = `
      :root {
        --cm-primary: ${theme.colors.premium.primary};
        --cm-surface: ${theme.colors.premium.surfaceElevated};
        --cm-surface-elevated: ${theme.colors.premium.surfaceHover};
        --cm-border: ${theme.colors.premium.border};
        --cm-text-muted: ${theme.colors.premium.textMuted};
        --cm-text-body: ${theme.colors.premium.textBody};
        --cm-error: ${theme.colors.error};
      }
      .cm-spring-btn {
        transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s, background-color 0.2s;
        cursor: pointer;
      }
      .cm-spring-btn:active { transform: scale(0.92); opacity: 0.85; }
      .cm-hide-scroll::-webkit-scrollbar { display: none; }
      .cm-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      @keyframes cm-slide-up {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @keyframes cm-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(212,255,0,0.15); }
        70%  { box-shadow: 0 0 0 6px rgba(212,255,0,0); }
        100% { box-shadow: 0 0 0 0 rgba(212,255,0,0); }
      }
      .cm-pulse { animation: cm-pulse 3s infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  const hasAnyContent = () =>
    title.trim().length > 0 || desc.trim().length > 0 || price !== '' || photos.length > 0;

  const confirmClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(onClose, 320);
  };

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: () => {
      if (showConfirmation) return;
      if (hasAnyContent()) setShowConfirmation(true);
      else confirmClose();
    },
    isModal: true,
    threshold: 120,
  });

  const canPublish =
    title.trim().length >= MIN_TITLE_LEN &&
    price !== '' &&
    desc.trim().length >= MIN_DESC_LEN &&
    cat !== '' &&
    (photos.length > 0 || videoFile !== null) &&
    (itemType === 'services' || condition !== '');

  // --- Фото ---
  const handlePhotoAdd = async () => {
    if (photos.length >= MAX_IMAGES) return;
    fileInputRef.current?.click();
  };

  const captureVideoThumbnail = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    video.currentTime = 1;
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/webp', 0.7));
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.load();
  });

  const handleFileChange = (e) => {
    const task = (async () => {
      const files = e.target.files;
    const clearMarketFileInput = () => {
      if (!fileInputRef.current) return;
      fileInputRef.current.value = '';
    };
    if (!files || files.length === 0) return;
    // Handle video separately (no compression on client; backend processes it)
    const videoCandidate = Array.from(files).find((file) => isVideoFileCandidate(file));
    if (videoCandidate) {
      const validation = await validateVideoFile(videoCandidate);
      if (!validation.valid) {
        hapticFeedback('error');
        toast.error(validation.error);
        clearMarketFileInput();
        return;
      }

      setVideoFile(videoCandidate);
      captureVideoThumbnail(videoCandidate).then(setVideoThumb);
      hapticFeedback('light');
      clearMarketFileInput();
      return;
    }

    if (photos.length + files.length > MAX_IMAGES) {
      toast.warning(`Максимум ${MAX_IMAGES} фото`);
      return;
    }
    setLoading(true);
    try {
      const processed = await processImageFiles(files);
      setPhotos(prev => [...prev, ...processed]);
      hapticFeedback('light');
    } catch {
      toast.error('Ошибка загрузки фото');
    } finally {
      setLoading(false);
      clearMarketFileInput();
    }
    })();

    registerMediaTask(task);
  };

  const removePhoto = useCallback((idx) => {
    hapticFeedback('medium');
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // --- Авто-рост textarea ---
  const handleDescChange = (e) => {
    setDesc(e.target.value);
    // обновляем data-attr для grow-wrap
    if (descRef.current?.parentElement) {
      descRef.current.parentElement.dataset.replicatedValue = e.target.value;
    }
  };

  // --- Отправка ---
  const handleSubmit = async () => {
    if (loading) return;

    if (mediaProcessingTasksRef.current.size > 0) {
      setLoading(true);
      await waitForMediaTasks();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const currentPhotos = photosRef.current;
    const currentVideoFile = videoFileRef.current;
    const canPublishNow =
      title.trim().length >= MIN_TITLE_LEN &&
      price !== '' &&
      desc.trim().length >= MIN_DESC_LEN &&
      cat !== '' &&
      (currentPhotos.length > 0 || currentVideoFile !== null) &&
      (itemType === 'services' || condition !== '');

    if (!canPublishNow) {
      setLoading(false);
      return;
    }

    setLoading(true);
    hapticFeedback('heavy');
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', desc.trim());
      formData.append('price', parseInt(price, 10));
      formData.append('category', cat);
      formData.append('item_type', itemType);
      if (condition) formData.append('condition', condition);
      if (location.trim()) formData.append('location', location.trim());
      if (user?.telegram_id) formData.append('telegram_id', user.telegram_id);
      currentPhotos.forEach((p) => { if (p.file) formData.append('images', p.file); });
      if (currentVideoFile) formData.append('video', currentVideoFile);

      const result = await createMarketItem(formData);
      addMarketItem(result);
      hapticFeedback('success');
      toast.success('Товар опубликован');
      if (onSuccess) onSuccess(result);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка публикации');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    if (hasAnyContent()) {
      hapticFeedback('light');
      setShowConfirmation(true);
      return;
    }
    confirmClose();
  };

  const displayedCategories = CATEGORIES.filter(c => c.type === itemType);

  // Текст выбранного состояния
  const condLabel = CONDITIONS.find(c => c.id === condition);

  const sheet = (
    <div
      style={{ ...s.backdrop, opacity: isVisible ? 1 : 0 }}
      onClick={handleClose}
    >
      {/* Основной шит */}
      <div
        ref={sheetRef}
        style={{
          ...s.sheet,
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <DragHandle handlers={swipeHandlers} gap={0} />

        {/* Таб-свитчер Товар / Услуга */}
        <div style={s.switcherWrap}>
          <div style={s.switcher}>
            <button
              className="cm-spring-btn"
              style={{ ...s.switcherBtn, ...(itemType === 'goods' ? s.switcherBtnActive : {}) }}
              onClick={() => { hapticFeedback('light'); setItemType('goods'); }}
            >Товар</button>
            <button
              className="cm-spring-btn"
              style={{ ...s.switcherBtn, ...(itemType === 'services' ? s.switcherBtnActive : {}) }}
              onClick={() => { hapticFeedback('light'); setItemType('services'); }}
            >Услуга</button>
          </div>
        </div>

        {/* Прокручиваемый контент */}
        <div className="cm-hide-scroll" style={s.scroll}>

          {/* Сетка категорий 2x3 */}
          <div style={s.catGrid}>
            {displayedCategories.map(c => {
              const isSelected = cat === c.id;
              return (
                <button
                  key={c.id}
                  className="cm-spring-btn"
                  onClick={() => { hapticFeedback('medium'); setCat(c.id); }}
                  style={{
                    ...s.catBtn,
                    borderColor: isSelected ? 'var(--cm-primary)' : 'transparent',
                    background: isSelected ? 'rgba(212,255,0,0.1)' : 'var(--cm-surface-elevated)',
                    color: isSelected ? 'var(--cm-primary)' : '#fff',
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* Видео-превью — отдельная карточка на всю ширину */}
          {videoFile && (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: photos.length > 0 ? 8 : 16, background: '#111' }}>
              {videoThumb
                ? <img src={videoThumb} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: 130, background: '#1a1a1a' }} />
              }
              {/* Play-иконка по центру */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                </div>
              </div>
              {/* Нижняя плашка */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', padding: '24px 10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.2px' }}>
                  Видео · {(videoFile.size / 1024 / 1024).toFixed(1)} МБ
                </span>
                <button
                  className="cm-spring-btn"
                  style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: 0 }}
                  onClick={() => { setVideoFile(null); setVideoThumb(null); }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Фото-миниатюры — 3-колоночная сетка */}
          {photos.length > 0 && (
            <div className="cm-hide-scroll" style={s.photosRow}>
              {photos.map((p, i) => (
                <div key={i} style={s.photoThumb}>
                  <img src={p.preview} alt="" style={s.photoImg} />
                  <button
                    className="cm-spring-btn"
                    style={s.photoRemove}
                    onClick={() => removePhoto(i)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Цена — авто-сайзинг */}
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
              />
            </div>
            {price && <span style={s.priceCurrency}>₽</span>}
          </div>

          {/* Название */}
          <input
            type="text"
            placeholder={itemType === 'services' ? 'Название услуги...' : 'Название товара...'}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            style={s.titleInput}
          />

          {/* Описание — grow-wrap */}
          <div
            className="cm-grow-wrap"
            data-replicated-value={desc}
            style={s.growWrap}
          >
            <textarea
              ref={descRef}
              placeholder={itemType === 'services' ? 'Опишите услугу, опыт и условия работы...' : 'Опишите состояние, комплектацию и причины продажи...'}
              value={desc}
              onChange={handleDescChange}
              style={s.descTextarea}
            />
          </div>

          {/* Чипы выбранных метаданных */}
          <div style={s.metaChips}>
            {condition && itemType === 'goods' && (
              <div
                className="cm-spring-btn"
                style={s.metaChip}
                onClick={() => setActiveSubSheet('cond')}
              >
                {condLabel?.icon} {condLabel?.label}
              </div>
            )}
            {location && (
              <div
                className="cm-spring-btn"
                style={s.metaChip}
                onClick={() => setActiveSubSheet('loc')}
              >
                <MapPin size={14} color="var(--cm-primary)" style={{ marginRight: 4 }} />
                {location}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div style={s.toolbar}>
          <div style={s.toolGroup}>
            {/* Фото */}
            <button
              className={`cm-spring-btn ${photos.length === 0 ? 'cm-pulse' : ''}`}
              style={photos.length > 0 ? { ...s.toolBtn, ...s.toolBtnActive } : s.toolBtn}
              onClick={handlePhotoAdd}
              disabled={loading}
            >
              {loading ? <div style={s.spinner} /> : <ImageIcon size={TOOL_ICON_SIZE} />}
            </button>

            {/* Состояние (только для товаров) */}
            {itemType === 'goods' && (
              <button
                className={`cm-spring-btn ${!condition ? 'cm-pulse' : ''}`}
                style={condition || activeSubSheet === 'cond' ? { ...s.toolBtn, ...s.toolBtnActive } : s.toolBtn}
                onClick={() => setActiveSubSheet(activeSubSheet === 'cond' ? null : 'cond')}
              >
                <Sparkles size={TOOL_ICON_SIZE} />
              </button>
            )}

            {/* Локация */}
            <button
              className="cm-spring-btn"
              style={location || activeSubSheet === 'loc' ? { ...s.toolBtn, ...s.toolBtnActive } : s.toolBtn}
              onClick={() => setActiveSubSheet(activeSubSheet === 'loc' ? null : 'loc')}
            >
              <MapPin size={TOOL_ICON_SIZE} />
            </button>
          </div>

          {/* Кнопка публикации */}
          <button
            className="cm-spring-btn"
            disabled={!canPublish || loading}
            onClick={handleSubmit}
            style={{
              ...s.publishBtn,
              background: canPublish ? 'var(--cm-primary)' : 'var(--cm-surface-elevated)',
              color: canPublish ? '#000' : 'var(--cm-text-muted)',
            }}
          >
            {loading ? <div style={s.spinner} /> : <Check size={TOOL_ICON_SIZE} />}
          </button>
        </div>

        {/* Sub-sheet: состояние */}
        <div style={{
          ...s.subSheet,
          transform: activeSubSheet === 'cond' ? 'translateY(0)' : 'translateY(100%)',
        }}>
          <div style={s.subSheetHeader}>
            <span style={s.subSheetTitle}>Состояние</span>
            <button
              className="cm-spring-btn"
              style={s.subSheetClose}
              onClick={() => setActiveSubSheet(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="cm-hide-scroll" style={{ overflowY: 'auto' }}>
            {CONDITIONS.map(c => (
              <button
                key={c.id}
                className="cm-spring-btn"
                onClick={() => {
                  hapticFeedback('light');
                  setCondition(c.id);
                  setActiveSubSheet(null);
                }}
                style={{
                  ...s.condBtn,
                  background: condition === c.id ? 'rgba(212,255,0,0.1)' : 'var(--cm-surface-elevated)',
                  color: condition === c.id ? 'var(--cm-primary)' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  {c.label}
                </div>
                {condition === c.id && <Check size={20} color="var(--cm-primary)" />}
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
            <button
              className="cm-spring-btn"
              style={s.subSheetClose}
              onClick={() => setActiveSubSheet(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <MapPin size={20} color="var(--cm-text-muted)" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Аудитория, общага или метро..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              style={s.locInput}
            />
          </div>
          <button
            className="cm-spring-btn"
            style={s.locSaveBtn}
            onClick={() => setActiveSubSheet(null)}
          >
            Сохранить
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Grow-wrap стили */}
      <style>{`
        .cm-grow-wrap { display: grid; }
        .cm-grow-wrap::after {
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
        .cm-grow-wrap > textarea {
          resize: none;
          overflow: hidden;
          grid-area: 1/1/2/2;
          font-family: inherit;
        }
      `}</style>
    </div>
  );

  const portal = (
    <>
      {sheet}
      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Выйти из редактора?"
        message="Весь введённый текст будет потерян"
        confirmText="Да, выйти"
        cancelText="Продолжить"
        confirmType="danger"
        onConfirm={confirmClose}
        onCancel={() => setShowConfirmation(false)}
      />
    </>
  );

  return createPortal(portal, document.body);
};

// ===== СТИЛИ =====
const s = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 3000,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    transition: 'opacity 0.3s ease',
  },
  sheet: {
    background: 'var(--cm-surface)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  // Таб-свитчер
  switcherWrap: {
    padding: '12px 16px 10px',
    borderBottom: '1px solid var(--cm-border)',
    flexShrink: 0,
  },
  switcher: {
    display: 'flex',
    background: 'var(--cm-surface-elevated)',
    borderRadius: 12,
    padding: 4,
  },
  switcherBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--cm-text-muted)',
    padding: '8px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  switcherBtnActive: {
    background: 'var(--cm-primary)',
    color: '#000',
  },

  // Скролл-область
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 150px',
    display: 'flex',
    flexDirection: 'column',
  },

  // Категории
  catGrid: {
    display: 'grid',
    gridTemplateRows: 'repeat(2, auto)',
    gridAutoFlow: 'column',
    gridAutoColumns: 'max-content',
    gap: 8,
    padding: '12px 0 16px',
    overflowX: 'auto',
    flexShrink: 0,
  },
  catBtn: {
    border: '1px solid transparent',
    borderRadius: 20,
    background: 'var(--cm-surface-elevated)',
    color: '#fff',
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },

  // Фото
  photosRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 16,
  },
  photoThumb: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  photoImg: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    borderRadius: 12,
    display: 'block',
  },
  photoRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(36,36,40,0.9)',
    color: 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    flexShrink: 0,
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
    fontFamily: 'inherit',
    visibility: 'hidden',
    whiteSpace: 'pre',
    minWidth: '3ch',
  },
  priceInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    fontSize: 36,
    fontWeight: 800,
    fontFamily: 'inherit',
    background: 'transparent',
    border: 'none',
    color: 'var(--cm-primary)',
    outline: 'none',
    padding: 0,
  },
  priceCurrency: {
    fontSize: 36,
    fontWeight: 800,
    color: 'var(--cm-primary)',
    marginLeft: 8,
  },

  // Название
  titleInput: {
    fontSize: 22,
    fontWeight: 700,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    marginTop: 16,
    width: '100%',
    fontFamily: 'inherit',
  },

  // Описание grow-wrap
  growWrap: {
    marginTop: 12,
    padding: 0,
  },
  descTextarea: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'var(--cm-text-body)',
    fontSize: 16,
    outline: 'none',
    minHeight: 80,
    lineHeight: 1.4,
    padding: 0,
  },

  // Чипы метаданных
  metaChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  metaChip: {
    background: 'var(--cm-surface-elevated)',
    border: '1px solid var(--cm-border)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },

  // Нижний тулбар
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 'calc(12px) 16px calc(12px + env(safe-area-inset-bottom, 20px))',
    background: 'var(--cm-surface)',
    borderTop: '1px solid var(--cm-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  toolGroup: {
    display: 'flex',
    gap: 8,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: 'var(--cm-surface-elevated)',
    color: 'var(--cm-text-muted)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  toolBtnActive: { background: 'rgba(212,255,0,0.15)', color: 'var(--cm-primary)' },
  publishBtn: {
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
    background: 'var(--cm-surface)',
    borderTop: '1px solid var(--cm-border)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: '24px 16px calc(env(safe-area-inset-bottom,20px) + 24px)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70%',
    transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)',
    gap: 8,
  },
  subSheetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subSheetTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
  },
  subSheetClose: {
    background: 'var(--cm-surface-elevated)',
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

  // Локация
  locInput: {
    width: '100%',
    background: 'var(--cm-surface-elevated)',
    border: '1px solid var(--cm-border)',
    color: '#fff',
    fontSize: 16,
    padding: '16px 20px 16px 52px',
    borderRadius: 16,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  locSaveBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    background: 'var(--cm-primary)',
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
    animation: 'cm-spin 0.8s linear infinite',
  },
};

export default CreateMarketItem;


