import React from 'react';

function ProfileCardSkeleton({ mode = 'dating' }) {
  const isDatingMode = mode === 'dating';

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={styles.card}>
        {/* Shimmer overlay */}
        <div style={styles.shimmerOverlay}>
          <div style={styles.shimmer} />
        </div>

        {/* Аватар - БОЛЬШОЙ для dating, маленький для остальных */}
        <div style={isDatingMode ? styles.avatarContainerLarge : styles.avatarContainerSmall}>
          <div style={isDatingMode ? styles.avatarPlaceholderLarge : styles.avatarPlaceholderSmall}>
            {/* Пустой круг */}
          </div>
        </div>

        {/* Контент */}
        <div style={styles.content}>
          {/* Имя и возраст */}
          <div style={styles.nameRow}>
            <div style={styles.nameBlock} />
            <div style={styles.ageBlock} />
          </div>

          {/* Информация */}
          <div style={styles.infoSection}>
            <div style={styles.infoItem}>
              <div style={styles.icon} />
              <div style={styles.infoText} />
            </div>
            <div style={styles.infoItem}>
              <div style={styles.icon} />
              <div style={styles.infoText} />
            </div>
            <div style={styles.infoItem}>
              <div style={styles.icon} />
              <div style={styles.infoTextShort} />
            </div>
          </div>

          {/* РЕЖИМ ЗНАКОМСТВА */}
          {isDatingMode && (
            <>
              {/* Био */}
              <div style={styles.bioSection}>
                <div style={styles.bioLine} />
                <div style={{ ...styles.bioLine, width: '85%' }} />
              </div>

              {/* Интересы */}
              <div style={styles.section}>
                <div style={styles.sectionTitleBlock} />
                <div style={styles.tags}>
                  <div style={styles.tag} />
                  <div style={{ ...styles.tag, width: '70px' }} />
                  <div style={{ ...styles.tag, width: '85px' }} />
                </div>
              </div>
            </>
          )}

          {/* РЕЖИМЫ С ПОСТАМИ */}
          {!isDatingMode && (
            <>
              {/* Блок "Ищет помощь/команду" */}
              <div style={styles.postSection}>
                <div style={styles.postSectionTitleBlock} />
                <div style={styles.postCard}>
                  <div style={styles.postTitleBlock} />
                  <div style={styles.postBodyBlock}>
                    <div style={styles.postLine} />
                    <div style={{ ...styles.postLine, width: '90%' }} />
                  </div>
                  
                  {/* Теги поста */}
                  <div style={styles.tags}>
                    <div style={styles.tagColored} />
                    <div style={{ ...styles.tagColored, width: '65px' }} />
                    <div style={{ ...styles.tagColored, width: '75px' }} />
                  </div>
                </div>
              </div>

              {/* Блок "Может помочь" */}
              <div style={styles.section}>
                <div style={styles.sectionTitleBlock} />
                <div style={styles.tags}>
                  <div style={styles.tag} />
                  <div style={{ ...styles.tag, width: '80px' }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const shimmerKeyframes = `
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
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

  // Shimmer overlay
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 1,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%)',
    animation: 'shimmer 2s infinite',
    transform: 'translateX(-100%)',
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
  },

  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  // Имя и возраст
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  nameBlock: {
    width: '160px',
    height: '28px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ageBlock: {
    width: '50px',
    height: '24px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  // Информация
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexShrink: 0,
  },
  infoText: {
    width: '120px',
    height: '15px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoTextShort: {
    width: '160px',
    height: '15px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Био (dating)
  bioSection: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bioLine: {
    width: '100%',
    height: '16px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Секции
  section: {
    marginTop: '8px',
  },
  sectionTitleBlock: {
    width: '100px',
    height: '16px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: '12px',
  },

  // Блок с постом
  postSection: {
    marginTop: '12px',
  },
  postSectionTitleBlock: {
    width: '140px',
    height: '17px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: '12px',
  },
  postCard: {
    backgroundColor: '#252525',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  postTitleBlock: {
    width: '85%',
    height: '18px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  postBodyBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  postLine: {
    width: '100%',
    height: '15px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Теги
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },
  tag: {
    width: '90px',
    height: '30px',
    backgroundColor: 'rgba(135, 116, 225, 0.1)',
    border: '1px solid rgba(135, 116, 225, 0.3)',
    borderRadius: '12px',
  },
  tagColored: {
    width: '80px',
    height: '30px',
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    border: '1.5px solid rgba(100, 200, 255, 0.5)',
    borderRadius: '12px',
  },
};

export default ProfileCardSkeleton;