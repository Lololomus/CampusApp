import React from 'react';
import { Settings, LogOut, Edit } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';

function Profile() {
  const { isRegistered, user, logout, startRegistration, posts } = useStore();

  const handleLogout = () => {
    hapticFeedback('medium');
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      logout();
    }
  };

  const handleEdit = () => {
    hapticFeedback('light');
    alert('Редактирование профиля - в разработке');
  };

  // Если пользователь не зарегистрирован
  if (!isRegistered) {
    return (
      <div style={styles.container}>
        <div style={styles.guestView}>
          <div style={styles.guestIcon}>👤</div>
          <h2 style={styles.guestTitle}>Вы гость</h2>
          <p style={styles.guestMessage}>
            Зарегистрируйтесь, чтобы создать свой профиль и начать общаться
          </p>
          <button onClick={startRegistration} style={styles.registerButton}>
            Создать профиль
          </button>
        </div>
      </div>
    );
  }

  // Фильтруем посты пользователя (если есть)
  const userPosts = posts.filter(post => post.author === user.name);

  return (
    <div style={styles.container}>
      
      {/* Шапка профиля */}
      <div style={styles.header}>
        
        {/* Аватар */}
        <div style={styles.avatarWrapper}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {user.name ? user.name[0].toUpperCase() : '?'}
            </div>
          )}
        </div>

        {/* Основная информация */}
        <h2 style={styles.name}>
          {user.name}, {user.age || 20}
        </h2>
        
        <div style={styles.university}>
          {user.university} • {user.institute} • {user.course} курс
          {user.group && ` • ${user.group}`}
        </div>

        {/* Био */}
        {user.bio && (
          <div style={styles.bioWrapper}>
            <p style={styles.bio}>"{user.bio}"</p>
          </div>
        )}

        {/* Кнопка редактирования */}
        <button onClick={handleEdit} style={styles.editButton}>
          <Edit size={18} />
          <span>Редактировать профиль</span>
        </button>
      </div>

      {/* Статистика */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{user.stats?.posts || userPosts.length}</div>
          <div style={styles.statLabel}>Постов</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{user.stats?.comments || 0}</div>
          <div style={styles.statLabel}>Комментариев</div>
        </div>
      </div>

      {/* Мои посты */}
      <div style={styles.postsSection}>
        <h3 style={styles.sectionTitle}>Мои посты</h3>
        
        {userPosts.length > 0 ? (
          <div style={styles.postsList}>
            {userPosts.map(post => (
              <div key={post.id} style={styles.postItem}>
                <h4 style={styles.postTitle}>{post.title}</h4>
                <p style={styles.postPreview}>{post.body}</p>
                <div style={styles.postMeta}>
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.commentsCount}</span>
                  <span>👁️ {post.views}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>У вас пока нет постов</p>
            <p style={styles.emptyHint}>
              Нажмите кнопку "+" внизу экрана, чтобы создать первый пост
            </p>
          </div>
        )}
      </div>

      {/* Футер с кнопками */}
      <div style={styles.footer}>
        <button onClick={handleEdit} style={styles.footerButton}>
          <Settings size={20} />
          <span>Настройки</span>
        </button>
        <button onClick={handleLogout} style={styles.logoutButton}>
          <LogOut size={20} />
          <span>Выйти</span>
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
    overflowY: 'auto'
  },
  
  // Guest view
  guestView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    padding: '32px'
  },
  guestIcon: {
    fontSize: '80px',
    marginBottom: '24px',
    opacity: 0.5
  },
  guestTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '12px'
  },
  guestMessage: {
    fontSize: '15px',
    color: '#999',
    textAlign: 'center',
    lineHeight: '1.6',
    marginBottom: '32px',
    maxWidth: '320px'
  },
  registerButton: {
    padding: '16px 32px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  },

  // Profile header
  header: {
    padding: '32px 20px 24px',
    borderBottom: '1px solid #333',
    textAlign: 'center'
  },
  avatarWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px'
  },
  avatar: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #8774e1'
  },
  avatarPlaceholder: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: '#8774e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
    fontWeight: '700',
    color: '#fff',
    border: '3px solid #6b5dd3'
  },
  name: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px'
  },
  university: {
    fontSize: '14px',
    color: '#8774e1',
    fontWeight: '500',
    marginBottom: '16px'
  },
  bioWrapper: {
    position: 'relative',
    maxWidth: '400px',
    margin: '0 auto 20px',
    padding: '0 20px'
  },
  bio: {
    fontSize: '15px',
    color: '#ccc',
    fontStyle: 'italic',
    lineHeight: '1.5',
    margin: 0
  },
  editButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s'
  },

  // Stats
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '20px',
    borderBottom: '1px solid #333'
  },
  statCard: {
    padding: '20px',
    borderRadius: '16px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  },

  // Posts section
  postsSection: {
    padding: '20px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #333'
  },
  postsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  postItem: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  postTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  postPreview: {
    fontSize: '14px',
    color: '#999',
    marginBottom: '12px',
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  postMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#666'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#999',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5'
  },

  // Footer
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '20px',
    marginTop: '24px',
    borderTop: '1px solid #333'
  },
  footerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px',
    transition: 'color 0.2s'
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: 'none',
    color: '#ff4444',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px',
    transition: 'color 0.2s'
  }
};

export default Profile;