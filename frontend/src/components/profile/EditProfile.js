// ===== 📄 ФАЙЛ: src/components/profile/EditProfile.js =====

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Camera, User, AtSign, Search,
  Building2, Hash, GraduationCap, MapPin, ChevronLeft,
} from 'lucide-react';
import { useStore } from '../../store';
import { updateUserProfile, uploadUserAvatar } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import theme from '../../theme';
import { Z_EDIT_PROFILE } from '../../constants/zIndex';
import {
  COURSES, searchCampuses, getFacultiesForCampus,
  getCampusById, ONBOARDING_LIMITS,
} from '../../constants/universityData';

const normalizeText = (value) => String(value ?? '').trim();

const normalizeUsername = (value) => normalizeText(value).replace(/^@/, '');


function EditProfile() {
  const { user, setUser, setShowEditModal } = useStore();

  // === Основные поля ===
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // === Кампус ===
  const [campusId, setCampusId] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customUni, setCustomUni] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [customFaculty, setCustomFaculty] = useState('');
  const [course, setCourse] = useState(null);
  const [group, setGroup] = useState('');

  // === UI ===
  const [showCampusPicker, setShowCampusPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  // Инициализация из user
  useEffect(() => {
    if (!user) return;

    setName(user.name || '');
    setUsername(user.username || '');
    setAvatarPreview(user.avatar);
    setCourse(user.course || null);
    setGroup(user.group || '');

    if (user.campus_id) {
      setCampusId(user.campus_id);
      setIsCustom(false);
      setFaculty(user.institute || '');
      // Проверяем: если institute не из списка факультетов кампуса — это "Другой"
      const campus = getCampusById(user.campus_id);
      if (campus && user.institute && !campus.faculties.includes(user.institute)) {
        setFaculty('Другой');
        setCustomFaculty(user.institute);
      }
    } else if (user.custom_university) {
      setIsCustom(true);
      setCampusId(null);
      setCustomUni(user.custom_university || '');
      setCustomCity(user.custom_city || '');
      setCustomFaculty(user.custom_faculty || user.institute || '');
    } else {
      // Legacy: user.university/institute есть, но campus_id нет
      setIsCustom(true);
      setCustomUni(user.university || '');
      setCustomCity(user.city || '');
      setCustomFaculty(user.institute || '');
    }
  }, [user]);

  const selectedCampus = useMemo(
    () => (campusId ? getCampusById(campusId) : null),
    [campusId]
  );

  const faculties = useMemo(
    () => (selectedCampus ? getFacultiesForCampus(selectedCampus.id) : []),
    [selectedCampus]
  );

  const filteredCampuses = useMemo(
    () => searchCampuses(searchQuery),
    [searchQuery]
  );

  // Текущий display кампуса
  const campusDisplay = selectedCampus
    ? selectedCampus.short
    : isCustom
      ? (customUni || 'Свой ВУЗ')
      : 'Не выбран';

  const initialProfileState = useMemo(() => {
    if (!user) {
      return {
        name: '',
        username: '',
        campusId: null,
        isCustom: false,
        customUni: '',
        customCity: '',
        finalFaculty: '',
        course: null,
        group: '',
      };
    }

    const hasCampus = Boolean(user.campus_id);
    const isCustomUniversity = !hasCampus && Boolean(user.custom_university || user.university);

    return {
      name: normalizeText(user.name),
      username: normalizeUsername(user.username),
      campusId: hasCampus ? user.campus_id : null,
      isCustom: isCustomUniversity,
      customUni: isCustomUniversity ? normalizeText(user.custom_university || user.university) : '',
      customCity: isCustomUniversity ? normalizeText(user.custom_city || user.city) : '',
      finalFaculty: normalizeText(user.custom_faculty || user.institute),
      course: user.course || null,
      group: normalizeText(user.group),
    };
  }, [user]);

  const finalFaculty = useMemo(() => {
    if (isCustom) return normalizeText(customFaculty);
    if (faculty === 'Другой') return normalizeText(customFaculty);
    return normalizeText(faculty);
  }, [customFaculty, faculty, isCustom]);

  const currentProfileState = useMemo(() => {
    return {
      name: normalizeText(name),
      username: normalizeUsername(username),
      campusId: isCustom ? null : (campusId || null),
      isCustom,
      customUni: isCustom ? normalizeText(customUni) : '',
      customCity: isCustom ? normalizeText(customCity) : '',
      finalFaculty,
      course: course || null,
      group: normalizeText(group),
    };
  }, [campusId, course, customCity, customUni, finalFaculty, group, isCustom, name, username]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(initialProfileState) !== JSON.stringify(currentProfileState);
  }, [currentProfileState, initialProfileState]);

  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    setTimeout(() => setShowEditModal(false), 340);
  }, [isExiting, setShowEditModal]);

  const handleBack = useCallback(() => {
    if (loading || isExiting) return;

    hapticFeedback('light');

    if (showCampusPicker) {
      setShowCampusPicker(false);
      return;
    }

    handleClose();
  }, [handleClose, isExiting, loading, showCampusPicker]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    hapticFeedback('selection');
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);

    try {
      setLoading(true);
      const data = await uploadUserAvatar(file);
      if (data?.avatar) {
        setUser({ ...user, avatar: data.avatar });
        toast.success('Фото обновлено');
      }
    } catch (error) {
      console.error('Ошибка загрузки фото', error);
      toast.error('Не удалось загрузить фото');
      setAvatarPreview(user.avatar);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampus = useCallback((campus) => {
    hapticFeedback('medium');
    setCampusId(campus.id);
    setIsCustom(false);
    setFaculty('');
    setCustomFaculty('');
    setShowCampusPicker(false);
    setSearchQuery('');
  }, []);

  const handleCustomMode = useCallback(() => {
    hapticFeedback('light');
    setIsCustom(true);
    setCampusId(null);
    setFaculty('');
    setShowCampusPicker(false);
    setSearchQuery('');
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Введите имя');
      return;
    }

    hapticFeedback('success');
    setLoading(true);

    try {
      const cleanUsername = username.replace(/^@/, '').trim();

      const finalFaculty = isCustom
        ? customFaculty.trim() || null
        : (faculty === 'Другой' ? customFaculty.trim() || null : faculty || null);

      const updateData = {
        name: name.trim(),
        username: cleanUsername,
        course: course,
        group: group.trim() || null,
        institute: finalFaculty,
      };

      if (selectedCampus) {
        updateData.campus_id = selectedCampus.id;
        updateData.university = selectedCampus.university;
        updateData.city = selectedCampus.city;
        updateData.custom_university = null;
        updateData.custom_city = null;
        updateData.custom_faculty = null;
      } else if (isCustom && customUni.trim()) {
        updateData.campus_id = null;
        updateData.university = customUni.trim();
        updateData.custom_university = customUni.trim();
        updateData.custom_city = customCity.trim() || null;
        updateData.city = customCity.trim() || null;
        updateData.custom_faculty = finalFaculty;
      }

      const updatedUser = await updateUserProfile(updateData);
      setUser(updatedUser);
      toast.success('Профиль обновлён');
      handleClose();
    } catch (error) {
      console.error('Ошибка сохранения', error);
      if (error.response?.status === 403) {
        toast.error(error.response.data.detail || 'Нельзя часто менять учебные данные');
      } else {
        toast.error('Ошибка сохранения изменений');
      }
    } finally {
      setLoading(false);
    }
  };


  // ============ РЕНДЕР: выбор кампуса (отдельный экран) ============
  const canSave = !loading && hasUnsavedChanges && Boolean(name.trim());

  useTelegramScreen({
    id: 'edit-profile-screen',
    title: showCampusPicker ? 'Выбор ВУЗа' : 'Редактирование профиля',
    priority: 120,
    back: {
      visible: true,
      onClick: handleBack,
    },
    main: {
      visible: !showCampusPicker && hasUnsavedChanges,
      text: 'Сохранить изменения',
      onClick: handleSave,
      enabled: canSave,
      loading,
      color: theme.colors.primary,
    },
  });

  if (showCampusPicker) {
    return (
      <div style={{ ...styles.overlay, animation: isExiting ? 'epSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards' : 'epSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards' }}>
        <div style={styles.container}>
          <DrilldownHeader title="Выбор ВУЗа" onBack={handleBack} />

          <div style={styles.scrollContent}>
            {/* Поиск */}
            <div style={styles.searchWrapper}>
              <Search size={18} color={theme.colors.textTertiary} />
              <input
                type="text"
                placeholder="Найти ВУЗ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
                autoFocus
              />
              {searchQuery && (
                <button style={styles.clearBtn} onClick={() => setSearchQuery('')}>
                  <X size={16} color={theme.colors.textTertiary} />
                </button>
              )}
            </div>

            {/* Список */}
            {filteredCampuses.map((campus) => (
              <button
                key={campus.id}
                style={{
                  ...styles.campusRow,
                  ...(campusId === campus.id ? { borderColor: theme.colors.primary } : {}),
                }}
                onClick={() => handleSelectCampus(campus)}
              >
                <div style={styles.campusIconWrap}>
                  <Building2 size={18} color={theme.colors.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.campusRowName}>{campus.university}</div>
                  <div style={styles.campusRowCity}>
                    {campus.city}{campus.address ? `, ${campus.address}` : ''}
                  </div>
                </div>
              </button>
            ))}

            {filteredCampuses.length === 0 && searchQuery && (
              <div style={styles.emptySearch}>Ничего не найдено</div>
            )}

            {/* Ручной ввод */}
            <button style={styles.customBtn} onClick={handleCustomMode}>
              Нет моего ВУЗа — ввести вручную
            </button>
          </div>
        </div>
        <style>{`
          @keyframes epSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes epSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
        `}</style>
      </div>
    );
  }


  // ============ РЕНДЕР: основная форма ============
  return (
    <div style={{ ...styles.overlay, animation: isExiting ? 'epSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards' : 'epSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards' }}>
      <div style={styles.container}>

        {/* HEADER */}
        <DrilldownHeader title="Редактирование" onBack={handleBack} />

        <div style={styles.scrollContent}>

          {/* AVATAR */}
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper}>
              {avatarPreview ? (
                <img src={avatarPreview} style={styles.avatarImg} alt="avatar" />
              ) : (
                <div style={styles.avatarPlaceholder}>{name?.[0] || '?'}</div>
              )}
              <label style={styles.cameraButton}>
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <Camera size={20} color="#000" />
              </label>
            </div>
            <div style={styles.avatarHint}>Нажмите для изменения</div>
          </div>

          {/* ОСНОВНОЕ */}
          <div style={styles.sectionTitle}>ОСНОВНОЕ</div>
          <div style={styles.card}>
            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}><User size={18} color={theme.colors.textDisabled} /></div>
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                maxLength={ONBOARDING_LIMITS.NAME_MAX}
              />
            </div>

            <div style={styles.divider} />

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}><AtSign size={18} color="#D4FF00" /></div>
              <input
                style={{ ...styles.input, color: '#D4FF00', fontWeight: theme.fontWeight.medium }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                maxLength={ONBOARDING_LIMITS.USERNAME_MAX}
              />
            </div>
          </div>

          {/* УЧЁБА */}
          <div style={styles.sectionTitle}>УЧЁБА</div>
          <div style={styles.card}>

            {/* Кампус — кликабельная строка */}
            <button
              style={styles.inputGroup}
              onClick={() => { hapticFeedback('light'); setShowCampusPicker(true); }}
            >
              <div style={styles.inputIcon}><GraduationCap size={18} color={theme.colors.textDisabled} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: theme.fontSize.lg, color: theme.colors.text }}>
                  {campusDisplay}
                </div>
              </div>
              <ChevronLeft size={16} color={theme.colors.textTertiary} style={{ transform: 'rotate(180deg)' }} />
            </button>

            {/* Custom: название ВУЗа + город */}
            {isCustom && (
              <>
                <div style={styles.divider} />
                <div style={styles.inputGroup}>
                  <div style={styles.inputIcon}><Building2 size={18} color={theme.colors.textDisabled} /></div>
                  <input
                    style={styles.input}
                    value={customUni}
                    onChange={(e) => setCustomUni(e.target.value)}
                    placeholder="Название ВУЗа"
                    maxLength={ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MAX}
                  />
                </div>
                <div style={styles.divider} />
                <div style={styles.inputGroup}>
                  <div style={styles.inputIcon}><MapPin size={18} color={theme.colors.textDisabled} /></div>
                  <input
                    style={styles.input}
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Город"
                    maxLength={ONBOARDING_LIMITS.CUSTOM_CITY_MAX}
                  />
                </div>
              </>
            )}

            <div style={styles.divider} />

            {/* Факультет: чипсы или текст */}
            {selectedCampus && faculties.length > 0 ? (
              <div style={{ padding: `${theme.spacing.md}px ${theme.spacing.lg}px` }}>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, marginBottom: 8 }}>
                  Факультет / Институт
                </div>
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
                    style={{ ...styles.input, marginTop: 8, padding: `${theme.spacing.sm}px 0` }}
                    value={customFaculty}
                    onChange={(e) => setCustomFaculty(e.target.value)}
                    placeholder="Введите название..."
                    maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
                  />
                )}
              </div>
            ) : isCustom ? (
              <div style={styles.inputGroup}>
                <div style={styles.inputIcon}><Building2 size={18} color={theme.colors.textDisabled} /></div>
                <input
                  style={styles.input}
                  value={customFaculty}
                  onChange={(e) => setCustomFaculty(e.target.value)}
                  placeholder="Факультет / Институт"
                  maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
                />
              </div>
            ) : null}

            <div style={styles.divider} />

            {/* Курс + Группа */}
            <div style={{ padding: `${theme.spacing.md}px ${theme.spacing.lg}px` }}>
              <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, marginBottom: 8 }}>
                Курс
              </div>
              <div style={styles.courseRow}>
                {COURSES.map((c) => (
                  <button
                    key={c}
                    style={{
                      ...styles.courseChip,
                      ...(course === c ? styles.courseChipActive : {}),
                    }}
                    onClick={() => { hapticFeedback('selection'); setCourse(c); }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.divider} />

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}><Hash size={18} color={theme.colors.textDisabled} /></div>
              <input
                style={styles.input}
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="Группа"
                maxLength={ONBOARDING_LIMITS.GROUP_MAX}
              />
            </div>
          </div>

          <div style={{ height: hasUnsavedChanges ? 8 : 0 }} />
        </div>

      </div>

      <style>{`
        @keyframes epSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes epSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        select option { background-color: #1C1C1E; color: #fff; padding: 10px; }
      `}</style>
    </div>
  );
}


