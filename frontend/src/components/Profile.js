import React, { useEffect, useState } from 'react';
import { Edit } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { getUserPosts, getUserStats, getMyRequests } from '../api';
import PostCard from './PostCard';
import ProfileMenuModal from './ProfileMenuModal';
import theme from '../theme';

function Profile() {
  const { 
    isRegistered, 
    user, 
    logout, 
    startRegistration, 
    setViewPostId, 
    setShowUserPosts, 
    setShowEditModal 
  } = useStore();
  
  const [userPosts, setUserPosts] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [stats, setStats] = useState({ 
    posts_count: 0, 
    comments_count: 0, 
    requests_count: 0 
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (isRegistered && user.id) {
      loadUserData();
    }
  }, [isRegistered, user.id]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const posts = await getUserPosts(user.id, 3);
      setUserPosts(posts);

      try {
        const requests = await getMyRequests(3, 0);
        setUserRequests(requests);
      } catch (err) {
        console.log('Запросы пока не загружены');
        setUserRequests([]);
      }

      const statsData = await getUserStats(user.id);
      setStats(statsData);
    } catch (error) {
      console.error('Ошибка загрузки данных профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    hapticFeedback('light');
    setShowProfileMenu(true);
  };

  const handleEdit = () => {
    hapticFeedback('light');
    setShowEditModal(true);
  };

  const handlePostClick = (postId) => {
    hapticFeedback('light');
    setViewPostId(postId);
  };

  const handleShowAllPosts = () => {
    hapticFeedback('light');
    setShowUserPosts(true);
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    hapticFeedback('light');
    setActiveTab(tab);
  };

  const handleRequestClick = (requestId) => {
    hapticFeedback('light');
    console.log('Request clicked:', requestId);
  };

  const handleShowAllRequests = () => {
    hapticFeedback('light');
    console.log('Show all requests');
  };

  if (!isRegistered) {
    return (
      <div style={styles.container}>
        <div style={styles.notRegistered}>
          <div style={styles.notRegisteredEmoji}>👋</div>
          <h3 style={styles.notRegisteredTitle}>Добро пожаловать!</h3>
          <p style={styles.notRegisteredText}>
            Зарегистрируйтесь, чтобы создать свой профиль и начать общаться
          </p>
          <button 
            onClick={startRegistration} 
            style={styles.registerButton}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ✨ Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div 
          style={styles.avatarContainer}
          onClick={handleAvatarClick}
        >
          <div style={styles.avatar}>
            {user.name ? user.name[0].toUpperCase() : 'П'}
          </div>
          <div style={styles.settingsHint}>⚙️</div>
        </div>

        <h2 style={styles.name}>
          {user.name}{user.age ? `, ${user.age}` : ''}
        </h2>
        
        <p style={styles.university}>
          {user.university} • {user.institute} • {user.course} курс
        </p>

        {user.bio && (
          <p style={styles.bio}>"{user.bio}"</p>
        )}

        {user.interests && user.interests.length > 0 && (
          <div style={styles.interests}>
            {user.interests.slice(0, 3).map((interest, idx) => (
              <span 
                key={interest} 
                style={{
                  ...styles.interestTag,
                  animationDelay: `${idx * 0.1}s`
                }}
              >
                {interest}
              </span>
            ))}
            {user.interests.length > 3 && (
              <span style={styles.interestTag}>
                +{user.interests.length - 3}
              </span>
            )}
          </div>
        )}

        <button 
          onClick={handleEdit} 
          style={styles.editButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(135, 116, 225, 0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Edit size={16} />
          Редактировать профиль
        </button>
      </div>

      <div style={styles.stats}>
        <div style={{...styles.statCard, animationDelay: '0s'}}>
          <div style={styles.statIcon}>📝</div>
          <div style={styles.statValue}>{stats.posts_count}</div>
          <div style={styles.statLabel}>ПОСТОВ</div>
        </div>

        <div style={{...styles.statCard, animationDelay: '0.1s'}}>
          <div style={styles.statIcon}>💬</div>
          <div style={styles.statValue}>{stats.comments_count}</div>
          <div style={styles.statLabel}>КОММЕНТАРИЕВ</div>
        </div>

        <div style={{...styles.statCard, animationDelay: '0.2s'}}>
          <div style={styles.statIcon}>📬</div>
          <div style={styles.statValue}>{stats.requests_count}</div>
          <div style={styles.statLabel}>ЗАПРОСОВ</div>
        </div>
      </div>

      <div style={styles.tabsContainer}>
        <button
          onClick={() => handleTabChange('posts')}
          style={{
            ...styles.tab,
            ...(activeTab === 'posts' ? styles.tabActive : styles.tabInactive)
          }}
        >
          📝 Посты
          <span style={styles.tabBadge}>{stats.posts_count}</span>
        </button>

        <button
          onClick={() => handleTabChange('requests')}
          style={{
            ...styles.tab,
            ...(activeTab === 'requests' ? styles.tabActive : styles.tabInactive)
          }}
        >
          📬 Запросы
          <span style={styles.tabBadge}>{stats.requests_count}</span>
        </button>
      </div>

      {activeTab === 'posts' && stats.posts_count > 0 && (
        <button 
          onClick={handleShowAllPosts}
          style={styles.showAllButtonTop}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(135, 116, 225, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(135, 116, 225, 0.4)';
          }}
        >
          📂 Все мои посты ({stats.posts_count}) →
        </button>
      )}

      {activeTab === 'requests' && stats.requests_count > 0 && (
        <button 
          onClick={handleShowAllRequests}
          style={styles.showAllButtonTop}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(135, 116, 225, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(135, 116, 225, 0.4)';
          }}
        >
          📬 Все мои запросы ({stats.requests_count}) →
        </button>
      )}

      <div style={styles.content}>
        {activeTab === 'posts' && (
          <>
            {!loading && userPosts.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyEmoji}>📝</div>
                <div style={styles.emptyTitle}>У вас пока нет постов</div>
                <div style={styles.emptySubtitle}>
                  Нажмите кнопку "+" внизу экрана, чтобы создать первый пост
                </div>
              </div>
            )}

            {userPosts.slice(0, 3).map((post, idx) => (
              <div 
                key={post.id} 
                onClick={() => handlePostClick(post.id)}
                style={{
                  animation: `fadeInUp 0.4s ease ${idx * 0.1}s both`
                }}
              >
                <PostCard post={post} />
              </div>
            ))}
          </>
        )}

        {activeTab === 'requests' && (
          <>
            {!loading && userRequests.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyEmoji}>📭</div>
                <div style={styles.emptyTitle}>У вас пока нет запросов</div>
                <div style={styles.emptySubtitle}>
                  Создайте запрос, чтобы найти помощь, команду или компанию
                </div>
              </div>
            )}

            {userRequests.slice(0, 3).map((request, idx) => (
              <div 
                key={request.id} 
                style={{
                  ...styles.requestCard,
                  animation: `fadeInUp 0.4s ease ${idx * 0.1}s both`
                }}
                onClick={() => handleRequestClick(request.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(135, 116, 225, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={styles.requestHeader}>
                  <span style={styles.requestCategory}>
                    {request.category === 'study' && '📚 Учёба'}
                    {request.category === 'help' && '🤝 Помощь'}
                    {request.category === 'hangout' && '🎉 Движ'}
                  </span>
                  <span style={styles.requestStatus}>
                    {request.status === 'active' ? '🟢 Активен' : '⚫ Закрыт'}
                  </span>
                </div>
                <h4 style={styles.requestTitle}>{request.title}</h4>
                <p style={styles.requestBody}>
                  {request.body.length > 100 
                    ? request.body.substring(0, 100) + '...' 
                    : request.body}
                </p>
                <div style={styles.requestFooter}>
                  <span>👥 {request.responses_count} откликов</span>
                  <span>👁 {request.views_count} просмотров</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showProfileMenu && (
        <ProfileMenuModal 
          onClose={() => setShowProfileMenu(false)}
          onEdit={handleEdit}
          onLogout={logout}
        />
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    paddingBottom: 80,
    minHeight: '100vh',
    background: theme.colors.bg,
  },
  
  header: {
    padding: `${theme.spacing.xxl}px ${theme.spacing.lg}px`,
    textAlign: 'center',
    borderBottom: `1px solid ${theme.colors.bgSecondary}`,
  },
  avatarContainer: {
    position: 'relative',
    display: 'inline-block',
    cursor: 'pointer',
    transition: theme.transitions.slow,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.full,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.xxxl + 4,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: `0 auto ${theme.spacing.lg}px`,
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    transition: theme.transitions.slow,
  },
  settingsHint: {
    position: 'absolute',
    top: 0,
    right: -8,
    fontSize: theme.fontSize.xl,
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.full,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${theme.colors.primary}`,
    animation: 'pulse 2s ease infinite',
  },
  name: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: `${theme.spacing.sm}px 0`,
  },
  university: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textTertiary,
    margin: `${theme.spacing.xs}px 0`,
  },
  bio: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    margin: `${theme.spacing.md}px 0`,
    padding: `0 ${theme.spacing.xxl}px`,
    lineHeight: 1.5,
  },
  interests: {
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    flexWrap: 'wrap',
    margin: `${theme.spacing.md}px ${theme.spacing.lg}px 0`,
  },
  interestTag: {
    background: 'rgba(135, 116, 225, 0.15)',
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: theme.radius.xl,
    padding: `6px ${theme.spacing.md}px`,
    fontSize: theme.fontSize.xs,
    color: '#b19ef5',
    fontWeight: theme.fontWeight.medium,
    animation: 'fadeInUp 0.5s ease both',
  },
  editButton: {
    marginTop: theme.spacing.lg,
    padding: `${theme.spacing.md}px ${theme.spacing.xxl}px`,
    background: 'transparent',
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.radius.md,
    color: theme.colors.primary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    margin: `${theme.spacing.lg}px auto 0`,
    transition: theme.transitions.slow,
  },

  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  statCard: {
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.lg}px ${theme.spacing.sm}px`,
    textAlign: 'center',
    border: `1px solid ${theme.colors.cardHover}`,
    transition: theme.transitions.slow,
    animation: 'fadeInUp 0.5s ease both',
  },
  statIcon: {
    fontSize: theme.fontSize.xxl,
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  tabsContainer: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.cardHover}`,
    position: 'sticky',
    top: 0,
    background: theme.colors.bg,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: 'none',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    position: 'relative',
  },
  tabActive: {
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    color: theme.colors.text,
    boxShadow: '0 4px 12px rgba(135, 116, 225, 0.4)',
    transform: 'translateY(-2px)',
  },
  tabInactive: {
    background: theme.colors.bgSecondary,
    color: theme.colors.textTertiary,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    background: '#ff6b9d',
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    padding: `2px 6px`,
    borderRadius: 10,
    minWidth: 18,
    textAlign: 'center',
    animation: 'bounce 1s ease infinite',
  },

  showAllButtonTop: {
    width: 'calc(100% - 32px)',
    margin: theme.spacing.lg,
    padding: `14px ${theme.spacing.xxl}px`,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    textAlign: 'center',
    transition: theme.transitions.slow,
  },

  content: {
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.lg}px`,
  },
  emptyState: {
    textAlign: 'center',
    padding: `48px ${theme.spacing.xxl}px`,
    animation: 'fadeInUp 0.5s ease',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textTertiary,
    lineHeight: 1.5,
  },

  requestCard: {
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    border: `1px solid ${theme.colors.cardHover}`,
    cursor: 'pointer',
    transition: theme.transitions.slow,
  },
  requestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  requestCategory: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  requestStatus: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  requestTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: `${theme.spacing.sm}px 0`,
  },
  requestBody: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: theme.spacing.md,
  },
  requestFooter: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
  },

  notRegistered: {
    padding: `48px ${theme.spacing.xxl}px`,
    textAlign: 'center',
  },
  notRegisteredEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.xxl,
    animation: 'bounce 2s ease infinite',
  },
  notRegisteredTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  notRegisteredText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textTertiary,
    lineHeight: 1.5,
    marginBottom: theme.spacing.xxxl,
  },
  registerButton: {
    padding: `14px ${theme.spacing.xxxl}px`,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    border: 'none',
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    transition: theme.transitions.slow,
  },
};

export default Profile;