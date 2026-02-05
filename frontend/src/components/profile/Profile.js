// ===== 📄 ФАЙЛ: frontend/src/components/profile/Profile.js =====

import React, { useEffect, useState } from 'react';
import { 
  Edit2, Grid, ShoppingBag, FileText, Share2, Heart, 
  MessageCircle, Calendar, Building2, Users, Award, ChevronRight
} from 'lucide-react';

import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { 
  getUserPosts, getMyRequests, getMyMarketItems, 
  getMyDatingProfile, getUserStats, deleteMarketItem
} from '../../api';
import theme from '../../theme';
import { toast } from '../shared/Toast';

import PostCard from '../posts/PostCard';
import RequestCard from '../requests/RequestCard';
import MyMarketCard from './MyMarketCard';
import PhotoViewer from '../shared/PhotoViewer';

const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'S';

const formatDate = (dateString) => {
  if (!dateString) return '01.01.24';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

const TAB_COLORS = {
  posts: theme.colors.primary,
  requests: theme.colors.primary,
  market: theme.colors.market,
};

function Profile() {
  const { 
    user, datingProfile, setDatingProfile, setShowEditModal, 
    setShowUserPosts, setShowUserRequests, setShowUserMarketItems,
    setEditingMarketItem, setShowCreateMarketItem
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ 
    posts_count: 0, 
    comments_count: 0, 
    likes_count: 0
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        const postsData = await getUserPosts(user.id, 3);
        const marketData = await getMyMarketItems(10);
        const requestsData = await getMyRequests();
        const datingData = !datingProfile ? await getMyDatingProfile() : datingProfile;
        const userStats = await getUserStats(user.id);

        setPosts(postsData);
        setMarketItems(marketData);
        setRequests(requestsData);
        setStats(userStats);
        if (datingData) setDatingProfile(datingData);
        
      } catch (error) {
        console.error('❌ Profile load error:', error);
        if (error.response?.status === 404) {
          toast.error('Пользователь не найден. Перелогиньтесь.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const heroImage = user?.avatar;

  const tabs = [
    { id: 'posts', label: 'Посты', icon: <Grid size={16} /> },
    { id: 'requests', label: 'Запросы', icon: <FileText size={16} /> },
    { id: 'market', label: 'Товары', icon: <ShoppingBag size={16} /> },
  ];

  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);
  const activeColor = TAB_COLORS[activeTab];

  const handleOpenMyPosts = () => {
    hapticFeedback('medium');
    setShowUserPosts(true);
  };

  const handleOpenMyRequests = () => {
    hapticFeedback('medium');
    setShowUserRequests(true);
  };

  const handleOpenMyMarketItems = () => {
    hapticFeedback('medium');
    setShowUserMarketItems(true);
  };

  const handleEditMarketItem = (item) => {
    hapticFeedback('light');
    setEditingMarketItem(item);
    setShowCreateMarketItem(true);
  };

  const handleDeleteMarketItem = async (itemId) => {
    try {
      await deleteMarketItem(itemId);
      setMarketItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Товар удалён');
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка при удалении');
    }
  };

  const handleShareProfile = () => {
    hapticFeedback('light');
    const link = `https://t.me/MyCampusBot?start=profile_${user.telegram_id}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Ссылка скопирована');
      hapticFeedback('success');
    });
  };

  const handleAvatarClick = () => {
    if (user.avatar) {
      hapticFeedback('light');
      setShowPhotoViewer(true);
    }
  };

  return (
    <div style={styles.container}>
      
      <div style={styles.heroBackground}>
        {heroImage ? (
          <img src={heroImage} alt="" style={styles.heroImageBlur} />
        ) : (
          <div style={styles.heroGradient} />
        )}
        <div style={styles.heroOverlay} />
      </div>

      <div style={styles.contentWrapper}>
        
        <div style={styles.cardWrapper} className="fade-in-up">
          <StudentIDCard 
            key={user.avatar}
            user={user} 
            stats={stats}
            onAvatarClick={handleAvatarClick}
          />
        </div>

        <div style={styles.actionsContainer}>
          <button 
            style={styles.editButton} 
            onClick={() => { hapticFeedback('light'); setShowEditModal(true); }}
          >
            <Edit2 size={18} />
            <span>Редактировать профиль</span>
          </button>
          
          <div style={styles.secondaryButtons}>
            <button style={styles.secondaryButton} onClick={handleShareProfile}>
              <Share2 size={18} />
              <span>Поделиться</span>
            </button>
          </div>
        </div>

        <div style={styles.tabsContainer}>
          <div style={styles.tabsWrapper}>
            <div 
              style={{
                ...styles.activeIndicator,
                transform: `translateX(${activeTabIndex * 100}%)`,
                background: activeColor,
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
                    color: isActive ? '#fff' : theme.colors.textSecondary,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.feedContainer}>
            
          {activeTab === 'posts' && (
            <div className="fade-in">
              <div style={{padding: '0 16px', marginBottom: 16}}>
                <ActionCard 
                  icon={<FileText size={20} color="#fff" />}
                  title="Мои публикации"
                  subtitle={`${stats.posts_count} постов`}
                  gradient={`linear-gradient(135deg, ${theme.colors.primary}, #6366f1)`}
                  onClick={handleOpenMyPosts}
                />
              </div>
              
              {posts.length > 0 ? (
                <div style={styles.listGap}>
                  {posts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              ) : (
                <EmptyState text="Пока нет постов" icon="📝" />
              )}
            </div>
          )}
          
          {activeTab === 'requests' && (
            <div className="fade-in">
              <div style={{padding: '0 16px', marginBottom: 16}}>
                <ActionCard 
                  icon={<FileText size={20} color="#fff" />}
                  title="Мои запросы"
                  subtitle={`${requests.length} активных`}
                  gradient={`linear-gradient(135deg, ${theme.colors.primary}, #6366f1)`}
                  onClick={handleOpenMyRequests}
                />
              </div>
              
              {requests.length > 0 ? (
                <div style={styles.listGap}>
                  {requests.slice(0, 3).map(req => <RequestCard key={req.id} request={req} />)}
                </div>
              ) : (
                <EmptyState text="Нет активных запросов" icon="⚡️" />
              )}
            </div>
          )}

          {activeTab === 'market' && (
            <div className="fade-in">
              <div style={{padding: '0 16px', marginBottom: 16}}>
                <ActionCard 
                  icon={<ShoppingBag size={20} color="#fff" />}
                  title="Мои товары"
                  subtitle={`${marketItems.length} объявлений`}
                  gradient={`linear-gradient(135deg, ${theme.colors.market}, #14b8a6)`}
                  onClick={handleOpenMyMarketItems}
                />
              </div>

              {marketItems.length > 0 ? (
                <div style={styles.listGap}>
                  {marketItems.slice(0, 4).map(item => (
                    <MyMarketCard 
                      key={item.id} 
                      item={item}
                      onEdit={handleEditMarketItem}
                      onDelete={handleDeleteMarketItem}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text="Пока нет товаров" icon="📦" />
              )}
            </div>
          )}
          
          <div style={{ height: 100 }} />
        </div>
      </div>

      {showPhotoViewer && user.avatar && (
        <PhotoViewer 
          images={[user.avatar]}
          initialIndex={0}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      <style>{`
        .fade-in-up { 
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
          opacity: 0; 
          transform: translateY(20px); 
        }
        .fade-in { 
          animation: fadeIn 0.3s ease forwards; 
        }
        
        @keyframes fadeInUp { 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes fadeIn { 
          from { opacity: 0; } 
          to { opacity: 1; } 
        }
        
        @media (hover: hover) and (pointer: fine) {
          button:hover {
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

const StudentIDCard = ({ user, stats, onAvatarClick }) => (
  <div style={styles.studentCard}>
    <div style={styles.cardHeader}>
      <div style={styles.universityLogo}>
        <Award size={20} color={theme.colors.primary} />
        <span style={styles.universityName}>{user.university}</span>
      </div>
      <div style={styles.studentBadge}>STUDENT ID</div>
    </div>

    <div style={styles.cardBody}>
      <div style={styles.photoSection}>
        <div 
          style={styles.photoWrapper}
          onClick={onAvatarClick}
        >
          {user.avatar ? (
            <img src={user.avatar} style={styles.photoImg} alt="Avatar" />
          ) : (
            <div style={styles.photoPlaceholder}>
              {getInitials(user.name)}
            </div>
          )}
        </div>
      </div>

      <div style={styles.infoSection}>
        <div style={styles.studentName}>{user.name}</div>
        {user.username && (
          <div style={styles.username}>@{user.username}</div>
        )}
        
        <div style={styles.statsLine}>
          {stats.posts_count} постов · {stats.comments_count} комментов · {stats.likes_count} лайков
        </div>
        
        <div style={styles.infoRow}>
          <Building2 size={14} color={theme.colors.textSecondary} />
          <span style={styles.infoText}>{user.course} курс · {user.institute}</span>
        </div>
        
        {user.group && (
          <div style={styles.infoRow}>
            <Users size={14} color={theme.colors.textSecondary} />
            <span style={styles.infoText}>Группа: {user.group}</span>
          </div>
        )}
      </div>
    </div>

    <div style={styles.cardFooter}>
      <div style={styles.idNumber}>
        ID: #{user.telegram_id}
      </div>
      <div style={styles.joinDate}>
        <Calendar size={12} color={theme.colors.textTertiary} />
        <span>С {formatDate(user.created_at)}</span>
      </div>
    </div>

    <div style={styles.magneticStripe} />
  </div>
);

const ActionCard = ({ icon, title, subtitle, gradient, onClick }) => (
  <div 
    style={{
      background: gradient,
      borderRadius: 16, 
      padding: '16px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12,
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      transition: 'all 0.3s ease',
    }}
    onClick={onClick}
  >
    <div style={{
      width: 48, 
      height: 48, 
      borderRadius: 12, 
      background: 'rgba(255,255,255,0.2)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backdropFilter: 'blur(10px)',
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{subtitle}</div>
    </div>
    <ChevronRight size={24} color="rgba(255,255,255,0.8)" />
  </div>
);

const EmptyState = ({ text, icon }) => (
  <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.5 }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 15, color: theme.colors.textSecondary }}>{text}</div>
  </div>
);

const styles = {
  container: { 
    minHeight: '100vh', 
    background: theme.colors.bg, 
    position: 'relative', 
    overflow: 'hidden' 
  },
  
  heroBackground: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, height: '200px', 
    zIndex: 0, overflow: 'hidden'
  },
  heroImageBlur: { 
    width: '100%', height: '100%', objectFit: 'cover', 
    filter: 'blur(40px) brightness(0.4)', transform: 'scale(1.2)' 
  },
  heroGradient: { 
    width: '100%', height: '100%', 
    background: `linear-gradient(135deg, ${theme.colors.gradientStart}, ${theme.colors.gradientEnd})`
  },
  heroOverlay: { 
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    background: `linear-gradient(to bottom, transparent 0%, ${theme.colors.bg} 100%)` 
  },
  
  contentWrapper: { position: 'relative', zIndex: 2, paddingTop: 40 },
  
  cardWrapper: { padding: '0 16px', marginBottom: 16 },
  
  studentCard: {
    background: theme.colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: theme.shadows.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  
  cardHeader: {
    padding: '12px 16px',
    background: theme.colors.primaryLight,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  universityLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  
  universityName: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.text,
  },
  
  studentBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: theme.colors.primary,
    padding: '4px 10px',
    background: theme.colors.primaryLight,
    borderRadius: 8,
    letterSpacing: '0.5px',
  },
  
  cardBody: {
    padding: '16px',
    display: 'flex',
    gap: 12,
  },
  
  photoSection: {
    flexShrink: 0,
  },
  
  photoWrapper: {
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  
  photoImg: {
    width: 140,
    height: 140,
    borderRadius: 12,
    objectFit: 'cover',
    border: `2px solid ${theme.colors.borderLight}`,
    boxShadow: theme.shadows.md,
  },
  
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${theme.colors.gradientStart}, ${theme.colors.gradientEnd})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
    fontWeight: 800,
    color: '#fff',
    border: `2px solid ${theme.colors.borderLight}`,
    boxShadow: theme.shadows.md,
  },
  
  infoSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: 2,
  },
  
  studentName: {
    fontSize: 20,
    fontWeight: 800,
    color: theme.colors.text,
    lineHeight: 1.2,
  },
  
  username: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: 600,
  },
  
  statsLine: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: 500,
    marginBottom: 4,
  },
  
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  
  infoText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: 500,
  },
  
  cardFooter: {
    padding: '10px 16px',
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: theme.colors.bgSecondary,
  },
  
  idNumber: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  
  joinDate: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  
  magneticStripe: {
    height: 8,
    background: `linear-gradient(90deg, ${theme.colors.gradientStart}, ${theme.colors.gradientEnd}, ${theme.colors.gradientStart})`,
    opacity: 0.3,
  },

  actionsContainer: { 
    padding: '0 16px', 
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  
  editButton: {
    width: '100%', 
    padding: '14px', 
    background: `linear-gradient(135deg, ${theme.colors.primary}, #6366f1)`,
    border: 'none',
    borderRadius: 16, 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: 700,
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    cursor: 'pointer',
    boxShadow: `0 4px 16px ${theme.colors.primaryGlow}`,
    transition: 'all 0.3s',
  },
  
  secondaryButtons: {
    display: 'flex',
    gap: 8,
  },
  
  secondaryButton: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: `1.5px solid ${theme.colors.border}`,
    borderRadius: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  tabsContainer: {
    padding: '0 16px', 
    marginBottom: 16, 
    position: 'sticky', 
    top: 10, 
    zIndex: 10
  },
  
  tabsWrapper: {
    display: 'flex', 
    background: 'rgba(255, 255, 255, 0.05)', 
    borderRadius: 12, 
    padding: 3, 
    position: 'relative', 
    height: 40,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.colors.borderLight}`,
  },
  
  activeIndicator: {
    position: 'absolute', 
    top: 3, bottom: 3, left: 3, 
    width: 'calc((100% - 6px) / 3)', 
    borderRadius: 10,
    boxShadow: theme.shadows.md, 
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s', 
    zIndex: 1,
  },
  
  tabButton: {
    flex: 1, 
    background: 'transparent', 
    border: 'none', 
    fontSize: 13, 
    fontWeight: 600, 
    cursor: 'pointer', 
    position: 'relative', 
    zIndex: 2, 
    transition: 'color 0.2s',
  },

  feedContainer: { 
    paddingTop: 0 
  },
  
  listGap: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12, 
    padding: '0 16px' 
  },
};

export default Profile;