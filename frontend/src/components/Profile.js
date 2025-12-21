import React, { useEffect, useState } from 'react';
import { Settings, LogOut, Edit } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { getUserPosts, getUserStats } from '../api';
import PostCard from './PostCard';

function Profile() {
  const { isRegistered, user, logout, startRegistration, setViewPostId, setShowUserPosts, setShowEditModal } = useStore();
  const [userPosts, setUserPosts] = useState([]);
  const [stats, setStats] = useState({ posts_count: 0, comments_count: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRegistered && user.id) {
      loadUserData();
    }
  }, [isRegistered, user.id]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Загружаем последние 3 постов
      const posts = await getUserPosts(user.id, 3);
      setUserPosts(posts);

      // Загружаем статистику
      const statsData = await getUserStats(user.id);
      setStats(statsData);
    } catch (error) {
      console.error('Ошибка загрузки данных профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    hapticFeedback('medium');
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      logout();
    }
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

  // Если пользователь не зарегистрирован
  if (!isRegistered) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👤</div>
          <h2 style={styles.emptyTitle}>Добро пожаловать!</h2>
          <p style={styles.emptyText}>
            Зарегистрируйтесь, чтобы создать свой профиль и начать общаться
          </p>
          <button onClick={startRegistration} style={styles.registerButton}>
            Начать регистрацию
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Шапка профиля */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          {user.name?.[0] || '?'}
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
        <button onClick={handleEdit} style={styles.editButton}>
          <Edit size={16} />
          <span>Редактировать профиль</span>
        </button>
      </div>

      {/* Счётчики */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📝</div>
          <div style={styles.statNumber}>{stats.posts_count}</div>
          <div style={styles.statLabel}>Постов</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💬</div>
          <div style={styles.statNumber}>{stats.comments_count}</div>
          <div style={styles.statLabel}>Комментариев</div>
        </div>
      </div>

      {/* Мои посты */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📝 МОИ ПОСТЫ</h3>
        
        {loading ? (
          <div style={styles.loading}>Загрузка...</div>
        ) : userPosts.length > 0 ? (
          <>
            {userPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => handlePostClick(post.id)}
              />
            ))}
            
            {stats.posts_count > 3 && (
              <button onClick={handleShowAllPosts} style={styles.showAllButton}>
                📂 Показать все посты ({stats.posts_count})
              </button>
            )}
          </>
        ) : (
          <div style={styles.emptyPosts}>
            <p style={styles.emptyPostsText}>У вас пока нет постов</p>
            <p style={styles.emptyPostsHint}>
              Нажмите кнопку "+" внизу экрана, чтобы создать первый пост
            </p>
          </div>
        )}
      </div>

      {/* Настройки закрепленные кнопки внизу*/}
      <div style={styles.fixedFooter}>
        <button style={styles.settingsButton}>
          <Settings size={20} />
          <span>Настройки</span>
        </button>
        <button onClick={handleLogout} style={styles.logoutButton}>
          <LogOut size={20} />
          <span>Выход</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#121212',
    minHeight: '100vh',
    paddingBottom: '80px',
  },
  header: {
    padding: '24px 16px',
    textAlign: 'center',
    borderBottom: '1px solid #333',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#8774e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 auto 16px',
  },
  name: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 8px 0',
  },
  university: {
    fontSize: '14px',
    color: '#999',
    marginBottom: '12px',
  },
  bio: {
    fontSize: '15px',
    color: '#ccc',
    fontStyle: 'italic',
    marginBottom: '16px',
  },
  editButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #8774e1',
    backgroundColor: 'transparent',
    color: '#8774e1',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    margin: '0 auto',
  },
  statsContainer: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    padding: '14px 12px',
    textAlign: 'center',
    border: '1px solid #333',
  },
  statIcon: {
    fontSize: '20px',
    marginBottom: '4px',
    opacity: 0.8,
  },
  statNumber: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#8774e1',
    marginBottom: '2px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#999',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  section: {
    padding: '20px 16px',
    borderBottom: '1px solid #333',
    marginBottom: '80px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
  },
  emptyPosts: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyPostsText: {
    fontSize: '16px',
    color: '#999',
    marginBottom: '8px',
  },
  emptyPostsHint: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
  },
  showAllButton: {
    width: '100%',
    padding: '14px',
    marginTop: '12px',
    borderRadius: '12px',
    border: '1px solid #8774e1',
    backgroundColor: '#8774e120',
    color: '#8774e1',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s',
  },
  fixedFooter: {
    position: 'fixed',
    bottom: '60px',
    left: 0,
    right: 0,
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
    backgroundColor: '#121212',
    borderTop: '1px solid #333',
    zIndex: 100,
  },
  settingsButton: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s',
  },
  logoutButton: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #ff4444',
    backgroundColor: 'transparent',
    color: '#ff4444',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.2s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#999',
    lineHeight: '1.5',
    marginBottom: '24px',
    maxWidth: '320px',
  },
  registerButton: {
    padding: '14px 32px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default Profile;