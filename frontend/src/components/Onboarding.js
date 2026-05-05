// ===== FILE: Onboarding.js =====

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, User, AtSign, ChevronLeft, X, Check, Zap, Plus, Info } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback, getTelegramUser } from '../utils/telegram';
import { updateUserProfile, uploadUserAvatar } from '../api';
import { compressImage } from '../utils/media';
import { toast } from './shared/Toast';
import { Z_ONBOARDING_MAIN } from '../constants/zIndex';
import { useTelegramScreen } from './shared/telegram/useTelegramScreen';
import CampusLogoAvatar from './shared/CampusLogoAvatar';
import FacultyGraphPicker from './shared/FacultyGraphPicker';
import {
  CAMPUSES, searchCampuses,
  getFacultiesForCampus,
  ONBOARDING_LIMITS,
} from '../constants/universityData';

// --- Неоновые частицы (дофаминовая анимация при завершении) ---
function triggerNeonSparks(rect) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  hapticFeedback('success');

  for (let i = 0; i < 40; i++) {
    const spark = document.createElement('div');
    const isLine = Math.random() > 0.5;
    spark.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:99999;
      border-radius:${isLine ? '2px' : '50%'};
      width:${isLine ? (8 + Math.random() * 16) : (4 + Math.random() * 5)}px;
      height:${isLine ? '2px' : spark.style?.width || '5px'};
      background-color:${Math.random() > 0.3 ? '#D4FF00' : '#FFF'};
    `;
    document.body.appendChild(spark);

    const angle = Math.random() * Math.PI * 2;
    const velocity = 80 + Math.random() * 140;
    const rot = Math.random() * 360;
    const anim = spark.animate([
      { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(1)`, opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * velocity}px), calc(-50% + ${Math.sin(angle) * velocity}px)) rotate(${rot + 90}deg) scale(0)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 500, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'forwards' });
    anim.onfinish = () => spark.remove();
  }
}

// =============================================
// Главный компонент
// =============================================

function Onboarding() {
  const {
    onboardingStep,
    onboardingData,
    setOnboardingStep,
    setOnboardingData,
    finishRegistration,
    setUser,
  } = useStore();

  const [educationDraft, setEducationDraft] = useState({});
  // Хранит сжатый файл аватара для загрузки ПОСЛЕ регистрации
  const pendingAvatarFileRef = useRef(null);
  const pendingTelegramAvatarUrlRef = useRef(null);
  const educationBackHandlerRef = useRef(null);
  const [educationNestedActive, setEducationNestedActive] = useState(false);

  const goToStep = useCallback((step) => {
    if (step === 1) setEducationNestedActive(false);
    setOnboardingStep(step);
  }, [setOnboardingStep]);

  const handleNativeBack = useCallback(() => {
    if (onboardingStep !== 2) return;
    if (educationNestedActive && educationBackHandlerRef.current) {
      educationBackHandlerRef.current();
      return;
    }
    goToStep(1);
  }, [educationNestedActive, goToStep, onboardingStep]);

  // Нативная кнопка "Назад" в TMA — управляется через useTelegramScreen
  useTelegramScreen({
    id: 'onboarding-flow',
    priority: 3000,
    back: {
      visible: onboardingStep > 1,
      onClick: handleNativeBack,
    },
  });

  // После успешной регистрации — загружаем аватар (пользователь уже создан)
  const handleFinishRegistration = useCallback(async (data) => {
    await finishRegistration(data);
    const pending = pendingAvatarFileRef.current;
    const telegramAvatarUrl = pendingTelegramAvatarUrlRef.current;
    pendingAvatarFileRef.current = null;
    pendingTelegramAvatarUrlRef.current = null;

    if (!useStore.getState().user?.id) return;

    let avatarSynced = false;
    if (pending) {
      try {
        const result = await uploadUserAvatar(pending);
        if (result?.avatar) {
          setUser({ ...useStore.getState().user, avatar: result.avatar });
          avatarSynced = true;
        }
      } catch {
        // Аватар можно добавить позже в профиле — не критично
      }
    }

    // Telegram CDN sometimes blocks browser file fetch by CORS. Keep the visible
    // Telegram photo as an external URL fallback instead of losing the avatar.
    if (!avatarSynced && telegramAvatarUrl) {
      try {
        const updatedUser = await updateUserProfile({ avatar: telegramAvatarUrl });
        setUser(updatedUser || { ...useStore.getState().user, avatar: telegramAvatarUrl });
      } catch {
        // Аватар можно добавить позже в профиле — не критично
      }
    }
  }, [finishRegistration, setUser]);

  return (
    <>
      <style>{onboardingStyles}</style>
      <div style={styles.overlay}>
        {/* Контейнер 200% ширины — оба шага рядом, переход через translateX */}
        <div
          style={{
            ...styles.stepsTrack,
            transform: onboardingStep === 1 ? 'translateX(0)' : 'translateX(-50%)',
          }}
        >
          <div style={styles.stepSlot}>
            <StepAboutYou
              onboardingData={onboardingData}
              setOnboardingData={setOnboardingData}
              onSetPendingFile={(file) => { pendingAvatarFileRef.current = file; }}
              onSetTelegramAvatarUrl={(url) => { pendingTelegramAvatarUrlRef.current = url; }}
              onNext={() => goToStep(2)}
            />
          </div>

          <div style={styles.stepSlot}>
            <StepEducation
              onboardingData={onboardingData}
              educationDraft={educationDraft}
              setEducationDraft={setEducationDraft}
              onNestedStateChange={setEducationNestedActive}
              onRegisterNestedBack={(handler) => { educationBackHandlerRef.current = handler; }}
              onBack={() => goToStep(1)}
              onFinish={handleFinishRegistration}
            />
          </div>
        </div>
      </div>
    </>
  );
}


