// ===== 📄 ФАЙЛ: frontend/src/components/profile/SettingsModal.js =====
import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell, BellOff, Heart, MessageCircle, Package,
  HelpCircle, TrendingUp, BarChart3, Info,
} from 'lucide-react';

import { useStore } from '../../store';
import { getNotificationSettings, updateNotificationSettings } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';


function SettingsModal() {
  const { showSettingsModal, setShowSettingsModal } = useStore();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Загрузка настроек при открытии
  useEffect(() => {
    if (showSettingsModal) {
      loadSettings();
    }
  }, [showSettingsModal]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Settings load error:', error);
      toast.error('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    hapticFeedback('light');
    setShowSettingsModal(false);
  }, [setShowSettingsModal]);

  // Optimistic toggle с API-вызовом
  const handleToggle = useCallback(async (key) => {
    if (!settings) return;
    hapticFeedback('light');

    const newValue = !settings[key];

    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: newValue }));

    try {
      await updateNotificationSettings({ [key]: newValue });
    } catch (error) {
      // Откат при ошибке
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Ошибка сохранения');
    }
  }, [settings]);

  // Мастер-переключатель "Выключить всё"
  const handleMuteAll = useCallback(async () => {
    if (!settings) return;
    hapticFeedback('medium');

    const newMute = !settings.mute_all;
    setSettings(prev => ({ ...prev, mute_all: newMute }));

    try {
      await updateNotificationSettings({ mute_all: newMute });
      if (newMute) {
        toast.info('Все уведомления выключены');
      } else {
        toast.success('Уведомления включены');
      }
    } catch (error) {
      setSettings(prev => ({ ...prev, mute_all: !newMute }));
      toast.error('Ошибка сохранения');
    }
  }, [settings]);

  // Переключение частоты дайджеста
  const handleDigestFrequency = useCallback(async (freq) => {
    if (!settings) return;
    hapticFeedback('selection');

    setSettings(prev => ({ ...prev, digest_frequency: freq }));

    try {
      await updateNotificationSettings({ digest_frequency: freq });
    } catch (error) {
      setSettings(prev => ({ ...prev, digest_frequency: freq === 'daily' ? 'weekly' : 'daily' }));
      toast.error('Ошибка сохранения');
    }
  }, [settings]);

  if (!showSettingsModal) return null;

  const isMuted = settings?.mute_all;

  // Custom Title Component
  const customTitle = (
    <div style={styles.titleWrapper}>
      <span style={styles.headerEmoji}>⚙️</span>
      <span>Настройки</span>
    </div>
  );

  return (
    <SwipeableModal
      isOpen={showSettingsModal}
      onClose={handleClose}
      showHeaderDivider={false}
      title={customTitle}
    >
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>Загрузка...</span>
          </div>
        ) : settings ? (
          <>
            {/* Мастер-переключатель */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: 'solid',
                background: isMuted
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(16, 185, 129, 0.1)',
                borderColor: isMuted
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(16, 185, 129, 0.3)',
                marginBottom: 20,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={handleMuteAll}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isMuted
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(16, 185, 129, 0.2)',
              }}>
                {isMuted
                  ? <BellOff size={22} color="#ef4444" />
                  : <Bell size={22} color="#10b981" />
                }
              </div>
              <div style={styles.muteText}>
                <span style={styles.muteTitle}>
                  {isMuted ? 'Уведомления выключены' : 'Уведомления включены'}
                </span>
                <span style={styles.muteSubtitle}>
                  {isMuted ? 'Нажми чтобы включить' : 'Нажми чтобы выключить все'}
                </span>
              </div>
              <Toggle value={!isMuted} />
            </div>

            {/* Секция уведомлений */}
            <div style={{
              ...styles.section,
              opacity: isMuted ? 0.4 : 1,
              pointerEvents: isMuted ? 'none' : 'auto',
              transition: 'opacity 0.3s',
            }}>
              <div style={styles.sectionTitle}>🔔 Уведомления</div>

              <ToggleRow
                icon={<Heart size={18} color="#ff3b5c" />}
                label="Матчи"
                description="Взаимные лайки в Dating"
                value={settings.matches_enabled}
                onChange={() => handleToggle('matches_enabled')}
              />

              <ToggleRow
                icon={<Heart size={18} color="#ff6b9d" />}
                label="Лайки в Dating"
                description="Кто-то оценил профиль"
                value={settings.dating_likes_enabled}
                onChange={() => handleToggle('dating_likes_enabled')}
              />

              <ToggleRow
                icon={<MessageCircle size={18} color="#8b5cf6" />}
                label="Комментарии"
                description="Новые комментарии и ответы"
                value={settings.comments_enabled}
                onChange={() => handleToggle('comments_enabled')}
              />

              <ToggleRow
                icon={<Package size={18} color="#10b981" />}
                label="Маркет"
                description="Отклики на товары и follow-up"
                value={settings.market_enabled}
                onChange={() => handleToggle('market_enabled')}
              />

              <ToggleRow
                icon={<HelpCircle size={18} color="#3b82f6" />}
                label="Запросы"
                description="Отклики на запросы и follow-up"
                value={settings.requests_enabled}
                onChange={() => handleToggle('requests_enabled')}
              />

              <ToggleRow
                icon={<TrendingUp size={18} color="#f59e0b" />}
                label="Достижения"
                description="Пост набрал 10/50/100 лайков"
                value={settings.milestones_enabled}
                onChange={() => handleToggle('milestones_enabled')}
              />
            </div>

            {/* Секция дайджеста */}
            <div style={{
              ...styles.section,
              opacity: isMuted ? 0.4 : 1,
              pointerEvents: isMuted ? 'none' : 'auto',
              transition: 'opacity 0.3s',
            }}>
              <div style={styles.sectionTitle}>📊 Дайджест</div>

              <ToggleRow
                icon={<BarChart3 size={18} color="#8774e1" />}
                label="Сводка активности"
                description="Лайки, комментарии, просмотры"
                value={settings.digest_enabled}
                onChange={() => handleToggle('digest_enabled')}
              />

              {settings.digest_enabled && (
                <div style={styles.frequencyRow}>
                  <span style={styles.frequencyLabel}>Частота:</span>
                  <div style={styles.frequencyButtons}>
                    {['daily', 'weekly'].map((freq) => {
                      const isActive = settings.digest_frequency === freq;
                      return (
                        <button
                          key={freq}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: `1px solid ${isActive ? 'rgba(212,255,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            background: isActive ? 'rgba(212,255,0,0.1)' : 'transparent',
                            color: isActive ? '#D4FF00' : '#8E8E93',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => handleDigestFrequency(freq)}
                        >
                          {freq === 'daily' ? 'Ежедневно' : 'Еженедельно'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Секция "О приложении" */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Другое</div>

              <div style={styles.infoRow}>
                <Info size={16} color={theme.colors.textTertiary} />
                <span style={styles.infoText}>CampusApp v2.1.0</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </SwipeableModal>
  );
}


// =============================================
// Подкомпоненты
// =============================================

const Toggle = ({ value }) => (
  <div style={{
    width: 44,
    height: 24,
    borderRadius: 12,
    position: 'relative',
    flexShrink: 0,
    transition: 'background 0.2s',
    background: value ? '#D4FF00' : 'rgba(255,255,255,0.12)',
  }}>
    <div style={{
      width: 20,
      height: 20,
      borderRadius: 10,
      background: value ? '#000' : '#fff',
      position: 'absolute',
      top: 2,
      left: 2,
      transition: 'transform 0.2s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      transform: value ? 'translateX(20px)' : 'translateX(0)',
    }} />
  </div>
);


const ToggleRow = ({ icon, label, description, value, onChange }) => (
  <div style={styles.toggleRow} onClick={onChange}>
    <div style={styles.toggleRowIcon}>{icon}</div>
    <div style={styles.toggleRowText}>
      <span style={styles.toggleRowLabel}>{label}</span>
      {description && (
        <span style={styles.toggleRowDesc}>{description}</span>
      )}
    </div>
    <Toggle value={value} />
  </div>
);


// =============================================
// Стили
// =============================================

const styles = {
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: '#FFFFFF',
  },

  headerEmoji: {
    fontSize: 22,
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
    gap: 12,
  },

  spinner: {
    width: 32,
    height: 32,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: '#D4FF00',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Мастер-переключатель текст
  muteText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  muteTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#FFFFFF',
  },

  muteSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Секции
  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingLeft: 4,
  },

  // Toggle rows
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#1C1C1E',
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  toggleRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#2C2C2E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  toggleRowText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },

  toggleRowLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
  },

  toggleRowDesc: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Дайджест частота
  frequencyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 14,
    background: '#1C1C1E',
    marginBottom: 6,
    border: '1px solid rgba(255,255,255,0.06)',
  },

  frequencyLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: 500,
  },

  frequencyButtons: {
    display: 'flex',
    gap: 6,
  },

  // О приложении
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  infoText: {
    fontSize: 13,
    color: '#8E8E93',
  },
};


export default SettingsModal;
