// ===== FILE: DatingOnboarding.js =====
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Plus, X, Heart, Loader2, Edit3 } from 'lucide-react';
import { useStore } from '../../store';
import { createDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback, isTelegramSDKAvailable } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import {
  PROMPT_OPTIONS,
  PROMPT_MAX_LENGTH,
  BIO_MIN_LENGTH,
  BIO_MAX_LENGTH,
  MAX_PHOTOS,
  GOAL_OPTIONS,
  MAX_GOALS,
  INTEREST_OPTIONS,
  MAX_INTERESTS,
} from '../../constants/datingConstants';

// ===== Цветовые константы =====
const DATING = '#FF2D55';
const BG = '#000000';
const SURFACE_ELEVATED = '#2C2C2E';
const BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT_MUTED = '#8E8E93';
const CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const TOTAL_STEPS = 4;
const AGES = Array.from({ length: 25 }, (_, i) => i + 16); // 16-40
const AGE_ITEM_WIDTH = 60;
const SAFE_LEFT = 'max(env(safe-area-inset-left, 0px), var(--tg-safe-area-left, 0px), var(--tg-content-safe-area-left, 0px))';
const SAFE_RIGHT = 'max(env(safe-area-inset-right, 0px), var(--tg-safe-area-right, 0px), var(--tg-content-safe-area-right, 0px))';

// Отображение без эмодзи (как в моке)
const GENDER_DISPLAY = [
  { value: 'male', label: 'Парень' },
  { value: 'female', label: 'Девушка' },
];
const LOOKING_FOR_DISPLAY = [
  { value: 'female', label: 'Девушек' },
  { value: 'male', label: 'Парней' },
  { value: 'all', label: 'Всех' },
];

