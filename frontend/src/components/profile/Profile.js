// ===== FILE: frontend/src/components/profile/Profile.js =====

import React, { useEffect, useState } from 'react';
import {
  Grid, ShoppingBag, FileText, Share2, Heart,
  MessageCircle, MapPin, ChevronRight,
  Shield, Zap, Settings, PencilLine, Check, Barcode, Bell,
} from 'lucide-react';
import { HandTap } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';

import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import {
  getUserPosts, getMyMarketItems,
  getMyDatingProfile, getUserStats, deleteMarketItem
} from '../../api';
import { toast } from '../shared/Toast';
import { getCampusDisplayName } from '../../constants/universityData';

import PostCard from '../posts/PostCard';
import MyMarketCard from './MyMarketCard';
import PhotoViewer from '../media/PhotoViewer';
import SettingsModal from './SettingsModal';
import theme from '../../theme';
import EditMarketItemModal from '../market/EditMarketItemModal';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import MarketDetail from '../market/MarketDetail';
import EdgeBlur from '../shared/EdgeBlur';
import { buildMiniAppStartappUrl } from '../../utils/deepLinks';
import { normalizeTelegramUsername } from '../../utils/telegramUsername';

const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'S';

function Profile() {
  const {
    user, datingProfile, setDatingProfile, setShowEditModal,
    setShowUserPosts, setShowUserMarketItems,
    moderationRole, setActiveTab: setNavigationTab,
    setShowSettingsModal, setViewPostId,
    updatedPostId, updatedPostData, clearUpdatedPost,
    setShowNotificationsScreen, unreadNotificationsCount,
  } = useStore();

  const [activeTab, setActiveTab] = useState('posts');
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const [posts, setPosts] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  const [editingMarketItem, setEditingMarketItem] = useState(null);
  const [marketItemToDelete, setMarketItemToDelete] = useState(null);
  const [selectedMarketItem, setSelectedMarketItem] = useState(null);
  const [stats, setStats] = useState({
    posts_count: 0,
    comments_count: 0,
    likes_count: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const postsData = await getUserPosts(user.id, 3);
        const marketData = await getMyMarketItems(10);
        const datingData = !datingProfile ? await getMyDatingProfile() : datingProfile;
        const userStats = await getUserStats(user.id);

        setPosts(postsData);
        setMarketItems(marketData);
        setStats(userStats);
        if (datingData) setDatingProfile(datingData);

      } catch (error) {
        console.error('Profile load error:', error);
        if (error.response?.status === 404) {
          toast.error('Пользователь не найден. Перелогиньтесь.');
        }
      }
    };

    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!updatedPostId) return;

    let hasUpdated = false;
    setPosts((prev) => prev.map((post) => {
      if (String(post.id) !== String(updatedPostId)) return post;
      hasUpdated = true;
      return { ...post, ...updatedPostData };
    }));

    if (hasUpdated) {
      clearUpdatedPost();
    }
  }, [updatedPostId, updatedPostData, clearUpdatedPost]);

  const tabs = [
    { id: 'posts', label: 'Мои посты' },
    { id: 'market', label: 'Мои объявления' },
  ];

  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);

  const previewPosts = posts.slice(0, 3);
  const previewMarket = marketItems.slice(0, 4);

  const handleOpenMyPosts = () => { hapticFeedback('medium'); setShowUserPosts(true); };
  const handleOpenMyMarketItems = () => { hapticFeedback('medium'); setShowUserMarketItems(true); };

  const handleEditMarketItem = (item) => { hapticFeedback('light'); setEditingMarketItem(item); };
  const handleDeleteMarketItem = (itemId) => { hapticFeedback('medium'); setMarketItemToDelete(itemId); };

  const confirmDeleteMarketItem = async () => {
    if (!marketItemToDelete) return;
    try {
      await deleteMarketItem(marketItemToDelete);
      setMarketItems(prev => prev.filter(i => i.id !== marketItemToDelete));
      toast.success('Объявление удалено');
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка при удалении');
    } finally {
      setMarketItemToDelete(null);
    }
  };

  const handleShareProfile = () => {
    hapticFeedback('light');
    const link = buildMiniAppStartappUrl(`user_${user.id}`);
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Ссылка скопирована');
      hapticFeedback('success');
    }).catch((error) => {
      console.error('Profile link copy error:', error);
      toast.error('Не удалось скопировать ссылку');
      hapticFeedback('error');
    });
  };

  const handleAvatarClick = () => {
    if (user.avatar) {
      hapticFeedback('light');
      setShowPhotoViewer(true);
    }
  };

  const handlePostClick = (postId) => { hapticFeedback('light'); setViewPostId(postId); };

  const handleMarketItemOpen = (item) => { hapticFeedback('light'); setSelectedMarketItem(item); };

  return (
    <div style={styles.container}>
      {/* Нижний блюр — от края экрана вверх, прозрачный конец совпадает с верхним краем навбара */}
      <EdgeBlur position="bottom" height={100} zIndex={50} />

      <div style={styles.contentWrapper}>

        <h1 style={styles.pageTitle}>Профиль</h1>

        {/* CAMPUS ID КАРТА */}
        <div style={styles.cardWrapper}>
          <CampusIDCard
            key={user.avatar}
            user={user}
            onAvatarClick={handleAvatarClick}
          />
        </div>

        {/* КНОПКИ ДЕЙСТВИЙ */}
        <div style={styles.actionsRow}>
          {/* Уведомления — лайм, с бейджем */}
          <button
            style={styles.notifAction}
            onClick={() => { hapticFeedback('light'); setShowNotificationsScreen(true); }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color="#000" />
              {unreadNotificationsCount > 0 && (
                <div style={styles.notifBadge}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </div>
              )}
            </div>
            <span>Уведомления</span>
          </button>
          {/* Поделиться ID — серый */}
          <button
            style={styles.secondaryAction}
            onClick={handleShareProfile}
          >
            <Share2 size={18} />
          </button>
          <button
            style={styles.iconAction}
            onClick={() => { hapticFeedback('light'); setShowEditModal(true); }}
          >
            <PencilLine size={20} />
          </button>
          <button
            style={styles.iconAction}
            onClick={() => { hapticFeedback('light'); setShowSettingsModal(true); }}
          >
            <Settings size={20} />
          </button>
        </div>

        {/* КНОПКИ МОДЕРАЦИИ */}
        {moderationRole?.can_moderate && (
          <div style={styles.modSection}>
            <button
              style={styles.modButton}
              onClick={() => { hapticFeedback('medium'); setNavigationTab('ambassador'); }}
            >
              <div style={styles.modIcon}>
                <Shield size={18} color="#fff" />
              </div>
              <div style={styles.modText}>
                <span style={styles.modTitle}>Панель модерации</span>
                <span style={styles.modSubtitle}>Жалобы и очередь</span>
              </div>
              {moderationRole?.pending_reports > 0 && (
                <div style={styles.modBadge}>
                  {moderationRole.pending_reports > 99 ? '99+' : moderationRole.pending_reports}
                </div>
              )}
              <ChevronRight size={18} color="#8E8E93" />
            </button>
          </div>
        )}

        {moderationRole?.can_admin && (
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <button
              style={styles.adminButton}
              onClick={() => { hapticFeedback('medium'); setNavigationTab('admin'); }}
            >
              <div style={styles.adminIcon}>
                <Zap size={18} color="#fff" />
              </div>
              <div style={styles.modText}>
                <span style={styles.modTitle}>Админ-панель</span>
                <span style={styles.modSubtitle}>Статистика и контроль</span>
              </div>
              <ChevronRight size={18} color="#8E8E93" />
            </button>
          </div>
        )}

        {/* СТАТИСТИКА */}
        <StatsGrid stats={stats} />

        {/* ТАБЫ */}
        <div style={styles.tabsContainer}>
          <div style={styles.tabsWrapper}>
            <div
              style={{
                ...styles.activeIndicator,
                transform: `translateX(${activeTabIndex * 100}%)`,
              }}
            />
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { hapticFeedback('selection'); setActiveTab(tab.id); }}
                  style={{
                    ...styles.tabButton,
                    color: isActive ? '#000000' : '#8E8E93',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* КОНТЕНТ ТАБОВ */}
        <div style={styles.feedContainer}>

          {activeTab === 'posts' && (
            <div className="tab-enter">
              <ActionCard
                icon={<FileText size={20} color="#fff" />}
                title="Мои посты"
                subtitle={`${stats.posts_count} постов`}
                onClick={handleOpenMyPosts}
              />
              {previewPosts.length > 0 ? (
                <div style={styles.previewPostList}>
                  {previewPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={handlePostClick}
                      onPostDeleted={(postId) => setPosts(prev => prev.filter(p => p.id !== postId))}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Пока нет постов" icon={<FileText size={36} />} />
              )}
            </div>
          )}

          {activeTab === 'market' && (
            <div className="tab-enter">
              <ActionCard
                icon={<ShoppingBag size={20} color="#fff" />}
                title="Мои объявления"
                subtitle={`${marketItems.length} объявлений`}
                onClick={handleOpenMyMarketItems}
              />
              {previewMarket.length > 0 ? (
                <div style={styles.marketList}>
                  {previewMarket.map((item) => (
                    <MyMarketCard
                      key={item.id}
                      item={item}
                      onOpen={handleMarketItemOpen}
                      onEdit={handleEditMarketItem}
                      onDelete={handleDeleteMarketItem}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Пока нет объявлений" icon={<ShoppingBag size={36} />} />
              )}
            </div>
          )}

          <div style={{ height: 100 }} />
        </div>
      </div>

      {showPhotoViewer && user.avatar && (
        <PhotoViewer
          photos={[user.avatar]}
          initialIndex={0}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      <SettingsModal />

      {editingMarketItem && (
        <EditMarketItemModal
          item={editingMarketItem}
          onClose={() => setEditingMarketItem(null)}
          onSuccess={(updatedItem) => {
            setMarketItems(prev => prev.map(i => (i.id === updatedItem.id ? updatedItem : i)));
            setEditingMarketItem(null);
          }}
        />
      )}

      {selectedMarketItem && (
        <MarketDetail
          item={selectedMarketItem}
          onClose={() => setSelectedMarketItem(null)}
          onUpdate={(updatedItem) => {
            if (updatedItem?.id) {
              setMarketItems(prev => prev.map(i => (
                String(i.id) === String(updatedItem.id) ? { ...i, ...updatedItem } : i
              )));
              setSelectedMarketItem(updatedItem);
            } else {
              setMarketItems(prev => prev.filter(i => String(i.id) !== String(selectedMarketItem.id)));
              setSelectedMarketItem(null);
            }
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={!!marketItemToDelete}
        title="Удалить объявление?"
        message="Это действие нельзя отменить."
        confirmText="Удалить"
        confirmType="danger"
        onConfirm={confirmDeleteMarketItem}
        onCancel={() => setMarketItemToDelete(null)}
      />

      <style>{`
        .fade-in { animation: fadeIn 0.25s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ===== CAMPUS ID CARD =====
const CampusIDCard = ({ user, onAvatarClick }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);

  const campusLabel = getCampusDisplayName(user);
  const profileQrUrl = buildMiniAppStartappUrl(`user_${user.id}`);
  const telegramUsername = normalizeTelegramUsername(user.telegram_username);

  const courseInstituteParts = [];
  if (user.course) courseInstituteParts.push(`${user.course} курс`);
  if (user.institute) courseInstituteParts.push(user.institute);
  const courseInstituteText = courseInstituteParts.join(' · ') || null;

  const handleCopyUsername = (e) => {
    e.stopPropagation();
    const text = telegramUsername ? `@${telegramUsername}` : `#${user.telegram_id}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 2000);
    });
  };

  return (
    <div style={cardStyles.flipContainer}>
      <div
        style={{
          ...cardStyles.flipInner,
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* ЛИЦЕВАЯ СТОРОНА */}
        <div style={cardStyles.flipFront}>
          {/* Glow-blob */}
          <div style={cardStyles.glowBlob} />

          {/* Подсказка тапа */}
          <div style={cardStyles.tapHint}>
            <HandTap size={20} weight="duotone" color="#FFF" />
          </div>

          {/* Шапка: университет */}
          <div style={cardStyles.cardHeader}>
            <div style={cardStyles.uniRow}>
              <div style={cardStyles.uniIconWrap}>
                <MapPin size={14} weight="duotone" color="#fff" />
              </div>
              <span style={cardStyles.uniName}>{campusLabel}</span>
            </div>
          </div>

          {/* Тело: аватар + инфо */}
          <div style={cardStyles.cardBody}>
            <div
              style={cardStyles.avatarWrap}
              onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
            >
              {user.avatar ? (
                <img src={user.avatar} style={cardStyles.avatarImg} alt="avatar" />
              ) : (
                <div style={cardStyles.avatarPlaceholder}>
                  {getInitials(user.name)}
                </div>
              )}
            </div>

            <div style={cardStyles.infoBlock}>
              <div style={cardStyles.userName}>{user.name}</div>

              <div
                style={{
                  ...cardStyles.usernameRow,
                  color: copiedUsername ? '#32D74B' : '#D4FF00',
                  background: copiedUsername ? 'rgba(50,215,75,0.1)' : 'rgba(212,255,0,0.06)',
                }}
                onClick={handleCopyUsername}
              >
                {copiedUsername ? (
                  <><Check size={13} />&nbsp;Скопировано</>
                ) : (
                  telegramUsername ? `@${telegramUsername}` : `ID #${user.telegram_id}`
                )}
              </div>

              {courseInstituteText && (
                <div style={cardStyles.metaRow}>
                  <span style={cardStyles.metaText}>{courseInstituteText}</span>
                </div>
              )}

              {user.group && (
                <div style={cardStyles.metaRow}>
                  <span style={cardStyles.metaText}>Группа {user.group}</span>
                </div>
              )}
            </div>
          </div>

          {/* Разделитель */}
          <div style={cardStyles.dashedSep} />

          {/* Футер: ID + бейдж достижения */}
          <div style={cardStyles.cardFooter}>
            <div style={cardStyles.idRow}>
              <Barcode size={20} color="#fff" />
              <span style={cardStyles.idText}>ID:{user.telegram_id}</span>
            </div>

            {/* Бейдж достижения — показываем если есть данные */}
            {user.achievement && (
              <div style={cardStyles.achieveBadge}>
                {user.achievement.title}
              </div>
            )}
          </div>
        </div>

        {/* ОБРАТНАЯ СТОРОНА */}
        <div style={cardStyles.flipBack}>
          <div style={cardStyles.qrWrap}>
            <QRCodeSVG
              value={profileQrUrl}
              size={120}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
            />
          </div>
          <div style={cardStyles.qrTitle}>МОЙ QR-КОД</div>
          <div style={cardStyles.qrSubtitle}>Покажи для добавления</div>
        </div>
      </div>
    </div>
  );
};

// ===== STATS GRID =====
const StatsGrid = ({ stats }) => {
  const statCards = [
    { icon: Grid, label: 'Постов', value: stats.posts_count || 0, color: '#4DA6FF' },
    { icon: MessageCircle, label: 'Комментов', value: stats.comments_count || 0, color: '#A78BFA' },
    { icon: Heart, label: 'Лайков', value: stats.likes_count || 0, color: '#FF453A' },
  ];

  return (
    <div style={styles.statsGrid}>
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} style={styles.statCard}>
            <Icon size={20} color={card.color} style={{ marginBottom: 8, opacity: 0.9 }} />
            <div style={{ ...styles.statValue, color: '#FFFFFF' }}>{card.value}</div>
            <div style={styles.statLabel}>{card.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// ===== ACTION CARD =====
const ActionCard = ({ icon, title, subtitle, onClick }) => (
  <div style={styles.actionCard} onClick={onClick}>
    <div style={styles.actionCardIcon}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={styles.actionCardTitle}>{title}</div>
      <div style={styles.actionCardSubtitle}>{subtitle}</div>
    </div>
    <ChevronRight size={18} color="#8E8E93" />
  </div>
);

// ===== EMPTY STATE =====
const EmptyState = ({ text, icon }) => (
  <div style={styles.emptyState}>
    <div style={styles.emptyIcon}>{icon}</div>
    <div style={styles.emptyText}>{text}</div>
  </div>
);

// ===== СТИЛИ FLIP-КАРТЫ =====
const cardStyles = {
  flipContainer: {
    perspective: '1200px',
    overflow: 'hidden',
    borderRadius: 24,
  },
  flipInner: {
    position: 'relative',
    width: '100%',
    transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.1, 1)',
    transformStyle: 'preserve-3d',
    WebkitTransformStyle: 'preserve-3d',
    cursor: 'pointer',
  },
  flipFront: {
    background: '#0A0A0C',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
    padding: 24,
    // overflow: hidden ломает backface-visibility в iOS Safari — используем clipPath
    clipPath: 'inset(0 round 24px)',
    position: 'relative',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
  },
  flipBack: {
    background: '#0A0A0C',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    transform: 'rotateY(180deg)',
    WebkitTransform: 'rotateY(180deg)',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    top: -50, right: -50,
    width: 200, height: 200,
    background: '#D4FF00',
    filter: 'blur(90px)',
    opacity: 0.08,
    pointerEvents: 'none',
  },
  tapHint: {
    position: 'absolute',
    top: 12, right: 12,
    opacity: 0.3,
    pointerEvents: 'none',
  },
  cardHeader: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 2,
  },
  uniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  uniIconWrap: {
    width: 26, height: 26,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  uniName: {
    fontSize: 14, fontWeight: 700, color: '#FFF',
  },
  cardBody: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    marginBottom: 20,
    position: 'relative',
    zIndex: 2,
  },
  avatarWrap: {
    width: 96, height: 96,
    borderRadius: 28,
    overflow: 'hidden',
    flexShrink: 0,
    cursor: 'pointer',
  },
  avatarImg: {
    width: '100%', height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, #FF4D85, #7A5CFF)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 38, fontWeight: 800, color: '#FFF',
  },
  infoBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingTop: 4,
  },
  userName: {
    fontSize: 22, fontWeight: 800, color: '#FFF',
    letterSpacing: '-0.5px', lineHeight: 1.2,
  },
  usernameRow: {
    fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center',
    padding: '3px 6px', marginLeft: -6,
    borderRadius: 6,
    transition: 'all 0.2s',
    cursor: 'pointer',
    width: 'max-content',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13, color: '#8E8E93', fontWeight: 500,
  },
  dashedSep: {
    borderTop: '1px dashed rgba(255,255,255,0.15)',
    marginBottom: 14,
    position: 'relative',
    zIndex: 2,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  idText: {
    fontSize: 13, fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '2px',
    color: '#FFF',
  },
  achieveBadge: {
    background: 'rgba(212,255,0,0.15)',
    border: '1px solid rgba(212,255,0,0.4)',
    color: '#D4FF00',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 11, fontWeight: 800,
    letterSpacing: '0.5px',
  },
  qrWrap: {
    background: '#FFF',
    padding: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 16, fontWeight: 800,
    letterSpacing: '1px', color: '#FFF',
  },
  qrSubtitle: {
    fontSize: 13, color: '#8E8E93', marginTop: 4,
  },
};

// ===== ГЛАВНЫЕ СТИЛИ =====
const styles = {
  container: {
    minHeight: '100vh',
    background: '#000000',
    position: 'relative',
  },

  contentWrapper: {
    position: 'relative',
    zIndex: 2,
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 4px)',
  },

  pageTitle: {
    margin: 0,
    padding: '4px 16px 12px',
    fontSize: 24,
    fontWeight: 800,
    color: '#FFF',
    letterSpacing: '-0.5px',
    textAlign: 'center',
    transform: 'translateY(2px)',
  },

  cardWrapper: {
    padding: '0 16px',
    marginBottom: 16,
  },

  actionsRow: {
    padding: '0 16px',
    marginBottom: 12,
    display: 'flex',
    gap: 10,
    alignItems: 'stretch',
  },
  notifAction: {
    flex: 1,
    background: '#D4FF00',
    color: '#000',
    border: 'none',
    borderRadius: 16,
    padding: '14px 12px',
    fontSize: 14, fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(212,255,0,0.15)',
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  notifBadge: {
    position: 'absolute', top: -6, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    background: '#FF453A', fontSize: 9, fontWeight: 800, color: '#FFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 3px',
  },
  secondaryAction: {
    width: 52, height: 52,
    background: '#2C2C2E',
    color: '#FFF',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 0,
    fontSize: 14, fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  iconAction: {
    width: 52, height: 52,
    background: '#2C2C2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFF',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },

  modSection: {
    padding: '0 16px',
    marginBottom: 8,
  },
  modButton: {
    width: '100%',
    padding: '12px 14px',
    background: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  adminButton: {
    width: '100%',
    padding: '12px 14px',
    background: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  adminIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  modText: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
  },
  modTitle: { fontSize: 14, fontWeight: 700, color: '#FFF' },
  modSubtitle: { fontSize: 12, color: '#8E8E93', fontWeight: 500 },
  modBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: '#ef4444', color: '#fff',
    fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 6px', lineHeight: 1,
  },

  statsGrid: {
    padding: '0 16px',
    marginBottom: 16,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    borderRadius: 16,
    padding: '14px 8px',
    background: theme.colors.premium.surfaceElevated,
    border: '1px solid rgba(255,255,255,0.05)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22, fontWeight: 800, lineHeight: 1,
  },
  statLabel: {
    fontSize: 11, fontWeight: 600,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 6,
  },

  tabsContainer: {
    padding: '0 16px',
    marginBottom: 16,
    position: 'sticky',
    top: 10,
    zIndex: 10,
  },
  tabsWrapper: {
    display: 'flex',
    background: '#1C1C1E',
    borderRadius: 14,
    padding: 0,
    position: 'relative',
    height: 42,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: 'calc(100% / 2)',
    background: '#D4FF00',
    borderRadius: 14,
    boxShadow: '0 2px 10px rgba(212,255,0,0.2)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 2,
    transition: 'color 0.2s',
  },

  feedContainer: {
    paddingTop: 0,
  },

  listGap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },

  previewPostList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: '0 16px',
  },

  marketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '0 16px',
  },

  actionCard: {
    margin: '0 16px 12px',
    background: theme.colors.premium.surfaceElevated,
    borderRadius: 16,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04)',
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  actionCardIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionCardTitle: {
    fontSize: 15, fontWeight: 700, color: '#FFF', marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 13, color: '#8E8E93', fontWeight: 500,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '48px 24px',
    margin: '0 16px',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
  emptyIcon: {
    color: '#555',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14, fontWeight: 600, color: '#8E8E93',
  },
};

export default Profile;