// =============================================
// Шаг 1: фото + имя + ник в Campus
// =============================================

function StepAboutYou({ onboardingData, setOnboardingData, onSetPendingFile, onSetTelegramAvatarUrl, onNext }) {
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const telegramPhotoUrl = telegramUser?.photoUrl || null;
  const persistedAvatar = onboardingData.avatar || null;

  const [name, setName] = useState(onboardingData.name || telegramUser?.firstName || '');
  const [username, setUsername] = useState(onboardingData.username || '');
  const [avatarPreview, setAvatarPreview] = useState(persistedAvatar || telegramPhotoUrl);
  const [avatarSource, setAvatarSource] = useState(
    persistedAvatar ? 'uploaded' : (telegramPhotoUrl ? 'telegram' : 'empty')
  );
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const isValid = name.trim().length >= ONBOARDING_LIMITS.NAME_MIN;
  const isTelegramAvatar = avatarSource === 'telegram' && Boolean(avatarPreview);

  const fallbackAvatarPreview = useCallback(() => {
    if (persistedAvatar) { setAvatarPreview(persistedAvatar); setAvatarSource('uploaded'); return; }
    if (telegramPhotoUrl) { setAvatarPreview(telegramPhotoUrl); setAvatarSource('telegram'); return; }
    setAvatarPreview(null); setAvatarSource('empty');
  }, [persistedAvatar, telegramPhotoUrl]);

  const handleAvatarError = () => {
    if (avatarSource === 'telegram') {
      if (persistedAvatar) { setAvatarPreview(persistedAvatar); setAvatarSource('uploaded'); }
      else { setAvatarPreview(null); setAvatarSource('empty'); }
      return;
    }
    setAvatarPreview(null); setAvatarSource('empty');
  };

  const openFilePicker = () => {
    hapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Сбросить значение input чтобы можно было выбрать тот же файл повторно
    e.target.value = '';

    setProcessing(true);
    try {
      // Валидация + сжатие через существующую утилиту
      const compressed = await compressImage(file);

      // Показываем локальный превью сразу
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setAvatarSource('uploaded');
      };
      reader.readAsDataURL(compressed);

      // Сохраняем для загрузки после регистрации
      onSetPendingFile(compressed);
      onSetTelegramAvatarUrl(null);
      // Сбрасываем сохранённый server URL аватара, т.к. будет новый
      setOnboardingData({ avatar: null });
    } catch (err) {
      toast.error(err.message || 'Не удалось обработать фото');
      fallbackAvatarPreview();
    } finally {
      setProcessing(false);
    }
  };

  const handleNext = async () => {
    if (!isValid) { toast.error('Введите имя (минимум 2 символа)'); return; }
    hapticFeedback('medium');
    const cleanUsername = username.replace(/^@/, '').trim();
    setOnboardingData({ name: name.trim(), username: cleanUsername || null });

    // Если аватар из Telegram — скачиваем и сохраняем как файл для загрузки после регистрации
    if (avatarSource === 'telegram' && avatarPreview) {
      onSetTelegramAvatarUrl(avatarPreview);
      try {
        const response = await fetch(avatarPreview);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' });
          const compressed = await compressImage(file);
          onSetPendingFile(compressed);
        }
      } catch {
        // Не критично — аватар можно добавить позже
      }
    } else if (avatarSource !== 'uploaded') {
      onSetTelegramAvatarUrl(null);
    }

    onNext();
  };

  return (
    <div style={styles.stepPage}>
      {/* Шапка — без индикатора шага (перенесён рядом с заголовком) */}
      <div style={styles.stepHeader} />

      <div style={{ ...styles.stepScrollable, overflowY: 'hidden' }}>
        <div style={styles.stepCenterContent}>

          <div style={styles.titleRow}>
            <h2 style={{ ...styles.bigTitle, ...styles.bigTitleInRow }}>Как тебя зовут?</h2>
            <span style={{ ...styles.stepIndicator, ...styles.titleStepIndicator }}>ШАГ 1 ИЗ 2</span>
          </div>

          {/* Аватар — весь блок кликабельный, включая плюс-бейдж */}
          <div style={styles.avatarZone}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={openFilePicker}>
              <div style={{ ...styles.avatarSquare, ...(processing ? styles.avatarProcessing : {}) }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" style={styles.avatarImg} onError={handleAvatarError} />
                ) : (
                  <User size={36} color="#8E8E93" />
                )}
              </div>
              {/* Plus-бейдж — кликабелен т.к. родитель имеет onClick */}
              <div style={styles.avatarPlusBadge} className="onb-pressable">
                <Plus size={20} color="#000" strokeWidth={3} />
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

            {isTelegramAvatar ? (
              <div style={styles.telegramBadge}>
                <Check size={14} color="#D4FF00" strokeWidth={3} />
                <span>Синхронизировано с Telegram</span>
              </div>
            ) : (
              <span style={styles.avatarHintText}>
                {processing ? 'Обработка...' : 'Добавить фото'}
              </span>
            )}
          </div>

          {/* iOS-style grouped input */}
          <div style={styles.iosInputGroup}>
            <div style={styles.iosInputRow}>
              <User size={20} color="#8E8E93" style={styles.iosInputIcon} />
              <input
                type="text"
                placeholder="Твоё имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                style={styles.iosInput}
                maxLength={ONBOARDING_LIMITS.NAME_MAX}
              />
            </div>
            <div style={styles.iosInputSeparator} />
            <div style={styles.iosInputRow}>
              <AtSign size={20} color="#D4FF00" style={styles.iosInputIcon} />
              <input
                type="text"
                placeholder="ник в Campus (не Telegram)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                style={{ ...styles.iosInput, color: username ? '#D4FF00' : '#fff', fontWeight: username ? 600 : 400 }}
                maxLength={ONBOARDING_LIMITS.USERNAME_MAX}
                autoCapitalize="none"
              />
            </div>
          </div>

        </div>
      </div>

      <div style={styles.stepBottom}>
        <button
          style={{ ...styles.primaryCta, ...(!isValid ? styles.primaryCtaDisabled : {}) }}
          className="onb-pressable"
          onClick={handleNext}
          disabled={!isValid}
        >
          Дальше
        </button>
      </div>
    </div>
  );
}


