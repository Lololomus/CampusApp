// ===== FILE: frontend/src/components/notifications/NotificationsScreen.js =====

import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart, ShoppingBag, MessageCircle, LifeBuoy, Flame, Check, X, Star, BarChart3,
  ChevronDown, ChevronUp, Bell, AlertTriangle
} from 'lucide-react';

import DrilldownHeader from '../shared/DrilldownHeader';
import EdgeBlur from '../shared/EdgeBlur';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { getNotifications, markAllNotificationsRead, decideContactRequest } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { toast } from '../shared/Toast';
import { Z_MODAL_NOTIFICATIONS_SCREEN } from '../../constants/zIndex';
import ReviewModal from '../market/ReviewModal';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { normalizeTelegramUsername } from '../../utils/telegramUsername';

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
  badgePoll: '#00C2A8',
};

const FILTERS = [
  { key: 'all', label: 'Все', icon: Bell },
  { key: 'match', label: 'Матчи', icon: Heart },
  { key: 'comment', label: 'Комменты', icon: MessageCircle },
  { key: 'market', label: 'Маркет', icon: ShoppingBag },
  { key: 'request', label: 'Запросы', icon: LifeBuoy },
];

const TYPE_TO_FILTER = {
  match: 'match',
  dating_like: 'match',
  comment: 'comment',
  comment_reply: 'comment',
  poll_vote: 'comment',
  market_contact: 'market',
  review_request: 'market',
  request_response: 'request',
  contact_request_decision: 'market',
};

