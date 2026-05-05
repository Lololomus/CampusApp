// ===== 📄 ФАЙЛ: src/components/profile/EditProfile.js =====
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X, Plus, User, AtSign, Search,
  GraduationCap, ChevronLeft, Info, Lock, MessageCircle, ArrowLeft,
} from 'lucide-react';
import { useStore } from '../../store';
import { updateUserProfile, uploadUserAvatar } from '../../api';
import { normalizeTelegramUsername } from '../../utils/telegramUsername';
import { compressImage } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import SwipeableModal from '../shared/SwipeableModal';
import { BOTTOM_SHEET_EXIT_MS } from '../../hooks/useBottomSheetModal';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import CampusLogoAvatar from '../shared/CampusLogoAvatar';
import FacultyGraphPicker from '../shared/FacultyGraphPicker';
import theme from '../../theme';
import { Z_EDIT_PROFILE } from '../../constants/zIndex';
import {
  searchCampuses,
  getCampusById, getFacultiesForCampus, ONBOARDING_LIMITS,
} from '../../constants/universityData';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const normalizeText = (value) => String(value ?? '').trim();
const normalizeUsername = (value) => normalizeText(value).replace(/^@/, '');

// ============================================================
// Шторка: учёба заморожена
// ============================================================

function EduLockedSheet({ daysLeft, onClose }) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, BOTTOM_SHEET_EXIT_MS);
  };

  return (
    <SwipeableModal isOpen={isOpen} onClose={handleClose} zIndex={10001}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 8 }}>
        <div style={sheetStyles.iconBox}>
          <Lock size={32} color="#FF9F0A" />
        </div>

        <h2 style={sheetStyles.title}>Учёба заморожена</h2>
        <p style={sheetStyles.subtitle}>
          Изменить ВУЗ и курс можно раз в 30 дней — чтобы не обходить фильтры сообщества.
        </p>

        <div style={sheetStyles.cooldownBox}>
          <span style={sheetStyles.cooldownNum}>{daysLeft}</span>
          <span style={sheetStyles.cooldownLabel}>
            {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} до разморозки
          </span>
        </div>

        <button type="button" style={sheetStyles.closeBtn} onClick={handleClose}>
          Понятно
        </button>
      </div>
    </SwipeableModal>
  );
}

const sheetStyles = {
  iconBox: {
    width: 72, height: 72, borderRadius: 24,
    background: 'rgba(255,159,10,0.12)',
    border: '1px solid rgba(255,159,10,0.2)',
    boxShadow: '0 0 24px rgba(255,159,10,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, flexShrink: 0,
  },
  title: {
    margin: '0 0 10px', fontSize: 24, fontWeight: 800,
    color: '#FFFFFF', letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '0 0 24px', fontSize: 15,
    color: '#8E8E93', lineHeight: 1.5, maxWidth: 280,
  },
  cooldownBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'rgba(255,159,10,0.08)',
    border: '1px solid rgba(255,159,10,0.18)',
    borderRadius: 20, padding: '18px 40px', marginBottom: 24, width: '100%',
    boxSizing: 'border-box',
  },
  cooldownNum: {
    fontSize: 48, fontWeight: 900, color: '#FF9F0A', lineHeight: 1,
    letterSpacing: '-2px',
  },
  cooldownLabel: { fontSize: 14, color: 'rgba(255,159,10,0.7)', marginTop: 4, fontWeight: 600 },
  closeBtn: {
    width: '100%', background: '#2C2C2E', border: 'none',
    color: '#fff', padding: 18, borderRadius: 20,
    fontSize: 17, fontWeight: 700, cursor: 'pointer',
  },
};



// ============================================================
// Основной компонент
// ============================================================

