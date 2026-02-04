import React, { useEffect, useState } from 'react';
import { 
  Edit2, GraduationCap, Grid, ShoppingBag, 
  FileText, List, QrCode, Share2,
  Heart, MessageCircle, Calendar, ChevronRight, LogOut
} from 'lucide-react';

import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { 
  getUserPosts, getMyRequests, getMyMarketItems, 
  getMyDatingProfile, getUserStats, updateDatingSettings,
  deleteMarketItem
} from '../../api';
import theme from '../../theme';

import PostCard from '../posts/PostCard';
import RequestCard from '../requests/RequestCard';
import MyMarketCard from './MyMarketCard';

const getInitials = (name) => name ? name.charAt(0).toUpperCase() : 'S';

const formatDate = (dateString) => {
    if (!dateString) return '2024';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }).replace('.', '');
};

const TAB_COLORS = {
  about: '#3b82f6',     
  posts: '#8b5cf6',     
  requests: '#8b5cf6',  
  market: '#10b981',    
};

function Profile() {
  const { 
    user, 
    setUser, 
    datingProfile, 
    setDatingProfile, 
    setShowEditModal, 
    setShowUserPosts,
    setShowUserMarketItems,
    setEditingMarketItem,
    setShowCreateMarketItem,
    logout 
  } = useStore();
  
  const [activeTab, setActiveTab] = useState('about');
  const [loading, setLoading] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ posts_count: 0, comments_count: 0, likes_count: 0 });

  useEffect(() => {
      const loadData = async () => {
        setLoading(true);
        
        // 🔍 ДЛЯ ДЕБАГА: Проверяем user.id
        console.log('🔍 Profile loading, user:', user);
        console.log('🔍 user.id:', user?.id);
        console.log('🔍 user.telegram_id:', user?.telegram_id);
        
        try {
          // ✅ Запросы БЕЗ .catch() — ошибки будут видны!
          const postsData = await getUserPosts(user.id, 3);
          console.log('✅ Posts loaded:', postsData);
          
          const marketData = await getMyMarketItems(10);
          console.log('✅ Market items loaded:', marketData);
          
          const requestsData = await getMyRequests();
          console.log('✅ Requests loaded:', requestsData);
          
          const datingData = !datingProfile ? await getMyDatingProfile() : datingProfile;
          
          const userStats = await getUserStats(user.id);
          console.log('✅ Stats loaded:', userStats);

          setPosts(postsData);
          setMarketItems(marketData);
          setRequests(requestsData);
          setStats(userStats);
          if (datingData) setDatingProfile(datingData);
          
        } catch (error) {
          console.error('❌ Profile load error:', error);
          console.error('📍 Response:', error.response?.data);
          console.error('📍 Status:', error.response?.status);
          
          // ⚠️ Показываем пользователю, если критическая ошибка
          if (error.response?.status === 404) {
            alert('Пользователь не найден. Перелогиньтесь.');
          }
        } finally {
          setLoading(false);
        }
      };
      
      if (user?.id) {
        loadData();
      } else {
        console.warn('⚠️ user.id отсутствует, данные не загружаются');
      }
    }, [user?.id]);

  const heroImage = datingProfile?.photos?.[0]?.url || datingProfile?.photos?.[0] || user?.avatar;

  const tabs = [
    { id: 'about', label: 'Инфо', icon: <List size={16} /> },
    { id: 'posts', label: 'Посты', icon: <Grid size={16} /> },
    { id: 'requests', label: 'Запросы', icon: <FileText size={16} /> },
    { id: 'market', label: 'Товары', icon: <ShoppingBag size={16} /> },
  ];

  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);
  const activeColor = TAB_COLORS[activeTab] || theme.colors.primary;

  const handleOpenMyPosts = () => {
    hapticFeedback('medium');
    setShowUserPosts(true);
  };

  const handleOpenMyMarketItems = () => {
    hapticFeedback('medium');
    setShowUserMarketItems(true);
  };

  const handleEditMarketItem = (item) => {
    setEditingMarketItem(item);
    setShowCreateMarketItem(true);
  };

  const handleDeleteMarketItem = async (itemId) => {
    try {
      await deleteMarketItem(itemId);
      setMarketItems(prev => prev.filter(i => i.id !== itemId));
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleShareProfile = () => {
      hapticFeedback('light');
      const link = `https://t.me/MyCampusBot?start=profile_${user.telegram_id}`;
      navigator.clipboard.writeText(link).then(() => {
          hapticFeedback('success');
      });
  };

  const handleDatingToggle = async () => {
      hapticFeedback('medium');
      const newValue = !user.show_in_dating;
      setUser({ ...user, show_in_dating: newValue });
      
      try {
          if (typeof updateDatingSettings === 'function') {
              await updateDatingSettings({ show_in_dating: newValue });
          }
      } catch (e) {
          console.error("Ошибка обновления статуса", e);
          setUser({ ...user, show_in_dating: !newValue });
      }
  };

  const handleLogout = () => {
    if (window.confirm("Сбросить кэш и выйти?")) {
        logout();
    }
  };

  return (
    <div style={styles.container}>
      
      {/* ФОН */}
      <div style={styles.heroBackground}>
        {heroImage ? (
           <img src={heroImage} alt="" style={styles.heroImageBlur} />
        ) : (
           <div style={styles.heroGradient} />
        )}
        <div style={styles.heroOverlay} />
      </div>

      <div style={styles.contentWrapper}>
        
        {/* CAMPUS ID */}
        <div style={styles.cardWrapper} className="fade-in-up">
          <div style={styles.campusCard}>
            <div style={styles.watermark}>CAMPUS ID</div>

            <div style={styles.cardHeader}>
              <div style={styles.uniBadge}>
                 <GraduationCap size={14} color="#fff" style={{marginRight:6}}/>
                 {user.university}
              </div>
              
              <button onClick={handleShareProfile} style={styles.iconButton}>
                  <Share2 size={20} color="#fff" />
              </button>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.cardAvatarContainer}>
                {user.avatar ? (
                  <img src={user.avatar} style={styles.cardAvatar} alt="Avatar" />
                ) : (
                  <div style={styles.cardAvatarPlaceholder}>{getInitials(user.name)}</div>
                )}
              </div>

              <div style={styles.cardInfo}>
                <div style={styles.studentName}>{user.name}</div>
                
                {user.username && (
                    <div style={styles.username}>@{user.username}</div>
                )}
                
                <div style={styles.studentRole}>Студент / {user.institute}</div>
                
                <div style={styles.cardGrid}>
                  <div>
                    <div style={styles.cardLabel}>КУРС</div>
                    <div style={styles.cardValue}>{user.course}</div>
                  </div>
                  <div>
                    <div style={styles.cardLabel}>ГРУППА</div>
                    <div style={styles.cardValue}>{user.group || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.cardFooter}>
              <div style={styles.idNumber}>ID: {String(user.telegram_id || user.id).slice(0, 10)}</div>
              <QrCode size={20} color="rgba(255,255,255,0.4)" />
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div style={styles.actionContainer}>
            <button 
                style={styles.editButton} 
                onClick={() => { hapticFeedback('light'); setShowEditModal(true); }}
            >
                <Edit2 size={16} />
                <span>Редактировать профиль</span>
            </button>

            <button 
                style={{
                    ...styles.editButton, 
                    marginTop: 10, 
                    borderColor: 'rgba(239, 68, 68, 0.3)', 
                    color: '#ef4444'
                }} 
                onClick={handleLogout}
            >
                <LogOut size={16} />
                <span>Выйти (Dev Reset)</span>
            </button>
        </div>

        {/* TABS */}
        <div style={styles.tabsContainer}>
          <div style={styles.tabsWrapper}>
            <div 
              style={{
                ...styles.activeIndicator,
                transform: `translateX(${activeTabIndex * 100}%)`,
                backgroundColor: activeColor, 
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
                  <span style={{ position: 'relative', zIndex: 2 }}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* КОНТЕНТ */}
        <div style={styles.feedContainer}>
            
            {activeTab === 'about' && (
                <div className="fade-in" style={{padding: '0 16px'}}>
                    
                    {/* Статистика */}
                    <div style={styles.statsGrid}>
                        <div style={styles.statItem}>
                            <FileText size={20} color={TAB_COLORS.posts} />
                            <span style={styles.statValue}>{stats.posts_count || 0}</span>
                            <span style={styles.statLabel}>Постов</span>
                        </div>
                        <div style={styles.statItem}>
                            <MessageCircle size={20} color={TAB_COLORS.about} />
                            <span style={styles.statValue}>{stats.comments_count || 0}</span>
                            <span style={styles.statLabel}>Комментов</span>
                        </div>
                        <div style={styles.statItem}>
                            <Heart size={20} color="#ec4899" />
                            <span style={styles.statValue}>{stats.likes_count || 0}</span>
                            <span style={styles.statLabel}>Лайков</span>
                        </div>
                        <div style={styles.statItem}>
                            <Calendar size={20} color={TAB_COLORS.market} />
                            <span style={styles.statValue}>{formatDate(user.created_at)}</span>
                            <span style={styles.statLabel}>С нами с</span>
                        </div>
                    </div>

                    {/* Анкета знакомств */}
                    <div 
                        style={{
                            ...styles.datingStatusCard,
                            backgroundImage: user.show_in_dating 
                                ? 'linear-gradient(#1e1e1e, #1e1e1e), linear-gradient(135deg, #ec4899, #8b5cf6)'
                                : 'none',
                            border: user.show_in_dating ? '1px solid transparent' : '1px solid #333'
                        }}
                    >
                        <div style={styles.datingInfo}>
                            <div style={styles.heartContainer}>
                                <Heart 
                                    size={24} 
                                    fill={user.show_in_dating ? "#ec4899" : "none"} 
                                    color={user.show_in_dating ? "#ec4899" : "#666"} 
                                    style={{
                                        animation: user.show_in_dating ? 'heartbeat 1.5s infinite' : 'none',
                                        filter: user.show_in_dating ? 'drop-shadow(0 0 4px rgba(236, 72, 153, 0.6))' : 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <div style={styles.datingTitle}>Анкета знакомств</div>
                                <div style={styles.datingSubtitle}>
                                    {user.show_in_dating ? "Анкета активна, вас видят" : "Вы скрыты от всех"}
                                </div>
                            </div>
                        </div>

                        <div style={styles.switchContainer} onClick={handleDatingToggle}>
                            <div style={{
                                ...styles.switchTrack,
                                backgroundColor: user.show_in_dating ? '#10b981' : '#444'
                            }}>
                                <div style={{
                                    ...styles.switchThumb,
                                    transform: user.show_in_dating ? 'translateX(22px)' : 'translateX(2px)'
                                }} />
                            </div>
                        </div>
                    </div>

                    {datingProfile?.goals && (
                        <div style={styles.infoBlock}>
                             <div style={styles.infoLabel}>ЦЕЛИ И ИНТЕРЕСЫ</div>
                             <div style={styles.tagsRow}>
                                {datingProfile.goals.map((g, i) => (
                                    <span key={i} style={styles.tag}>{g}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'posts' && (
                <div className="fade-in">
                    <div style={{padding: '0 16px', marginBottom: 16}}>
                        <div 
                            style={{...styles.myPostsButton, borderColor: TAB_COLORS.posts}} 
                            onClick={handleOpenMyPosts}
                        >
                            <div style={styles.mpIconBg}>
                                <FileText size={20} color="#fff" />
                            </div>
                            <div style={styles.mpContent}>
                                <div style={styles.mpTitle}>Мои публикации</div>
                                <div style={styles.mpSubtitle}>{stats.posts_count} постов</div>
                            </div>
                            <ChevronRight size={20} color="#666" />
                        </div>
                    </div>
                    {posts.length > 0 ? (
                        <div style={styles.listGap}>{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
                    ) : null}
                </div>
            )}
            
            {activeTab === 'requests' && (
                <div className="fade-in">
                    {requests.length > 0 ? (
                         <div style={styles.listGap}>{requests.map(req => <RequestCard key={req.id} request={req} />)}</div>
                    ) : <EmptyState text="Нет запросов" icon="⚡️" />}
                </div>
            )}

            {activeTab === 'market' && (
                <div className="fade-in">
                    {/* Кнопка "Мои товары" */}
                    <div style={{padding: '0 16px', marginBottom: 16}}>
                        <div 
                            style={{...styles.myPostsButton, borderColor: TAB_COLORS.market}} 
                            onClick={handleOpenMyMarketItems}
                        >
                            <div style={{...styles.mpIconBg, backgroundColor: TAB_COLORS.market}}>
                                <ShoppingBag size={20} color="#fff" />
                            </div>
                            <div style={styles.mpContent}>
                                <div style={styles.mpTitle}>Мои товары</div>
                                <div style={styles.mpSubtitle}>{marketItems.length} шт</div>
                            </div>
                            <ChevronRight size={20} color="#666" />
                        </div>
                    </div>

                    {/* Превью: первые 4 товара */}
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

      <style>{`
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes heartbeat {
            0% { transform: scale(1); }
            14% { transform: scale(1.15); }
            28% { transform: scale(1); }
            42% { transform: scale(1.15); }
            70% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const EmptyState = ({ text, icon }) => (
  <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
    <div>{text}</div>
  </div>
);

const styles = {
  container: { minHeight: '100vh', background: theme.colors.bg, position: 'relative', overflow: 'hidden' },
  
  heroBackground: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, height: '500px', 
    zIndex: 0, overflow: 'hidden'
  },
  heroImageBlur: { width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(50px) brightness(0.5)', transform: 'scale(1.2)' },
  heroGradient: { width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 30%, #2a2a2a 0%, #121212 80%)' },
  heroOverlay: { 
    position: 'absolute', 
    top: 0, left: 0, right: 0, bottom: 0, 
    background: `linear-gradient(to bottom, transparent 0%, transparent 60%, ${theme.colors.bg} 100%)` 
  },
  
  contentWrapper: { position: 'relative', zIndex: 2, paddingTop: 60 },
  
  cardWrapper: { padding: '0 16px', marginBottom: 20 },
  campusCard: {
    background: 'linear-gradient(135deg, #252525 0%, #1a1a1a 100%)',
    borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  watermark: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)',
    fontSize: 60, fontWeight: 900, color: 'rgba(255,255,255,0.03)', pointerEvents: 'none', whiteSpace: 'nowrap'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  uniBadge: {
      display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, 
      color: '#fff', textTransform: 'uppercase', letterSpacing: 1
  },
  iconButton: { 
    background: 'rgba(255,255,255,0.1)',
    border: 'none', cursor: 'pointer', padding: 8, borderRadius: '50%',
    display: 'flex', alignItems: 'center', backdropFilter: 'blur(4px)'
  },
  
  cardBody: { display: 'flex', gap: 16 },
  cardAvatarContainer: {
    width: 80, height: 100, borderRadius: 8, background: '#000', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
  },
  cardAvatar: { width: '100%', height: '100%', objectFit: 'cover' },
  cardAvatarPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: '#333', background: '#e0e0e0' },
  
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  studentName: { fontSize: 19, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 2 },
  username: { fontSize: 13, color: '#8b5cf6', marginBottom: 4, fontWeight: '500' }, 
  studentRole: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  cardLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 },
  cardValue: { fontSize: 13, color: '#fff', fontWeight: 600 },

  cardFooter: { marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  idNumber: { fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  actionContainer: { padding: '0 16px', marginBottom: 24 },
  editButton: {
    width: '100%', padding: '12px', background: theme.colors.card, border: `1px solid ${theme.colors.border}`,
    borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer'
  },

  tabsContainer: {
    padding: '0 16px', marginBottom: 16, position: 'sticky', top: 10, zIndex: 10
  },
  tabsWrapper: {
    display: 'flex', background: 'rgba(118, 118, 128, 0.24)', borderRadius: 10, padding: 2, position: 'relative', height: 36,
  },
  activeIndicator: {
    position: 'absolute', top: 2, bottom: 2, left: 2, width: 'calc((100% - 4px) / 4)', borderRadius: 8,
    boxShadow: '0 3px 8px rgba(0,0,0,0.2)', transition: 'transform 0.3s cubic-bezier(0.3, 1, 0.4, 1), background-color 0.3s ease', zIndex: 1,
  },
  tabButton: {
    flex: 1, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', position: 'relative', zIndex: 2, transition: 'color 0.2s',
  },

  feedContainer: { paddingTop: 0 },
  listGap: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' },
  
  statsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12,
  },
  statItem: {
    backgroundColor: theme.colors.card, borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${theme.colors.border}`,
  },
  statValue: {
    fontSize: 14, fontWeight: 700, margin: '4px 0 2px 0', color: '#fff',
  },
  statLabel: {
    fontSize: 9, color: theme.colors.textTertiary,
  },
  
  datingStatusCard: {
    background: theme.colors.card,
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    transition: 'all 0.3s ease'
  },
  datingInfo: {
    display: 'flex', alignItems: 'center', gap: 14,
  },
  heartContainer: {
    width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  datingTitle: {
    fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2,
  },
  datingSubtitle: {
    fontSize: 11, color: theme.colors.textSecondary,
  },
  
  switchContainer: {
    cursor: 'pointer', padding: '4px', 
  },
  switchTrack: {
    width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background-color 0.3s ease',
  },
  switchThumb: {
    position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
  },

  infoBlock: { background: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${theme.colors.border}` },
  infoLabel: { fontSize: 11, fontWeight: 700, color: theme.colors.textTertiary, marginBottom: 8, letterSpacing: 0.5 },
  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: { background: 'rgba(255,255,255,0.05)', color: theme.colors.textSecondary, border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 20, fontSize: 13 },

  myPostsButton: {
    backgroundColor: theme.colors.card, borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid transparent', cursor: 'pointer',
  },
  mpIconBg: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mpContent: { flex: 1 },
  mpTitle: { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 2 },
  mpSubtitle: { fontSize: 12, color: theme.colors.textSecondary },
};

export default Profile;