const BADGE_CONFIG = {
  match: { icon: Heart, color: COLORS.badgeDating },
  dating_like: { icon: Heart, color: COLORS.badgeDating },
  comment: { icon: MessageCircle, color: COLORS.badgeComment },
  comment_reply: { icon: MessageCircle, color: COLORS.badgeComment },
  poll_vote: { icon: BarChart3, color: COLORS.badgePoll },
  market_contact: { icon: ShoppingBag, color: COLORS.badgeMarket },
  review_request: { icon: Star, color: COLORS.badgeMarket },
  request_response: { icon: LifeBuoy, color: COLORS.badgeRequest },
  contact_request_decision: { icon: Check, color: COLORS.success },
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
        userLetter: null,
        userColor: null,
        text: 'Кто-то оценил твою анкету',
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
    case 'poll_vote':
      return buildPollVoteDisplay(p);
    case 'market_contact': {
      const marketContactSourceLabel = p.item_type === 'service' ? 'услуге' : 'товару';
      return {
        userName: p.buyer_name,
        userLetter: (p.buyer_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeMarket,
        text: p.approval_required
          ? `хочет связаться по ${marketContactSourceLabel} "${p.item_title || ''}"`
          : `хочет забрать твой "${p.item_title || ''}"`,
        thumbnailUrl: null,
        hasActions: Boolean(p.contact_request_id) && (p.contact_status || 'pending') === 'pending',
        contactRequestId: p.contact_request_id,
        contactStatus: p.contact_status || 'pending',
        requesterUsername: normalizeTelegramUsername(p.buyer_username),
        approvalRequired: Boolean(p.approval_required),
        actionHint: p.approval_required
          ? 'Если примешь, покупатель получит твой Telegram username.'
          : null,
        isDatingLikeAnon: false,
      };
    }
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
    case 'contact_request_decision': {
      const accepted = p.decision === 'accepted' || p.contact_status === 'accepted';
      const title = p.source_title ? ` «${p.source_title}»` : '';
      const sourceLabel = p.source_item_type === 'service' ? 'услуге' : 'товару';
      const username = normalizeTelegramUsername(p.owner_username);
      return {
        userName: p.owner_name,
        userLetter: null,
        userIcon: accepted ? Check : X,
        userColor: accepted ? COLORS.success : COLORS.error,
        text: accepted
          ? `открыл(а) контакт по ${sourceLabel}${title}`
          : `отклонил(а) заявку по ${sourceLabel}${title}`,
        thumbnailUrl: null,
        hasActions: false,
        isContactDecision: true,
        isAcceptedDecision: accepted,
        ownerUsername: username,
        actionHint: accepted && username
          ? 'Напиши продавцу в Telegram, чтобы договориться о деталях.'
          : null,
        isDatingLikeAnon: false,
      };
    }
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
    case 'review_request':
      return {
        userName: p.seller_name,
        userLetter: (p.seller_name || '?')[0].toUpperCase(),
        userColor: COLORS.badgeMarket,
        text: `оцени сделку по «${p.item_title || ''}»`,
        thumbnailUrl: null,
        hasActions: !p.is_review_done,
        isReviewRequest: true,
        reviewPayload: p,
        isDone: !!p.is_review_done,
        isDatingLikeAnon: false,
      };
    case 'admin_report':
      return {
        userName: null,
        userLetter: null,
        userIcon: AlertTriangle,
        userColor: '#FF9F0A',
        text: `Новая жалоба на ${p.target_type || 'контент'}: ${p.reason || ''}`,
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
    default:
      return {
        userName: null,
        userLetter: null,
        userIcon: Bell,
        userColor: COLORS.muted,
        text: 'Новое уведомление',
        thumbnailUrl: null,
        hasActions: false,
        isDatingLikeAnon: false,
      };
  }
}

function buildPollVoteDisplay(payload) {
  const voters = Array.isArray(payload.voters)
    ? payload.voters
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean)
    : [];
  const previewVoters = voters.slice(0, 2);
  const hiddenVoters = voters.slice(2);
  const voteCount = Math.max(Number(payload.vote_count) || voters.length || 0, 0);
  const entityLabel = getPollEntityLabel(payload.poll_type);

  if (payload.is_anonymous) {
    return {
      userName: null,
      userLetter: null,
      userColor: null,
      text: `В твоем ${entityLabel} уже ${voteCount} ${pluralizeVotes(voteCount)}`,
      thumbnailUrl: null,
      hasActions: false,
      isDatingLikeAnon: false,
      isPollVote: true,
      pollQuestion: payload.poll_question || '',
      voteCount,
      previewVoters: [],
      hiddenVoters: [],
      hiddenCount: 0,
    };
  }

  let text = `В твоем ${entityLabel} уже ${voteCount} ${pluralizeVotes(voteCount)}`;
  if (previewVoters.length >= 2) {
    text = `${previewVoters[0]} и ${previewVoters[1]} проголосовали в твоем ${entityLabel}`;
  } else if (previewVoters.length === 1) {
    text = `${previewVoters[0]} проголосовал(а) в твоем ${entityLabel}`;
  }

  return {
    userName: null,
    userLetter: null,
    userColor: null,
    text,
    thumbnailUrl: null,
    hasActions: false,
    isDatingLikeAnon: false,
    isPollVote: true,
    pollQuestion: payload.poll_question || '',
    voteCount,
    previewVoters,
    hiddenVoters,
    hiddenCount: hiddenVoters.length,
  };
}

function getPollEntityLabel(pollType) {
  return pollType === 'quiz' ? 'викторине' : 'опросе';
}

function pluralizeVotes(count) {
  if (count % 10 === 1 && count % 100 !== 11) return 'голос';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'голоса';
  return 'голосов';
}

function getMilestoneTitle(milestone) {
  if (milestone >= 1000) return 'Легенда!';
  if (milestone >= 500) return 'Вирусный пост!';
  if (milestone >= 100) return 'Топ контент!';
  if (milestone >= 50) return 'Уфф, горячо!';
  return 'Первые 10 лайков!';
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

function openTelegramUsername(username) {
  const cleanUsername = normalizeTelegramUsername(username);
  if (!cleanUsername) {
    toast.error('Telegram username недоступен');
    return;
  }
  const url = `https://t.me/${cleanUsername}`;
  hapticFeedback('light');
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// ========== КОМПОНЕНТЫ ==========

const FilterChip = ({ label, icon: Icon, active, onClick }) => (
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
    }}
  >
    {Icon && <Icon size={15} strokeWidth={2.5} />}
    {label}
  </button>
);

