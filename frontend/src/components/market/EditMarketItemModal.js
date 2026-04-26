// ===== FILE: EditMarketItemModal.js =====
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Sparkles, MapPin, Check, Lock, Play, Loader2 } from 'lucide-react';
import { isVideoFileCandidate, validateVideoFile } from '../../utils/videoValidation';
import { useSwipe } from '../../hooks/useSwipe';
import { DragHandle } from '../shared/SwipeableModal';
import { updateMarketItem } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { compressImage } from '../../utils/media';
import { Z_MODAL_MARKET_DETAIL } from '../../constants/zIndex';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { MARKET_CONDITIONS, MARKET_CATEGORIES_MAP } from '../../constants/marketConstants';
import { modalBoundaryProps, modalTouchBoundaryHandlers } from '../../utils/modalEventBoundary';

const MAX_IMAGES = 3;
const TOOL_ICON_SIZE = 26;

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

  // --- Поля формы ---
  const [title, setTitle]         = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [price, setPrice]         = useState(item?.price || '');
  const [condition, setCondition] = useState(item?.condition || '');
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
  const [videoFile, setVideoFile] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);

  // --- Суб-шиты ---
  const [activeSubSheet, setActiveSubSheet] = useState(null); // 'cond' | 'loc' | null

  const fileInputRef = useRef(null);
  const descRef      = useRef(null);
  const sheetRef     = useRef(null);
  const dragHandleRef = useRef(null);

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
    if (currentKeys.some((k, i) => k !== baseline.imageKeys[i])) return true;
    if (videoFile) return true;
    return false;
  }, [title, description, price, condition, location, images, videoFile, baseline]);

  const isFormValid = useMemo(() =>
    title.trim().length >= 3 &&
    description.trim().length >= 10 &&
    Number(price) > 0 &&
    (images.length >= 1 || videoFile !== null) &&
    (item?.item_type !== 'product' || condition !== ''),
  [title, description, price, images, videoFile, condition, item?.item_type]);

  const canSend = hasChanges && isFormValid && !isSubmitting;

  const computeProgress = () => {
    if (!hasChanges) return 0;
    const segs = [
      { w: 25, v: images.length > 0 || videoFile ? 1 : 0 },
      { w: 20, v: Math.min(1, title.trim().length / 3) },
      { w: 15, v: Number(price) > 0 ? 1 : 0 },
      { w: 40, v: Math.min(1, description.trim().length / 10) },
    ];
    if (item?.item_type === 'product') segs.push({ w: 20, v: condition !== '' ? 1 : 0 });
    const total = segs.reduce((s, seg) => s + seg.w, 0);
    const filled = segs.reduce((s, seg) => s + seg.w * seg.v, 0);
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  };
  const sendProgress = computeProgress();

  // --- Анимация ---
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Скролл-фриз страницы при открытии
  useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevBodyStyle = {
      overflow: body.style.overflow,
    };
    const prevRootOverflow = root?.style.overflow || '';
    const prevHtmlOverflow = html.style.overflow;

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';

    return () => {
      body.style.overflow = prevBodyStyle.overflow;
      html.style.overflow = prevHtmlOverflow;
      if (root) root.style.overflow = prevRootOverflow;
    };
  }, []);

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    activationRef: dragHandleRef,
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
      visible: true,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleClose,
    },
    main: { visible: false },
  });

  // --- Видео тумб ---
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

  // --- Фото/Видео ---
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Видео
    const videoCandidate = files.find(f => isVideoFileCandidate(f));
    if (videoCandidate) {
      const validation = await validateVideoFile(videoCandidate);
      if (!validation.valid) { hapticFeedback('error'); toast.error(validation.error); }
      else {
        setVideoFile(videoCandidate);
        captureVideoThumbnail(videoCandidate).then(setVideoThumb);
        hapticFeedback('light');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
        const compressed = await compressImage(file, (p) => setProcessingImages(prev => prev.map(x => x.id === procId ? { ...x, progress: p } : x)));
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
    setVideoFile(null);
    setVideoThumb(null);
    setIsVisible(false);
    setTimeout(onClose, 320);
  }

  // --- Сохранение ---
  async function handleSubmit() {
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
      if (videoFile) formData.append('video', videoFile);

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
  const catInfo = MARKET_CATEGORIES_MAP[item?.category] || { label: item?.category || '', icon: '📦' };
  const condLabel = MARKET_CONDITIONS.find(c => c.id === condition);

  const modal = (
    <>
      <div
        {...modalBoundaryProps}
        {...modalTouchBoundaryHandlers}
        style={{
          ...s.overlay,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible && !showConfirmation ? 'auto' : 'none',
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
          <DragHandle handlers={swipeHandlers} handleRef={dragHandleRef} gap={0} />

          {/* Скролл-область */}
          <div className="market-hide-scroll" style={s.scroll}>

            {/* Заголовок + заблокированная категория */}
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.colors.premium.textMuted, marginBottom: 10 }}>
              {item?.item_type === 'product' ? 'Редактирование товара' : 'Редактирование услуги'}
            </div>
            <div style={s.categoryLocked}>
              <span>{catInfo.icon} {catInfo.label}</span>
              <span style={{ marginLeft: 'auto', color: theme.colors.premium.textMuted, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} /> не редактируется
              </span>
            </div>

            {/* Видео превью */}
            {videoFile && (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: images.length > 0 ? 8 : 16, background: '#111' }}>
                {videoThumb ? <img src={videoThumb} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: 130, background: '#1a1a1a' }} />}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={20} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', padding: '24px 10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.2px' }}>Видео · {(videoFile.size / 1024 / 1024).toFixed(1)} МБ</span>
                  <button style={{ width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: 0, transition: 'opacity 0.15s' }} onClick={() => { setVideoFile(null); setVideoThumb(null); }}><X size={13} /></button>
                </div>
              </div>
            )}

            {/* Фото-миниатюры */}
            {(images.length > 0 || processingImages.length > 0) && (
              <div style={s.photosRow}>
                {images.map((img, i) => (
                  <div key={i} style={s.photoThumb}>
                    <img src={img.url} alt="" style={s.photoImg} />
                    {!isSubmitting && (
                      <button
                        style={{ ...s.photoRemove, transition: 'opacity 0.15s' }}
                        onClick={() => removeImage(i)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {processingImages.map(proc => (
                  <div key={proc.id} style={s.photoThumb}>
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <div style={s.spinner} />
                      <span style={{ fontSize: 10, color: theme.colors.premium.textMuted }}>{Math.round(proc.progress)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
            <div className="em-title-wrap" data-replicated-value={title}>
              <textarea
                placeholder={item?.item_type === 'product' ? 'Название товара...' : 'Название услуги...'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                rows={1}
                maxLength={100}
                style={s.titleInput}
                disabled={isSubmitting}
              />
            </div>

            {/* Описание */}
            <div
              className="em-grow-wrap"
              data-replicated-value={description}
              style={s.growWrap}
            >
              <textarea
                ref={descRef}
                placeholder={item?.item_type === 'service' ? 'Опишите услугу, опыт и условия работы...' : 'Опишите состояние, комплектацию и причины продажи...'}
                value={description}
                onChange={handleDescChange}
                style={s.descTextarea}
                disabled={isSubmitting}
              />
            </div>

            {/* Чипы метаданных */}
            <div style={s.metaChips}>
              {item?.item_type === 'product' && condition && (
                <div
                  style={{ ...s.metaChip, transition: 'opacity 0.15s' }}
                  onClick={() => !isSubmitting && setActiveSubSheet('cond')}
                >
                  {condLabel?.icon} {condLabel?.label}
                </div>
              )}
              {location && (
                <div
                  style={{ ...s.metaChip, transition: 'opacity 0.15s' }}
                  onClick={() => !isSubmitting && setActiveSubSheet('loc')}
                >
                  <MapPin size={14} color={theme.colors.premium.primary} style={{ marginRight: 4 }} />
                  {location}
                </div>
              )}
            </div>
          </div>

          {/* Нижний тулбар */}
          <div style={s.bottomDock}>
            <div style={s.toolbar}>
              <div style={s.toolGroup}>
                {/* Фото */}
                <button
                  style={{ ...s.toolBtn, ...(images.length > 0 || videoFile ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
                >
                  <ImageIcon size={TOOL_ICON_SIZE} />
                </button>

                {/* Состояние — только для товаров */}
                {item?.item_type === 'product' && (
                  <button
                    style={{ ...s.toolBtn, ...(condition || activeSubSheet === 'cond' ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                    onClick={() => !isSubmitting && setActiveSubSheet(activeSubSheet === 'cond' ? null : 'cond')}
                  >
                    <Sparkles size={TOOL_ICON_SIZE} />
                  </button>
                )}

                {/* Локация */}
                <button
                  style={{ ...s.toolBtn, ...(location || activeSubSheet === 'loc' ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                  onClick={() => !isSubmitting && setActiveSubSheet(activeSubSheet === 'loc' ? null : 'loc')}
                >
                  <MapPin size={TOOL_ICON_SIZE} />
                </button>
              </div>
            </div>

            <div style={s.publishBtnWrap}>
              <button style={s.publishBtn} onClick={handleSubmit} disabled={!canSend}>
                <div style={{ ...s.publishFill, width: `${sendProgress}%` }} />
                <span style={{ position: 'relative', zIndex: 1, color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSubmitting ? <><Loader2 size={18} style={{ animation: 'em-spin 0.7s linear infinite' }} /> Сохраняем...</> : 'Сохранить'}
                </span>
                <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sendProgress}% 0 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transition: 'clip-path 0.35s ease', pointerEvents: 'none' }}>
                  <span style={{ color: '#000', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSubmitting ? <><Loader2 size={18} style={{ animation: 'em-spin 0.7s linear infinite' }} /> Сохраняем...</> : 'Сохранить'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Sub-sheet: состояние — только для товаров */}
          {item?.item_type === 'product' && (
            <div style={{
              ...s.subSheet,
              transform: activeSubSheet === 'cond' ? 'translateY(0)' : 'translateY(100%)',
            }}>
              <div style={s.subSheetHeader}>
                <span style={s.subSheetTitle}>Состояние</span>
                <button style={{ ...s.subSheetClose, transition: 'opacity 0.15s' }} onClick={() => setActiveSubSheet(null)}>
                  <X size={16} />
                </button>
              </div>
              <div className="market-hide-scroll" style={{ overflowY: 'auto' }}>
                {MARKET_CONDITIONS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { hapticFeedback('light'); setCondition(c.id); setActiveSubSheet(null); }}
                    style={{
                      ...s.condBtn,
                      background: condition === c.id ? 'rgba(212,255,0,0.1)' : theme.colors.premium.surfaceHover,
                      color: condition === c.id ? theme.colors.premium.primary : '#fff',
                      transition: 'opacity 0.15s, background-color 0.15s',
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
          )}

          {/* Sub-sheet: локация */}
          <div style={{
            ...s.subSheet,
            transform: activeSubSheet === 'loc' ? 'translateY(0)' : 'translateY(100%)',
          }}>
            <div style={s.subSheetHeader}>
              <span style={s.subSheetTitle}>Где забирать?</span>
              <button style={{ ...s.subSheetClose, transition: 'opacity 0.15s' }} onClick={() => setActiveSubSheet(null)}>
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
            <button style={{ ...s.locSaveBtn, transition: 'opacity 0.15s' }} onClick={() => setActiveSubSheet(null)}>
              Сохранить
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
      </div>
      <style>{`
        .em-title-wrap { display: grid; }
        .em-title-wrap > textarea,
        .em-title-wrap::after {
          font-size: 22px; font-weight: 700; line-height: 1.3;
          padding: 0; font-family: inherit; word-break: break-word;
          grid-area: 1/1/2/2;
        }
        .em-title-wrap::after {
          content: attr(data-replicated-value) " ";
          white-space: pre-wrap; visibility: hidden;
        }
        .em-title-wrap > textarea { resize: none; overflow: hidden; }
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
          word-break: break-word;
          grid-area: 1/1/2/2;
        }
        .em-grow-wrap > textarea {
          resize: none;
          overflow: hidden;
          grid-area: 1/1/2/2;
          font-family: inherit;
        }
        @keyframes em-spin { to { transform: rotate(360deg); } }
      `}</style>

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
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
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
    height: '90%',
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
    gap: 8,
    marginBottom: 12,
    padding: '10px 12px',
    background: theme.colors.premium.surfaceHover,
    borderRadius: 14,
    border: `1px solid ${theme.colors.premium.border}`,
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 200px',
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
    color: '#fff',
    caretColor: '#fff',
    outline: 'none',
    marginTop: 16,
    width: '100%',
    fontFamily: 'inherit',
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
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginTop: 16,
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
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
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
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    background: 'transparent',
    borderTop: 'none',
    pointerEvents: 'none',
  },
  toolbar: {
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  publishBtnWrap: {
    padding: '8px 16px',
    paddingBottom: 'calc(10px + var(--screen-bottom-offset))',
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
    color: theme.colors.premium.textMuted,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.15s, background-color 0.2s',
    flexShrink: 0,
    pointerEvents: 'auto',
  },
  toolBtnActive: { background: 'rgba(212,255,0,0.15)', color: theme.colors.premium.primary },
  publishBtn: {
    position: 'relative',
    width: '100%',
    height: 52,
    borderRadius: 26,
    border: 'none',
    background: theme.colors.premium.surfaceHover,
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    pointerEvents: 'auto',
  },
  publishFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, #D4FF00 0%, #8fff00 100%)',
    transition: 'width 0.35s ease',
    borderRadius: 26,
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
    padding: 'calc(24px) 16px calc(24px + var(--screen-bottom-offset))',
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
