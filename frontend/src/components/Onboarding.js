// Onboarding component

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Camera, User, AtSign, Search, GraduationCap, Building2, ChevronLeft, X } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback, getTelegramUser, isTelegramSDKAvailable } from '../utils/telegram';
import { uploadUserAvatar } from '../api';
import { toast } from './shared/Toast';
import theme from '../theme';
import { Z_ONBOARDING_MAIN } from '../constants/zIndex';
import { useTelegramScreen } from './shared/telegram/useTelegramScreen';
import {
  CAMPUSES, COURSES, searchCampuses, getFacultiesForCampus,
  ONBOARDING_LIMITS,
} from '../constants/universityData';

function Onboarding() {
  const {
    onboardingStep,
    onboardingData,
    setOnboardingStep,
    setOnboardingData,
    finishRegistration,
  } = useStore();

  const [direction, setDirection] = useState('forward');
  const [educationDraft, setEducationDraft] = useState({});
  const isTelegram = useMemo(() => isTelegramSDKAvailable(), []);

  const goToStep = useCallback((step, forward = true) => {
    setDirection(forward ? 'forward' : 'backward');
    setOnboardingStep(step);
  }, [setOnboardingStep]);

  const handleNativeBack = useCallback(() => {
    if (onboardingStep > 1) {
      goToStep(onboardingStep - 1, false);
    }
  }, [goToStep, onboardingStep]);

  useTelegramScreen({
    id: 'onboarding-flow',
    priority: 3000,
    back: {
      visible: onboardingStep > 1,
      onClick: handleNativeBack,
    },
  });

  const renderStep = () => {
    const animClass = direction === 'forward' ? 'onb-slide-right' : 'onb-slide-left';

    switch (onboardingStep) {
      case 1:
        return (
          <div className={`${animClass} onb-step-frame`} key="step1">
            <StepAboutYou
              onboardingData={onboardingData}
              setOnboardingData={setOnboardingData}
              onNext={() => goToStep(2, true)}
            />
          </div>
        );
      case 2:
        return (
          <div className={`${animClass} onb-step-frame`} key="step2">
            <StepEducation
              onboardingData={onboardingData}
              educationDraft={educationDraft}
              setEducationDraft={setEducationDraft}
              onBack={() => goToStep(1, false)}
              onFinish={finishRegistration}
              showLocalBackButton={!isTelegram}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <style>{onboardingStyles}</style>
      <div style={styles.overlay}>
        <div style={styles.container}>
          {renderStep()}
        </div>
      </div>
    </>
  );
}


// ========================================
// Step 1: photo + name + username
// ========================================

function StepAboutYou({ onboardingData, setOnboardingData, onNext }) {
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const telegramPhotoUrl = telegramUser?.photoUrl || null;
  const persistedAvatar = onboardingData.avatar || null;
  const initialAvatar = persistedAvatar || telegramPhotoUrl;

  const [name, setName] = useState(onboardingData.name || telegramUser?.firstName || '');
  const [username, setUsername] = useState(onboardingData.username || '');
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar);
  const [avatarSource, setAvatarSource] = useState(
    persistedAvatar ? 'uploaded' : (telegramPhotoUrl ? 'telegram' : 'empty')
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isValid = name.trim().length >= ONBOARDING_LIMITS.NAME_MIN;
  const isTelegramAvatar = avatarSource === 'telegram' && Boolean(avatarPreview);

  const fallbackAvatarPreview = useCallback(() => {
    if (persistedAvatar) {
      setAvatarPreview(persistedAvatar);
      setAvatarSource('uploaded');
      return;
    }
    if (telegramPhotoUrl) {
      setAvatarPreview(telegramPhotoUrl);
      setAvatarSource('telegram');
      return;
    }
    setAvatarPreview(null);
    setAvatarSource('empty');
  }, [persistedAvatar, telegramPhotoUrl]);

  const handleAvatarPick = () => {
    hapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleAvatarError = () => {
    // Quiet fallback for broken Telegram image links.
    if (avatarSource === 'telegram') {
      if (persistedAvatar) {
        setAvatarPreview(persistedAvatar);
        setAvatarSource('uploaded');
      } else {
        setAvatarPreview(null);
        setAvatarSource('empty');
      }
      return;
    }

    setAvatarPreview(null);
    setAvatarSource('empty');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setAvatarSource('uploaded');
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    uploadUserAvatar(file)
      .then((data) => {
        if (data?.avatar) {
          setOnboardingData({ avatar: data.avatar });
          toast.success('Фото загружено');
        }
      })
      .catch(() => {
        toast.error('Не удалось загрузить фото');
        fallbackAvatarPreview();
      })
      .finally(() => setUploading(false));
  };

  const handleNext = () => {
    if (!isValid) {
      toast.error('Введите имя (минимум 2 символа)');
      return;
    }
    hapticFeedback('medium');
    
    const cleanUsername = username.replace(/^@/, '').trim();
    setOnboardingData({
      name: name.trim(),
      username: cleanUsername || null,
    });
    onNext();
  };

  const handleEnterSubmit = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleNext();
  };

  return (
    <div style={styles.stepContent}>
      <div style={styles.stepIndicator}>Шаг 1 из 2</div>
      <div style={styles.stepTitle}>Представьтесь</div>
      <div style={styles.stepSubtitle}>Как вас будут видеть другие студенты</div>

      {/* Avatar */}
      <div style={styles.avatarCenter}>
        <div style={styles.avatarOuter} className="onb-pressable" onClick={handleAvatarPick}>
          {avatarPreview ? (
            <img src={avatarPreview} alt="" style={styles.avatarImg} onError={handleAvatarError} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              <Camera size={28} color={theme.colors.textTertiary} />
            </div>
          )}
          <div style={styles.avatarBadge}>
            <Camera size={14} color="#fff" />
          </div>
          {uploading && <div style={styles.avatarLoading} />}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div style={styles.avatarHint}>
          {isTelegramAvatar ? 'Фото из Telegram, можно сменить' : 'Добавить фото'}
        </div>
      </div>

      {/* Name */}
      <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.05s' }}>
        <label style={styles.label}>
          <User size={14} color={theme.colors.textTertiary} style={{ marginRight: 6 }} />
          Ваше имя *
        </label>
        <input
          type="text"
          placeholder="Иван Иванов"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleEnterSubmit}
          style={styles.input}
          maxLength={ONBOARDING_LIMITS.NAME_MAX}
        />
      </div>

      {/* Username */}
      <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.1s' }}>
        <label style={styles.label}>
          <AtSign size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
          Username
          <span style={styles.labelOptional}>необязательно</span>
        </label>
        <input
          type="text"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleEnterSubmit}
          style={{ ...styles.input, color: theme.colors.primary }}
          maxLength={ONBOARDING_LIMITS.USERNAME_MAX}
          autoCapitalize="none"
        />
        <div style={styles.hint}>Чтобы вас могли найти</div>
      </div>

      <button
        style={{
          ...styles.primaryButton,
          ...(isValid ? {} : styles.primaryButtonDisabled),
        }}
        onClick={handleNext}
        disabled={!isValid}
        className={`onb-fade-up ${isValid ? 'onb-pressable' : ''}`}
      >
        Далее
      </button>
    </div>
  );
}


