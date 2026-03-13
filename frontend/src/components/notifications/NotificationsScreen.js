// ===== FILE: frontend/src/components/notifications/NotificationsScreen.js =====

import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart, ShoppingBag, MessageCircle, LifeBuoy, Flame, Check, X
} from 'lucide-react';

import DrilldownHeader from '../shared/DrilldownHeader';
import EdgeBlur from '../shared/EdgeBlur';
import { getNotifications, markAllNotificationsRead } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { Z_MODAL_NOTIFICATIONS_SCREEN } from '../../constants/zIndex';

// ========== КОНСТАНТЫ ==========

const COLORS = {
  bg: '#050505',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  muted: '#8E8E93',
  lime: '#D4FF00',
  success: '#32D74B',
  error: '#FF453A',
  badgeDating: '#FF2D55',
  badgeMarket: '#32D74B',
  badgeComment: '#A78BFA',
  badgeRequest: '#4DA6FF',
};

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'match', label: '🔥 Матчи' },
  { key: 'comment', label: '💬 Комменты' },
  { key: 'market', label: '🛒 Маркет' },
  { key: 'request', label: '🆘 Запросы' },
];

const TYPE_TO_FILTER = {
  match: 'match',
  dating_like: 'match',
  comment: 'comment',
  comment_reply: 'comment',
  market_contact: 'market',
  request_response: 'request',
};

const BADGE_CONFIG = {
  match: { icon: Heart, color: COLORS.badgeDating },
  dating_like: { icon: Heart, color: COLORS.badgeDating },
  comment: { icon: MessageCircle, color: COLORS.badgeComment },
  comment_reply: { icon: MessageCircle, color: COLORS.badgeComment },
  market_contact: { icon: ShoppingBag, color: COLORS.badgeMarket },
  request_response: { icon: LifeBuoy, color: COLORS.badgeRequest },
};

// ========== ХЕЛПЕРЫ ==========