const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000000',
    zIndex: Z_EDIT_PROFILE,
    display: 'flex', flexDirection: 'column',
  },
  container: {
    flex: 1, display: 'flex', flexDirection: 'column',
    backgroundColor: '#000000', height: '100%',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: theme.spacing.xl,
    paddingLeft: theme.spacing.xl,
    paddingRight: theme.spacing.xl,
    paddingBottom: `calc(${theme.spacing.xl}px + var(--screen-bottom-offset))`,
  },

  // Avatar
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: theme.spacing.xxxl },
  avatarWrapper: { position: 'relative', width: 100, height: 100 },
  avatarImg: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' },
  avatarPlaceholder: {
    width: '100%', height: '100%', borderRadius: '50%',
    backgroundColor: '#2C2C2E', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 40, color: '#8E8E93', fontWeight: theme.fontWeight.bold,
  },
  cameraButton: {
    position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: '50%',
    backgroundColor: '#D4FF00', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '3px solid #000000', cursor: 'pointer', boxShadow: theme.shadows.md,
  },
  avatarHint: { marginTop: theme.spacing.md, fontSize: theme.fontSize.sm, color: '#8E8E93' },

  // Sections
  sectionTitle: {
    fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold,
    color: '#8E8E93', marginBottom: 8, paddingLeft: 12, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1C1C1E', borderRadius: theme.radius.lg,
    overflow: 'hidden', marginBottom: theme.spacing.xxl,
    border: '1px solid rgba(255,255,255,0.06)',
  },

  // Inputs
  inputGroup: {
    display: 'flex', alignItems: 'center', minHeight: 48,
    padding: `0 ${theme.spacing.lg}px`, background: 'none', border: 'none',
    width: '100%', cursor: 'pointer',
  },
  inputIcon: { marginRight: 12, display: 'flex', alignItems: 'center' },
  input: {
    flex: 1, background: 'transparent', border: 'none', color: '#FFFFFF',
    fontSize: theme.fontSize.lg, height: '100%', outline: 'none', padding: '12px 0',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 46 },

  // Campus picker
  searchWrapper: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.md, border: '1px solid rgba(255,255,255,0.08)',
    backgroundColor: '#1C1C1E', marginBottom: theme.spacing.lg,
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none',
    color: '#FFFFFF', fontSize: theme.fontSize.lg, outline: 'none',
  },
  clearBtn: { background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' },
  campusRow: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, borderRadius: theme.radius.md,
    border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1C1C1E',
    marginBottom: theme.spacing.sm, cursor: 'pointer', width: '100%',
    textAlign: 'left', transition: `all ${theme.transitions.normal}`,
  },
  campusIconWrap: {
    width: 40, height: 40, borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(212,255,0,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  campusRowName: { fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.semibold, color: '#FFFFFF', marginBottom: 2 },
  campusRowCity: { fontSize: theme.fontSize.sm, color: '#8E8E93' },
  emptySearch: { textAlign: 'center', padding: '32px 16px', color: '#8E8E93', fontSize: theme.fontSize.md },
  customBtn: {
    width: '100%', padding: theme.spacing.lg, borderRadius: theme.radius.md,
    border: '2px dashed rgba(255,255,255,0.15)', backgroundColor: 'transparent',
    color: '#8E8E93', fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium, cursor: 'pointer',
    marginTop: theme.spacing.md,
  },

  // Chips
  chipsWrap: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`, borderRadius: theme.radius.full,
    border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#2C2C2E',
    color: '#8E8E93', fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium, cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
  },
  chipActive: {
    borderColor: '#D4FF00', backgroundColor: 'rgba(212,255,0,0.1)',
    color: '#D4FF00',
  },

  // Course
  courseRow: { display: 'flex', gap: theme.spacing.sm },
  courseChip: {
    flex: 1, padding: `${theme.spacing.sm}px 0`, borderRadius: theme.radius.sm,
    border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#2C2C2E',
    color: '#8E8E93', fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold, cursor: 'pointer', textAlign: 'center',
    transition: `all ${theme.transitions.normal}`,
  },
  courseChipActive: {
    borderColor: '#D4FF00', backgroundColor: 'rgba(212,255,0,0.1)',
    color: '#D4FF00',
  },

};

export default EditProfile;
