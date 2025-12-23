import React from 'react';
import { MapPin, GraduationCap, Calendar, Tag } from 'lucide-react';

function ProfileCard({ profile, mode, onSkip, onAction, isAnimating, swipeDirection }) {
  if (!profile) return null;

  const isDatingMode = mode === 'dating';

  // Динамическая анимация в зависимости от direction
  let animationStyle = 'slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  
  if (isAnimating) {
    if (swipeDirection === 'left') {
      animationStyle = 'swipeLeft 0.4s ease-out forwards';
    } else if (swipeDirection === 'right') {
      animationStyle = 'swipeRight 0.4s ease-out forwards';
    }
  }

  const cardStyle = {
    ...styles.card,
    animation: animationStyle,
  };

  return (
    <>
      <style>{keyframes}</style>
      <div style={cardStyle}>
        {/* Аватар - БОЛЬШОЙ для dating, маленький для остальных */}
        <div style={isDatingMode ? styles.avatarContainerLarge : styles.avatarContainerSmall}>
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} style={styles.avatarImage} />
          ) : (
            <div style={isDatingMode ? styles.avatarPlaceholderLarge : styles.avatarPlaceholderSmall}>
              {profile.name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* Контент */}
        <div style={styles.content}>
          {/* Имя и возраст */}
          <h2 style={styles.name}>
            {profile.name}
            {profile.age && <span style={styles.age}>, {profile.age}</span>}
          </h2>

          {/* Информация */}
          <div style={styles.infoSection}>
            {profile.university && (
              <div style={styles.infoItem}>
                <GraduationCap size={16} color="#888" />
                <span>{profile.university}</span>
              </div>
            )}
            {profile.institute && (
              <div style={styles.infoItem}>
                <MapPin size={16} color="#888" />
                <span>{profile.institute}</span>
              </div>
            )}
            {!profile.hide_course_group && profile.course && (
              <div style={styles.infoItem}>
                <Calendar size={16} color="#888" />
                <span>{profile.course} курс{profile.group ? ` · ${profile.group}` : ''}</span>
              </div>
            )}
          </div>

          {/* РЕЖИМ ЗНАКОМСТВА */}
          {isDatingMode && (
            <>
              {/* Био */}
              {profile.bio && (
                <div style={styles.bioSection}>
                  <p style={styles.bioText}>{profile.bio}</p>
                </div>
              )}

              {/* Интересы */}
              {profile.interests && profile.interests.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Интересы</h3>
                  <div style={styles.tags}>
                    {profile.interests.map((interest, idx) => (
                      <span key={idx} style={styles.tag}>
                        #{interest.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* РЕЖИМЫ С ПОСТАМИ */}
          {!isDatingMode && profile.active_post && (
            <>
              {/* Блок "Ищет помощь/команду" */}
              <div style={styles.postSection}>
                <h3 style={styles.postSectionTitle}>
                  {mode === 'study' && '📚 Ищет помощь'}
                  {mode === 'help' && '🤝 Нужна помощь'}
                  {mode === 'hangout' && '🎉 Ищет компанию'}
                </h3>
                <div style={styles.postCard}>
                  <h4 style={styles.postTitle}>{profile.active_post.title}</h4>
                  <p style={styles.postBody}>{profile.active_post.body}</p>
                  
                  {/* Теги поста */}
                  {profile.active_post.tags && profile.active_post.tags.length > 0 && (
                    <div style={styles.tags}>
                      {profile.active_post.tags.map((tag, idx) => (
                        <span key={idx} style={styles.tagColored}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Блок "Может помочь" */}
              {profile.interests && profile.interests.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>💡 Может помочь с</h3>
                  <div style={styles.tags}>
                    {profile.interests.map((interest, idx) => (
                      <span key={idx} style={styles.tag}>
                        #{interest.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const keyframes = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes swipeLeft {
    to {
      opacity: 0;
      transform: translateX(-120%) rotate(-15deg);
    }
  }

  @keyframes swipeRight {
    to {
      opacity: 0;
      transform: translateX(120%) rotate(15deg);
    }
  }

  @keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;

const styles = {
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: '24px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(135, 116, 225, 0.15)',
    position: 'relative',
  },
  
  // Большой аватар (dating)
  avatarContainerLarge: {
    width: '100%',
    height: '320px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  avatarPlaceholderLarge: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '4px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '72px',
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },

  // Маленький аватар (study/help/hangout)
  avatarContainerSmall: {
    width: '100%',
    height: '180px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  avatarPlaceholderSmall: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '42px',
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  name: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  age: {
    fontSize: '24px',
    fontWeight: '400',
    color: '#aaa',
  },

  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#aaa',
    fontSize: '15px',
  },

  bioSection: {
    marginTop: '8px',
  },
  bioText: {
    color: '#ccc',
    fontSize: '16px',
    lineHeight: '1.5',
    margin: 0,
  },

  section: {
    marginTop: '8px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '12px',
  },

  // Блок с постом
  postSection: {
    marginTop: '12px',
  },
  postSectionTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '12px',
  },
  postCard: {
    backgroundColor: '#252525',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #333',
  },
  postTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
    margin: 0,
  },
  postBody: {
    fontSize: '15px',
    color: '#bbb',
    lineHeight: '1.5',
    marginBottom: '12px',
    margin: 0,
  },

  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },
  tag: {
    padding: '6px 12px',
    backgroundColor: 'rgba(135, 116, 225, 0.1)',
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#8774e1',
    fontWeight: '500',
  },
  // Цветные теги для постов
  tagColored: {
    padding: '6px 12px',
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    border: '1.5px solid rgba(100, 200, 255, 0.5)',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#64c8ff',
    fontWeight: '500',
  },
};

export default ProfileCard;