function DatingOnboarding({ onClose }) {
  const { setDatingProfile } = useStore();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempCustomPrompt, setTempCustomPrompt] = useState('');
  const [tempCustomAnswer, setTempCustomAnswer] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const [data, setData] = useState({
    gender: '',
    lookingFor: '',
    age: 20,
    photos: [null, null, null],
    previews: [null, null, null],
    bio: '',
    goals: [],
    interests: [],
    prompt: '',
    answer: '',
  });

  const wheelRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoSlotRef = useRef(null);
  const ageSelectionRef = useRef(data.age);
  const ageScrollRafRef = useRef(null);
  const ageSnapTimeoutRef = useRef(null);
  const isTelegram = isTelegramSDKAvailable();
  const isDesktop = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: fine)').matches;
  const shouldRenderLocalBack = import.meta.env.DEV && isDesktop && !isTelegram && step > 0;

  // Очистка превью при unmount
  useEffect(() => {
    return () => {
      const urls = data.previews.filter(Boolean);
      if (urls.length > 0) revokeObjectURLs(urls);
      if (ageScrollRafRef.current) cancelAnimationFrame(ageScrollRafRef.current);
      if (ageSnapTimeoutRef.current) clearTimeout(ageSnapTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ageSelectionRef.current = data.age;
  }, [data.age]);

  // ===== Валидация =====
  const canGoNext = useCallback(() => {
    if (step === 0) return data.gender && data.lookingFor && data.age;
    if (step === 1) return data.photos.some(p => p !== null);
    if (step === 2) return data.bio.trim().length >= BIO_MIN_LENGTH && data.goals.length > 0;
    if (step === 3) {
      if (!data.prompt) return true;
      return data.prompt.trim().length > 0 && data.answer.trim().length > 0;
    }
    return false;
  }, [step, data]);

  const getSegmentWidth = (i) => {
    if (step > i) return '100%';
    if (step === i) {
      if (i === 3 && !data.prompt) return '40%';
      return canGoNext() ? '100%' : '40%';
    }
    return '0%';
  };

  // ===== Навигация =====
  const handleNext = () => {
    if (!canGoNext()) {
      hapticFeedback('error');
      return;
    }
    hapticFeedback('medium');
    if (step < TOTAL_STEPS - 1) {
      setStep(prev => prev + 1);
    } else {
      submitProfile();
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    if (step > 0) setStep(prev => prev - 1);
  };

  useTelegramScreen({
    id: 'dating-onboarding',
    priority: 3200,
    back: {
      visible: step > 0 && isTelegram,
      onClick: handleBack,
    },
  });

  // ===== Свайп-жесты =====
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;

    if (Math.abs(distanceX) > Math.abs(distanceY) * 1.5) {
      if (distanceX > 50 && canGoNext()) handleNext();
      if (distanceX < -50 && step > 0) handleBack();
    }
  };

  // ===== Возрастной пикер =====
  const scrollToAge = useCallback((age, behavior = 'smooth') => {
    const container = wheelRef.current;
    if (!container) return;
    const index = AGES.indexOf(age);
    if (index === -1) return;
    container.scrollTo({ left: index * AGE_ITEM_WIDTH, behavior });
  }, []);

  // Авто-скролл возрастного пикера при переходе на шаг 0
  useEffect(() => {
    if (step !== 0) return undefined;
    const rafId = requestAnimationFrame(() => {
      scrollToAge(ageSelectionRef.current, 'smooth');
    });
    return () => cancelAnimationFrame(rafId);
  }, [step, scrollToAge]);

  const syncAgeFromScroll = useCallback(() => {
    const container = wheelRef.current;
    if (!container) return;
    const index = Math.round(container.scrollLeft / AGE_ITEM_WIDTH);
    const newAge = AGES[Math.min(Math.max(index, 0), AGES.length - 1)];

    if (ageSelectionRef.current !== newAge) {
      ageSelectionRef.current = newAge;
      setData(prev => (prev.age === newAge ? prev : { ...prev, age: newAge }));
      hapticFeedback('selection');
    }
  }, []);

  useEffect(() => {
    const container = wheelRef.current;
    if (step !== 0 || !container) return undefined;

    const handleScroll = () => {
      if (ageScrollRafRef.current) return;
      ageScrollRafRef.current = requestAnimationFrame(() => {
        ageScrollRafRef.current = null;
        syncAgeFromScroll();
      });

      if (ageSnapTimeoutRef.current) clearTimeout(ageSnapTimeoutRef.current);
      ageSnapTimeoutRef.current = setTimeout(() => {
        scrollToAge(ageSelectionRef.current, 'smooth');
      }, 90);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (ageScrollRafRef.current) {
        cancelAnimationFrame(ageScrollRafRef.current);
        ageScrollRafRef.current = null;
      }
      if (ageSnapTimeoutRef.current) {
        clearTimeout(ageSnapTimeoutRef.current);
        ageSnapTimeoutRef.current = null;
      }
    };
  }, [step, scrollToAge, syncAgeFromScroll]);

  const handleAgeSelect = (age) => {
    if (data.age !== age) {
      hapticFeedback('selection');
      setData(prev => ({ ...prev, age }));
    } else {
      hapticFeedback('light');
    }
    ageSelectionRef.current = age;
    scrollToAge(age, 'smooth');
  };

  // ===== Фото =====
  const handlePhotoSlotClick = (index) => {
    if (data.photos[index]) return;
    hapticFeedback('light');
    photoSlotRef.current = index;
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e) => {
    if (!e.target.files?.length) return;
    hapticFeedback('light');

    const slotIndex = photoSlotRef.current;
    if (slotIndex == null) return;

    try {
      const processed = await processImageFiles([e.target.files[0]]);
      if (processed.length > 0) {
        const { file, preview } = processed[0];
        setData(prev => {
          const newPhotos = [...prev.photos];
          const newPreviews = [...prev.previews];
          // Освобождаем предыдущий URL если был
          if (newPreviews[slotIndex]) {
            revokeObjectURLs([newPreviews[slotIndex]]);
          }
          newPhotos[slotIndex] = file;
          newPreviews[slotIndex] = preview;
          return { ...prev, photos: newPhotos, previews: newPreviews };
        });
        hapticFeedback('success');
      }
    } catch (error) {
      toast.error(error?.message || 'Не удалось обработать фото');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index) => {
    hapticFeedback('light');
    setData(prev => {
      const newPhotos = [...prev.photos];
      const newPreviews = [...prev.previews];
      if (newPreviews[index]) {
        revokeObjectURLs([newPreviews[index]]);
      }
      newPhotos[index] = null;
      newPreviews[index] = null;
      return { ...prev, photos: newPhotos, previews: newPreviews };
    });
  };

  // ===== Тоглы =====
  const toggleItem = (field, item, max) => {
    const currentList = data[field];
    const alreadySelected = currentList.includes(item);
    if (!alreadySelected && currentList.length >= max) {
      hapticFeedback('warning');
      return;
    }

    hapticFeedback(alreadySelected ? 'light' : 'selection');
    setData(prev => {
      const list = prev[field];
      if (list.includes(item)) return { ...prev, [field]: list.filter(i => i !== item) };
      return { ...prev, [field]: [...list, item] };
    });
  };

  // ===== Кастомный ледокол =====
  const isCurrentPromptCustom = data.prompt && !PROMPT_OPTIONS.some(p => p.question === data.prompt);

  const saveCustomPrompt = () => {
    if (!tempCustomPrompt.trim() || !tempCustomAnswer.trim()) {
      hapticFeedback('error');
      return;
    }
    hapticFeedback('success');
    setData(prev => ({ ...prev, prompt: tempCustomPrompt.trim(), answer: tempCustomAnswer.trim() }));
    setShowCustomModal(false);
  };

  // ===== Сабмит =====
  const submitProfile = async () => {
    const actualPhotos = data.photos.filter(p => p !== null);
    if (actualPhotos.length === 0) {
      toast.error('Загрузите хотя бы 1 фото');
      return;
    }

    if (data.bio.trim().length < BIO_MIN_LENGTH) {
      toast.error(`Биография должна быть минимум ${BIO_MIN_LENGTH} символов`);
      return;
    }

    if (data.bio.trim().length > BIO_MAX_LENGTH) {
      toast.error(`Биография не должна превышать ${BIO_MAX_LENGTH} символов`);
      return;
    }

    if (data.prompt && data.answer.trim().length > 0) {
      if (data.answer.trim().length < 10) {
        toast.error('Ответ должен быть минимум 10 символов');
        return;
      }
      if (data.answer.trim().length > PROMPT_MAX_LENGTH) {
        toast.error(`Ответ не должен превышать ${PROMPT_MAX_LENGTH} символов`);
        return;
      }
    }

    setIsSubmitting(true);
    hapticFeedback('success');

    try {
      const profileData = {
        gender: data.gender,
        age: data.age,
        looking_for: data.lookingFor,
        bio: data.bio.trim(),
        goals: data.goals,
        interests: data.interests,
        photos: actualPhotos,
        prompt_question: data.prompt || undefined,
        prompt_answer: data.answer.trim() || undefined,
      };

      const newProfile = await createDatingProfile(profileData);
      setDatingProfile(newProfile);
      toast.success('Профиль создан!');

      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
    } catch (error) {
      console.error('Dating profile creation error:', error);
      toast.error(error.response?.data?.detail || 'Ошибка создания профиля. Попробуй ещё раз');
      setIsSubmitting(false);
    }
  };

  // ===== Текст кнопки =====
  const getFinalButtonText = () => {
    if (isSubmitting) return <Loader2 size={24} className="do-animate-spin" />;
    if (step < TOTAL_STEPS - 1) return 'Далее';
    if (!data.prompt) return 'Пропустить и создать';
    return 'Создать профиль';
  };

  return (
    <>
      <style>{`
        @keyframes do-slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes do-fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes do-spin {
          100% { transform: rotate(360deg); }
        }

        .do-spring-btn { transition: transform 0.15s ${CURVE}, opacity 0.15s ${CURVE}; cursor: pointer; }
        .do-spring-btn:active { transform: scale(0.96); opacity: 0.8; }
        .do-spring-btn:disabled { transform: none; opacity: 0.5; cursor: not-allowed; }

        .do-modal-slide-up { animation: do-slideUp 0.4s ${CURVE} forwards; }
        .do-animate-spin { animation: do-spin 1s linear infinite; }
        .do-fade-in { animation: do-fadeIn 0.3s ease; }

        .do-hide-scroll::-webkit-scrollbar { display: none; }
        .do-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        .do-textarea:focus { border-color: ${DATING} !important; }
        .do-input-line:focus { border-bottom-color: ${DATING} !important; }
        .do-input-line::placeholder, .do-textarea::placeholder { color: ${TEXT_MUTED}; }
      `}</style>

      <div style={styles.overlay}>
        {/* ===== HEADER: Прогрессбар + Назад ===== */}
        <div style={styles.header}>
          <div style={styles.progressContainer}>
            {[...Array(TOTAL_STEPS)].map((_, i) => (
              <div key={i} style={styles.progressSegment}>
                <div style={{ ...styles.progressFill, width: getSegmentWidth(i) }} />
              </div>
            ))}
          </div>
          <div style={styles.backRow}>
            <button
              className="do-spring-btn"
              onClick={handleBack}
              style={{
                ...styles.backBtn,
                opacity: shouldRenderLocalBack ? 1 : 0,
                pointerEvents: shouldRenderLocalBack ? 'auto' : 'none',
              }}
            >
              <ChevronLeft size={28} />
            </button>
          </div>
        </div>

        {/* ===== СВАЙП-КОНТЕЙНЕР ===== */}
        <div
          style={{ ...styles.swipeContainer, transform: `translateX(-${step * 25}%)` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndEvent}
        >
          {/* --- ШАГ 0: Основы --- */}
          <div className="do-hide-scroll" style={{ ...styles.stepContainer, opacity: step === 0 ? 1 : 0.5 }}>
            <h1 style={styles.stepTitle}>Основы</h1>
            <p style={styles.stepSubtitle}>Эти данные нельзя будет изменить позже.</p>

            {/* Пол */}
            <div style={styles.fieldGroup}>
              <div style={styles.fieldLabel}>Я...</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {GENDER_DISPLAY.map(g => (
                  <button
                    key={g.value}
                    className="do-spring-btn"
                    onClick={() => { hapticFeedback('light'); setData(prev => ({ ...prev, gender: g.value })); }}
                    style={{
                      ...styles.chip,
                      ...styles.chipLarge,
                      ...(data.gender === g.value ? styles.chipActive : {}),
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Кого ищу */}
            <div style={{ ...styles.fieldGroup, marginBottom: 32 }}>
              <div style={styles.fieldLabel}>Хочу найти...</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {LOOKING_FOR_DISPLAY.map(g => (
                  <button
                    key={g.value}
                    className="do-spring-btn"
                    onClick={() => { hapticFeedback('light'); setData(prev => ({ ...prev, lookingFor: g.value })); }}
                    style={{
                      ...styles.chip,
                      ...styles.chipLarge,
                      ...(data.lookingFor === g.value ? styles.chipActive : {}),
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Возраст */}
            <div style={styles.fieldGroup}>
              <div style={{ ...styles.fieldLabel, textAlign: 'center' }}>Мне лет</div>
              <div style={styles.agePickerOuter}>
                {/* Рамка по центру */}
                <div style={styles.ageCenterBox} />
                <div
                  ref={wheelRef}
                  className="do-hide-scroll"
                  onTouchStart={e => e.stopPropagation()}
                  onTouchMove={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}
                  style={styles.ageScroller}
                >
                  {AGES.map(a => (
                    <div
                      key={a}
                      onClick={() => handleAgeSelect(a)}
                      style={{
                        ...styles.ageItem,
                        fontSize: data.age === a ? 32 : 22,
                        fontWeight: data.age === a ? 800 : 600,
                        color: data.age === a ? '#FFF' : TEXT_MUTED,
                      }}
                    >
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* --- ШАГ 1: Фото --- */}
          <div className="do-hide-scroll" style={{ ...styles.stepContainer, opacity: step === 1 ? 1 : 0.5 }}>
            <h1 style={styles.stepTitle}>Твои фото</h1>
            <p style={styles.stepSubtitle}>
              Добавь хотя бы одно фото, где хорошо видно твое лицо. Максимум {MAX_PHOTOS} фото.
            </p>

            <div style={styles.photosGrid}>
              {data.photos.map((p, i) => (
                <div
                  key={i}
                  className="do-spring-btn"
                  onClick={() => !p && handlePhotoSlotClick(i)}
                  style={{
                    ...styles.photoSlot,
                    border: p ? 'none' : `2px dashed ${BORDER}`,
                  }}
                >
                  {p ? (
                    <>
                      <img src={data.previews[i]} alt="" style={styles.photoImg} />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        style={styles.photoRemoveBtn}
                      >
                        <X size={14} />
                      </button>
                      {i === 0 && <div style={styles.photoMainBadge}>MAIN</div>}
                    </>
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      <Plus size={24} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* --- ШАГ 2: Вайб --- */}
          <div className="do-hide-scroll" style={{ ...styles.stepContainer, opacity: step === 2 ? 1 : 0.5 }}>
            <h1 style={styles.stepTitle}>Твой вайб</h1>
            <p style={styles.stepSubtitle}>Расскажи немного о себе и выбери, что ты здесь ищешь.</p>

            {/* Био */}
            <div style={styles.fieldGroup}>
              <div style={styles.fieldLabel}>Обо мне (минимум {BIO_MIN_LENGTH} символов)</div>
              <textarea
                className="do-textarea"
                placeholder="Люблю кофе, техно и хакатоны..."
                value={data.bio}
                onChange={e => setData(prev => ({ ...prev, bio: e.target.value }))}
                onTouchMove={e => e.stopPropagation()}
                style={styles.textarea}
                maxLength={BIO_MAX_LENGTH}
              />
            </div>

            {/* Цели */}
            <div style={styles.fieldGroup}>
              <div style={styles.fieldLabel}>Мои цели (до {MAX_GOALS})</div>
              <div style={styles.chipsWrap}>
                {GOAL_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    className="do-spring-btn"
                    onClick={() => toggleItem('goals', value, MAX_GOALS)}
                    style={{
                      ...styles.chip,
                      ...(data.goals.includes(value) ? styles.chipActive : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Интересы */}
            <div style={styles.fieldGroup}>
              <div style={styles.fieldLabel}>Мои интересы (до {MAX_INTERESTS})</div>
              <div style={styles.chipsWrap}>
                {INTEREST_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    className="do-spring-btn"
                    onClick={() => toggleItem('interests', value, MAX_INTERESTS)}
                    style={{
                      ...styles.chip,
                      ...(data.interests.includes(value) ? styles.chipActive : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* --- ШАГ 3: Ледокол --- */}
          <div className="do-hide-scroll" style={{ ...styles.stepContainer, opacity: step === 3 ? 1 : 0.5 }}>
            <h1 style={styles.stepTitle}>
              Начни диалог{' '}
              <span style={{ fontSize: 16, color: TEXT_MUTED, fontWeight: 600 }}>(необязательно)</span>
            </h1>
            <p style={styles.stepSubtitle}>
              Выбери вопрос-ледокол или напиши свой. Он поможет другим начать с тобой общение.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {/* Кнопка "Свой ледокол" */}
              <button
                className="do-spring-btn"
                onClick={() => {
                  hapticFeedback('selection');
                  setShowCustomModal(true);
                  setTempCustomPrompt(isCurrentPromptCustom ? data.prompt : '');
                  setTempCustomAnswer(isCurrentPromptCustom ? data.answer : '');
                }}
                style={styles.customPromptBtn}
              >
                <Edit3 size={18} color={DATING} /> Написать свой ледокол...
              </button>

              {/* Кастомный промпт (если есть) */}
              {isCurrentPromptCustom && (
                <button
                  className="do-spring-btn"
                  style={styles.selectedPromptBtn}
                >
                  <Heart size={18} fill="currentColor" color={DATING} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{data.prompt}</span>
                </button>
              )}

              {/* Дефолтные ледоколы */}
              {PROMPT_OPTIONS.map((p) => {
                const isActive = data.prompt === p.question;
                return (
                  <button
                    key={p.id}
                    className="do-spring-btn"
                    onClick={() => {
                      hapticFeedback('selection');
                      setData(prev => ({
                        ...prev,
                        prompt: p.question,
                        answer: isActive ? prev.answer : '',
                      }));
                    }}
                    style={{
                      ...styles.promptBtn,
                      background: isActive ? 'rgba(255, 45, 85, 0.1)' : SURFACE_ELEVATED,
                      border: isActive ? `1px solid ${DATING}` : `1px solid ${BORDER}`,
                      color: isActive ? DATING : '#FFF',
                    }}
                  >
                    <Heart
                      size={18}
                      fill={isActive ? 'currentColor' : 'none'}
                      color={isActive ? DATING : TEXT_MUTED}
                      style={{ flexShrink: 0, transition: 'all 0.2s' }}
                    />
                    <span style={{ flex: 1 }}>{p.question}</span>
                  </button>
                );
              })}
            </div>

            {/* Ответ на ледокол */}
            {data.prompt && (
              <div className="do-fade-in" style={styles.answerBox}>
                <div style={styles.answerLabel}>Твой ответ:</div>
                <textarea
                  style={styles.answerTextarea}
                  placeholder="Начни печатать..."
                  value={data.answer}
                  onChange={e => setData(prev => ({ ...prev, answer: e.target.value }))}
                  onTouchMove={e => e.stopPropagation()}
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        {/* ===== STICKY КНОПКА ===== */}
        <div style={styles.stickyContainer}>
          <button
            className="do-spring-btn"
            disabled={!canGoNext() || isSubmitting}
            onClick={handleNext}
            style={{
              ...styles.stickyButton,
              background: (!data.prompt && step === 3) ? SURFACE_ELEVATED : DATING,
              boxShadow: (!data.prompt && step === 3) ? 'none' : '0 4px 16px rgba(255, 45, 85, 0.3)',
            }}
          >
            {getFinalButtonText()}
          </button>
        </div>

        {/* ===== МОДАЛКА КАСТОМНОГО ЛЕДОКОЛА ===== */}
        {showCustomModal && (
          <div className="do-modal-slide-up" style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Свой ледокол</h2>
              <button
                className="do-spring-btn"
                onClick={() => {
                  hapticFeedback('light');
                  setShowCustomModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div>
                <div style={styles.fieldLabel}>Придумай вопрос:</div>
                <input
                  className="do-input-line"
                  style={styles.inputLine}
                  placeholder="О чем спросить?"
                  value={tempCustomPrompt}
                  onChange={e => setTempCustomPrompt(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <div style={{ ...styles.fieldLabel, marginTop: 24 }}>И сразу ответь на него:</div>
                <textarea
                  className="do-textarea"
                  style={{ ...styles.textarea, fontSize: 18, borderColor: DATING }}
                  placeholder="Твой креативный ответ..."
                  value={tempCustomAnswer}
                  onChange={e => setTempCustomAnswer(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <button
              className="do-spring-btn"
              disabled={!tempCustomPrompt.trim() || !tempCustomAnswer.trim()}
              onClick={saveCustomPrompt}
              style={{
                ...styles.stickyButton,
                background: (tempCustomPrompt.trim() && tempCustomAnswer.trim()) ? DATING : SURFACE_ELEVATED,
                color: (tempCustomPrompt.trim() && tempCustomAnswer.trim()) ? '#FFF' : TEXT_MUTED,
                marginBottom: 'var(--screen-bottom-offset, 0px)',
              }}
            >
              Сохранить и выбрать
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ===== Стили =====
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: BG,
    zIndex: 10000,
    color: '#FFF',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    WebkitFontSmoothing: 'antialiased',
    overflow: 'hidden',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  progressContainer: {
    position: 'absolute',
    top: 'calc(var(--screen-top-offset, 0px) + 10px)',
    left: `calc(16px + ${SAFE_LEFT})`,
    right: `calc(16px + ${SAFE_RIGHT})`,
    height: 4,
    display: 'flex',
    gap: 4,
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: DATING,
    borderRadius: 2,
    transition: `width 0.4s ${CURVE}`,
  },
  backRow: {
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 18px)',
    paddingLeft: `calc(16px + ${SAFE_LEFT})`,
    paddingRight: `calc(16px + ${SAFE_RIGHT})`,
    paddingBottom: 0,
    display: 'flex',
    alignItems: 'center',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#FFF',
    padding: 0,
    transition: `opacity 0.2s`,
  },

  // Свайп-контейнер
  swipeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    width: '400%',
    height: '100%',
    transition: `transform 0.4s ${CURVE}`,
  },
  stepContainer: {
    width: '25%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 74px)',
    paddingBottom: 'calc(var(--screen-bottom-offset, 0px) + 100px)',
    paddingLeft: `calc(20px + ${SAFE_LEFT})`,
    paddingRight: `calc(20px + ${SAFE_RIGHT})`,
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: `opacity 0.4s ${CURVE}`,
    boxSizing: 'border-box',
  },

  // Типография
  stepTitle: {
    margin: '0 0 8px',
    fontSize: 28,
    fontWeight: 800,
  },
  stepSubtitle: {
    margin: '0 0 32px',
    color: TEXT_MUTED,
    fontSize: 15,
  },

  // Поля
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Чипы
  chip: {
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: SURFACE_ELEVATED,
    border: '1px solid transparent',
    color: '#FFF',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  chipActive: {
    background: 'rgba(255, 45, 85, 0.1)',
    border: `1px solid ${DATING}`,
    color: DATING,
  },
  chipLarge: {
    flex: 1,
    padding: '14px 20px',
    borderRadius: 24,
    fontSize: 15,
  },
  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Возрастной пикер
  agePickerOuter: {
    position: 'relative',
    width: '100%',
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageCenterBox: {
    position: 'absolute',
    width: 60,
    height: 60,
    border: `2px solid ${DATING}`,
    borderRadius: 16,
    zIndex: 0,
    pointerEvents: 'none',
  },
  ageScroller: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollSnapStop: 'always',
    scrollBehavior: 'smooth',
    overscrollBehaviorX: 'contain',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x',
    padding: '0 calc(50% - 30px)',
    zIndex: 1,
    alignItems: 'center',
  },
  ageItem: {
    scrollSnapAlign: 'center',
    flexShrink: 0,
    width: 60,
    textAlign: 'center',
    transition: 'all 0.2s',
    cursor: 'pointer',
    userSelect: 'none',
  },

  // Фото
  photosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  photoSlot: {
    aspectRatio: '3/4',
    background: SURFACE_ELEVATED,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoRemoveBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    borderRadius: '50%',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    color: '#FFF',
    cursor: 'pointer',
  },
  photoMainBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    background: DATING,
    color: '#FFF',
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
  },
  photoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    color: DATING,
  },

  // Textarea
  textarea: {
    width: '100%',
    background: SURFACE_ELEVATED,
    border: `1px solid ${BORDER}`,
    color: '#FFF',
    fontSize: 16,
    padding: 16,
    borderRadius: 16,
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: 120,
    transition: 'border-color 0.3s',
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Промпты (ледоколы)
  customPromptBtn: {
    padding: 16,
    borderRadius: 16,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: SURFACE_ELEVATED,
    border: `1px dashed rgba(255, 45, 85, 0.5)`,
    color: DATING,
  },
  selectedPromptBtn: {
    padding: 16,
    borderRadius: 16,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255, 45, 85, 0.1)',
    border: `1px solid ${DATING}`,
    color: DATING,
  },
  promptBtn: {
    padding: 16,
    borderRadius: 16,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  answerBox: {
    background: SURFACE_ELEVATED,
    padding: 20,
    borderRadius: 16,
    border: `1px solid ${DATING}`,
    marginBottom: 24,
  },
  answerLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  answerTextarea: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: DATING,
    fontSize: 20,
    fontWeight: 700,
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },

  // Sticky кнопка
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingLeft: `calc(16px + ${SAFE_LEFT})`,
    paddingRight: `calc(16px + ${SAFE_RIGHT})`,
    paddingBottom: 'calc(var(--screen-bottom-offset, 0px) + 16px)',
    background: `linear-gradient(to top, ${BG} 80%, transparent)`,
    zIndex: 30,
  },
  stickyButton: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    border: 'none',
    fontWeight: 800,
    fontSize: 17,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#FFF',
    transition: 'all 0.3s',
  },

  // Модалка
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: BG,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 24px)',
    paddingLeft: `calc(20px + ${SAFE_LEFT})`,
    paddingRight: `calc(20px + ${SAFE_RIGHT})`,
    paddingBottom: 20,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  modalCloseBtn: {
    background: SURFACE_ELEVATED,
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFF',
  },
  modalBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  // Input line (для модалки)
  inputLine: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${BORDER}`,
    color: '#FFF',
    fontSize: 18,
    padding: '12px 0',
    fontFamily: 'inherit',
    fontWeight: 700,
    transition: `border-color 0.3s ${CURVE}`,
    outline: 'none',
    boxSizing: 'border-box',
  },
};

export default DatingOnboarding;
