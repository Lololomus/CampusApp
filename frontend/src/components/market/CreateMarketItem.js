// ===== FILE: CreateMarketItem.js =====
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Sparkles, MapPin, Check, Play, Loader2 } from 'lucide-react';
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
import { Z_MODAL_CREATE_MARKET_ITEM } from '../../constants/zIndex';
import { MARKET_CATEGORIES, MARKET_CONDITIONS } from '../../constants/marketConstants';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { modalBoundaryProps, modalTouchBoundaryHandlers } from '../../utils/modalEventBoundary';

const MAX_IMAGES = 3;
const MIN_TITLE_LEN = 3;
const MIN_DESC_LEN = 10;
const TOOL_ICON_SIZE = 26;

const hasCreateMarketDraftData = (draft) => {
  if (!draft || typeof draft !== 'object') return false;
  return (
    String(draft.title || '').trim().length > 0 ||
    String(draft.desc || '').trim().length > 0 ||
    String(draft.price || '').trim().length > 0 ||
    String(draft.location || '').trim().length > 0 ||
    String(draft.cat || '').trim().length > 0 ||
    String(draft.condition || '').trim().length > 0 ||
    (Array.isArray(draft.photos) && draft.photos.length > 0) ||
    Boolean(draft.videoFile)
  );
};

