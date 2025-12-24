import React, { useEffect, useState } from 'react';
import { Edit } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { getUserPosts, getUserStats, getMyRequests } from '../api';
import PostCard from './PostCard';
import ProfileMenuModal from './ProfileMenuModal';

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
      {/* HEADER */}
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

      {/* СТАТИСТИКА — 3 карточки */}
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

      {/* ТАБЫ */}
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

      {/* КНОПКА "ВСЕ..." СВЕРХУ */}
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

      {/* КОНТЕНТ */}
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

      {/* МОДАЛКА НАСТРОЕК */}
      {showProfileMenu && (
        <ProfileMenuModal 
          onClose={() => setShowProfileMenu(false)}
          onEdit={handleEdit}
          onLogout={logout}
        />
      )}

      {/* CSS АНИМАЦИИ (БЕЗ slideIn!) */}
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
    paddingBottom: '80px',
    minHeight: '100vh',
    background: '#0a0a0a',
  },
  
  // HEADER
  header: {
    padding: '24px 16px',
    textAlign: 'center',
    borderBottom: '1px solid #1a1a1a',
  },
  avatarContainer: {
    position: 'relative',
    display: 'inline-block',
    cursor: 'pointer',
    transition: 'transform 0.3s ease',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8774e1 0%, #b19ef5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 auto 16px',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    transition: 'all 0.3s ease',
  },
  settingsHint: {
    position: 'absolute',
    top: 0,
    right: '-8px',
    fontSize: '20px',
    background: '#1a1a1a',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #8774e1',
    animation: 'pulse 2s ease infinite',
  },
  name: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '8px 0',
  },
  university: {
    fontSize: '14px',
    color: '#888',
    margin: '4px 0',
  },
  bio: {
    fontSize: '14px',
    color: '#ccc',
    fontStyle: 'italic',
    margin: '12px 0',
    padding: '0 24px',
    lineHeight: '1.5',
  },
  interests: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    margin: '12px 16px 0',
  },
  interestTag: {
    background: 'rgba(135, 116, 225, 0.15)',
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '12px',
    color: '#b19ef5',
    fontWeight: '500',
    animation: 'fadeInUp 0.5s ease both',
  },
  editButton: {
    marginTop: '16px',
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #8774e1',
    borderRadius: '12px',
    color: '#8774e1',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: '16px auto 0',
    transition: 'all 0.3s ease',
  },

  // СТАТИСТИКА
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    padding: '16px',
  },
  statCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '16px 8px',
    textAlign: 'center',
    border: '1px solid #2a2a2a',
    transition: 'all 0.3s ease',
    animation: 'fadeInUp 0.5s ease both',
  },
  statIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // ТАБЫ
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    padding: '16px',
    borderBottom: '1px solid #2a2a2a',
    position: 'sticky',
    top: 0,
    background: '#0a0a0a',
    zIndex: 10,
  },
  tab: {
    flex: 1,
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    position: 'relative',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #8774e1 0%, #b19ef5 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(135, 116, 225, 0.4)',
    transform: 'translateY(-2px)',
  },
  tabInactive: {
    background: '#1a1a1a',
    color: '#888',
  },
  tabBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    background: '#ff6b9d',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '10px',
    minWidth: '18px',
    textAlign: 'center',
    animation: 'bounce 1s ease infinite',
  },

  // КНОПКА СВЕРХУ
  showAllButtonTop: {
    width: 'calc(100% - 32px)',
    margin: '16px',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #8774e1 0%, #b19ef5 100%)',
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: '16px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    textAlign: 'center',
    transition: 'all 0.3s ease',
  },

  // КОНТЕНТ
  content: {
    padding: '0 16px 16px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    animation: 'fadeInUp 0.5s ease',
  },
  emptyEmoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '8px',
  },
  emptySubtitle: {
    fontSize: '14px',
    color: '#888',
    lineHeight: '1.5',
  },

  // КАРТОЧКА ЗАПРОСА
  requestCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #2a2a2a',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  requestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  requestCategory: {
    fontSize: '12px',
    color: '#8774e1',
    fontWeight: '600',
  },
  requestStatus: {
    fontSize: '11px',
    color: '#888',
  },
  requestTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '8px 0',
  },
  requestBody: {
    fontSize: '14px',
    color: '#ccc',
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  requestFooter: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#888',
  },

  // NOT REGISTERED
  notRegistered: {
    padding: '48px 24px',
    textAlign: 'center',
  },
  notRegisteredEmoji: {
    fontSize: '64px',
    marginBottom: '24px',
    animation: 'bounce 2s ease infinite',
  },
  notRegisteredTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '12px',
  },
  notRegisteredText: {
    fontSize: '16px',
    color: '#888',
    lineHeight: '1.5',
    marginBottom: '32px',
  },
  registerButton: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #8774e1 0%, #b19ef5 100%)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
    transition: 'all 0.3s ease',
  },
};

export default Profile;