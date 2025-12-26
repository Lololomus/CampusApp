import React from 'react';
import { MapPin, GraduationCap, Calendar } from 'lucide-react';
import theme from '../../theme';


function ProfileCard({ profile, onSkip, onAction, isAnimating, swipeDirection }) {
  if (!profile) return null;

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
        {/* Аватар */}
        <div style={styles.avatarContainer}>
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} style={styles.avatarImage} />
          ) : (
            <div style={styles.avatarPlaceholder}>
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
                <GraduationCap size={16} color={theme.colors.textTertiary} />
                <span>{profile.university}</span>
              </div>
            )}
            {profile.institute && (
              <div style={styles.infoItem}>
                <MapPin size={16} color={theme.colors.textTertiary} />
                <span>{profile.institute}</span>
              </div>
            )}
            {!profile.hide_course_group && profile.course && (
              <div style={styles.infoItem}>
                <Calendar size={16} color={theme.colors.textTertiary} />
                <span>{profile.course} курс{profile.group ? ` · ${profile.group}` : ''}</span>
              </div>
            )}
          </div>

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
`;


const styles = {
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: `0 20px 60px ${theme.colors.overlay}, 0 0 80px rgba(135, 116, 225, 0.15)`,
    position: 'relative',
  },
  
  avatarContainer: {
    width: '100%',
    height: 320,
    background: `linear-gradient(135deg, ${theme.colors.gradientStart} 0%, ${theme.colors.gradientEnd} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  
  avatarPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '4px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 72,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textTransform: 'uppercase',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  content: {
    flex: 1,
    padding: theme.spacing.xxl,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },

  name: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: 0,
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  
  age: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.normal,
    color: theme.colors.textTertiary,
  },

  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
  },

  bioSection: {
    marginTop: theme.spacing.sm,
  },
  
  bioText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.lg,
    lineHeight: 1.5,
    margin: 0,
  },

  section: {
    marginTop: theme.spacing.sm,
  },
  
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  
  tag: {
    padding: `6px ${theme.spacing.md}px`,
    backgroundColor: 'rgba(135, 116, 225, 0.1)',
    border: `1px solid rgba(135, 116, 225, 0.3)`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
};


export default ProfileCard;