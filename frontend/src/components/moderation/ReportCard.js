// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ReportCard.js =====

import React, { useState } from 'react';
import {
  SkipForward, CheckCircle, Trash2, Clock, Ban,
  AlertTriangle, MessageSquare, User, Image, ChevronDown, ChevronUp
} from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import {
  reviewReport, moderateDeletePost, moderateDeleteRequest,
  moderateDeleteMarketItem, moderateDeleteComment,
  shadowBanUser
} from '../../api';
import { toast } from '../shared/Toast';
import { useStore } from '../../store';
import theme from '../../theme';

const REASON_LABELS = {
  spam: 'Спам',
  abuse: 'Оскорбления',
  inappropriate: 'Неприемлемый контент',
  harassment: 'Оскорбления',
  nsfw: 'NSFW',
  misinformation: 'Дезинформация',
  scam: 'Мошенничество',
  spam_scam: 'Спам/скам',
  impersonation: 'Фейк/выдача себя',
  harassment_hate: 'Травля/хейт',
  sexual_content: 'Сексуальный контент',
  underage_risk: 'Риск с несоверш.',
  other: 'Другое',
};

const TARGET_LABELS = {
  post: 'Пост',
  comment: 'Комментарий',
  request: 'Запрос',
  market_item: 'Товар',
  user: 'Пользователь',
};

const TARGET_ICONS = {
  post: MessageSquare,
  comment: MessageSquare,
  request: AlertTriangle,
  market_item: Image,
  user: User,
};