const CreateMarketItem = ({ onClose, onSuccess }) => {
  const {
    user,
    addMarketItem,
    createMarketDraft,
    setCreateMarketDraft,
    clearCreateMarketDraft,
  } = useStore();

  // --- Основной стейт ---
  const [itemType, setItemType] = useState('product');
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
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- Суб-шиты ---
  const [activeSubSheet, setActiveSubSheet] = useState(null); // 'cond' | 'loc' | null

  // --- Анимация видимости ---
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  const fileInputRef  = useRef(null);
  const titleRef      = useRef(null);
  const descRef       = useRef(null);
  const sheetRef      = useRef(null);
  const dragHandleRef = useRef(null);
  const skipItemTypeResetRef = useRef(false);
  const hasCheckedInitialDraftRef = useRef(false);
  const mediaProcessingTasksRef = useRef(new Set());
  const photosRef = useRef(photos);
  const videoFileRef = useRef(videoFile);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Скролл-фриз страницы при открытии
  useEffect(() => {
    const body = document.body;
    const root = document.getElementById('root');
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prevBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const prevRootOverflow = root?.style.overflow || '';
    const prevHtmlOverflow = html.style.overflow;
    const shouldRestoreScroll = prevBodyStyle.position !== 'fixed';

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    html.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';

    const restoreScrollPosition = () => {
      const prevScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        setTimeout(() => {
          window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
          html.style.scrollBehavior = prevScrollBehavior;
        }, 0);
      });
    };

    return () => {
      body.style.overflow = prevBodyStyle.overflow;
      body.style.position = prevBodyStyle.position;
      body.style.top = prevBodyStyle.top;
      body.style.left = prevBodyStyle.left;
      body.style.right = prevBodyStyle.right;
      body.style.width = prevBodyStyle.width;
      html.style.overflow = prevHtmlOverflow;
      if (root) root.style.overflow = prevRootOverflow;
      if (shouldRestoreScroll) restoreScrollPosition();
    };
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
    if (skipItemTypeResetRef.current) {
      skipItemTypeResetRef.current = false;
      return;
    }

    setCat('');
    if (itemType === 'service') setCondition('');
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

  useEffect(() => {
    if (hasCheckedInitialDraftRef.current) return;
    hasCheckedInitialDraftRef.current = true;

    if (hasCreateMarketDraftData(createMarketDraft)) {
      setShowRestoreDialog(true);
    }
  }, [createMarketDraft]);

  const hasAnyContent = () =>
    title.trim().length > 0 ||
    desc.trim().length > 0 ||
    price !== '' ||
    photos.length > 0 ||
    videoFile !== null ||
    cat !== '' ||
    condition !== '' ||
    location.trim().length > 0;

  const buildDraftSnapshot = () => ({
    itemType,
    cat,
    title,
    price,
    desc,
    condition,
    location,
    photos: [...photos],
    videoFile,
    videoThumb,
    savedAt: Date.now(),
  });

  const restoreDraft = (draft) => {
    if (!draft || typeof draft !== 'object') return;

    const nextPhotos = Array.isArray(draft.photos) ? [...draft.photos] : [];
    const nextVideo = draft.videoFile || null;

    skipItemTypeResetRef.current = true;
    setItemType(draft.itemType === 'service' ? 'service' : 'product');
    setCat(draft.cat || '');
    setTitle(draft.title || '');
    setPrice(String(draft.price ?? ''));
    setDesc(draft.desc || '');
    setCondition(draft.condition || '');
    setLocation(draft.location || '');
    setPhotos(nextPhotos);
    setVideoFile(nextVideo);
    setVideoThumb(draft.videoThumb || null);
    photosRef.current = nextPhotos;
    videoFileRef.current = nextVideo;
  };

  const closeWithDraft = ({ keepDraft = true } = {}) => {
    if (keepDraft) {
      if (hasAnyContent()) {
        setCreateMarketDraft(buildDraftSnapshot());
      } else {
        clearCreateMarketDraft();
      }
    } else {
      clearCreateMarketDraft();
    }

    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(onClose, 320);
  };

  const handleRestoreDraft = () => {
    restoreDraft(createMarketDraft);
    setShowRestoreDialog(false);
  };

  const handleDiscardDraft = () => {
    clearCreateMarketDraft();
    setShowRestoreDialog(false);
  };

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    activationRef: dragHandleRef,
    onSwipeDown: () => {
      if (showConfirmation || showRestoreDialog) return false;
      if (hasAnyContent()) {
        setShowConfirmation(true);
        return false;
      }
      closeWithDraft();
      return true;
    },
    isModal: true,
    threshold: 120,
  });

  // Telegram back button
  useTelegramScreen({
    id: 'create-market-item',
    priority: Z_MODAL_CREATE_MARKET_ITEM + 5,
    back: {
      visible: true,
      onClick: () => {
        if (showRestoreDialog) {
          handleDiscardDraft();
          return;
        }
        if (showConfirmation) {
          setShowConfirmation(false);
          return;
        }
        handleClose();
      },
    },
    main: { visible: false },
  });

  const canPublish =
    title.trim().length >= MIN_TITLE_LEN &&
    price !== '' &&
    desc.trim().length >= MIN_DESC_LEN &&
    cat !== '' &&
    (photos.length > 0 || videoFile !== null) &&
    (itemType === 'service' || condition !== '');

  const computeProgress = () => {
    const segs = [
      { w: 25, v: photos.length > 0 || videoFile ? 1 : 0 },
      { w: 15, v: cat !== '' ? 1 : 0 },
      { w: 20, v: Math.min(1, title.trim().length / MIN_TITLE_LEN) },
      { w: 15, v: price !== '' && Number(price) > 0 ? 1 : 0 },
      { w: 25, v: Math.min(1, desc.trim().length / MIN_DESC_LEN) },
    ];
    if (itemType === 'product') segs.push({ w: 20, v: condition !== '' ? 1 : 0 });
    const total = segs.reduce((s, seg) => s + seg.w, 0);
    const filled = segs.reduce((s, seg) => s + seg.w * seg.v, 0);
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  };
  const sendProgress = computeProgress();

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
      const clearInput = () => {
        if (!fileInputRef.current) return;
        fileInputRef.current.value = '';
      };
      if (!files || files.length === 0) return;
      const videoCandidate = Array.from(files).find((file) => isVideoFileCandidate(file));
      if (videoCandidate) {
        const validation = await validateVideoFile(videoCandidate);
        if (!validation.valid) {
          hapticFeedback('error');
          toast.error(validation.error);
          clearInput();
          return;
        }
        setVideoFile(videoCandidate);
        captureVideoThumbnail(videoCandidate).then(setVideoThumb);
        hapticFeedback('light');
        clearInput();
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
        clearInput();
      }
    })();
    registerMediaTask(task);
  };

  const removePhoto = useCallback((idx) => {
    hapticFeedback('medium');
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // --- Авто-рост textarea ---
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (titleRef.current?.parentElement) {
      titleRef.current.parentElement.dataset.replicatedValue = e.target.value;
    }
  };

  const handleDescChange = (e) => {
    setDesc(e.target.value);
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
      (itemType === 'service' || condition !== '');

    if (!canPublishNow) {
      setLoading(false);
      hapticFeedback('error');
      if (!cat) {
        toast.error('Выберите категорию');
      } else if (!title.trim() || title.trim().length < MIN_TITLE_LEN) {
        toast.error('Введите название (минимум 3 символа)');
      } else if (!price) {
        toast.error('Укажите цену');
      } else if (!desc.trim() || desc.trim().length < MIN_DESC_LEN) {
        toast.error('Добавьте описание (минимум 10 символов)');
      } else if (currentPhotos.length === 0 && !currentVideoFile) {
        toast.error('Добавьте хотя бы одно фото');
      } else if (itemType === 'product' && !condition) {
        toast.error('Укажите состояние товара');
      }
      return;
    }

    setLoading(true);
    setUploadProgress(10);
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

      setUploadProgress(50);
      const result = await createMarketItem(formData);
      setUploadProgress(100);
      addMarketItem(result);
      hapticFeedback('success');
      toast.success('Товар опубликован');
      if (onSuccess) onSuccess(result);
      closeWithDraft({ keepDraft: false });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка публикации');
      hapticFeedback('error');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  function handleClose() {
    if (loading) return;
    if (hasAnyContent()) {
      hapticFeedback('light');
      setShowConfirmation(true);
      return;
    }
    closeWithDraft();
  }

  // Текст выбранного состояния
  const condLabel = MARKET_CONDITIONS.find(c => c.id === condition);

  // --- Слайд с категориями + полями (общий для product/service) ---
  const renderSlide = (type) => (
    <div style={s.slide}>
      <div style={s.catGrid}>
        {MARKET_CATEGORIES.filter(c => c.type === type).map(c => {
          const isSelected = cat === c.id;
          return (
            <button key={c.id}
              onClick={() => { hapticFeedback('medium'); setCat(c.id); }}
              style={{
                ...s.catBtn,
                borderColor: isSelected ? theme.colors.premium.primary : 'transparent',
                background: isSelected ? 'rgba(212,255,0,0.1)' : theme.colors.premium.surfaceHover,
                color: isSelected ? theme.colors.premium.primary : '#fff',
                transition: 'opacity 0.15s, background-color 0.2s, border-color 0.2s',
              }}>
              <span>{c.icon}</span><span>{c.label}</span>
            </button>
          );
        })}
      </div>
      {videoFile && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: photos.length > 0 ? 8 : 16, background: '#111' }}>
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
      {photos.length > 0 && (
        <div className="market-hide-scroll" style={s.photosRow}>
          {photos.map((p, i) => (
            <div key={i} style={s.photoThumb}>
              <img src={p.preview} alt="" style={s.photoImg} />
              <button style={{ ...s.photoRemove, transition: 'opacity 0.15s' }} onClick={() => removePhoto(i)}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={s.priceRow}>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <span style={s.priceSizer}>{price || 'Цена'}</span>
          <input type="text" inputMode="numeric" placeholder="Цена" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} style={s.priceInput} />
        </div>
        {price && <span style={s.priceCurrency}>₽</span>}
      </div>
      <div className="cm-title-wrap" data-replicated-value={title}>
        <textarea ref={itemType === type ? titleRef : null} placeholder={type === 'product' ? 'Название товара...' : 'Название услуги...'} value={title} onChange={handleTitleChange} maxLength={100} rows={1} style={s.titleInput} />
      </div>
      <div className="cm-grow-wrap" data-replicated-value={desc} style={s.growWrap}>
        <textarea ref={itemType === type ? descRef : null} placeholder={type === 'product' ? 'Опишите состояние, комплектацию и причины продажи...' : 'Опишите услугу, опыт и условия работы...'} value={desc} onChange={handleDescChange} style={s.descTextarea} />
      </div>
      <div style={s.metaChips}>
        {type === 'product' && condition && <div style={{ ...s.metaChip, transition: 'opacity 0.15s' }} onClick={() => setActiveSubSheet('cond')}>{condLabel?.icon} {condLabel?.label}</div>}
        {location && <div style={{ ...s.metaChip, transition: 'opacity 0.15s' }} onClick={() => setActiveSubSheet('loc')}><MapPin size={14} color={theme.colors.premium.primary} style={{ marginRight: 4 }} />{location}</div>}
      </div>
    </div>
  );

  const sheet = (
    <div
      {...modalBoundaryProps}
      {...modalTouchBoundaryHandlers}
      style={{ ...s.backdrop, opacity: isVisible ? 1 : 0 }}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        style={{
          ...s.sheet,
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Прогресс-бар */}
        {loading && uploadProgress > 0 && (
          <div style={s.progressBar}>
            <div style={{ ...s.progressFill, width: `${uploadProgress}%` }} />
          </div>
        )}

        {/* Drag handle */}
        <DragHandle handlers={swipeHandlers} handleRef={dragHandleRef} gap={0} />

        {/* Таб-свитчер Товар / Услуга */}
        <div style={s.switcherWrap}>
          <div style={s.switcher}>
            <button
              style={{
                ...s.switcherBtn,
                ...(itemType === 'product' ? s.switcherBtnActive : {}),
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onClick={() => { hapticFeedback('light'); setItemType('product'); }}
            >Товар</button>
            <button
              style={{
                ...s.switcherBtn,
                ...(itemType === 'service' ? s.switcherBtnActive : {}),
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onClick={() => { hapticFeedback('light'); setItemType('service'); }}
            >Услуга</button>
          </div>
        </div>

        {/* Прокручиваемый контент */}
        <div className="market-hide-scroll" style={s.scroll}>
          <div style={{
            display: 'flex',
            width: '200%',
            transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            transform: `translateX(${itemType === 'product' ? '0' : '-50%'})`,
          }}>
            {renderSlide('product')}
            {renderSlide('service')}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div style={s.bottomDock}>
          <div style={s.toolbar}>
            <div style={s.toolGroup}>
              {/* Фото */}
              <button
                style={{ ...s.toolBtn, ...(photos.length > 0 ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                onClick={handlePhotoAdd}
                disabled={loading}
              >
                {loading && uploadProgress === 0 ? <div style={s.spinner} /> : <ImageIcon size={TOOL_ICON_SIZE} />}
              </button>

              {/* Состояние (только для товаров) */}
              {itemType === 'product' && (
                <button
                  style={{ ...s.toolBtn, ...(condition || activeSubSheet === 'cond' ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                  onClick={() => setActiveSubSheet(activeSubSheet === 'cond' ? null : 'cond')}
                >
                  <Sparkles size={TOOL_ICON_SIZE} />
                </button>
              )}

              {/* Локация */}
              <button
                style={{ ...s.toolBtn, ...(location || activeSubSheet === 'loc' ? s.toolBtnActive : {}), transition: 'opacity 0.15s, background-color 0.2s' }}
                onClick={() => setActiveSubSheet(activeSubSheet === 'loc' ? null : 'loc')}
              >
                <MapPin size={TOOL_ICON_SIZE} />
              </button>
            </div>
          </div>

          <div style={s.publishBtnWrap}>
            <button style={s.publishBtn} onClick={handleSubmit} disabled={loading || !canPublish}>
              <div style={{ ...s.publishFill, width: `${sendProgress}%` }} />
              <span style={{ position: 'relative', zIndex: 1, color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {loading ? <><Loader2 size={18} style={{ animation: 'cm-spin 0.7s linear infinite' }} /> Публикуем...</> : 'Опубликовать'}
              </span>
              <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sendProgress}% 0 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transition: 'clip-path 0.35s ease', pointerEvents: 'none' }}>
                <span style={{ color: '#000', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <><Loader2 size={18} style={{ animation: 'cm-spin 0.7s linear infinite' }} /> Публикуем...</> : 'Опубликовать'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Sub-sheet: состояние */}
        <div style={{
          ...s.subSheet,
          transform: activeSubSheet === 'cond' ? 'translateY(0)' : 'translateY(100%)',
        }}>
          <div style={s.subSheetHeader}>
            <span style={s.subSheetTitle}>Состояние</span>
            <button
              style={{ ...s.subSheetClose, transition: 'opacity 0.15s' }}
              onClick={() => setActiveSubSheet(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="market-hide-scroll" style={{ overflowY: 'auto' }}>
            {MARKET_CONDITIONS.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  hapticFeedback('light');
                  setCondition(c.id);
                  setActiveSubSheet(null);
                }}
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

        {/* Sub-sheet: локация */}
        <div style={{
          ...s.subSheet,
          transform: activeSubSheet === 'loc' ? 'translateY(0)' : 'translateY(100%)',
        }}>
          <div style={s.subSheetHeader}>
            <span style={s.subSheetTitle}>Где забирать?</span>
            <button
              style={{ ...s.subSheetClose, transition: 'opacity 0.15s' }}
              onClick={() => setActiveSubSheet(null)}
            >
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
          <button
            style={{ ...s.locSaveBtn, transition: 'opacity 0.15s' }}
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
        .cm-title-wrap { display: grid; }
        .cm-title-wrap > textarea,
        .cm-title-wrap::after {
          font-size: 22px;
          font-weight: 700;
          line-height: 1.3;
          padding: 0;
          font-family: inherit;
          word-break: break-word;
          grid-area: 1/1/2/2;
        }
        .cm-title-wrap::after {
          content: attr(data-replicated-value) " ";
          white-space: pre-wrap;
          visibility: hidden;
        }
        .cm-title-wrap > textarea {
          resize: none;
          overflow: hidden;
        }

        .cm-grow-wrap { display: grid; }
        .cm-grow-wrap > textarea,
        .cm-grow-wrap::after {
          font-size: 16px;
          line-height: 1.4;
          min-height: 80px;
          padding: 0;
          font-family: inherit;
          word-break: break-word;
          grid-area: 1/1/2/2;
        }
        .cm-grow-wrap::after {
          content: attr(data-replicated-value) " ";
          white-space: pre-wrap;
          visibility: hidden;
        }
        .cm-grow-wrap > textarea {
          resize: none;
          overflow: hidden;
        }

        @keyframes cm-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  const portal = (
    <>
      {sheet}
      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Выйти из редактора?"
        message="Черновик сохранится в текущей сессии и его можно будет восстановить."
        confirmText="Выйти"
        cancelText="Продолжить"
        confirmType="danger"
        onConfirm={() => closeWithDraft()}
        onCancel={() => setShowConfirmation(false)}
      />
      <ConfirmationDialog
        isOpen={showRestoreDialog}
        title="Восстановить черновик?"
        message="Найден незавершенный черновик из текущей сессии."
        confirmText="Восстановить"
        cancelText="Начать заново"
        confirmType="primary"
        onConfirm={handleRestoreDraft}
        onCancel={handleDiscardDraft}
      />
    </>
  );

  return createPortal(portal, document.body);
};

// ===== СТИЛИ =====
const s = {
  backdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_MODAL_CREATE_MARKET_ITEM,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    transition: 'opacity 0.3s ease',
  },
  sheet: {
    background: theme.colors.premium.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${theme.colors.premium.primary} 0%, #8fff00 100%)`,
    transition: 'width 0.3s ease',
  },
  // Таб-свитчер
  switcherWrap: {
    padding: '12px 16px 10px',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    flexShrink: 0,
  },
  switcher: {
    display: 'flex',
    background: theme.colors.premium.surfaceHover,
    borderRadius: 12,
    padding: 4,
  },
  switcherBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: theme.colors.premium.textMuted,
    padding: '8px',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  switcherBtnActive: {
    background: theme.colors.premium.primary,
    color: '#000',
  },
  // Скролл-область
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  slide: {
    width: '50%',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 20px 200px',
    boxSizing: 'border-box',
  },
  // Категории
  catGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    padding: '12px 0 16px',
    flexShrink: 0,
  },
  catBtn: {
    border: '1px solid transparent',
    borderRadius: 20,
    background: theme.colors.premium.surfaceHover,
    color: '#fff',
    padding: '8px 10px',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    minWidth: 0,
    overflow: 'hidden',
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
    background: 'transparent',
    border: 'none',
    color: '#fff',
    caretColor: '#fff',
    outline: 'none',
    marginTop: 16,
    width: '100%',
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
    color: theme.colors.premium.textBody,
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
  // Нижний тулбар
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
    width: '100%',
  },
  // Локация
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
    transition: 'border-color 0.2s',
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
    animation: 'cm-spin 0.8s linear infinite',
  },
};

export default CreateMarketItem;