// ========================================
// Step 2: campus + faculty + course + group
// ========================================

function StepEducation({
  onboardingData,
  educationDraft,
  setEducationDraft,
  onBack,
  onFinish,
  showLocalBackButton = true,
}) {
  const resolveCampusById = useCallback((campusId) => {
    if (!campusId) return null;
    return CAMPUSES.find((campus) => campus.id === campusId) || null;
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
  const [customCity, setCustomCity] = useState(
    educationDraft.customCity ?? onboardingData.custom_city ?? onboardingData.city ?? ''
  );
  const [faculty, setFaculty] = useState(educationDraft.faculty ?? '');
  const [customFaculty, setCustomFaculty] = useState(
    educationDraft.customFaculty ?? onboardingData.custom_faculty ?? ''
  );
  const [course, setCourse] = useState(educationDraft.course ?? onboardingData.course ?? null);
  const [group, setGroup] = useState(educationDraft.group ?? onboardingData.group ?? '');
  const [submitting, setSubmitting] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setEducationDraft({
      searchQuery,
      selectedCampusId: selectedCampus?.id || null,
      isCustom,
      customUni,
      customCity,
      faculty,
      customFaculty,
      course,
      group,
    });
  }, [
    searchQuery,
    selectedCampus,
    isCustom,
    customUni,
    customCity,
    faculty,
    customFaculty,
    course,
    group,
    setEducationDraft,
  ]);

  const filteredCampuses = useMemo(
    () => searchCampuses(searchQuery),
    [searchQuery]
  );

  const faculties = useMemo(
    () => (selectedCampus ? getFacultiesForCampus(selectedCampus.id) : []),
    [selectedCampus]
  );

  const handleSelectCampus = useCallback((campus) => {
    hapticFeedback('medium');
    if (!selectedCampus || selectedCampus.id !== campus.id) {
      setFaculty('');
      setCustomFaculty('');
    }
    setSelectedCampus(campus);
    setIsCustom(false);
  }, [selectedCampus]);

  const handleCustomMode = useCallback(() => {
    hapticFeedback('light');
    setIsCustom(true);
    setSelectedCampus(null);
  }, []);

  const handleBack = () => {
    hapticFeedback('light');
    onBack();
  };

  const localBackControl = showLocalBackButton ? (
    <button style={styles.backButton} className="onb-pressable" onClick={handleBack}>
      <ChevronLeft size={22} color={theme.colors.text} />
    </button>
  ) : (
    <div style={styles.backButtonSpacer} />
  );

  const handleResetCampus = () => {
    hapticFeedback('light');
    setSelectedCampus(null);
    setIsCustom(false);
  };

  const hasValidCampus = Boolean(selectedCampus) || (isCustom && customUni.trim().length >= ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MIN);
  const isFinishBlocked = !hasValidCampus || !course;
  const canFinish = !isFinishBlocked && !submitting;

  useEffect(() => {
    if (selectedCampus || isCustom) return undefined;

    const shouldAutoFocus = window.innerWidth >= 768;
    if (!shouldAutoFocus) return undefined;

    const timer = setTimeout(() => {
      try {
        searchInputRef.current?.focus({ preventScroll: true });
      } catch {
        searchInputRef.current?.focus();
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [selectedCampus, isCustom, searchQuery]);

  const handleFinish = async () => {
    if (!hasValidCampus) {
      toast.error('Выберите ВУЗ');
      return;
    }

    hapticFeedback('success');
    setSubmitting(true);

    const finalFaculty = isCustom
      ? customFaculty.trim() || null
      : (faculty === 'Другой' ? customFaculty.trim() || null : faculty || null);

    const data = {};

    if (selectedCampus) {
      data.campus_id = selectedCampus.id;
      data.university = selectedCampus.university;
      data.city = selectedCampus.city;
      data.institute = finalFaculty;
    } else {
      data.campus_id = null;
      data.university = customUni.trim();
      data.custom_university = customUni.trim();
      data.custom_city = customCity.trim() || null;
      data.city = customCity.trim() || null;
      data.custom_faculty = finalFaculty;
      data.institute = finalFaculty;
    }

    data.course = course;
    data.group = group.trim() || null;

    try {
      await onFinish(data);
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedCampus && !isCustom) {
    return (
      <div style={styles.stepContent}>
        <div style={styles.stepShell}>
          <div style={styles.stepTopZone}>
            <div style={styles.stepHeader}>
              {localBackControl}
              <div style={styles.stepIndicator}>Шаг 2 из 2</div>
              <div style={styles.backButtonSpacer} />
            </div>

            <div style={styles.stepTitle}>
              <GraduationCap size={28} color={theme.colors.primary} style={{ marginRight: 10 }} />
              Где учитесь?
            </div>

            <div style={styles.searchWrapper} className="onb-fade-up">
              <Search size={18} color={theme.colors.textTertiary} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Найти ВУЗ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
                autoCapitalize="none"
                autoComplete="off"
              />
              {searchQuery && (
                <button style={styles.clearSearch} className="onb-pressable" onClick={() => setSearchQuery('')}>
                  <X size={16} color={theme.colors.textTertiary} />
                </button>
              )}
            </div>
          </div>

          <div style={styles.stepMiddleZone}>
            <div style={styles.campusList}>
              {filteredCampuses.map((campus, index) => (
                <button
                  key={campus.id}
                  style={{ ...styles.campusCard, animationDelay: index < 8 ? `${index * 0.04}s` : '0s' }}
                  className="onb-fade-in onb-pressable"
                  onClick={() => handleSelectCampus(campus)}
                >
                  <div style={styles.campusIcon}>
                    <Building2 size={20} color={theme.colors.primary} />
                  </div>
                  <div style={styles.campusInfo}>
                    <div style={styles.campusName}>{campus.university}</div>
                    <div style={styles.campusCity}>{campus.city}{campus.address ? `, ${campus.address}` : ''}</div>
                  </div>
                  <ChevronLeft size={18} color={theme.colors.textTertiary} style={{ transform: 'rotate(180deg)' }} />
                </button>
              ))}

              {filteredCampuses.length === 0 && searchQuery && (
                <div style={styles.emptySearch} className="onb-fade-in">
                  Ничего не найдено
                </div>
              )}
            </div>
          </div>

          <div style={styles.stepBottomZone}>
            <button
              style={styles.customButton}
              className="onb-fade-up onb-pressable"
              onClick={handleCustomMode}
            >
              Нет моего ВУЗа — ввести вручную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.stepContent}>
      <div style={styles.stepShell}>
        <div style={styles.stepTopZone}>
          <div style={styles.stepHeader}>
            {localBackControl}
            <div style={styles.stepIndicator}>Шаг 2 из 2</div>
            <div style={styles.backButtonSpacer} />
          </div>

          <div style={styles.selectedCampus} className="onb-fade-up">
            <div style={styles.selectedCampusInfo}>
              <Building2 size={18} color={theme.colors.primary} />
              <span style={styles.selectedCampusText}>
                {selectedCampus ? selectedCampus.short : customUni || 'Свой ВУЗ'}
              </span>
            </div>
            <button style={styles.changeCampusBtn} className="onb-pressable" onClick={handleResetCampus}>
              Изменить
            </button>
          </div>
        </div>

        <div style={styles.stepMiddleZone}>
          {isCustom && (
            <>
              <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.05s' }}>
                <label style={styles.label}>Название ВУЗа *</label>
                <input
                  type="text"
                  placeholder="КубГУ, МИРЭА, ИТМО..."
                  value={customUni}
                  onChange={(e) => setCustomUni(e.target.value)}
                  style={styles.input}
                  maxLength={ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MAX}
                />
              </div>
              <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.1s' }}>
                <label style={styles.label}>
                  Город
                  <span style={styles.labelOptional}>необязательно</span>
                </label>
                <input
                  type="text"
                  placeholder="Краснодар, Москва..."
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  style={styles.input}
                  maxLength={ONBOARDING_LIMITS.CUSTOM_CITY_MAX}
                />
              </div>
            </>
          )}

          {selectedCampus && faculties.length > 0 && (
            <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.1s' }}>
              <label style={styles.label}>Факультет / Институт</label>
              <div style={styles.chipsWrap}>
                {faculties.map((f) => (
                  <button
                    key={f}
                    style={{
                      ...styles.chip,
                      ...(faculty === f ? styles.chipActive : {}),
                    }}
                    className="onb-pressable"
                    onClick={() => {
                      hapticFeedback('selection');
                      setFaculty(f);
                      if (f !== 'Другой') setCustomFaculty('');
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {faculty === 'Другой' && (
                <input
                  type="text"
                  placeholder="Введите название..."
                  value={customFaculty}
                  onChange={(e) => setCustomFaculty(e.target.value)}
                  style={{ ...styles.input, marginTop: 8 }}
                  maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
                />
              )}
            </div>
          )}

          {isCustom && (
            <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.15s' }}>
              <label style={styles.label}>
                Факультет / Институт
                <span style={styles.labelOptional}>необязательно</span>
              </label>
              <input
                type="text"
                placeholder="ИСА, Юридический..."
                value={customFaculty}
                onChange={(e) => setCustomFaculty(e.target.value)}
                style={styles.input}
                maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
              />
            </div>
          )}

          <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.15s' }}>
            <label style={styles.label}>Курс</label>
            <div style={styles.courseRow}>
              {COURSES.map((c) => (
                <button
                  key={c}
                  style={{
                    ...styles.courseChip,
                    ...(course === c ? styles.courseChipActive : {}),
                  }}
                  className="onb-pressable"
                  onClick={() => {
                    hapticFeedback('selection');
                    setCourse(c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="onb-fade-up" style={{ ...styles.field, animationDelay: '0.2s' }}>
            <label style={styles.label}>
              Группа
              <span style={styles.labelOptional}>необязательно</span>
            </label>
            <input
              type="text"
              placeholder="БИ-21, ИСП-6..."
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              style={styles.input}
              maxLength={ONBOARDING_LIMITS.GROUP_MAX}
            />
          </div>
        </div>

        <div style={styles.stepBottomZone}>
          <button
            style={{
              ...styles.primaryButton,
              ...styles.primaryButtonPinned,
              ...(isFinishBlocked ? styles.primaryButtonDisabled : {}),
            }}
            onClick={handleFinish}
            disabled={!canFinish}
            className={`onb-fade-up ${canFinish ? 'onb-pressable' : ''}`}
          >
            {submitting ? 'Регистрация...' : 'Завершить регистрацию'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// Styles
// ========================================

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme.colors.bg,
    zIndex: Z_ONBOARDING_MAIN,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingTop: `calc(${theme.spacing.lg}px + var(--screen-top-offset))`,
    paddingBottom: `calc(${theme.spacing.lg}px + var(--screen-bottom-offset))`,
    paddingLeft: `${theme.spacing.xl}px`,
    paddingRight: `${theme.spacing.xl}px`,
    boxSizing: 'border-box',
  },
  container: {
    width: '100%',
    maxWidth: 500,
    paddingBottom: 0,
    minHeight: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    textRendering: 'optimizeLegibility',
    WebkitTextSizeAdjust: '100%',
  },
  stepContent: {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  stepShell: {
    display: 'flex',
    flexDirection: 'column',
    height: `min(760px, calc(var(--tg-app-viewport-stable-height, 100dvh) - ${theme.spacing.lg * 2}px - var(--screen-top-offset) - var(--screen-bottom-offset)))`,
    minHeight: `min(640px, calc(var(--tg-app-viewport-stable-height, 100dvh) - ${theme.spacing.lg * 2}px - var(--screen-top-offset) - var(--screen-bottom-offset)))`,
    width: '100%',
    minWidth: 0,
  },
  stepTopZone: {
    flexShrink: 0,
    width: '100%',
    minWidth: 0,
  },
  stepMiddleZone: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    width: '100%',
    boxSizing: 'border-box',
    paddingRight: 0,
    paddingBottom: theme.spacing.sm,
    scrollbarGutter: 'stable',
    overflowAnchor: 'none',
  },
  stepBottomZone: {
    flexShrink: 0,
    paddingTop: theme.spacing.md,
  },

  // Header
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    background: 'none',
    border: 'none',
    padding: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    transition: `transform ${theme.transitions.fast}, opacity ${theme.transitions.fast}`,
  },
  backButtonSpacer: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  stepIndicator: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
  },
  stepSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xxl,
  },

  // Avatar
  avatarCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  avatarOuter: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: '50%',
    cursor: 'pointer',
    transition: `transform ${theme.transitions.fast}, opacity ${theme.transitions.fast}`,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    border: `2px solid ${theme.colors.border}`,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: theme.colors.card,
    border: `2px dashed ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `3px solid ${theme.colors.bg}`,
  },
  avatarLoading: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundColor: theme.colors.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    marginTop: 10,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
  },

  // Form fields
  field: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  labelOptional: {
    marginLeft: 6,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.normal,
  },
  input: {
    width: '100%',
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Search
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    marginBottom: theme.spacing.lg,
  },
  searchInput: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    background: 'none',
    border: 'none',
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    outline: 'none',
  },
  clearSearch: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    transition: `transform ${theme.transitions.fast}, opacity ${theme.transitions.fast}`,
  },

  // Campus list
  campusList: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  campusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    width: '100%',
    boxSizing: 'border-box',
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.lg,
    border: `1.5px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    cursor: 'pointer',
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
    textAlign: 'left',
  },
  campusIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  campusInfo: {
    flex: 1,
    minWidth: 0,
  },
  campusName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  campusCity: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptySearch: {
    width: '100%',
    textAlign: 'center',
    padding: '32px 16px',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
    border: `1.5px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  },
  customButton: {
    width: '100%',
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px dashed ${theme.colors.border}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
    marginBottom: 0,
  },

  // Selected campus badge
  selectedCampus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    border: `1.5px solid ${theme.colors.primary}40`,
    marginBottom: theme.spacing.xl,
  },
  selectedCampusInfo: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  selectedCampusText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  changeCampusBtn: {
    background: 'none',
    border: 'none',
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    padding: '4px 8px',
    transition: `transform ${theme.transitions.fast}, opacity ${theme.transitions.fast}`,
  },

  // Chips (faculties)
  chipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.full,
    border: `1.5px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
  },
  chipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },

  // Course chips
  courseRow: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  courseChip: {
    flex: 1,
    padding: `${theme.spacing.md}px 0`,
    borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    cursor: 'pointer',
    textAlign: 'center',
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
  },
  courseChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },

  // Buttons
  primaryButton: {
    width: '100%',
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: '#fff',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
    boxShadow: `0 6px 16px ${theme.colors.primaryGlow}`,
    marginTop: theme.spacing.lg,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.card,
    color: theme.colors.textDisabled,
    border: `1.5px solid ${theme.colors.border}`,
    boxShadow: 'none',
    cursor: 'not-allowed',
    opacity: 1,
  },
  primaryButtonPinned: {
    marginTop: 0,
  },
};


// ========================================
// CSS animations
// ========================================

const onboardingStyles = `
  @keyframes onb-slide-right {
    from { opacity: 0; transform: translate3d(12px, 0, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes onb-slide-left {
    from { opacity: 0; transform: translate3d(-12px, 0, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes onb-fade-up {
    from { opacity: 0; transform: translate3d(0, 6px, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
  }
  @keyframes onb-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .onb-step-frame {
    width: 100%;
    min-width: 0;
  }
  .onb-slide-right { animation: onb-slide-right 0.32s cubic-bezier(0.22, 1, 0.36, 1); }
  .onb-slide-left  { animation: onb-slide-left 0.32s cubic-bezier(0.22, 1, 0.36, 1); }
  .onb-fade-up     { animation: onb-fade-up 0.36s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .onb-fade-in     { animation: onb-fade-in 0.24s ease-out both; }
  .onb-pressable:active {
    opacity: 0.9;
  }
`;


export default Onboarding;