// =============================================
// Шаг 2: ВУЗ + курс (только как в моке)
// =============================================

function StepEducation({
  onboardingData,
  educationDraft,
  setEducationDraft,
  onNestedStateChange,
  onRegisterNestedBack,
  onBack,
  onFinish,
}) {
  const resolveCampusById = useCallback((campusId) => {
    if (!campusId) return null;
    return CAMPUSES.find((c) => c.id === campusId) || null;
  }, []);

  const [searchQuery, setSearchQuery] = useState(educationDraft.searchQuery ?? '');
  const [selectedCampus, setSelectedCampus] = useState(() => {
    const draftCampus = resolveCampusById(educationDraft.selectedCampusId);
    if (draftCampus) return draftCampus;
    return resolveCampusById(onboardingData.campus_id);
  });
  const [isCustom, setIsCustom] = useState(() => {
    if (typeof educationDraft.isCustom === 'boolean') return educationDraft.isCustom;
    if (onboardingData.campus_id) return false;
    return Boolean(onboardingData.custom_university);
  });
  const [customUni, setCustomUni] = useState(
    educationDraft.customUni ?? onboardingData.custom_university ?? (!onboardingData.campus_id ? onboardingData.university || '' : '')
  );
  const [course, setCourse] = useState(educationDraft.course ?? onboardingData.course ?? null);
  const [institute, setInstitute] = useState(educationDraft.institute ?? onboardingData.institute ?? onboardingData.custom_faculty ?? '');
  const [finishStatus, setFinishStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const searchInputRef = useRef(null);
  const finishBtnRef = useRef(null);

  // Сохраняем черновик при каждом изменении
  useEffect(() => {
    setEducationDraft({
      searchQuery,
      selectedCampusId: selectedCampus?.id || null,
      isCustom,
      customUni,
      course,
      institute,
    });
  }, [searchQuery, selectedCampus, isCustom, customUni, course, institute, setEducationDraft]);

  const filteredCampuses = useMemo(() => searchCampuses(searchQuery), [searchQuery]);
  const campusFaculties = useMemo(
    () => (selectedCampus ? getFacultiesForCampus(selectedCampus.id) : []),
    [selectedCampus]
  );
  const inSearchMode = !selectedCampus && !isCustom;
  const resetToCampusList = useCallback(() => {
    hapticFeedback('light');
    setSelectedCampus(null);
    setIsCustom(false);
    setInstitute('');
  }, []);

  useEffect(() => {
    onNestedStateChange?.(!inSearchMode);
  }, [inSearchMode, onNestedStateChange]);

  useEffect(() => {
    onRegisterNestedBack?.(() => resetToCampusList());
    return () => onRegisterNestedBack?.(null);
  }, [onRegisterNestedBack, resetToCampusList]);

  // Авто-фокус поиска только на десктопе
  useEffect(() => {
    if (selectedCampus || isCustom || window.innerWidth < 768) return;
    const timer = setTimeout(() => {
      try { searchInputRef.current?.focus({ preventScroll: true }); } catch { searchInputRef.current?.focus(); }
    }, 180);
    return () => clearTimeout(timer);
  }, [selectedCampus, isCustom]);

  const handleSelectCampus = useCallback((campus) => {
    hapticFeedback('medium');
    setSelectedCampus(campus);
    setIsCustom(false);
    setInstitute((current) => (campus.faculties.includes(current) ? current : ''));
  }, []);

  const handleResetCampus = resetToCampusList;
  const handleCustomMode = () => { hapticFeedback('light'); setIsCustom(true); setSelectedCampus(null); setInstitute(''); };
  const handleBack = () => {
    if (!inSearchMode) {
      resetToCampusList();
      return;
    }
    hapticFeedback('light');
    onBack();
  };
  const handleSelectInstitute = (value) => {
    hapticFeedback('selection');
    setInstitute(value);
  };

  const hasValidCampus = Boolean(selectedCampus) || (isCustom && customUni.trim().length >= ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MIN);
  const canFinish = hasValidCampus && Boolean(course) && finishStatus === 'idle';

  const handleFinish = async () => {
    if (!hasValidCampus) { toast.error('Выберите ВУЗ'); return; }
    if (!course) { toast.error('Выберите курс'); return; }

    const data = {};
    if (selectedCampus) {
      data.campus_id = selectedCampus.id;
      data.university = selectedCampus.university;
      data.city = selectedCampus.city;
      data.institute = institute.trim() || null;
      data.custom_faculty = null;
    } else {
      data.campus_id = null;
      data.university = customUni.trim();
      data.custom_university = customUni.trim();
      data.institute = institute.trim() || null;
      data.custom_faculty = institute.trim() || null;
    }
    data.course = course;

    setFinishStatus('loading');
    try {
      await onFinish(data);
      setFinishStatus('success');
      if (finishBtnRef.current) {
        triggerNeonSparks(finishBtnRef.current.getBoundingClientRect());
      }
    } catch {
      setFinishStatus('idle');
    }
  };

  // Кнопка назад в UI — только в Dev (в проде нативный TMA BackButton)
  const showLocalBack = import.meta.env.DEV;

  return (
    <div style={styles.stepPage}>
      {/* Шапка */}
      <div style={styles.stepHeader}>
        {showLocalBack ? (
          <button style={styles.circleBackBtn} className="onb-pressable" onClick={handleBack}>
            <ChevronLeft size={24} color="#fff" />
          </button>
        ) : <div style={{ width: 44 }} />}
        <span style={styles.stepIndicator}>ШАГ 2 ИЗ 2</span>
        <div style={{ width: 44 }} />
      </div>

      <div style={styles.stepScrollable}>
        <h2 style={{ ...styles.bigTitle, marginBottom: 24 }}>Где ботаешь?</h2>

        {/* === Поиск ВУЗа === */}
        {inSearchMode && (
          <>
            <div style={styles.searchWrapper}>
              <Search size={20} color="#8E8E93" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Название или город"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
                autoCapitalize="none"
                autoComplete="off"
              />
              {searchQuery && (
                <button className="onb-pressable" style={styles.clearBtn} onClick={() => setSearchQuery('')}>
                  <X size={16} color="#8E8E93" />
                </button>
              )}
            </div>

            <div style={styles.campusList}>
              {filteredCampuses.map((campus) => (
                <button
                  key={campus.id}
                  style={styles.campusCard}
                  className="onb-pressable"
                  onClick={() => handleSelectCampus(campus)}
                >
                  <CampusLogoAvatar campus={campus} size={48} radius={14} />
                  <div style={styles.campusInfo}>
                    <span style={styles.campusName}>{campus.short}</span>
                    <span style={styles.campusCity}>{campus.fullName} · {campus.city}</span>
                  </div>
                </button>
              ))}
              {filteredCampuses.length === 0 && searchQuery && (
                <div style={styles.emptySearch}>Ничего не найдено</div>
              )}
            </div>
          </>
        )}

        {/* === Выбранный ВУЗ === */}
        {selectedCampus && (
          <div style={styles.selectedCampusCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
              <CampusLogoAvatar campus={selectedCampus} size={64} radius={18} letterSize={20} />
              <div style={styles.campusInfo}>
                <span style={{ ...styles.campusName, fontSize: 20 }}>{selectedCampus.short}</span>
                <span style={styles.campusCity}>{selectedCampus.fullName}</span>
              </div>
            </div>
            <button className="onb-pressable" style={styles.changeBtn} onClick={handleResetCampus}>Изменить</button>
          </div>
        )}

        {/* === Свой ВУЗ === */}
        {isCustom && (
          <div style={styles.customCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Свой ВУЗ</span>
              <button className="onb-pressable" style={styles.changeBtn} onClick={() => setIsCustom(false)}>К списку</button>
            </div>
            <input
              type="text"
              placeholder="Краткое название (напр. МГУ)"
              value={customUni}
              onChange={(e) => setCustomUni(e.target.value)}
              style={{ ...styles.customInput, marginBottom: 16 }}
              maxLength={ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MAX}
              autoFocus
            />
            {/* Оранжевый инфо-блок */}
            <div style={styles.customInfoBox}>
              <Info size={22} color="#FF9F0A" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Проверка до 72 часов</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  Ты уже можешь зайти в Campus, но умный поиск однокурсников заработает после аппрува ВУЗа.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === Курс — показываем только после выбора ВУЗа === */}
        {(selectedCampus || isCustom) && (
          <div style={{ marginBottom: 32 }}>
            <div style={styles.educationDetailsCard}>
              <div style={styles.sectionLabel}>Какой курс?</div>
              <div style={styles.courseGrid}>
                {['1', '2', '3', '4', '5', '6'].map((c) => (
                  <button
                    key={c}
                    style={{ ...styles.courseCell, ...(course === c ? styles.courseCellActive : {}) }}
                    className="onb-pressable"
                    onClick={() => { hapticFeedback('selection'); setCourse(c); }}
                  >
                    {c}
                  </button>
                ))}
                <button
                  style={{ ...styles.courseCell, ...styles.courseCellWide, ...(course === 'Выпускник' ? styles.courseCellActive : {}) }}
                  className="onb-pressable"
                  onClick={() => { hapticFeedback('selection'); setCourse('Выпускник'); }}
                >
                  Уже выпускник 🎓
                </button>
              </div>

              <div style={styles.educationDivider} />

              <div style={styles.facultyHeader}>
                <span style={styles.sectionLabel}>Институт / факультет</span>
                <span style={styles.optionalBadge}>необязательно</span>
              </div>

              {selectedCampus ? (
                <div style={selectedCampus.facultyGraph ? styles.facultyGraphShell : styles.eduTree}>
                  {selectedCampus.facultyGraph ? (
                    <FacultyGraphPicker
                      campus={selectedCampus}
                      value={institute}
                      onSelect={handleSelectInstitute}
                    />
                  ) : (
                    <>
                      <div style={styles.treeRoot}>
                        <div style={styles.treeDot} />
                        <div style={styles.treeRootText}>
                          <span style={styles.treeRootTitle}>{selectedCampus.short}</span>
                          <span style={styles.treeRootSubtitle}>Учебное дерево</span>
                        </div>
                      </div>

                      <div style={styles.treeBranch}>
                        <div style={styles.treeLine} />
                        <div style={styles.treeNode}>
                          <div style={styles.treeNodeLabel}>Выберите подразделение</div>
                          <div style={styles.facultyChips}>
                            {campusFaculties.map((faculty) => {
                              const isActive = institute === faculty;
                              return (
                                <button
                                  key={faculty}
                                  type="button"
                                  style={{ ...styles.facultyChip, ...(isActive ? styles.facultyChipActive : {}) }}
                                  className="onb-pressable"
                                  onClick={() => handleSelectInstitute(faculty)}
                                >
                                  {faculty}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {institute ? (
                        <div style={styles.pathPill}>
                          <span style={styles.pathMuted}>Путь:</span>
                          <span>{selectedCampus.university} → {institute}</span>
                        </div>
                      ) : (
                        <div style={styles.pathEmpty}>Можно пропустить и указать позже</div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Например, Экономический факультет"
                    value={institute}
                    onChange={(e) => setInstitute(e.target.value)}
                    style={styles.customInput}
                    maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
                  />
                  <div style={styles.customFacultyHint}>Для своего ВУЗа подразделение вводится вручную.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Нижняя зона */}
      <div style={styles.stepBottom}>
        {inSearchMode && (
          <button className="onb-pressable" style={styles.addCustomUniBtn} onClick={handleCustomMode}>
            <div style={styles.addCustomUniIcon}>
              <Plus size={18} color="#8E8E93" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Нет моего ВУЗа</div>
              <div style={{ fontSize: 13, color: '#8E8E93' }}>Ввести вручную (через модерацию)</div>
            </div>
          </button>
        )}

        <button
          ref={finishBtnRef}
          style={{
            ...styles.primaryCta,
            ...(!canFinish && finishStatus === 'idle' ? styles.primaryCtaDisabled : {}),
            ...(finishStatus === 'success' ? styles.primaryCtaSuccess : {}),
            transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
          className="onb-pressable"
          onClick={handleFinish}
          disabled={!canFinish}
        >
          {finishStatus === 'idle' && <><Check size={20} strokeWidth={3} /> Завершить</>}
          {finishStatus === 'loading' && <div style={styles.spinner} />}
          {finishStatus === 'success' && <><Zap size={20} fill="#000" /> Готово!</>}
        </button>
      </div>
    </div>
  );
}


// =============================================
// Стили
// =============================================

const SURFACE = '#1C1C1E';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#8E8E93';
const PRIMARY = '#D4FF00';
const BG = '#000';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    backgroundColor: BG,
    zIndex: Z_ONBOARDING_MAIN,
    overflow: 'hidden',
  },
  stepsTrack: {
    display: 'flex',
    width: '200%',
    height: '100%',
    transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
    willChange: 'transform',
  },
  stepSlot: {
    width: '50%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },

  stepPage: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: BG,
    overflow: 'hidden',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'max(16px, env(safe-area-inset-top)) 20px 16px',
    flexShrink: 0,
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: 800,
    color: PRIMARY,
    letterSpacing: 1,
    textTransform: 'uppercase',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  stepScrollable: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px calc(164px + var(--screen-bottom-offset, 0px))',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  stepBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '18px 20px calc(16px + var(--screen-bottom-offset, 0px))',
    background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.72) 62%, transparent 100%)',
    pointerEvents: 'none',
  },

  stepCenterContent: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '100%',
    paddingBottom: '5vh',
  },

  bigTitle: {
    margin: '0 0 32px',
    fontSize: 32,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -1,
  },
  titleRow: {
    position: 'relative',
    display: 'block',
    marginBottom: 24,
    minWidth: 0,
  },
  bigTitleInRow: {
    boxSizing: 'border-box',
    width: '100%',
    paddingRight: 104,
    marginBottom: 0,
    lineHeight: 1.18,
    overflowWrap: 'normal',
  },
  titleStepIndicator: {
    position: 'absolute',
    top: 8,
    right: 0,
    transform: 'translateY(0)',
  },

  // Аватар
  avatarZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarSquare: {
    width: 110,
    height: 110,
    borderRadius: 40,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
    transition: 'opacity 0.2s',
  },
  avatarProcessing: {
    opacity: 0.5,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlusBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 14,
    background: PRIMARY,
    border: `4px solid ${BG}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  telegramBadge: {
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(212,255,0,0.1)',
    border: '1px solid rgba(212,255,0,0.2)',
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    color: PRIMARY,
  },
  avatarHintText: {
    marginTop: 16,
    fontSize: 14,
    color: MUTED,
  },

  // iOS grouped input
  iosInputGroup: {
    background: SURFACE,
    borderRadius: 20,
    border: `1px solid ${BORDER}`,
    overflow: 'hidden',
  },
  iosInputRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  iosInputSeparator: {
    height: 1,
    background: BORDER,
    marginLeft: 20,
  },
  iosInputIcon: {
    position: 'absolute',
    left: 20,
    flexShrink: 0,
  },
  iosInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: 17,
    padding: '18px 20px 18px 52px',
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
  },

  // Кнопки
  primaryCta: {
    width: '100%',
    minHeight: 58,
    background: PRIMARY,
    color: '#000',
    border: `1px solid ${PRIMARY}`,
    padding: 18,
    borderRadius: 20,
    fontSize: 17,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: '0 12px 28px rgba(212,255,0,0.22)',
  },
  primaryCtaDisabled: {
    background: '#2C2C2E',
    color: MUTED,
    border: `1px solid ${BORDER}`,
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  primaryCtaSuccess: {
    background: PRIMARY,
    color: '#000',
    border: `1px solid ${PRIMARY}`,
    boxShadow: '0 8px 24px rgba(212,255,0,0.3)',
    transform: 'scale(1.04)',
  },

  circleBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  // Поиск
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: '16px 20px',
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 17,
    outline: 'none',
    fontFamily: 'inherit',
    WebkitAppearance: 'none',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
  },

  // Карточки кампусов
  campusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 24,
  },
  campusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    background: SURFACE,
    borderRadius: 20,
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  campusInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  campusName: {
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 2,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  campusCity: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 1.25,
    minWidth: 0,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
  emptySearch: {
    textAlign: 'center',
    padding: '32px 16px',
    color: MUTED,
    fontSize: 15,
  },

  // Выбранный кампус
  selectedCampusCard: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    padding: 16,
    marginBottom: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  changeBtn: {
    background: '#2C2C2E',
    border: 'none',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },

  // Custom ВУЗ
  customCard: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  customInput: {
    width: '100%',
    background: BG,
    border: `1px solid ${BORDER}`,
    color: '#fff',
    fontSize: 17,
    padding: '16px 20px',
    borderRadius: 16,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
  },
  customInfoBox: {
    display: 'flex',
    gap: 12,
    padding: 16,
    background: 'rgba(255,159,10,0.1)',
    border: '1px solid rgba(255,159,10,0.2)',
    borderRadius: 16,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 12,
  },

  educationDetailsCard: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    padding: 16,
  },

  educationDivider: {
    height: 1,
    background: BORDER,
    margin: '18px 0',
  },

  // Курс — 3 колонки
  courseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  courseCell: {
    padding: '16px 0',
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    color: '#fff',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
  },
  courseCellActive: {
    background: PRIMARY,
    border: `1px solid ${PRIMARY}`,
    color: '#000',
  },
  courseCellWide: {
    gridColumn: 'span 3',
    fontSize: 16,
    fontWeight: 700,
  },

  facultyHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  optionalBadge: {
    color: MUTED,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${BORDER}`,
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  eduTree: {
    background: 'linear-gradient(180deg, rgba(212,255,0,0.07), rgba(255,255,255,0.025))',
    border: `1px solid ${BORDER}`,
    borderRadius: 18,
    padding: 14,
  },
  facultyGraphShell: {
    margin: '0 -16px',
  },
  treeRoot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  treeDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: PRIMARY,
    boxShadow: '0 0 18px rgba(212,255,0,0.45)',
    flexShrink: 0,
  },
  treeRootText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  treeRootTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  treeRootSubtitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  treeBranch: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 14,
  },
  treeLine: {
    width: 1,
    marginLeft: 5,
    background: 'linear-gradient(180deg, rgba(212,255,0,0.6), rgba(212,255,0,0.05))',
    borderRadius: 1,
    flexShrink: 0,
  },
  treeNode: {
    flex: 1,
    minWidth: 0,
  },
  treeNodeLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
  },
  facultyChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  facultyChip: {
    border: `1px solid ${BORDER}`,
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    borderRadius: 999,
    padding: '10px 13px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  facultyChipActive: {
    background: PRIMARY,
    color: '#000',
    border: `1px solid ${PRIMARY}`,
    boxShadow: '0 8px 22px rgba(212,255,0,0.16)',
  },
  pathPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 14,
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.28)',
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  pathMuted: {
    color: MUTED,
    fontWeight: 600,
  },
  pathEmpty: {
    marginTop: 14,
    color: MUTED,
    fontSize: 13,
  },
  customFacultyHint: {
    marginTop: 10,
    color: MUTED,
    fontSize: 13,
    lineHeight: 1.35,
  },

  // "Нет моего ВУЗа"
  addCustomUniBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(28,28,30,0.92)',
    border: `1px solid ${BORDER}`,
    borderRadius: 18,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    pointerEvents: 'auto',
    boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
  },
  addCustomUniIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#2C2C2E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  spinner: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '3px solid rgba(0,0,0,0.2)',
    borderTopColor: '#000',
    animation: 'onb-spin 0.8s linear infinite',
  },
};


// =============================================
// CSS
// =============================================

const onboardingStyles = `
  .onb-pressable {
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s;
    cursor: pointer;
  }
  .onb-pressable:active {
    transform: scale(0.96);
    opacity: 0.85;
  }
  .onb-pressable:disabled {
    transform: none !important;
    opacity: 1 !important;
  }
  @keyframes onb-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  input { -webkit-tap-highlight-color: transparent; }
  input::placeholder { color: #666; }
`;

export default Onboarding;