function EditProfile() {
  const { user, setUser, setShowEditModal } = useStore();
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // === Основные поля ===
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // === Кампус ===
  const [campusId, setCampusId] = useState(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customUni, setCustomUni] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [course, setCourse] = useState(null);
  const [institute, setInstitute] = useState('');

  // === Приватность ===
  const [showTelegramId, setShowTelegramId] = useState(false);

  // === UI ===
  const [showCampusPicker, setShowCampusPicker] = useState(false);
  const [showEduLockedSheet, setShowEduLockedSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const canEditEdu = user?.can_edit_edu !== false;
  const eduCooldownDays = user?.edu_cooldown_days ?? 0;
  const hasUsedFreeChange = Boolean(user?.last_profile_edit);

  const isDev = import.meta.env.DEV;
  const isDesktop = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
  const showLocalBack = isDev || isDesktop;

  useBodyScrollLock();

  // Инициализация из user
  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setUsername(user.username || '');
    setAvatarPreview(user.avatar);
    setShowTelegramId(Boolean(user.show_telegram_id));
    // Нормализуем курс в строку для корректного сравнения с chip-значениями
    setCourse(user.course != null ? String(user.course) : null);
    setInstitute(user.institute || user.custom_faculty || '');

    if (user.campus_id) {
      setCampusId(user.campus_id);
      setIsCustom(false);
    } else if (user.custom_university) {
      setIsCustom(true);
      setCampusId(null);
      setCustomUni(user.custom_university || '');
      setCustomCity(user.custom_city || '');
    } else {
      setIsCustom(true);
      setCustomUni(user.university || '');
      setCustomCity(user.city || '');
    }
  }, [user]);

  // Автофокус на поиск при открытии пикера
  useEffect(() => {
    if (!showCampusPicker) return;
    const timer = setTimeout(() => {
      try { searchInputRef.current?.focus({ preventScroll: true }); } catch { searchInputRef.current?.focus(); }
    }, 400);
    return () => clearTimeout(timer);
  }, [showCampusPicker]);

  const selectedCampus = useMemo(() => (campusId ? getCampusById(campusId) : null), [campusId]);
  const campusFaculties = useMemo(() => (campusId ? getFacultiesForCampus(campusId) : []), [campusId]);
  const filteredCampuses = useMemo(() => searchCampuses(searchQuery), [searchQuery]);

  const initialProfileState = useMemo(() => {
    if (!user) return { name: '', username: '', campusId: null, isCustom: false, customUni: '', customCity: '', course: null, institute: '', showTelegramId: false };
    const hasCampus = Boolean(user.campus_id);
    const isCustomUniversity = !hasCampus && Boolean(user.custom_university || user.university);
    return {
      name: normalizeText(user.name),
      username: normalizeUsername(user.username),
      campusId: hasCampus ? user.campus_id : null,
      isCustom: isCustomUniversity,
      customUni: isCustomUniversity ? normalizeText(user.custom_university || user.university) : '',
      customCity: isCustomUniversity ? normalizeText(user.custom_city || user.city) : '',
      // Нормализуем в строку — иначе 2 !== '2' → hasUnsavedChanges всегда true
      course: user.course != null ? String(user.course) : null,
      institute: normalizeText(user.institute || user.custom_faculty),
      showTelegramId: Boolean(user.show_telegram_id),
    };
  }, [user]);

  const currentProfileState = useMemo(() => ({
    name: normalizeText(name),
    username: normalizeUsername(username),
    campusId: isCustom ? null : (campusId || null),
    isCustom,
    customUni: isCustom ? normalizeText(customUni) : '',
    customCity: isCustom ? normalizeText(customCity) : '',
    course: course || null,
    institute: normalizeText(institute),
    showTelegramId,
  }), [campusId, course, customCity, customUni, institute, isCustom, name, showTelegramId, username]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(initialProfileState) !== JSON.stringify(currentProfileState),
    [currentProfileState, initialProfileState]
  );

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    setTimeout(() => setShowEditModal(false), 340);
  }, [isExiting, setShowEditModal]);

  const handleBack = useCallback(() => {
    if (loading || isExiting) return;
    hapticFeedback('light');
    if (showCampusPicker) { setShowCampusPicker(false); return; }
    handleClose();
  }, [handleClose, isExiting, loading, showCampusPicker]);

  const handleCloseImmediate = useCallback(() => {
    if (isExiting) return;
    setShowEditModal(false);
  }, [isExiting, setShowEditModal]);

  const handleEdgeSwipeIntercept = useCallback(() => {
    if (loading || isExiting) return true;
    if (!showCampusPicker) return false;
    hapticFeedback('light');
    setShowCampusPicker(false);
    return true;
  }, [isExiting, loading, showCampusPicker]);

  // Аватар: сжать → локальный превью → загрузить
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    hapticFeedback('selection');
    setAvatarProcessing(true);

    try {
      const compressed = await compressImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(compressed);

      const data = await uploadUserAvatar(compressed);
      if (data?.avatar) {
        setUser({ ...user, avatar: data.avatar });
        toast.success('Фото обновлено');
      }
    } catch (err) {
      toast.error(err.message || 'Не удалось загрузить фото');
      setAvatarPreview(user?.avatar || null);
    } finally {
      setAvatarProcessing(false);
    }
  };

  const handleSelectCampus = useCallback((campus) => {
    hapticFeedback('medium');
    setCampusId(campus.id);
    setIsCustom(false);
    setInstitute((current) => (campus.faculties.includes(current) ? current : ''));
    setShowCampusPicker(false);
    setSearchQuery('');
  }, []);

  const handleCustomMode = useCallback(() => {
    hapticFeedback('light');
    setIsCustom(true);
    setCampusId(null);
    setInstitute('');
    setShowCampusPicker(false);
    setSearchQuery('');
  }, []);

  const handleSelectInstitute = useCallback((value) => {
    hapticFeedback('selection');
    if (!canEditEdu) {
      setShowEduLockedSheet(true);
      return;
    }
    setInstitute(value);
  }, [canEditEdu]);

  const handleLockedEduClick = useCallback(() => {
    hapticFeedback('light');
    setShowEduLockedSheet(true);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Введите имя'); return; }
    hapticFeedback('success');
    setLoading(true);
    try {
      const cleanUsername = username.replace(/^@/, '').trim();
      // Конвертируем курс обратно в число для API (Выпускник → null)
      const courseNum = course === 'Выпускник' ? null : (course ? Number(course) : null);

      const updateData = {
        name: name.trim(),
        username: cleanUsername,
        course: courseNum,
        institute: institute.trim() || null,
        show_telegram_id: showTelegramId,
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
        updateData.custom_faculty = institute.trim() || null;
      }

      const updatedUser = await updateUserProfile(updateData);
      setUser(updatedUser);
      toast.success('Профиль обновлён');
      handleClose();
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(error.response.data.detail || 'Нельзя часто менять учебные данные');
      } else {
        toast.error('Ошибка сохранения изменений');
      }
    } finally {
      setLoading(false);
    }
  };

  const canSave = !loading && hasUnsavedChanges && Boolean(name.trim());

  useTelegramScreen({
    id: 'edit-profile-screen',
    title: showCampusPicker ? 'Выбор ВУЗа' : 'Редактирование профиля',
    priority: 120,
    back: { visible: true, onClick: handleBack },
    main: {
      visible: false,
      text: 'Сохранить изменения',
      onClick: handleSave,
      enabled: canSave,
      loading,
      color: '#D4FF00',
    },
  });

  const slideStyle = {
    ...styles.overlay,
    animation: isExiting
      ? 'epSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
      : 'epSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
  };

  return (
    <EdgeSwipeBack
      onBack={handleCloseImmediate}
      onInterceptBack={handleEdgeSwipeIntercept}
      disabled={isExiting || showEduLockedSheet}
      zIndex={Z_EDIT_PROFILE}
    >
    <div style={slideStyle}>
      <style>{slideCSS}</style>
      <div style={styles.container}>

        {/* Back button — только в DEV/desktop, в Telegram не нужен */}
        {showLocalBack && (
          <button
            type="button"
            onClick={handleBack}
            style={styles.devBackButton}
            aria-label="Назад"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {/* Sliding track: панель 1 = форма, панель 2 = пикер ВУЗа */}
        <div style={styles.trackWrapper}>
          <div style={{
            ...styles.track,
            transform: showCampusPicker ? 'translateX(-50%)' : 'translateX(0)',
          }}>

            {/* ── Панель 1: основная форма ── */}
            <div style={styles.panel}>
              <div style={styles.scrollContent}>

                {/* АВАТАР */}
                <div style={styles.avatarSection}>
                  <div
                    style={{ position: 'relative', cursor: 'pointer' }}
                    onClick={() => { hapticFeedback('light'); fileInputRef.current?.click(); }}
                  >
                    <div style={{ ...styles.avatarSquare, ...(avatarProcessing ? styles.avatarProcessing : {}) }}>
                      {avatarPreview ? (
                        <img src={avatarPreview} style={styles.avatarImg} alt="avatar" />
                      ) : (
                        <User size={40} color="#8E8E93" />
                      )}
                    </div>
                    <div style={styles.avatarPlusBadge}>
                      <Plus size={20} color="#000" strokeWidth={3} />
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                  <div style={styles.avatarHint}>
                    {avatarProcessing ? 'Загрузка...' : 'Нажмите для изменения'}
                  </div>
                </div>

                {/* ОСНОВНОЕ */}
                <div style={styles.sectionTitle}>ОСНОВНОЕ</div>
                <div style={styles.card}>
                  <div style={styles.inputGroup}>
                    <div style={styles.inputIcon}><User size={18} color="#8E8E93" /></div>
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
                      style={{ ...styles.input, color: '#D4FF00', fontWeight: 500 }}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ник в Campus (не Telegram)"
                      autoCapitalize="none"
                      maxLength={ONBOARDING_LIMITS.USERNAME_MAX}
                    />
                  </div>
                </div>

                {/* ПРИВАТНОСТЬ */}
                <div style={styles.sectionTitle}>ПРИВАТНОСТЬ</div>
                <div style={styles.card}>
                  <div style={privacyStyles.row}>
                    <div style={privacyStyles.iconWrap}>
                      <MessageCircle size={18} color="#8E8E93" />
                    </div>
                    <div style={privacyStyles.textBlock}>
                      <div style={privacyStyles.label}>Показывать контакт в Telegram</div>
                      <div style={privacyStyles.desc}>Другие смогут написать вам напрямую в маркете и дейтинге</div>
                    </div>
                    <button
                      type="button"
                      style={{ ...privacyStyles.toggle, ...(showTelegramId ? privacyStyles.toggleOn : {}) }}
                      onClick={() => { hapticFeedback('selection'); setShowTelegramId(v => !v); }}
                    >
                      <div style={{ ...privacyStyles.thumb, ...(showTelegramId ? privacyStyles.thumbOn : {}) }} />
                    </button>
                  </div>
                  {showTelegramId && !normalizeTelegramUsername(user?.telegram_username) && (
                    <>
                      <div style={styles.divider} />
                      <div style={privacyStyles.warning}>
                        <Info size={15} color="#FF9F0A" style={{ flexShrink: 0 }} />
                        <span>У вас нет @username в Telegram — даже с включённым контактом написать вам не получится. Добавьте username в настройках Telegram.</span>
                      </div>
                    </>
                  )}
                </div>

                {/* УЧЁБА */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={styles.sectionTitle}>УЧЁБА</div>
                  {!canEditEdu && (
                    <div style={styles.eduLockedBadge}>
                      <Lock size={11} color="#FF9F0A" />
                      <span>{eduCooldownDays} дн.</span>
                    </div>
                  )}
                </div>

                {/* Предупреждение: следующее изменение запустит cooldown */}
                {canEditEdu && hasUsedFreeChange && (
                  <div style={{ ...styles.customInfoBox, marginBottom: 12 }}>
                    <Info size={18} color="#FF9F0A" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                      После сохранения изменить учёбу снова можно будет через <strong style={{ color: '#FF9F0A' }}>30 дней</strong>.
                    </span>
                  </div>
                )}

                {/* Выбранный кампус */}
                {selectedCampus ? (
                  <div style={{ ...styles.selectedCampusCard, ...(!canEditEdu ? styles.eduLockedSection : {}) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                      <CampusLogoAvatar campus={selectedCampus} size={64} radius={18} letterSize={20} />
                      <div style={styles.campusInfo}>
                        <span style={{ ...styles.campusName, fontSize: 20 }}>{selectedCampus.short}</span>
                        <span style={styles.campusCity}>{selectedCampus.fullName}</span>
                      </div>
                    </div>
                    <button
                      style={{ ...styles.changeBtn, ...(!canEditEdu ? styles.changeBtnLocked : {}) }}
                      onClick={() => {
                        hapticFeedback('light');
                        if (!canEditEdu) { setShowEduLockedSheet(true); return; }
                        setShowCampusPicker(true);
                      }}
                    >
                      {canEditEdu ? 'Изменить' : <Lock size={14} color="#8E8E93" />}
                    </button>
                  </div>
                ) : isCustom ? (
                  <div style={{ ...styles.customCard, ...(!canEditEdu ? styles.eduLockedSection : {}) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Свой ВУЗ</span>
                      <button
                        style={{ ...styles.changeBtn, ...(!canEditEdu ? styles.changeBtnLocked : {}) }}
                        onClick={() => {
                          hapticFeedback('light');
                          if (!canEditEdu) { setShowEduLockedSheet(true); return; }
                          setShowCampusPicker(true);
                        }}
                      >
                        {canEditEdu ? 'Изменить' : <Lock size={14} color="#8E8E93" />}
                      </button>
                    </div>
                    <input
                      style={{ ...styles.customInput, marginBottom: 12, ...(!canEditEdu ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}
                      value={customUni}
                      onChange={(e) => setCustomUni(e.target.value)}
                      placeholder="Название ВУЗа"
                      maxLength={ONBOARDING_LIMITS.CUSTOM_UNIVERSITY_MAX}
                      readOnly={!canEditEdu}
                    />
                    <input
                      style={{ ...styles.customInput, ...(!canEditEdu ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="Город (необязательно)"
                      maxLength={ONBOARDING_LIMITS.CUSTOM_CITY_MAX}
                      readOnly={!canEditEdu}
                    />
                    <div style={{ ...styles.customInfoBox, marginTop: 16 }}>
                      <Info size={20} color="#FF9F0A" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                        ВУЗ на проверке — после аппрува заработает умный поиск однокурсников.
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    style={{ ...styles.campusPickerTrigger, ...(!canEditEdu ? styles.eduLockedSection : {}) }}
                    onClick={() => {
                      hapticFeedback('light');
                      if (!canEditEdu) { setShowEduLockedSheet(true); return; }
                      setShowCampusPicker(true);
                    }}
                  >
                    <div style={styles.inputIcon}><GraduationCap size={18} color="#8E8E93" /></div>
                    <span style={{ flex: 1, textAlign: 'left', color: '#8E8E93', fontSize: 16 }}>Выберите ВУЗ</span>
                    {canEditEdu
                      ? <ChevronLeft size={16} color="#8E8E93" style={{ transform: 'rotate(180deg)' }} />
                      : <Lock size={16} color="#8E8E93" />}
                  </button>
                )}

                {/* Курс — 3 колонки + Выпускник */}
                <div style={styles.card}>
                  <div style={{ padding: '12px 16px 0' }}>
                    <div style={styles.fieldLabel}>Курс</div>
                    <div style={styles.courseGrid}>
                      {['1', '2', '3', '4', '5', '6'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          style={{
                            ...styles.courseCell,
                            ...(course === c ? styles.courseCellActive : {}),
                            ...(!canEditEdu ? styles.eduControlLocked : {}),
                          }}
                          onClick={() => {
                            if (!canEditEdu) { handleLockedEduClick(); return; }
                            hapticFeedback('selection');
                            setCourse(c);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                      <button
                        type="button"
                        style={{
                          ...styles.courseCell,
                          ...styles.courseCellWide,
                          ...(course === 'Выпускник' ? styles.courseCellActive : {}),
                          ...(!canEditEdu ? styles.eduControlLocked : {}),
                        }}
                        onClick={() => {
                          if (!canEditEdu) { handleLockedEduClick(); return; }
                          hapticFeedback('selection');
                          setCourse('Выпускник');
                        }}
                      >
                        Уже выпускник 🎓
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 16 }} />
                  <div style={styles.divider} />

                  <div style={styles.facultySection}>
                    <div style={styles.fieldLabel}>Институт / факультет</div>

                    {selectedCampus ? (
                      <div style={selectedCampus.facultyGraph ? styles.facultyGraphShell : styles.eduTree}>
                        {selectedCampus.facultyGraph ? (
                          <FacultyGraphPicker
                            campus={selectedCampus}
                            value={institute}
                            onSelect={handleSelectInstitute}
                            disabled={!canEditEdu}
                            onDisabledClick={handleLockedEduClick}
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
                                        style={{
                                          ...styles.facultyChip,
                                          ...(isActive ? styles.facultyChipActive : {}),
                                          ...(!canEditEdu ? styles.eduControlLocked : {}),
                                        }}
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
                              <div style={styles.pathEmpty}>Выберите свой институт или факультет</div>
                            )}
                          </>
                        )}
                      </div>
                    ) : isCustom ? (
                      <div>
                        <input
                          style={{ ...styles.customInput, ...(!canEditEdu ? styles.eduInputLocked : {}) }}
                          value={institute}
                          onChange={(e) => setInstitute(e.target.value)}
                          placeholder="Например, Экономический факультет"
                          maxLength={ONBOARDING_LIMITS.CUSTOM_FACULTY_MAX}
                          readOnly={!canEditEdu}
                          onClick={() => { if (!canEditEdu) handleLockedEduClick(); }}
                        />
                        <div style={{ ...styles.customInfoBox, marginTop: 12 }}>
                          <Info size={18} color="#8E8E93" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.4 }}>
                            Для своего ВУЗа подразделение вводится вручную.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.facultyDisabled}>
                        <GraduationCap size={18} color="#8E8E93" />
                        <span>Сначала выберите ВУЗ</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.bottomSpacer} />
              </div>
            </div>

            {/* ── Панель 2: пикер ВУЗа ── */}
            <div style={styles.panel}>
              <div style={styles.scrollContent}>

                <div style={styles.searchWrapper}>
                  <Search size={20} color="#8E8E93" style={{ flexShrink: 0 }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Название или город"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                    autoFocus={false}
                    autoCapitalize="none"
                  />
                  {searchQuery && (
                    <button style={styles.clearBtn} onClick={() => setSearchQuery('')}>
                      <X size={16} color="#8E8E93" />
                    </button>
                  )}
                </div>

                <div style={styles.campusList}>
                  {filteredCampuses.map((campus) => (
                    <button
                      key={campus.id}
                      style={{
                        ...styles.campusCard,
                        ...(campusId === campus.id ? styles.campusCardActive : {}),
                      }}
                      onClick={() => handleSelectCampus(campus)}
                    >
                      <CampusLogoAvatar campus={campus} size={48} radius={14} />
                      <div style={styles.campusInfo}>
                        <span style={{ ...styles.campusName, ...(campusId === campus.id ? { color: '#000' } : {}) }}>
                          {campus.short}
                        </span>
                        <span style={{ ...styles.campusCity, ...(campusId === campus.id ? { color: 'rgba(0,0,0,0.6)' } : {}) }}>
                          {campus.fullName} · {campus.city}
                        </span>
                      </div>
                    </button>
                  ))}
                  {filteredCampuses.length === 0 && searchQuery && (
                    <div style={styles.emptySearch}>Ничего не найдено</div>
                  )}
                </div>

                <button style={styles.addCustomUniBtn} onClick={handleCustomMode}>
                  <div style={styles.addCustomUniIcon}><Plus size={18} color="#8E8E93" /></div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Нет моего ВУЗа</div>
                    <div style={{ fontSize: 13, color: '#8E8E93' }}>Ввести вручную (через модерацию)</div>
                  </div>
                </button>

              </div>
            </div>

          </div>
        </div>

        {/* Летающая кнопка сохранения */}
        {!showCampusPicker && (
          <div style={{
            ...styles.floatingFooter,
            opacity: canSave ? 1 : 0,
            pointerEvents: canSave ? 'auto' : 'none',
          }}>
            <button
              style={styles.saveButton}
              onClick={handleSave}
              disabled={!canSave}
            >
              {loading ? <div style={styles.saveSpinner} /> : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {/* Шторка заморозки — position:fixed, не зависит от трека */}
      {showEduLockedSheet && (
        <EduLockedSheet
          daysLeft={eduCooldownDays}
          onClose={() => setShowEduLockedSheet(false)}
        />
      )}
    </div>
    </EdgeSwipeBack>
  );
}


const SURFACE = '#1C1C1E';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = '#8E8E93';
const PRIMARY = '#D4FF00';
const BG = '#000';

const styles = {
  overlay: {
    position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
    backgroundColor: BG,
    zIndex: Z_EDIT_PROFILE,
    display: 'flex', flexDirection: 'column',
  },
  container: {
    flex: 1, display: 'flex', flexDirection: 'column',
    backgroundColor: BG, overflow: 'hidden',
  },

  // Sliding track
  trackWrapper: {
    flex: 1, overflow: 'hidden', position: 'relative',
  },
  track: {
    display: 'flex',
    width: '200%',
    height: '100%',
    transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
    willChange: 'transform',
  },
  panel: {
    width: '50%', height: '100%', flexShrink: 0, overflowY: 'auto',
  },
  scrollContent: {
    padding: `${theme.spacing.xl}px`,
    paddingTop: `calc(var(--screen-top-offset) + ${theme.spacing.xl}px)`,
    paddingBottom: `${theme.spacing.xl}px`,
  },

  bottomSpacer: {
    height: 96,
  },

  devBackButton: {
    position: 'absolute',
    top: 'calc(var(--screen-top-offset) + 8px)',
    left: 12,
    zIndex: 200,
    width: 44,
    height: 44,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#000000',
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: `16px ${theme.spacing.xl}px calc(16px + var(--screen-bottom-offset))`,
    background: 'linear-gradient(to top, #000000 60%, transparent)',
    pointerEvents: 'none',
    transition: 'opacity 0.2s',
  },

  saveButton: {
    width: '100%',
    minHeight: 56,
    background: PRIMARY,
    color: '#000',
    fontSize: 16,
    fontWeight: 800,
    border: 'none',
    borderRadius: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    boxShadow: '0 8px 24px rgba(212,255,0,0.25)',
  },

  saveSpinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(0,0,0,0.2)',
    borderTopColor: '#000',
    borderRadius: '50%',
    animation: 'epSpin 0.7s linear infinite',
  },

  // Аватар
  avatarSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  avatarSquare: {
    width: 110, height: 110, borderRadius: 40,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
    transition: 'opacity 0.2s',
  },
  avatarProcessing: { opacity: 0.5 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarPlusBadge: {
    position: 'absolute', bottom: -6, right: -6,
    width: 36, height: 36, borderRadius: 14,
    background: PRIMARY, border: `4px solid ${BG}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  avatarHint: { marginTop: 16, fontSize: theme.fontSize.sm, color: MUTED },

  // Sections
  sectionTitle: {
    fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold,
    color: MUTED, marginBottom: 8, paddingLeft: 4, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: SURFACE, borderRadius: theme.radius.lg,
    overflow: 'hidden', marginBottom: 16,
    border: `1px solid ${BORDER}`,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: 600, color: MUTED,
    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
  },

  // Inputs
  inputGroup: {
    display: 'flex', alignItems: 'center', minHeight: 48,
    padding: `0 ${theme.spacing.lg}px`, background: 'none', border: 'none',
    width: '100%', cursor: 'pointer',
  },
  inputIcon: { marginRight: 12, display: 'flex', alignItems: 'center' },
  input: {
    flex: 1, background: 'transparent', border: 'none', color: '#fff',
    fontSize: theme.fontSize.lg, height: '100%', outline: 'none', padding: '12px 0',
  },
  divider: { height: 1, backgroundColor: BORDER, marginLeft: 46 },

  customInput: {
    width: '100%', background: BG, border: `1px solid ${BORDER}`,
    color: '#fff', fontSize: 16, padding: '14px 16px',
    borderRadius: 14, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', WebkitAppearance: 'none',
  },

  // Campus trigger (кампус не выбран)
  campusPickerTrigger: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', borderRadius: 16,
    background: SURFACE, border: `1px solid ${BORDER}`,
    cursor: 'pointer', width: '100%', marginBottom: 16,
  },

  // Выбранный кампус на форме
  selectedCampusCard: {
    background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 20, padding: 16, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minWidth: 0,
  },
  changeBtn: {
    background: '#2C2C2E', border: 'none', color: '#fff',
    padding: '8px 16px', borderRadius: 12,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },

  // Свой ВУЗ
  customCard: {
    background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 20, padding: 16, marginBottom: 16,
  },
  customInfoBox: {
    display: 'flex', gap: 10, padding: 12,
    background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)',
    borderRadius: 12, alignItems: 'flex-start',
  },

  // Заморозка учёбы
  eduLockedBadge: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)',
    borderRadius: 999, padding: '3px 10px',
    fontSize: 12, fontWeight: 700, color: '#FF9F0A',
  },
  eduLockedSection: { opacity: 0.5, pointerEvents: 'none' },
  eduControlLocked: { opacity: 0.48 },
  eduInputLocked: { opacity: 0.48 },
  changeBtnLocked: {
    background: 'rgba(255,255,255,0.06)', color: '#8E8E93',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, padding: 0, borderRadius: 10,
  },

  // Курс
  courseGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
  },
  courseCell: {
    padding: '14px 0', borderRadius: 14,
    border: `1px solid ${BORDER}`, background: '#2C2C2E',
    color: '#fff', fontSize: 17, fontWeight: 800,
    cursor: 'pointer', textAlign: 'center',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  },
  courseCellActive: {
    background: PRIMARY, border: `1px solid ${PRIMARY}`, color: '#000',
  },
  courseCellWide: { gridColumn: 'span 3', fontSize: 15, fontWeight: 700 },

  // Институт / факультет
  facultySection: {
    padding: '14px 16px 16px',
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
    transition: 'background 0.16s, color 0.16s, border-color 0.16s, transform 0.16s',
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
  facultyDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BORDER}`,
    color: MUTED,
    fontSize: 15,
    fontWeight: 600,
  },

  // Поиск кампусов (панель 2)
  searchWrapper: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: SURFACE, border: `1px solid ${BORDER}`,
    borderRadius: 20, padding: '14px 20px', marginBottom: 16,
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none',
    color: '#fff', fontSize: 17, outline: 'none', fontFamily: 'inherit',
  },
  clearBtn: { background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' },

  campusList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  campusCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: 16, background: SURFACE, borderRadius: 20,
    border: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'background 0.2s, border-color 0.2s',
  },
  campusCardActive: {
    background: PRIMARY, border: `1px solid ${PRIMARY}`,
  },
  campusInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  campusName: { fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  campusCity: { fontSize: 14, color: MUTED, lineHeight: 1.25, minWidth: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' },
  emptySearch: { textAlign: 'center', padding: '32px 16px', color: MUTED, fontSize: 15 },
  addCustomUniBtn: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', background: SURFACE,
    border: `1px solid ${BORDER}`, borderRadius: 16,
    cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  addCustomUniIcon: {
    width: 36, height: 36, borderRadius: 10, background: '#2C2C2E',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
};

const privacyStyles = {
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    background: '#2C2C2E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1, minWidth: 0,
  },
  label: {
    fontSize: 15, fontWeight: 600, color: '#fff',
  },
  desc: {
    fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.4,
  },
  toggle: {
    width: 51, height: 31, borderRadius: 16,
    background: '#3A3A3C',
    border: 'none', padding: 2,
    display: 'flex', alignItems: 'center',
    cursor: 'pointer', flexShrink: 0,
    transition: 'background 0.2s',
  },
  toggleOn: {
    background: PRIMARY,
  },
  thumb: {
    width: 27, height: 27, borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    transition: 'transform 0.2s',
    transform: 'translateX(0)',
  },
  thumbOn: {
    transform: 'translateX(20px)',
  },
  warning: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '12px 16px',
    fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45,
  },
};

const slideCSS = `
  @keyframes epSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes epSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
  @keyframes epSpin { to { transform: rotate(360deg); } }
  input { -webkit-tap-highlight-color: transparent; }
  input::placeholder { color: #555; }
`;

export default EditProfile;