function parseNotification(notif) {
  const p = notif.payload || {};

  switch (notif.type) {
    case 'match':
      return {
        userName: p.matched_name,
        userLetter: (p.matched_name || '?')[0].toUpperCase(),
        userColor: '#FF4D85',
        text: 'Взаимная симпатия! Напиши первым, пока собеседник онлайн.',
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    case 'dating_like':
      return {
        userName: null,
        userLetter: '❤️',
        userColor: null,
        text: 'Кто-то оценил твою анкету 👀',
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: true,
      };
    case 'comment':
      return {
        userName: p.commenter_name,
        userLetter: (p.commenter_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeComment,
        text: `прокомментировал(а) твой пост: "${p.comment_text || ''}"`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    case 'comment_reply':
      return {
        userName: p.replier_name,
        userLetter: (p.replier_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeComment,
        text: `ответил(а) на твой комментарий: "${p.comment_text || ''}"`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    case 'market_contact':
      return {
        userName: p.buyer_name,
        userLetter: (p.buyer_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeMarket,
        text: `хочет забрать твой "${p.item_title || ''}"`,
        thumbnailUrl: null,
        hasActions: true,
        isDatingLikeAnon: false,
      };
    case 'request_response':
      return {
        userName: p.responder_name,
        userLetter: (p.responder_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeRequest,
        text: `откликнулся на твой запрос "${p.request_title || ''}"`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    case 'milestone':
      return {
        userName: null,
        userLetter: null,
        userColor: null,
        text: `Твой пост "${p.post_title || ''}" набрал ${p.milestone} лайков!`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
        isMilestone: true,
        milestoneTitle: getMilestoneTitle(p.milestone),
      };
    case 'admin_report':
      return {
        userName: null,
        userLetter: '⚠️',
        userColor: '#FF9F0A',
        text: `Новая жалоба на ${p.target_type || 'контент'}: ${p.reason || ''}`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    default:
      return {
        userName: null,
        userLetter: '?',
        userColor: COLORS.muted,
        text: 'Новое уведомление',
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
  }
}

function getMilestoneTitle(milestone) {
  if (milestone >= 1000) return 'Легенда! 🏆';
  if (milestone >= 500) return 'Вирусный пост! 🚀';
  if (milestone >= 100) return 'Топ контент! ⭐️';
  if (milestone >= 50) return 'Уфф, горячо! 🔥';
  return 'Первые 10 лайков! 💥';
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin}м назад`;
  if (diffHour < 24) return `${diffHour}ч назад`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Вчера, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getDateGroup(isoString) {
  if (!isoString) return 'older';
  const date = new Date(isoString);
  const now = new Date();

  const dateDay = new Date(date); dateDay.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  if (dateDay.getTime() === today.getTime()) return 'today';
  if (dateDay.getTime() === yesterday.getTime()) return 'yesterday';
  return 'older';
}

// ========== КОМПОНЕНТЫ ==========

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 16px',
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 700,
      flexShrink: 0,
      border: 'none',
      cursor: 'pointer',
      background: active ? COLORS.lime : COLORS.surface,
      color: active ? '#000' : COLORS.muted,
      boxShadow: active ? '0 4px 12px rgba(212,255,0,0.2)' : 'none',
      transition: 'all 0.2s ease',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    {label}
  </button>
);

const NotificationItem = React.memo(({ notif }) => {
  const [resolved, setResolved] = useState(false);
  const display = parseNotification(notif);
  const badge = BADGE_CONFIG[notif.type];
  const isMilestone = display.isMilestone;
  const isDatingLikeAnon = display.isDatingLikeAnon;

  return (
    <div style={{
      position: 'relative',
      padding: 16,
      background: !notif.is_read ? 'rgba(212,255,0,0.03)' : 'transparent',
      boxShadow: !notif.is_read ? 'inset 3px 0 0 #D4FF00' : 'none',
      display: 'flex',
      gap: 14,
      borderBottom: `1px solid ${COLORS.border}`,
      transition: 'background 0.3s',
    }}>

      {/* ЛЕВЫЙ ЯКОРЬ: аватар + micro-badge */}
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        {isMilestone ? (
          // Milestone: градиентный круг с Flame
          <div style={{
            width: '100%', height: '100%', borderRadius: 16,
            background: 'linear-gradient(135deg, #FF9F0A, #FF4D85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,159,10,0.3)',
          }}>
            <Flame size={24} color="#FFF" />
          </div>
        ) : isDatingLikeAnon ? (
          // dating_like: анонимный — сердце на градиенте
          <div style={{
            width: '100%', height: '100%', borderRadius: 16,
            background: 'linear-gradient(135deg, #FF4D85, #FF2D55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,45,85,0.3)',
          }}>
            <Heart size={22} color="#FFF" />
          </div>
        ) : (
          // Обычный пользователь
          <div style={{
            width: '100%', height: '100%', borderRadius: 16,
            background: display.userColor || COLORS.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#FFF',
          }}>
            {display.userLetter}
          </div>
        )}

        {/* Micro-badge */}
        {badge && !isMilestone && !isDatingLikeAnon && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 20, height: 20, borderRadius: 8,
            background: badge.color, border: `2px solid ${COLORS.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <badge.icon size={10} color="#FFF" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* ЦЕНТР: текст + кнопки */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        {isMilestone ? (
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 2 }}>
            {display.milestoneTitle}
          </div>
        ) : null}

        <div style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.4 }}>
          {display.userName && (
            <span style={{ fontWeight: 800, color: COLORS.text }}>{display.userName} </span>
          )}
          {display.text}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginTop: 6, opacity: 0.7 }}>
          {formatTime(notif.created_at)}
        </div>

        {/* Quick Actions — только для market_contact */}
        {display.hasActions && !resolved && (
          <div className="ns-quick-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); hapticFeedback('success'); setResolved('accepted'); }}
              style={{
                flex: 1, background: COLORS.lime, color: '#000',
                border: 'none', borderRadius: 10, padding: '10px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={16} strokeWidth={3} /> Принять
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); hapticFeedback('light'); setResolved('declined'); }}
              style={{
                flex: 1, background: COLORS.surfaceElevated, color: COLORS.text,
                border: 'none', borderRadius: 10, padding: '10px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <X size={16} strokeWidth={3} /> Отказать
            </button>
          </div>
        )}

        {/* Resolved state */}
        {display.hasActions && resolved && (
          <div className="ns-quick-actions" style={{
            marginTop: 10, fontSize: 13, fontWeight: 600,
            color: resolved === 'accepted' ? COLORS.success : COLORS.muted,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Check size={14} strokeWidth={3} />
            {resolved === 'accepted' ? 'Заявка одобрена' : 'Заявка отклонена'}
          </div>
        )}
      </div>

      {/* ПРАВЫЙ ЯКОРЬ: thumbnail */}
      {display.thumbnailUrl && (
        <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, opacity: 0.8 }}>
          <img src={display.thumbnailUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

const GroupHeader = ({ title }) => (
  <div style={{
    padding: '16px 16px 8px',
    fontSize: 12, fontWeight: 800,
    color: COLORS.muted, letterSpacing: '1px',
    textTransform: 'uppercase',
  }}>
    {title}
  </div>
);

// ========== ГЛАВНЫЙ КОМПОНЕНТ ==========

function NotificationsScreen() {
  const { setShowNotificationsScreen, setUnreadNotificationsCount } = useStore();
  const [isExiting, setIsExiting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    setTimeout(() => setShowNotificationsScreen(false), 340);
  }, [isExiting, setShowNotificationsScreen]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {
        toast.error('Не удалось загрузить уведомления');
      } finally {
        setLoading(false);
      }
    };

    load();
    // Помечаем все как прочитанные при открытии экрана
    markAllNotificationsRead()
      .then(() => setUnreadNotificationsCount(0))
      .catch(() => {});
  }, [setUnreadNotificationsCount]);

  const handleMarkAllRead = useCallback(() => {
    hapticFeedback('light');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadNotificationsCount(0);
    markAllNotificationsRead().catch(() => {});
  }, [setUnreadNotificationsCount]);

  // Фильтрация
  const filtered = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    return TYPE_TO_FILTER[n.type] === activeFilter;
  });

  // Группировка по дате
  const groups = {
    today: filtered.filter(n => getDateGroup(n.created_at) === 'today'),
    yesterday: filtered.filter(n => getDateGroup(n.created_at) === 'yesterday'),
    older: filtered.filter(n => getDateGroup(n.created_at) === 'older'),
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: Z_MODAL_NOTIFICATIONS_SCREEN,
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      animation: isExiting
        ? 'nsSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
        : 'nsSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
    }}>
      {/* Верхний блюр — до нижнего края хедера */}
      <EdgeBlur position="top" height={76} zIndex={60} />
      {/* Нижний блюр — плавный фейд у нижнего края экрана */}
      <EdgeBlur position="bottom" height={60} zIndex={60} />

      <DrilldownHeader
        title="Уведомления"
        onBack={handleClose}
        transparent
        rightSlot={hasUnread ? (
          <button
            onClick={handleMarkAllRead}
            style={{
              background: 'none', border: 'none',
              color: COLORS.lime, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', padding: '4px 0',
            }}
          >
            Прочитать всё
          </button>
        ) : null}
      />

      {/* Фильтры */}
      <div style={{
        background: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onClick={() => { hapticFeedback('selection'); setActiveFilter(f.key); }}
            />
          ))}
        </div>
      </div>

      {/* Скролл-зона */}
      <div
        className="custom-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 16px', textAlign: 'center', color: COLORS.muted, fontSize: 15 }}>
            Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '80px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600 }}>
              {activeFilter === 'all' ? 'Уведомлений пока нет' : 'Нет уведомлений этого типа'}
            </div>
          </div>
        ) : (
          <>
            {groups.today.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <GroupHeader title="Сегодня" />
                {groups.today.map(n => <NotificationItem key={n.id} notif={n} />)}
              </div>
            )}
            {groups.yesterday.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <GroupHeader title="Вчера" />
                {groups.yesterday.map(n => <NotificationItem key={n.id} notif={n} />)}
              </div>
            )}
            {groups.older.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <GroupHeader title="На прошлой неделе" />
                {groups.older.map(n => <NotificationItem key={n.id} notif={n} />)}
              </div>
            )}

            <div style={{
              textAlign: 'center', padding: '32px 16px',
              color: COLORS.muted, fontSize: 13, fontWeight: 600,
            }}>
              Ты просмотрел(а) все уведомления 👀
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes nsSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes nsSlideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        .ns-quick-actions {
          animation: nsSlideDown 0.3s ease forwards;
        }
        @keyframes nsSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default NotificationsScreen;