const NotificationItem = React.memo(({ notif }) => {
  const display = parseNotification(notif);
  const initialContactStatus = display.contactStatus && display.contactStatus !== 'pending'
    ? display.contactStatus
    : false;
  const [resolved, setResolved] = useState(initialContactStatus);
  const [contactActionLoading, setContactActionLoading] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [isPollExpanded, setIsPollExpanded] = useState(false);
  const badge = BADGE_CONFIG[notif.type];
  const AvatarIcon = display.userIcon;
  const isMilestone = display.isMilestone;
  const isDatingLikeAnon = display.isDatingLikeAnon;
  const isPollVote = display.isPollVote;
  const isContactActionNotification = notif.type === 'market_contact';
  const showMicroBadge = badge && !isMilestone && !isDatingLikeAnon && !isPollVote && !AvatarIcon;

  useEffect(() => {
    setResolved(display.contactStatus && display.contactStatus !== 'pending' ? display.contactStatus : false);
  }, [display.contactStatus, notif.id]);

  const handleContactDecision = async (decision) => {
    if (!display.contactRequestId || contactActionLoading) return;
    setContactActionLoading(decision);
    try {
      hapticFeedback(decision === 'accepted' ? 'success' : 'light');
      const result = await decideContactRequest(display.contactRequestId, decision);
      setResolved(result.status);
      toast.success(decision === 'accepted' ? 'Контакт открыт' : 'Заявка отклонена');
    } catch (error) {
      hapticFeedback('error');
      toast.error(error?.response?.data?.detail || 'Не удалось сохранить решение');
    } finally {
      setContactActionLoading(null);
    }
  };

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
        ) : isPollVote ? (
          <div style={{
            width: '100%', height: '100%', borderRadius: 16,
            background: 'linear-gradient(135deg, #00C2A8, #4DA6FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,194,168,0.24)',
          }}>
            <BarChart3 size={22} color="#FFF" />
          </div>
        ) : (
          // Обычный пользователь
          <div style={{
            width: '100%', height: '100%', borderRadius: 16,
            background: display.userColor || COLORS.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#FFF',
          }}>
            {AvatarIcon ? <AvatarIcon size={22} color="#FFF" strokeWidth={3} /> : display.userLetter}
          </div>
        )}

        {/* Micro-badge */}
        {showMicroBadge && (
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

        {display.actionHint && (
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.35, marginTop: 6 }}>
            {display.actionHint}
          </div>
        )}

        {isPollVote && display.pollQuestion && (
          <div style={{
            marginTop: 8,
            fontSize: 13,
            color: COLORS.text,
            fontWeight: 600,
            lineHeight: 1.35,
          }}>
            «{display.pollQuestion}»
          </div>
        )}

        {isPollVote && display.hiddenCount > 0 && (
          <button
            onClick={() => {
              hapticFeedback('selection');
              setIsPollExpanded(prev => !prev);
            }}
            style={{
              marginTop: 10,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: COLORS.lime,
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {isPollExpanded ? 'Скрыть список' : `и ещё ${display.hiddenCount}`}
            {isPollExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {isPollVote && isPollExpanded && display.hiddenVoters.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
          }}>
            {display.hiddenVoters.map((name, index) => (
              <span
                key={`${notif.id}-${index}-${name}`}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginTop: 6, opacity: 0.7 }}>
          {formatTime(notif.created_at)}
        </div>

        {/* Quick Actions — contact approval */}
        {isContactActionNotification && display.hasActions && !resolved && (
          <div className="ns-quick-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleContactDecision('accepted'); }}
              disabled={Boolean(contactActionLoading)}
              style={{
                flex: 1, background: COLORS.lime, color: '#000',
                border: 'none', borderRadius: 8, padding: '10px',
                fontSize: 14, fontWeight: 700, cursor: contactActionLoading ? 'wait' : 'pointer',
                opacity: contactActionLoading && contactActionLoading !== 'accepted' ? 0.55 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={16} strokeWidth={3} />
              {contactActionLoading === 'accepted' ? 'Сохраняем...' : 'Принять'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleContactDecision('declined'); }}
              disabled={Boolean(contactActionLoading)}
              style={{
                flex: 1, background: COLORS.surfaceElevated, color: COLORS.text,
                border: 'none', borderRadius: 8, padding: '10px',
                fontSize: 14, fontWeight: 700, cursor: contactActionLoading ? 'wait' : 'pointer',
                opacity: contactActionLoading && contactActionLoading !== 'declined' ? 0.55 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <X size={16} strokeWidth={3} />
              {contactActionLoading === 'declined' ? 'Сохраняем...' : 'Отказать'}
            </button>
          </div>
        )}

        {/* Resolved state */}
        {isContactActionNotification && resolved && (
          <div className="ns-quick-actions" style={{
            marginTop: 10, fontSize: 13, fontWeight: 600,
            color: resolved === 'accepted' ? COLORS.success : COLORS.muted,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {resolved === 'accepted' ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
            {resolved === 'accepted' ? 'Заявка одобрена' : 'Заявка отклонена'}
          </div>
        )}

        {isContactActionNotification && resolved === 'accepted' && display.requesterUsername && (
          <button
            type="button"
            className="ns-quick-actions"
            onClick={(e) => {
              e.stopPropagation();
              openTelegramUsername(display.requesterUsername);
            }}
            style={{
              marginTop: 10,
              background: COLORS.surfaceElevated,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MessageCircle size={15} strokeWidth={3} />
            Написать @{display.requesterUsername}
          </button>
        )}

        {display.isContactDecision && display.isAcceptedDecision && display.ownerUsername && (
          <button
            type="button"
            className="ns-quick-actions"
            onClick={(e) => {
              e.stopPropagation();
              openTelegramUsername(display.ownerUsername);
            }}
            style={{
              marginTop: 12,
              background: COLORS.lime,
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MessageCircle size={16} strokeWidth={3} />
            Написать @{display.ownerUsername}
          </button>
        )}

        {/* Quick Action — review_request */}
        {notif.type === 'review_request' && !resolved && (
          display.isDone ? (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: COLORS.success, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} strokeWidth={3} /> Уже оценено
            </div>
          ) : (
            <div className="ns-quick-actions" style={{ marginTop: 12 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hapticFeedback('selection');
                  setReviewModal(display.reviewPayload);
                }}
                style={{
                  background: COLORS.lime, color: '#000',
                  border: 'none', borderRadius: 10, padding: '10px 20px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Star size={15} strokeWidth={3} /> Оценить
              </button>
            </div>
          )
        )}

        {reviewModal && (
          <ReviewModal
            sellerId={reviewModal.seller_id}
            sellerName={reviewModal.seller_name}
            dealId={reviewModal.deal_id}
            itemId={reviewModal.item_id}
            itemTitle={reviewModal.item_title}
            onClose={() => setReviewModal(null)}
            onSuccess={() => setResolved('done')}
          />
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

  useBodyScrollLock();

  useTelegramScreen({
    id: 'notifications-screen',
    title: 'Уведомления',
    priority: 105,
    back: { visible: true, onClick: handleClose },
  });

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
    if (n.type === 'contact_request_decision') {
      return activeFilter === 'market';
    }
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
      <EdgeSwipeBack
        onBack={() => setShowNotificationsScreen(false)}
        disabled={isExiting}
        zIndex={Z_MODAL_NOTIFICATIONS_SCREEN}
      >
    <div style={{
      position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
      zIndex: Z_MODAL_NOTIFICATIONS_SCREEN,
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      animation: isExiting
        ? 'nsSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
        : 'nsSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
    }}>
      {/* Нижний блюр — плавный фейд у нижнего края экрана */}
      <EdgeBlur position="bottom" height={60} zIndex={60} />

      <div
        className="custom-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <DrilldownHeader
          title="Уведомления"
          onBack={handleClose}
          sticky={false}
          showDivider={false}
          background="#000000"
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
                icon={f.icon}
                active={activeFilter === f.key}
                onClick={() => { hapticFeedback('selection'); setActiveFilter(f.key); }}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 16px', textAlign: 'center', color: COLORS.muted, fontSize: 15 }}>
            Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '80px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <Bell size={48} color={COLORS.muted} strokeWidth={1.8} />
            </div>
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
              Ты просмотрел(а) все уведомления
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
    </EdgeSwipeBack>
  );
}

export default NotificationsScreen;
