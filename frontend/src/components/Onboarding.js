// ===== 📄 ФАЙЛ: frontend/src/components/Onboarding.js =====

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Camera, User, AtSign, Search, GraduationCap, Building2, ChevronLeft, X } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { uploadUserAvatar } from '../api';
import { toast } from './shared/Toast';
import theme from '../theme';
import { Z_ONBOARDING_MAIN } from '../constants/zIndex';
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

  const goToStep = useCallback((step, forward = true) => {
    setDirection(forward ? 'forward' : 'backward');
    setTimeout(() => setOnboardingStep(step), 50);
  }, [setOnboardingStep]);

  const renderStep = () => {
    const animClass = direction === 'forward' ? 'onb-slide-right' : 'onb-slide-left';

    switch (onboardingStep) {
      case 1:
        return (
          <div className={animClass} key="step1">
            <StepAboutYou
              onboardingData={onboardingData}
              setOnboardingData={setOnboardingData}
              onNext={() => goToStep(2, true)}
            />
          </div>
        );
      case 2:
        return (
          <div className={animClass} key="step2">
            <StepEducation
              onboardingData={onboardingData}
              setOnboardingData={setOnboardingData}
              onBack={() => goToStep(1, false)}
              onFinish={finishRegistration}
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
// ШАГ 1: Фото + Имя + Username
// ========================================

function StepAboutYou({ onboardingData, setOnboardingData, onNext }) {
  const [name, setName] = useState(onboardingData.name || '');
  const [username, setUsername] = useState(onboardingData.username || '');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isValid = name.trim().length >= ONBOARDING_LIMITS.NAME_MIN;

  const handleAvatarPick = () => {
    hapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Превью сразу
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);

    // Загрузка на сервер
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
        setAvatarPreview(null);
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

  return (
    <div style={styles.stepContent}>
      <div style={styles.stepIndicator}>Шаг 1 из 2</div>
      <div style={styles.stepTitle}>Представьтесь</div>
      <div style={styles.stepSubtitle}>Как вас будут видеть другие студенты</div>

      {/* Аватар */}
      <div style={styles.avatarCenter}>
        <div style={styles.avatarOuter} onClick={handleAvatarPick}>
          {avatarPreview ? (
            <img src={avatarPreview} alt="" style={styles.avatarImg} />
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
        <div style={styles.avatarHint}>Добавить фото</div>
      </div>

      {/* Имя */}
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
          style={{ ...styles.input, color: theme.colors.primary }}
          maxLength={ONBOARDING_LIMITS.USERNAME_MAX}
          autoCapitalize="none"
        />
        <div style={styles.hint}>Чтобы вас могли найти</div>
      </div>

      <button
        style={{
          ...styles.primaryButton,
          opacity: isValid ? 1 : 0.5,
        }}
        onClick={handleNext}
        disabled={!isValid}
        className="onb-fade-up"
      >
        Далее
      </button>
    </div>
  );
}


// ========================================
// ШАГ 2: Кампус + Факультет + Курс + Группа
// ========================================

function StepEducation({ onboardingData, setOnboardingData, onBack, onFinish }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customUni, setCustomUni] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [customFaculty, setCustomFaculty] = useState('');
  const [course, setCourse] = useState(null);
  const [group, setGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSelectedCampus(campus);
    setIsCustom(false);
    setFaculty('');
    setCustomFaculty('');
  }, []);

  const handleCustomMode = useCallback(() => {
    hapticFeedback('light');
    setIsCustom(true);
    setSelectedCampus(null);
    setFaculty('');
  }, []);

  const handleBack = () => {
    hapticFeedback('light');
    onBack();
  };

  const handleResetCampus = () => {
    hapticFeedback('light');
    setSelectedCampus(null);
    setIsCustom(false);
    setSearchQuery('');
    setFaculty('');
    setCustomFaculty('');
    setCourse(null);
    setGroup('');
  };

  // Валидация: кампус или custom uni обязательны
  const hasValidCampus = selectedCampus || (isCustom && customUni.trim().length >= ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MIN);

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

    await onFinish(data);
    setSubmitting(false);
  };

  // ========== РЕНДЕР: выбор кампуса ==========
  if (!selectedCampus && !isCustom) {
    return (
      <div style={styles.stepContent}>
        <div style={styles.stepHeader}>
          <button style={styles.backButton} onClick={handleBack}>
            <ChevronLeft size={22} color={theme.colors.text} />
          </button>
          <div style={styles.stepIndicator}>Шаг 2 из 2</div>
          <div style={{ width: 40 }} />
        </div>

        <div style={styles.stepTitle}>
          <GraduationCap size={28} color={theme.colors.primary} style={{ marginRight: 10 }} />
          Где учитесь?
        </div>

        {/* Поиск */}
        <div style={styles.searchWrapper} className="onb-fade-up">
          <Search size={18} color={theme.colors.textTertiary} />
          <input
            type="text"
            placeholder="Найти ВУЗ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {searchQuery && (
            <button style={styles.clearSearch} onClick={() => setSearchQuery('')}>
              <X size={16} color={theme.colors.textTertiary} />
            </button>
          )}
        </div>

        {/* Список кампусов */}
        <div style={styles.campusList}>
          {filteredCampuses.map((campus, index) => (
            <button
              key={campus.id}
              style={{ ...styles.campusCard, animationDelay: `${index * 0.05}s` }}
              className="onb-fade-up"
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
            <div style={styles.emptySearch} className="onb-fade-up">
              Ничего не найдено
            </div>
          )}
        </div>

        {/* Кнопка "Нет моего" */}
        <button
          style={styles.customButton}
          className="onb-fade-up"
          onClick={handleCustomMode}
        >
          Нет моего ВУЗа — ввести вручную
        </button>
      </div>
    );
  }

  // ========== РЕНДЕР: детали (факультет, курс, группа) ==========
  return (
    <div style={styles.stepContent}>
      <div style={styles.stepHeader}>
        <button style={styles.backButton} onClick={handleBack}>
          <ChevronLeft size={22} color={theme.colors.text} />
        </button>
        <div style={styles.stepIndicator}>Шаг 2 из 2</div>
        <div style={{ width: 40 }} />
      </div>

      {/* Выбранный кампус */}
      <div style={styles.selectedCampus} className="onb-fade-up">
        <div style={styles.selectedCampusInfo}>
          <Building2 size={18} color={theme.colors.primary} />
          <span style={styles.selectedCampusText}>
            {selectedCampus ? selectedCampus.short : customUni || 'Свой ВУЗ'}
          </span>
        </div>
        <button style={styles.changeCampusBtn} onClick={handleResetCampus}>
          Изменить
        </button>
      </div>

      {/* Custom ВУЗ (если ввод вручную) */}
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

      {/* Факультет */}
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

      {/* Custom — факультет свободный текст */}
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

      {/* Курс */}
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

      {/* Группа */}
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

      {/* Кнопка завершения */}
      <button
        style={{
          ...styles.primaryButton,
          opacity: hasValidCampus && !submitting ? 1 : 0.5,
          marginTop: 8,
        }}
        onClick={handleFinish}
        disabled={!hasValidCampus || submitting}
        className="onb-fade-up"
      >
        {submitting ? 'Регистрация...' : 'Завершить регистрацию 🎉'}
      </button>

      <div style={{ height: 40 }} />
    </div>
  );
}


// ========================================
// СТИЛИ
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
    padding: `${theme.spacing.xl}px`,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    paddingBottom: 40,
  },
  stepContent: {
    position: 'relative',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    transition: `border-color ${theme.transitions.normal}`,
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
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    marginBottom: theme.spacing.lg,
  },
  searchInput: {
    flex: 1,
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
  },

  // Campus list
  campusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    maxHeight: '55vh',
    overflowY: 'auto',
  },
  campusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.lg,
    border: `1.5px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
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
    textAlign: 'center',
    padding: '32px 16px',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
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
    transition: `all ${theme.transitions.normal}`,
    marginBottom: theme.spacing.lg,
  },

  // Selected campus badge
  selectedCampus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    border: `1.5px solid ${theme.colors.primary}40`,
    marginBottom: theme.spacing.xl,
  },
  selectedCampusInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selectedCampusText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  changeCampusBtn: {
    background: 'none',
    border: 'none',
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    padding: '4px 8px',
  },

  // Chips (факультеты)
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
    transition: `all ${theme.transitions.normal}`,
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
    transition: `all ${theme.transitions.normal}`,
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
    transition: `all ${theme.transitions.normal}`,
    boxShadow: `0 8px 24px ${theme.colors.primaryGlow}`,
    marginTop: theme.spacing.lg,
  },
};


// ========================================
// CSS-АНИМАЦИИ
// ========================================

const onboardingStyles = `
  @keyframes onb-slide-right {
    from { opacity: 0; transform: translateX(30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes onb-slide-left {
    from { opacity: 0; transform: translateX(-30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes onb-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .onb-slide-right { animation: onb-slide-right 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  .onb-slide-left  { animation: onb-slide-left 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  .onb-fade-up     { animation: onb-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
`;


export default Onboarding;