function ReportCard({ report, onProcessed, compact = false }) {
  const { user } = useStore();
  const [actionMode, setActionMode] = useState(null); // 'delete' | 'timeout' | 'permaban'
  const [reason, setReason] = useState('');
  const [banDays, setBanDays] = useState(3);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const targetType = report.target_type;
  const TargetIcon = TARGET_ICONS[targetType] || MessageSquare;
  const reportCount = report.report_count || 1;
  const isContentTarget = ['post', 'comment', 'request', 'market_item'].includes(targetType);
  const targetUserId = report.target_user_id || (targetType === 'user' ? report.target_id : null);
  // Защита: нельзя применять санкции к самому себе
  const isSelf = Boolean(targetUserId && user?.id && targetUserId === user.id);
  const canBanTarget = Boolean(targetUserId) && !isSelf;

  // === ACTIONS ===

  const handleSkip = () => {
    hapticFeedback('light');
    onProcessed?.(report.id, 'skipped');
  };

  const handleDismiss = async () => {
    hapticFeedback('medium');
    setProcessing(true);
    try {
      await reviewReport(report.id, 'dismissed', 'Нарушения не обнаружено');
      toast.success('Жалоба отклонена');
      onProcessed?.(report.id, 'dismissed');
    } catch (err) {
      toast.error('Ошибка при отклонении');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (isSelf) {
      hapticFeedback('error');
      toast.error('Нельзя удалять собственный контент через модерацию');
      return;
    }
    if (!reason.trim()) {
      hapticFeedback('error');
      toast.error('Укажите причину удаления');
      return;
    }
    hapticFeedback('medium');
    setProcessing(true);
    try {
      // Удаляем контент
      const targetId = report.target_id;
      if (targetType === 'post') await moderateDeletePost(targetId, reason);
      else if (targetType === 'comment') await moderateDeleteComment(targetId, reason);
      else if (targetType === 'request') await moderateDeleteRequest(targetId, reason);
      else if (targetType === 'market_item') await moderateDeleteMarketItem(targetId, reason);
      else throw new Error('Удаление недоступно для этого типа жалобы');

      // Помечаем жалобу
      await reviewReport(report.id, 'reviewed', reason);
      toast.success('Контент удалён');
      onProcessed?.(report.id, 'deleted');
    } catch (err) {
      toast.error('Ошибка удаления');
      console.error(err);
    } finally {
      setProcessing(false);
      setActionMode(null);
    }
  };

  const handleBan = async (permanent = false) => {
    if (isSelf) {
      hapticFeedback('error');
      toast.error('Нельзя забанить себя');
      return;
    }
    if (!reason.trim()) {
      hapticFeedback('error');
      toast.error('Укажите причину бана');
      return;
    }
    if (!targetUserId) {
      hapticFeedback('error');
      toast.error('Нет ID пользователя для бана');
      return;
    }
    hapticFeedback('heavy');
    setProcessing(true);
    try {
      await shadowBanUser({
        user_id: targetUserId,
        reason,
        duration_days: permanent ? null : banDays,
        is_permanent: permanent,
      });
      await reviewReport(report.id, 'reviewed', reason);
      toast.success(permanent ? 'Перманентный бан' : `Бан на ${banDays} дней`);
      onProcessed?.(report.id, permanent ? 'permaban' : 'timeout');
    } catch (err) {
      toast.error('Ошибка бана');
      console.error(err);
    } finally {
      setProcessing(false);
      setActionMode(null);
    }
  };

  // === RENDER ===

  return (
    <div style={styles.card}>
      {/* Header */}
      <div
        style={styles.cardHeader}
        onClick={compact ? () => setExpanded(!expanded) : undefined}
      >
        <div style={styles.typeTag}>
          <TargetIcon size={14} />
          <span>{TARGET_LABELS[targetType] || targetType}</span>
        </div>
        <div style={styles.headerRight}>
          {reportCount > 1 && (
            <div style={{
              ...styles.countBadge,
              backgroundColor: reportCount >= 5 ? '#ef4444' : '#f59e0b',
            }}>
              {reportCount}×
            </div>
          )}
          <div style={styles.reasonTag}>
            {REASON_LABELS[report.reason] || report.reason}
          </div>
          {compact && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      </div>

      {/* Content preview */}
      {expanded && (
        <>
          <div style={styles.contentPreview}>
            {report.content_preview ? (
              <div style={styles.previewText}>
                {report.content_preview.length > 200
                  ? report.content_preview.slice(0, 200) + '...'
                  : report.content_preview}
              </div>
            ) : (
              <div style={styles.noPreview}>Контент недоступен</div>
            )}

            {report.content_image && (
              <img
                src={report.content_image}
                alt=""
                style={styles.previewImage}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>

          {/* Reporter description */}
          {report.description && (
            <div style={styles.descriptionBlock}>
              <span style={styles.descLabel}>Пояснение:</span>
              <span style={styles.descText}>{report.description}</span>
            </div>
          )}

          {/* Author info */}
          <div style={styles.authorRow}>
            <User size={14} color={theme.colors.textTertiary} />
            <span style={styles.authorName}>
              {report.target_user_name || `Пользователь #${targetUserId || report.target_id || '?'}`}
            </span>
            {isSelf && (
              <span style={styles.selfBadge}>это вы</span>
            )}
            {!isSelf && report.target_user_ban_count > 0 && (
              <span style={styles.banHistory}>
                ⚠️ {report.target_user_ban_count} бан(ов)
              </span>
            )}
          </div>

          {/* Action mode: inline reason input */}
          {actionMode && (
            <div style={styles.actionPanel}>
              <div style={styles.actionTitle}>
                {actionMode === 'delete' && '🗑️ Причина удаления:'}
                {actionMode === 'timeout' && `⏳ Бан на ${banDays} дней. Причина:`}
                {actionMode === 'permaban' && '🚫 Перманентный бан. Причина:'}
              </div>

              {actionMode === 'timeout' && (
                <div style={styles.daysRow}>
                  {[1, 3, 7, 14, 30].map(d => (
                    <button
                      key={d}
                      style={{
                        ...styles.dayChip,
                        background: banDays === d ? theme.colors.premium.primary : theme.colors.bgSecondary,
                        color: banDays === d ? theme.colors.premium.primaryText : theme.colors.textSecondary,
                      }}
                      onClick={() => setBanDays(d)}
                    >
                      {d}д
                    </button>
                  ))}
                </div>
              )}

              <textarea
                style={styles.reasonInput}
                placeholder="Опишите причину..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
              />
              <div style={styles.actionButtons}>
                <button
                  style={styles.cancelBtn}
                  onClick={() => { setActionMode(null); setReason(''); }}
                >
                  Отмена
                </button>
                <button
                  style={{
                    ...styles.confirmBtn,
                    opacity: processing || !reason.trim() ? 0.5 : 1,
                  }}
                  onClick={() => {
                    if (actionMode === 'delete') handleDelete();
                    else if (actionMode === 'timeout') handleBan(false);
                    else if (actionMode === 'permaban') handleBan(true);
                  }}
                  disabled={processing || !reason.trim()}
                >
                  {processing ? 'Обработка...' : 'Подтвердить'}
                </button>
              </div>
            </div>
          )}

          {/* Action bar */}
          {!actionMode && (
            <div style={styles.actionsRow}>
              <button style={styles.actionBtn} onClick={handleSkip} disabled={processing}>
                <SkipForward size={16} />
                <span>Пропустить</span>
              </button>
              <button style={{ ...styles.actionBtn, ...styles.dismissBtn }} onClick={handleDismiss} disabled={processing}>
                <CheckCircle size={16} />
                <span>ОК</span>
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                onClick={() => { setActionMode('delete'); hapticFeedback('light'); }}
                disabled={processing}
                hidden={!isContentTarget || isSelf}
              >
                <Trash2 size={16} />
                <span>Удалить</span>
              </button>
              {canBanTarget && (
                <button
                  style={{ ...styles.actionBtn, ...styles.timeoutBtn }}
                  onClick={() => { setActionMode('timeout'); hapticFeedback('light'); }}
                  disabled={processing}
                >
                  <Clock size={16} />
                  <span>Бан</span>
                </button>
              )}
              {canBanTarget && (
                <button
                  style={{ ...styles.actionBtn, ...styles.permaBtn }}
                  onClick={() => { setActionMode('permaban'); hapticFeedback('light'); }}
                  disabled={processing}
                >
                  <Ban size={16} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: theme.colors.card,
    borderRadius: 16,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    cursor: 'pointer',
  },

  typeTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.text,
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  countBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    padding: '2px 7px',
    borderRadius: 8,
  },

  reasonTag: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.colors.premium.primary,
    background: `${theme.colors.premium.primary}1A`,
    padding: '3px 8px',
    borderRadius: 8,
  },

  contentPreview: {
    padding: '12px 14px',
  },

  previewText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  noPreview: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },

  previewImage: {
    maxWidth: '100%',
    maxHeight: 200,
    borderRadius: 10,
    marginTop: 8,
    objectFit: 'cover',
  },

  descriptionBlock: {
    padding: '0 14px 10px',
    fontSize: 13,
    lineHeight: 1.5,
  },

  descLabel: {
    fontWeight: 600,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },

  descText: {
    color: theme.colors.textSecondary,
  },

  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderTop: `1px solid ${theme.colors.borderLight}`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },

  authorName: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.text,
    flex: 1,
  },

  banHistory: {
    fontSize: 11,
    fontWeight: 600,
    color: '#ef4444',
  },

  selfBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.colors.premium.primary,
    background: `${theme.colors.premium.primary}1A`,
    padding: '2px 8px',
    borderRadius: 6,
  },

  // Inline action panel
  actionPanel: {
    padding: '12px 14px',
    background: theme.colors.bgSecondary,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.text,
  },

  daysRow: {
    display: 'flex',
    gap: 6,
  },

  dayChip: {
    padding: '5px 12px',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  reasonInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
  },

  actionButtons: {
    display: 'flex',
    gap: 8,
  },

  cancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 10,
    border: `1px solid ${theme.colors.border}`,
    background: 'transparent',
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },

  confirmBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 10,
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },

  // Bottom actions row
  actionsRow: {
    display: 'flex',
    padding: '10px 10px',
    gap: 6,
  },

  actionBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '8px 4px',
    borderRadius: 10,
    border: `1px solid ${theme.colors.border}`,
    background: 'transparent',
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },

  dismissBtn: {
    borderColor: '#22c55e40',
    color: '#22c55e',
  },

  deleteBtn: {
    borderColor: '#f59e0b40',
    color: '#f59e0b',
  },

  timeoutBtn: {
    borderColor: '#f9731640',
    color: '#f97316',
  },

  permaBtn: {
    borderColor: '#ef444440',
    color: '#ef4444',
    flex: 0.6,
  },
};

export default ReportCard;
