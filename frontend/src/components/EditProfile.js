import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { updateUserProfile, getCurrentUser } from '../api';
import { Z_EDIT_PROFILE } from '../constants/zIndex';

// TODO: перелопатить логику "возможности редактирования КРИТИЧЕСКИХ полей"

function EditProfile() {
  const { user, setUser, showEditModal, setShowEditModal } = useStore();

  const universities = useMemo(() => ['МГСУ', 'РУК'], []);
  const institutes = useMemo(
    () => ['ИЦИТ', 'ИСА', 'ИЭУИС', 'Юридический', 'Экономический'],
    []
  );

  const buildFormDataFromUser = (u) => ({
    name: u?.name || '',
    age: u?.age ?? '',
    bio: u?.bio || '',
    university: u?.university || 'МГСУ',
    institute: u?.institute || 'ИЦИТ',
    course: u?.course || 1,
    group: u?.group || ''
  });

  const [formData, setFormData] = useState(() => buildFormDataFromUser(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Пока открылась модалка, но user ещё не подтянулся — держим критичные поля заблокированными
  const [refreshingUser, setRefreshingUser] = useState(false);

  // Подтянуть актуального user при открытии формы (чтобы last_profile_edit был точно свежим)
  useEffect(() => {
    if (!showEditModal) return;

    let cancelled = false;
    setRefreshingUser(true);

    (async () => {
      try {
        const freshUser = await getCurrentUser();
        if (!cancelled) setUser(freshUser);
      } catch (e) {
        // игнор: UI всё равно работает
      } finally {
        if (!cancelled) setRefreshingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showEditModal, setUser]);

  // Синхронизация формы с user при открытии/обновлении user
  useEffect(() => {
    if (!showEditModal) return;
    setFormData(buildFormDataFromUser(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditModal, user?.id, user?.updated_at, user?.last_profile_edit]);

  // Парсер даты с бэка (микросекунды + без TZ)
  const parseServerDate = (value) => {
    if (!value) return null;
    let s = String(value).trim();

    // "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
    s = s.replace(' ', 'T');

    // ".123456" -> ".123" (Safari/WebView часто не ест 6 цифр)
    s = s.replace(/\.(\d{3})\d+/, '.$1');

    // Если нет таймзоны, считаем что UTC (у тебя datetime.utcnow на бэке)
    if (!/[zZ]$|[+-]\d\d:\d\d$/.test(s)) s += 'Z';

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getCooldownDaysLeft = () => {
    if (!user || !user.last_profile_edit) return 0;

    const lastEdit = parseServerDate(user.last_profile_edit);
    if (!lastEdit) return 0;

    const daysPassed = Math.floor((Date.now() - lastEdit.getTime()) / 86400000);
    return Math.max(0, 30 - daysPassed);
  };

  const cooldownDays = getCooldownDaysLeft();
  const isCooldownActive = cooldownDays > 0;

  // Важно: блокируем критичные поля, пока обновляется user, чтобы нельзя было “успеть кликнуть”
  const isCriticalLocked = refreshingUser || isCooldownActive;

  const hasChanges = () => {
    if (!user) return false;
    return (
      formData.name !== (user.name || '') ||
      String(formData.age ?? '') !== String(user.age ?? '') ||
      formData.bio !== (user.bio || '') ||
      (!isCriticalLocked && formData.university !== (user.university || '')) ||
      (!isCriticalLocked && formData.institute !== (user.institute || '')) ||
      (!isCriticalLocked && formData.course !== (user.course || 1)) ||
      formData.group !== (user.group || '')
    );
  };

  // Никаких confirm/alert — просто закрываем
  const handleClose = () => {
    hapticFeedback('light');
    setShowEditModal(false);
  };

  // Telegram BackButton
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && showEditModal) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleClose);

      return () => {
        tg.BackButton.hide();
        tg.BackButton.offClick(handleClose);
      };
    }
  }, [showEditModal, formData]); // formData чтобы back работал “актуально”

  const handleSave = async () => {
    if (!user) return;

    if (!formData.name.trim()) {
      setError('Имя или никнейм не может быть пустым');
      hapticFeedback('error');
      return;
    }

    if (formData.age !== '') {
      const ageNum = parseInt(formData.age, 10);
      if (Number.isNaN(ageNum) || ageNum < 16 || ageNum > 100) {
        setError('Возраст должен быть числом от 16 до 100');
        hapticFeedback('error');
        return;
      }
    }

    setError('');
    setSaving(true);

    try {
      const updateData = {
        name: formData.name.trim(),
        age: formData.age === '' ? null : parseInt(formData.age, 10),
        bio: formData.bio.trim() || null,
        group: formData.group.trim() || null
      };

      // Критичные поля отправляем ТОЛЬКО когда они разрешены
      if (!isCriticalLocked) {
        updateData.university = formData.university;
        updateData.institute = formData.institute;
        updateData.course = formData.course;
      }

      await updateUserProfile(updateData);

      // Жёстко синхронизируем user после сохранения
      const freshUser = await getCurrentUser();
      setUser(freshUser);

      hapticFeedback('success');
      setShowEditModal(false);
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Не удалось сохранить изменения';
      setError(errorMsg);
      hapticFeedback('error');
    } finally {
      setSaving(false);
    }
  };

  if (!showEditModal) return null;

  const LockedField = ({ value }) => (
    <div
      style={{
        ...styles.select,
        opacity: 0.5,
        cursor: 'not-allowed',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {value}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .edit-enter { animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .fade-in { animation: fade-in 0.3s ease-out; }

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div style={styles.overlay} className="fade-in">
        <div style={styles.container} className="edit-enter">
          <div style={styles.header}>
            <h1 style={styles.title}>Редактирование профиля</h1>
            <p style={styles.subtitle}>Измените данные о себе</p>
          </div>

          <div style={styles.content}>
            <div style={styles.field}>
              <label style={styles.label}>Имя или никнейм</label>
              <input
                type="text"
                placeholder="Иван Иванов или @ivan_coder"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={styles.input}
                maxLength={100}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#8774e1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
              <div style={styles.hint}>Можете указать реальное имя или ник</div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Возраст (опционально)</label>
              <input
                type="number"
                placeholder="20"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                style={styles.input}
                min={16}
                max={100}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#8774e1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
              <div style={styles.hint}>Это поле можно оставить пустым</div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>О себе (опционально)</label>
              <textarea
                placeholder="Расскажите о своих интересах, хобби..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                style={styles.textarea}
                rows={4}
                maxLength={500}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#8774e1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
              <div style={styles.bioFooter}>
                <div style={styles.hint}>Это поле можно оставить пустым</div>
                <div style={styles.charCount}>{formData.bio.length}/500</div>
              </div>
            </div>

            {/* Университет (критичное) */}
            <div style={styles.field}>
              <label style={styles.label}>Университет</label>

              {isCriticalLocked ? (
                <LockedField value={formData.university} />
              ) : (
                <select
                  value={formData.university}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  style={styles.select}
                >
                  {universities.map((uni) => (
                    <option key={uni} value={uni}>
                      {uni}
                    </option>
                  ))}
                </select>
              )}

              {isCooldownActive && (
                <div style={styles.cooldownActiveHint}>
                  ⏱ Изменить можно через {cooldownDays} {cooldownDays === 1 ? 'день' : 'дней'}
                </div>
              )}
            </div>

            {/* Институт (критичное) */}
            <div style={styles.field}>
              <label style={styles.label}>Институт</label>

              {isCriticalLocked ? (
                <LockedField value={formData.institute} />
              ) : (
                <select
                  value={formData.institute}
                  onChange={(e) => setFormData({ ...formData, institute: e.target.value })}
                  style={styles.select}
                >
                  {institutes.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              )}

              {isCooldownActive && (
                <div style={styles.cooldownActiveHint}>
                  ⏱ Изменить можно через {cooldownDays} {cooldownDays === 1 ? 'день' : 'дней'}
                </div>
              )}
            </div>

            {/* Курс (критичное) */}
            <div style={styles.field}>
              <label style={styles.label}>Курс</label>

              {isCriticalLocked ? (
                <LockedField value={`${formData.course} курс`} />
              ) : (
                <select
                  value={formData.course}
                  onChange={(e) =>
                    setFormData({ ...formData, course: parseInt(e.target.value, 10) })
                  }
                  style={styles.select}
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} курс
                    </option>
                  ))}
                </select>
              )}

              {isCooldownActive && (
                <div style={styles.cooldownActiveHint}>
                  ⏱ Изменить можно через {cooldownDays} {cooldownDays === 1 ? 'день' : 'дней'}
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Группа (опционально)</label>
              <input
                type="text"
                placeholder="БИ-21"
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                style={styles.input}
                maxLength={100}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#8774e1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
              <div style={styles.hint}>Это поле можно оставить пустым</div>
            </div>

            {error && <div style={styles.error}>⚠️ {error}</div>}
          </div>

          <div style={styles.footer}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...styles.saveButton,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения 💾'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#121212',
    zIndex: Z_EDIT_PROFILE,
    overflowY: 'auto'
  },
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '24px',
    paddingBottom: '100px'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    marginTop: '40px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#8774e1',
    fontWeight: '500'
  },
  content: {
    marginBottom: '24px'
  },
  field: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#999',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  textarea: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    resize: 'none',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  select: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer'
  },
  hint: {
    fontSize: '13px',
    color: '#666',
    marginTop: '6px'
  },
  cooldownActiveHint: {
    fontSize: '13px',
    color: '#ff6b6b',
    marginTop: '6px',
    fontWeight: '600'
  },
  bioFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px'
  },
  charCount: {
    fontSize: '12px',
    color: '#666'
  },
  error: {
    padding: '12px 16px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    border: '1px solid rgba(255, 59, 48, 0.3)',
    color: '#ff3b30',
    fontSize: '14px',
    marginTop: '16px'
  },
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 24px',
    backgroundColor: '#121212',
    borderTop: '1px solid #333'
  },
  saveButton: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
    display: 'block',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  }
};

export default EditProfile;