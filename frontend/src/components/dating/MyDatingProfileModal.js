// ===== FILE: MyDatingProfileModal.js =====

import { useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap, SlidersHorizontal, Camera, Edit3, Heart, ChevronRight, ChevronLeft, EyeOff, Plus, X } from 'lucide-react';
import { useStore } from '../../store';
import { updateDatingProfile, updateDatingSettings } from '../../api';
import { formatImageProcessingWarning, processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { toast } from '../shared/Toast';
import PhotoViewer from '../media/PhotoViewer';
import SwipeableModal from '../shared/SwipeableModal';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { captureSourceRect } from '../../utils/mediaRect';
import {
  PROMPT_OPTIONS,
  PROMPTS_BY_CATEGORY,
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  LOOKING_FOR_OPTIONS,
  MAX_INTERESTS,
  MAX_GOALS,
  MAX_PHOTOS,
  BIO_MIN_LENGTH,
  BIO_MAX_LENGTH,
  MIN_AGE,
  MAX_AGE,
} from '../../constants/datingConstants';

const Z_MODAL = 2500;
const PROFILE_MODAL_TRANSITION_MS = 420;
const d = theme.colors.dating;

const getHeroPhotoSourceRect = (element) => captureSourceRect(element, {
  objectFit: 'contain',
  borderRadius: 24,
  hasContainFill: true,
});

// Цвета из CSS-переменных мока
const PINK = d.pink;          // #FF2D55 — var(--dating)
const SURFACE = d.surface;    // #1C1C1E — var(--surface)
const SURFACE_EL = d.surfaceHover; // #2C2C2E — var(--surface-elevated)
const MUTED = d.textMuted;    // #8E8E93 — var(--text-muted)
const BG = '#000000';         // var(--bg)

// Путь к фото в хранилище (для нормализации keep_photos)
const PHOTO_STORAGE_MARKER = '/uploads/images/';
const normalizePhotoPath = (photo) => {
  const url = typeof photo === 'object' && photo?.url
    ? photo.url
    : typeof photo === 'string'
      ? photo
      : '';
  if (!url) return '';
  if (url.includes(PHOTO_STORAGE_MARKER)) {
    return url.substring(url.lastIndexOf(PHOTO_STORAGE_MARKER));
  }
  return url.trim();
};

// Хелпер: собирает FormData из текущего профиля с нужными override-полями
const buildProfileFormData = (datingProfile, overrides = {}) => {
  const fd = new FormData();
  fd.append('gender', datingProfile.gender);
  fd.append('age', overrides.age ?? datingProfile.age);
  fd.append('looking_for', overrides.looking_for ?? datingProfile.looking_for);
  fd.append('bio', overrides.bio !== undefined ? overrides.bio : (datingProfile.bio || ''));
  fd.append('goals', JSON.stringify(overrides.goals ?? datingProfile.goals ?? []));
  fd.append('interests', JSON.stringify(overrides.interests ?? datingProfile.interests ?? []));

  // Промпт
  const prompt = overrides.prompt !== undefined ? overrides.prompt : datingProfile.prompts;
  if (prompt?.question && prompt?.answer) {
    fd.append('prompt_question', prompt.question);
    fd.append('prompt_answer', prompt.answer);
  }

  // Существующие фото (keep)
  const keepPhotos = overrides.keepPhotos !== undefined
    ? overrides.keepPhotos
    : (datingProfile.photos || []).map(normalizePhotoPath).filter(Boolean);
  fd.append('keep_photos', JSON.stringify(keepPhotos));

  // Новые файлы
  if (overrides.newFiles) {
    overrides.newFiles.forEach((file, i) => fd.append('photos', file, `photo_${i}.jpg`));
  }

  return fd;
};

function MyDatingProfileModal({ onClose }) {
  const { datingProfile, setDatingProfile, user } = useStore();

  // Анимация появления/скрытия (паттерн как в CreatePostModal)
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Навигация по фото в hero
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerSourceRect, setPhotoViewerSourceRect] = useState(null);
  const heroPhotoRef = useRef(null);

  // Активный bottom sheet
  const [activeSheet, setActiveSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  // Temp-стейты для sheets
  const [tempBio, setTempBio] = useState('');
  const [tempIcebreaker, setTempIcebreaker] = useState({ question: '', answer: '', isCustom: false });
  const [ibStep, setIbStep] = useState('list'); // 'list' | 'answer' | 'custom'
  const [tempGoals, setTempGoals] = useState([]);
  const [tempInterests, setTempInterests] = useState([]);
  const [tempSettings, setTempSettings] = useState({ age: 20, lookingFor: 'female', isHidden: false });
  const [tempPhotos, setTempPhotos] = useState([]); // существующие фото
  const [tempNewFiles, setTempNewFiles] = useState([]);
  const [tempNewPreviews, setTempNewPreviews] = useState([]);

  const fileInputRef = useRef(null);

  // Монтирование + триггер анимации появления (паттерн CreatePostModal)
  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  // Освобождаем object URL при анмаунте
  useEffect(() => {
    return () => {
      if (tempNewPreviews.length > 0) revokeObjectURLs(tempNewPreviews);
    };
  }, [tempNewPreviews]);

  // Закрытие с exit-анимацией
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), PROFILE_MODAL_TRANSITION_MS);
  };

  useTelegramScreen({
    id: 'my-dating-profile-modal',
    title: 'Мой профиль',
    priority: 110,
    back: { visible: true, onClick: handleClose },
  });

  const resolvePhotoViewerSourceRect = useCallback((index) => (
    index === currentPhotoIndex
      ? getHeroPhotoSourceRect(heroPhotoRef.current) || photoViewerSourceRect
      : null
  ), [currentPhotoIndex, photoViewerSourceRect]);

  if (!isMounted || !datingProfile) return null;

  const photos = datingProfile.photos || [];
  const hasPhotos = photos.length > 0;
  const hasPrompt = datingProfile.prompts?.question && datingProfile.prompts?.answer;

  const getPhotoUrl = (photo) =>
    typeof photo === 'object' && photo?.url ? photo.url : typeof photo === 'string' ? photo : '';

  // Открытие sheet — инициализация temp-стейтов
  const openSheet = (name) => {
    hapticFeedback('light');
    const profile = useStore.getState().datingProfile;
    const usr = useStore.getState().user;

    if (name === 'bio') {
      setTempBio(profile.bio || '');
    } else if (name === 'icebreaker') {
      if (profile.prompts?.question) {
        setTempIcebreaker({ question: profile.prompts.question, answer: profile.prompts.answer, isCustom: false });
        setIbStep('answer');
      } else {
        setTempIcebreaker({ question: '', answer: '', isCustom: false });
        setIbStep('list');
      }
    } else if (name === 'tags') {
      setTempGoals([...(profile.goals || [])]);
      setTempInterests([...(profile.interests || [])]);
    } else if (name === 'settings') {
      setTempSettings({
        age: profile.age || 20,
        lookingFor: profile.looking_for || 'female',
        isHidden: !usr?.show_in_dating,
      });
    } else if (name === 'photos') {
      setTempPhotos([...(profile.photos || [])]);
      setTempNewFiles([]);
      setTempNewPreviews([]);
    }

    setActiveSheet(name);
  };

  const closeSheet = () => setActiveSheet(null);

  // Тап по hero-фото — навигация (левая/правая половина)
  const handleHeroTap = (e) => {
    if (photos.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      if (currentPhotoIndex > 0) { hapticFeedback('light'); setCurrentPhotoIndex(prev => prev - 1); }
    } else {
      if (currentPhotoIndex < photos.length - 1) { hapticFeedback('light'); setCurrentPhotoIndex(prev => prev + 1); }
    }
  };

  // ===== SAVE HANDLERS =====

  const saveBio = async () => {
    const cleaned = tempBio.trim();
    if (cleaned.length > 0) {
      if (cleaned.length < BIO_MIN_LENGTH) { toast.warning(`Минимум ${BIO_MIN_LENGTH} символов`); return; }
      if (cleaned.length > BIO_MAX_LENGTH) { toast.warning(`Максимум ${BIO_MAX_LENGTH} символов`); return; }
      const letters = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[^\wа-яА-ЯёЁ\s]/g, '');
      if (letters.trim().length < BIO_MIN_LENGTH) { toast.warning('Напиши хотя бы пару слов'); return; }
    }
    setSaving(true);
    try {
      const profile = useStore.getState().datingProfile;
      const updated = await updateDatingProfile(buildProfileFormData(profile, { bio: cleaned }));
      setDatingProfile(updated);
      hapticFeedback('success');
      toast.success('Профиль обновлён');
      closeSheet();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveIcebreaker = async () => {
    if (!tempIcebreaker.question.trim() || !tempIcebreaker.answer.trim()) return;
    setSaving(true);
    try {
      const profile = useStore.getState().datingProfile;
      const updated = await updateDatingProfile(
        buildProfileFormData(profile, { prompt: { question: tempIcebreaker.question.trim(), answer: tempIcebreaker.answer.trim() } })
      );
      setDatingProfile(updated);
      hapticFeedback('success');
      toast.success('Ледокол сохранён');
      closeSheet();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async () => {
    setSaving(true);
    try {
      const profile = useStore.getState().datingProfile;
      const updated = await updateDatingProfile(
        buildProfileFormData(profile, { goals: tempGoals, interests: tempInterests })
      );
      setDatingProfile(updated);
      hapticFeedback('success');
      toast.success('Теги сохранены');
      closeSheet();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    const ageVal = parseInt(tempSettings.age);
    if (isNaN(ageVal) || ageVal < MIN_AGE || ageVal > MAX_AGE) {
      toast.warning(`Возраст: ${MIN_AGE}–${MAX_AGE}`);
      return;
    }
    setSaving(true);
    try {
      const profile = useStore.getState().datingProfile;
      const usr = useStore.getState().user;

      // Обновляем возраст и looking_for
      const updated = await updateDatingProfile(
        buildProfileFormData(profile, { age: ageVal, looking_for: tempSettings.lookingFor })
      );
      setDatingProfile(updated);

      // Обновляем видимость если изменилась
      const newShowValue = !tempSettings.isHidden;
      if (newShowValue !== usr?.show_in_dating) {
        await updateDatingSettings({ show_in_dating: newShowValue });
        useStore.setState({ user: { ...useStore.getState().user, show_in_dating: newShowValue } });
      }

      hapticFeedback('success');
      toast.success('Настройки сохранены');
      closeSheet();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const savePhotos = async () => {
    const totalPhotos = tempPhotos.length + tempNewFiles.length;
    if (totalPhotos === 0) { toast.warning('Минимум 1 фото обязательно'); return; }
    setSaving(true);
    try {
      const profile = useStore.getState().datingProfile;
      const keepPhotos = tempPhotos.map(normalizePhotoPath).filter(Boolean);
      const updated = await updateDatingProfile(
        buildProfileFormData(profile, { keepPhotos, newFiles: tempNewFiles })
      );
      setDatingProfile(updated);
      if (tempNewPreviews.length > 0) revokeObjectURLs(tempNewPreviews);
      setTempNewFiles([]);
      setTempNewPreviews([]);
      hapticFeedback('success');
      toast.success('Фото обновлены');
      closeSheet();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // Загрузка новых фото в photos sheet
  const handlePhotoUpload = async (e) => {
    if (!e.target.files.length) return;
    const totalPhotos = tempPhotos.length + tempNewFiles.length;
    if (totalPhotos + e.target.files.length > MAX_PHOTOS) {
      toast.warning(`Максимум ${MAX_PHOTOS} фото`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSaving(true);
    try {
      const processed = await processImageFiles(e.target.files);
      const warning = formatImageProcessingWarning(processed, e.target.files.length);
      if (warning) toast.warning(warning);
      setTempNewFiles(prev => [...prev, ...processed.map(p => p.file)]);
      setTempNewPreviews(prev => [...prev, ...processed.map(p => p.preview)]);
    } catch {
      toast.error('Ошибка обработки фото');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleGoal = (value) => {
    hapticFeedback('light');
    setTempGoals(prev => {
      if (prev.includes(value)) return prev.filter(g => g !== value);
      if (prev.length >= MAX_GOALS) { toast.warning(`Максимум ${MAX_GOALS} цели`); return prev; }
      return [...prev, value];
    });
  };

  const toggleInterest = (value) => {
    hapticFeedback('light');
    setTempInterests(prev => {
      if (prev.includes(value)) return prev.filter(i => i !== value);
      if (prev.length >= MAX_INTERESTS) { toast.warning(`Максимум ${MAX_INTERESTS} интересов`); return prev; }
      return [...prev, value];
    });
  };

  const icebreakerCanSave = tempIcebreaker.question.trim() && tempIcebreaker.answer.trim();

  return (
    <EdgeSwipeBack
      onBack={handleClose}
      disabled={showPhotoViewer || Boolean(activeSheet)}
      zIndex={Z_MODAL}
    >
      <>
      <div
        style={{ ...styles.overlay, opacity: isVisible ? 1 : 0 }}
        onClick={handleClose}
      />

      <div style={{
        ...styles.modal,
        transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)',
      }}>
        <div className="hide-scroll" style={styles.content}>
          <div style={styles.headerOverlay}>
            <DrilldownHeader
              title="Мой профиль"
              onBack={handleClose}
              sticky={false}
              showDivider={false}
              transparent
              titleVariant="app"
            />
          </div>
          <div style={styles.contentInner}>

          {/* ===== HERO PHOTO ===== */}
          <div style={styles.heroContainer} onClick={handleHeroTap}>
            {hasPhotos ? (
              <img
                ref={heroPhotoRef}
                src={getPhotoUrl(photos[currentPhotoIndex])}
                alt=""
                style={{
                  ...styles.heroImg,
                  visibility: showPhotoViewer ? 'hidden' : 'visible',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoViewerSourceRect(getHeroPhotoSourceRect(heroPhotoRef.current));
                  setShowPhotoViewer(true);
                }}
              />
            ) : (
              <div style={styles.heroEmpty}>
                <Camera size={48} color="rgba(255,255,255,0.3)" />
              </div>
            )}

            {/* Градиент снизу */}
            <div style={styles.heroGradient} />

            {/* Индикаторы фото (bars) */}
            {photos.length > 1 && (
              <div style={styles.photoBars}>
                {photos.map((_, i) => (
                  <div key={i} style={{
                    ...styles.photoBar,
                    background: i === currentPhotoIndex ? '#FFF' : 'rgba(255,255,255,0.3)',
                  }} />
                ))}
              </div>
            )}

            {/* Нижний оверлей: имя + кнопки */}
            <div style={styles.heroOverlay}>
              {/* Левая часть: имя, ВУЗ, бейдж скрытия */}
              <div style={styles.heroInfo}>
                {user && !user.show_in_dating && (
                  <div style={styles.hiddenBadge}>
                    <EyeOff size={14} /> Анкета скрыта
                  </div>
                )}
                <div style={styles.heroName}>
                  {user?.name}{datingProfile.age ? `, ${datingProfile.age}` : ''}
                </div>
                <div style={styles.heroUniversity}>
                  <GraduationCap size={16} />
                  {user?.university}{user?.institute ? ` • ${user.institute}` : ''}
                  {user?.course ? ` • ${user.course} курс` : ''}
                </div>
              </div>

              {/* Правая часть: кнопки */}
              <div style={styles.heroButtons}>
                <button
                  style={styles.heroBtn}
                  onClick={(e) => { e.stopPropagation(); openSheet('settings'); }}
                >
                  <SlidersHorizontal size={20} />
                </button>
                <button
                  style={{ ...styles.heroBtn, background: PINK, boxShadow: `0 4px 12px ${d.pinkGlow}`, border: 'none' }}
                  onClick={(e) => { e.stopPropagation(); openSheet('photos'); }}
                >
                  <Camera size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* ===== О СЕБЕ ===== */}
          <div style={styles.card} onClick={() => openSheet('bio')}>
            <Edit3 size={18} color={MUTED} style={styles.cardEditIcon} />
            <div style={styles.cardLabel}>Обо мне</div>
            <p style={{ ...styles.cardText, color: datingProfile.bio ? '#FFF' : MUTED }}>
              {datingProfile.bio || 'Напиши пару слов о себе...'}
            </p>
          </div>

          {/* ===== ЛЕДОКОЛ ===== */}
          <div
            style={{
              ...styles.card,
              border: hasPrompt ? `1px solid ${PINK}` : `1px solid ${theme.colors.border}`,
              boxShadow: hasPrompt ? `0 4px 20px rgba(255, 45, 85, 0.05)` : 'none',
            }}
            onClick={() => openSheet('icebreaker')}
          >
            <Edit3 size={18} color={MUTED} style={styles.cardEditIcon} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Heart size={18} fill={PINK} color={PINK} />
              <div style={{ ...styles.cardLabel, color: PINK, marginBottom: 0 }}>Ледокол</div>
            </div>
            {hasPrompt ? (
              <>
                <div style={{ fontSize: 14, color: MUTED, marginBottom: 8 }}>{datingProfile.prompts.question}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#FFF', lineHeight: 1.4 }}>{datingProfile.prompts.answer}</div>
              </>
            ) : (
              <p style={{ ...styles.cardText, color: MUTED }}>
                Выбери вопрос, чтобы с тобой было проще начать диалог
              </p>
            )}
          </div>

          {/* ===== ЦЕЛИ И ИНТЕРЕСЫ ===== */}
          <div style={styles.card} onClick={() => openSheet('tags')}>
            <Edit3 size={18} color={MUTED} style={styles.cardEditIcon} />
            <div style={styles.cardLabel}>Цели и интересы</div>
            <div style={styles.chipsRow}>
              {datingProfile.goals?.map(g => {
                const opt = GOAL_OPTIONS.find(o => o.value === g);
                return opt ? (
                  <span key={g} style={styles.chipActive}>{opt.label}</span>
                ) : null;
              })}
              {datingProfile.interests?.map(i => {
                const opt = INTEREST_OPTIONS.find(o => o.value === i);
                return opt ? (
                  <span key={i} style={styles.chipInactive}>{opt.label}</span>
                ) : null;
              })}
              {(!datingProfile.goals?.length && !datingProfile.interests?.length) && (
                <span style={{ color: MUTED, fontSize: 15 }}>Выбрать теги...</span>
              )}
            </div>
          </div>

          </div>
        </div>
      </div>

      {/* ===== PHOTO VIEWER ===== */}
      {showPhotoViewer && (
        <PhotoViewer
          photos={photos}
          initialIndex={currentPhotoIndex}
          onClose={() => {
            setShowPhotoViewer(false);
            setPhotoViewerSourceRect(null);
          }}
          dismissMode="swipe"
          sourceRect={photoViewerSourceRect}
          sourceRectProvider={resolvePhotoViewerSourceRect}
          onIndexChange={setCurrentPhotoIndex}
        />
      )}

      {/* ===== BIO SHEET ===== */}
      <SwipeableModal
        isOpen={activeSheet === 'bio'}
        onClose={closeSheet}
        title="Обо мне"
        showHeaderDivider={false}
      >
        <textarea
          value={tempBio}
          onChange={e => setTempBio(e.target.value)}
          placeholder="Расскажи, кого ищешь и чем увлекаешься..."
          maxLength={BIO_MAX_LENGTH}
          style={styles.textarea}
          autoFocus
        />
        <div style={styles.charCounter}>{tempBio.length} / {BIO_MAX_LENGTH}</div>
        <button
          onClick={saveBio}
          disabled={saving}
          style={{ ...styles.sheetSaveBtn, marginTop: 24 }}
        >
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </SwipeableModal>

      {/* ===== ICEBREAKER SHEET ===== */}
      <SwipeableModal
        isOpen={activeSheet === 'icebreaker'}
        onClose={closeSheet}
        title={ibStep === 'list' ? 'Выбери ледокол' : 'Твой ледокол'}
        showHeaderDivider={false}
      >
        {/* Шаг 1: список вопросов */}
        {ibStep === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Кнопка кастомного вопроса */}
            <button
              style={styles.promptCustomBtn}
              onClick={() => {
                hapticFeedback('light');
                setTempIcebreaker({ question: '', answer: '', isCustom: true });
                setIbStep('custom');
              }}
            >
              <Edit3 size={18} color={PINK} style={{ flexShrink: 0 }} />
              <span style={{ color: PINK, fontWeight: 600 }}>Написать свой вопрос...</span>
            </button>

            {/* Категоризированные вопросы */}
            {Object.entries(PROMPTS_BY_CATEGORY).map(([category, prompts]) => (
              <div key={category}>
                <div style={styles.promptCategoryLabel}>{category}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {prompts.map((p) => (
                    <button
                      key={p.id}
                      style={styles.promptListItem}
                      onClick={() => {
                        hapticFeedback('light');
                        setTempIcebreaker({ question: p.question, answer: '', isCustom: false });
                        setIbStep('answer');
                      }}
                    >
                      <span style={{ flex: 1, textAlign: 'left' }}>{p.question}</span>
                      <ChevronRight size={18} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Шаг 2: ответ на готовый вопрос */}
        {ibStep === 'answer' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              style={styles.ibBackBtn}
              onClick={() => { hapticFeedback('light'); setIbStep('list'); }}
            >
              <ChevronLeft size={18} /> Другой вопрос
            </button>
            <div style={{ fontSize: 15, color: MUTED, marginBottom: 12 }}>{tempIcebreaker.question}</div>
            <textarea
              style={styles.textareaLarge}
              placeholder="Твой ответ..."
              value={tempIcebreaker.answer}
              onChange={e => setTempIcebreaker(prev => ({ ...prev, answer: e.target.value }))}
              rows={4}
              maxLength={150}
              autoFocus
            />
          </div>
        )}

        {/* Шаг 3: кастомный вопрос */}
        {ibStep === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              style={styles.ibBackBtn}
              onClick={() => { hapticFeedback('light'); setIbStep('list'); }}
            >
              <ChevronLeft size={18} /> К списку
            </button>
            <div style={styles.ibFieldLabel}>Твой вопрос:</div>
            <input
              style={styles.ibInput}
              placeholder="Например: Любимый трек для пробежки?"
              value={tempIcebreaker.question}
              onChange={e => setTempIcebreaker(prev => ({ ...prev, question: e.target.value }))}
              autoFocus
            />
            <div style={{ ...styles.ibFieldLabel, marginTop: 24 }}>Твой ответ:</div>
            <textarea
              style={styles.textareaLarge}
              placeholder="Начни печатать..."
              value={tempIcebreaker.answer}
              onChange={e => setTempIcebreaker(prev => ({ ...prev, answer: e.target.value }))}
              rows={3}
              maxLength={150}
            />
          </div>
        )}

        {/* Кнопка сохранения (только для шагов answer и custom) */}
        {ibStep !== 'list' && (
          <button
            onClick={saveIcebreaker}
            disabled={saving || !icebreakerCanSave}
            style={{
              ...styles.sheetSaveBtn,
              marginTop: 24,
              background: icebreakerCanSave ? PINK : SURFACE_EL,
              color: icebreakerCanSave ? '#FFF' : MUTED,
            }}
          >
            {saving ? 'Сохраняем...' : 'Установить ледокол'}
          </button>
        )}
      </SwipeableModal>

      {/* ===== TAGS SHEET ===== */}
      <SwipeableModal
        isOpen={activeSheet === 'tags'}
        onClose={closeSheet}
        title="Кого ищешь?"
        showHeaderDivider={false}
      >
        <div style={styles.sheetSectionLabel}>Твои цели (до {MAX_GOALS})</div>
        <div style={{ ...styles.chipsRow, marginBottom: 32 }}>
          {GOAL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              style={tempGoals.includes(opt.value) ? styles.chipActiveLg : styles.chipInactiveLg}
              onClick={() => toggleGoal(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={styles.sheetSectionLabel}>Интересы (до {MAX_INTERESTS})</div>
        <div style={{ ...styles.chipsRow, marginBottom: 24 }}>
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt.value}
              style={tempInterests.includes(opt.value) ? styles.chipActiveLg : styles.chipInactiveLg}
              onClick={() => toggleInterest(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button onClick={saveTags} disabled={saving} style={styles.sheetSaveBtn}>
          {saving ? 'Сохраняем...' : 'Сохранить теги'}
        </button>
      </SwipeableModal>

      {/* ===== SETTINGS SHEET ===== */}
      <SwipeableModal
        isOpen={activeSheet === 'settings'}
        onClose={closeSheet}
        title="Настройки поиска"
        showHeaderDivider={false}
      >
        {/* Кого ищу */}
        <div style={{ marginBottom: 24 }}>
          <div style={styles.sheetSectionLabel}>Кого я ищу</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {LOOKING_FOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                style={{
                  ...styles.chipInactiveLg,
                  flex: 1,
                  justifyContent: 'center',
                  // .chip.dating-active из мока: розовый
              ...(tempSettings.lookingFor === opt.value ? { background: 'rgba(255, 45, 85, 0.1)', border: `1px solid ${PINK}`, color: PINK } : {}),
                }}
                onClick={() => { hapticFeedback('light'); setTempSettings(p => ({ ...p, lookingFor: opt.value })); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Возраст */}
        <div style={{ marginBottom: 32 }}>
          <div style={styles.sheetSectionLabel}>Мой возраст</div>
          <input
            type="number"
            min={MIN_AGE}
            max={MAX_AGE}
            value={tempSettings.age}
            onChange={e => setTempSettings(p => ({ ...p, age: e.target.value }))}
            style={styles.ageInput}
          />
        </div>

        {/* Скрыть анкету */}
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleTitle}>Скрыть анкету</div>
            <div style={styles.toggleDesc}>Тебя не будет видно в ленте,{'\n'}но ты сможешь общаться с мэтчами</div>
          </div>
          {/* Toggle switch через вложенный div */}
          <div
            style={{
              ...styles.toggleTrack,
              background: tempSettings.isHidden ? PINK : SURFACE_EL,
              border: `1px solid ${tempSettings.isHidden ? PINK : theme.colors.border}`,
            }}
            onClick={() => { hapticFeedback('light'); setTempSettings(p => ({ ...p, isHidden: !p.isHidden })); }}
          >
            <div style={{
              ...styles.toggleKnob,
              transform: tempSettings.isHidden ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </div>
        </div>

        <button onClick={saveSettings} disabled={saving} style={{ ...styles.sheetSaveBtn, background: PINK, color: '#FFF', marginTop: 32 }}>
          {saving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
      </SwipeableModal>

      {/* ===== PHOTOS SHEET ===== */}
      <SwipeableModal
        isOpen={activeSheet === 'photos'}
        onClose={closeSheet}
        title="Мои фотографии"
        showHeaderDivider={false}
      >
        <div style={styles.photoGrid}>
          {/* Существующие фото */}
          {tempPhotos.map((photo, idx) => (
            <div key={`ex-${idx}`} style={styles.photoSlot}>
              <img src={getPhotoUrl(photo)} alt="" style={styles.photoSlotImg} />
              {idx === 0 && (
                <div style={styles.mainBadge}>MAIN</div>
              )}
              <button
                style={styles.photoDeleteBtn}
                onClick={() => { hapticFeedback('light'); setTempPhotos(prev => prev.filter((_, i) => i !== idx)); }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Новые превью */}
          {tempNewPreviews.map((preview, idx) => (
            <div key={`new-${idx}`} style={styles.photoSlot}>
              <img src={preview} alt="" style={styles.photoSlotImg} />
              {tempPhotos.length === 0 && idx === 0 && (
                <div style={styles.mainBadge}>MAIN</div>
              )}
              <button
                style={styles.photoDeleteBtn}
                onClick={() => {
                  hapticFeedback('light');
                  setTempNewFiles(prev => prev.filter((_, i) => i !== idx));
                  setTempNewPreviews(prev => prev.filter((_, i) => i !== idx));
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Пустые слоты */}
          {Array.from({ length: Math.max(0, MAX_PHOTOS - tempPhotos.length - tempNewFiles.length) }).map((_, idx) => (
            <label key={`empty-${idx}`} style={styles.photoEmptySlot}>
              <input
                ref={idx === 0 ? fileInputRef : undefined}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
                disabled={saving}
              />
              <Plus size={24} color={MUTED} />
            </label>
          ))}
        </div>

        <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 24 }}>
          В дейтинге достаточно 3-х лучших фотографий.
        </p>

        <button onClick={savePhotos} disabled={saving} style={{ ...styles.sheetSaveBtn, background: PINK, color: '#FFF' }}>
          {saving ? 'Сохраняем...' : 'Сохранить фото'}
        </button>
      </SwipeableModal>
      </>
    </EdgeSwipeBack>
  );
}

// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: Z_MODAL,
    transition: `opacity ${PROFILE_MODAL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  },
  modal: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    zIndex: Z_MODAL + 1,
    backgroundColor: BG,
    display: 'flex',
    flexDirection: 'column',
    transition: `transform ${PROFILE_MODAL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    willChange: 'transform',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 100,
    position: 'relative',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  contentInner: {
    padding: '0 16px',
  },

  // Hero
  heroContainer: {
    width: '100%',
    aspectRatio: '3/4',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    background: '#000',
    cursor: 'pointer',
    marginBottom: 16,
  },
  heroImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  heroEmpty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: SURFACE,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
    pointerEvents: 'none',
  },
  photoBars: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    display: 'flex',
    gap: 4,
    zIndex: 10,
    pointerEvents: 'none',
  },
  photoBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    transition: 'background 0.3s',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 11,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingRight: 12,
  },
  hiddenBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    padding: '6px 10px',
    borderRadius: 10,
    color: MUTED,
    fontSize: 12,
    fontWeight: 700,
    border: `1px solid ${theme.colors.border}`,
    alignSelf: 'flex-start',
  },
  heroName: {
    fontSize: 28,
    fontWeight: 800,
    color: '#FFF',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    lineHeight: 1.1,
  },
  heroUniversity: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: 500,
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  heroButtons: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  heroBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFF',
    cursor: 'pointer',
  },

  // Cards (секции)
  card: {
    background: SURFACE,
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    marginBottom: 16,
    cursor: 'pointer',
    border: `1px solid ${theme.colors.border}`,
  },
  cardEditIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  cardLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    color: PINK,
    fontWeight: 700,
    letterSpacing: '0.5px',
    marginBottom: 12,
  },
  cardText: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.5,
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  // .chip.active из мока: лайм (--primary)
  chipActive: {
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    background: 'rgba(255, 45, 85, 0.1)',
    border: '1px solid rgba(255, 45, 85, 0.32)',
    color: PINK,
    whiteSpace: 'nowrap',
  },
  // .chip.inactive из мока: surfaceElevated + белый
  chipInactive: {
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    background: SURFACE_EL,
    border: '1px solid transparent',
    color: '#FFF',
    whiteSpace: 'nowrap',
  },

  // Sheets общее
  textarea: {
    width: '100%',
    background: SURFACE_EL,
    border: `1px solid ${theme.colors.border}`,
    color: '#FFF',
    fontSize: 16,
    padding: 16,
    borderRadius: 16,
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: 100,
    outline: 'none',
    boxSizing: 'border-box',
  },
  charCounter: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'right',
    marginTop: 6,
  },
  // Дефолтная кнопка сохранения = лайм (Bio, Tags). Розовые переопределяют инлайн
  sheetSaveBtn: {
    width: '100%',
    padding: 16,
    background: PINK,
    borderRadius: 16,
    border: 'none',
    color: '#FFF',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    boxShadow: `0 8px 24px ${d.pinkGlow}`,
  },
  sheetSectionLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 12,
  },
  // В tags sheet: active = лайм, inactive = surfaceElevated
  chipActiveLg: {
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    background: 'rgba(255, 45, 85, 0.1)',
    border: '1px solid rgba(255, 45, 85, 0.32)',
    color: PINK,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  },
  chipInactiveLg: {
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    background: SURFACE_EL,
    border: '1px solid transparent',
    color: '#FFF',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  },

  // Icebreaker
  promptCustomBtn: {
    width: '100%',
    background: 'rgba(255, 45, 85, 0.05)',
    border: `1px dashed rgba(255, 45, 85, 0.5)`,
    padding: 16,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
  },
  promptCategoryLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    paddingLeft: 4,
    marginBottom: 10,
  },
  promptListItem: {
    width: '100%',
    background: SURFACE_EL,
    border: `1px solid ${theme.colors.border}`,
    padding: 16,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#FFF',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
  },
  ibBackBtn: {
    background: 'transparent',
    border: 'none',
    color: MUTED,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 0 16px 0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // textarea-hero dating-accent из мока: розовый цвет текста
  textareaLarge: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: PINK,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.3,
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    padding: 0,
    boxSizing: 'border-box',
  },
  ibFieldLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  ibInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: '#FFF',
    fontSize: 18,
    padding: '12px 0',
    fontFamily: 'inherit',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Settings — toggle
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    padding: 16,
    background: SURFACE_EL,
    borderRadius: 16,
    border: `1px solid ${theme.colors.border}`,
  },
  toggleTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: '#FFF',
  },
  toggleDesc: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
    lineHeight: 1.4,
    whiteSpace: 'pre-line',
  },
  toggleTrack: {
    position: 'relative',
    width: 50,
    height: 30,
    borderRadius: 15,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 24,
    height: 24,
    background: '#FFF',
    borderRadius: '50%',
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  ageInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: '#FFF',
    fontSize: 18,
    padding: '12px 0',
    fontFamily: 'inherit',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Photos
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  photoSlot: {
    aspectRatio: '3/4',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    background: '#000',
  },
  photoSlotImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  mainBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    background: PINK,
    color: '#FFF',
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
  },
  photoDeleteBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    borderRadius: '50%',
    border: 'none',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  photoEmptySlot: {
    aspectRatio: '3/4',
    borderRadius: 12,
    border: `1px dashed ${theme.colors.border}`,
    background: SURFACE_EL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};


export default MyDatingProfileModal;
