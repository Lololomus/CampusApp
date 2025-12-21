import React, { useState } from 'react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';

function Onboarding() {
  const {
    onboardingStep,
    onboardingData,
    setOnboardingStep,
    setOnboardingData,
    finishRegistration
  } = useStore();

  const [group, setGroup] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [direction, setDirection] = useState('forward');

  const goToNextStep = (data) => {
    hapticFeedback('medium');
    setDirection('forward');
    setOnboardingData(data);
    setTimeout(() => setOnboardingStep(onboardingStep + 1), 50);
  };

  const goBack = () => {
    hapticFeedback('light');
    if (onboardingStep > 1) {
      setDirection('backward');
      setTimeout(() => setOnboardingStep(onboardingStep - 1), 50);
    }
  };

  const skipGroup = () => {
    hapticFeedback('light');
    setDirection('forward');
    setOnboardingData({ group: null });
    setTimeout(() => setOnboardingStep(onboardingStep + 1), 50);
  };

  const saveGroup = () => {
    hapticFeedback('medium');
    setDirection('forward');
    setOnboardingData({ group: group.trim() || null });
    setTimeout(() => setOnboardingStep(onboardingStep + 1), 50);
  };

  const handleFinish = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Введите ваше имя');
      return;
    }
    hapticFeedback('success');
    finishRegistration({
      name: name.trim(),
      bio: bio.trim()
    });
  };

  const universities = ['МГСУ', 'РУК'];
  const institutes = ['ИЦИТ', 'ИСА', 'ИЭУИС', 'Юридический', 'Экономический'];
  const courses = [1, 2, 3, 4, 5, 6];

  const renderStep = () => {
    const animationClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

    switch (onboardingStep) {
      case 1:
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Выберите университет</div>
            <div style={styles.stepSubtitle}>Шаг 1 из 5</div>
            <div style={styles.optionsList}>
              {universities.map((uni, index) => (
                <button
                  key={uni}
                  style={{
                    ...styles.optionButton,
                    animationDelay: `${index * 0.1}s`
                  }}
                  className="fade-in-up"
                  onClick={() => goToNextStep({ university: uni })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8774e1';
                    e.currentTarget.style.backgroundColor = 'rgba(135, 116, 225, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.backgroundColor = '#1e1e1e';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {uni}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Выберите институт</div>
            <div style={styles.stepSubtitle}>Шаг 2 из 5</div>
            <div style={styles.optionsList}>
              {institutes.map((inst, index) => (
                <button
                  key={inst}
                  style={{
                    ...styles.optionButton,
                    animationDelay: `${index * 0.08}s`
                  }}
                  className="fade-in-up"
                  onClick={() => goToNextStep({ institute: inst })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8774e1';
                    e.currentTarget.style.backgroundColor = 'rgba(135, 116, 225, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.backgroundColor = '#1e1e1e';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Выберите курс</div>
            <div style={styles.stepSubtitle}>Шаг 3 из 5</div>
            <div style={styles.coursesGrid}>
              {courses.map((course, index) => (
                <button
                  key={course}
                  style={{
                    ...styles.courseButton,
                    animationDelay: `${index * 0.08}s`
                  }}
                  className="fade-in-up"
                  onClick={() => goToNextStep({ course })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#8774e1';
                    e.currentTarget.style.backgroundColor = 'rgba(135, 116, 225, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.backgroundColor = '#1e1e1e';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {course}
                </button>
              ))}
            </div>
          </div>
        );

      case 4: {
        const hasGroupValue = group.trim().length > 0;

        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Ваша группа</div>
            <div style={styles.stepSubtitle}>Шаг 4 из 5 · Опционально</div>

            <div
              style={{ ...styles.field, animationDelay: '0.0s' }}
              className="fade-in-up"
            >
              <label style={styles.label}>Укажите свою учебную группу</label>
              <input
                type="text"
                placeholder="Например БИ-21 или ИСП-6"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                style={styles.input}
                maxLength={100}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#8774e1';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#333';
                }}
              />
              <div style={styles.hint}>Группу можно указать позже в профиле</div>
            </div>

            <div style={styles.buttonGroup}>
              {hasGroupValue && (
                <button
                  style={styles.submitButton}
                  className="fade-in-up"
                  onClick={saveGroup}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(135, 116, 225, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(135, 116, 225, 0.4)';
                  }}
                >
                  Далее
                </button>
              )}

              <button
                style={styles.skipButton}
                className="fade-in-up"
                onClick={skipGroup}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#8774e1';
                  e.currentTarget.style.borderColor = '#8774e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#999';
                  e.currentTarget.style.borderColor = '#333';
                }}
              >
                Пропустить
              </button>
            </div>
          </div>
        );
      }

      case 5:
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Расскажите о себе</div>
            <div style={styles.stepSubtitle}>Шаг 5 из 5 · Последний шаг!</div>

            <form onSubmit={handleFinish} style={styles.form}>
              <div
                style={{ ...styles.field, animationDelay: '0.0s' }}
                className="fade-in-up"
              >
                <label style={styles.label}>Ваше имя *</label>
                <input
                  type="text"
                  placeholder="Иван Иванов"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  required
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#8774e1';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                  }}
                />
              </div>

              <div
                style={{ ...styles.field, animationDelay: '0.1s' }}
                className="fade-in-up"
              >
                <label style={styles.label}>О себе (опционально)</label>
                <textarea
                  placeholder="Расскажите немного о себе, своих интересах..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={styles.textarea}
                  rows={4}
                  maxLength={500}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#8774e1';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                  }}
                />
                <div style={styles.charCount}>{bio.length}/500</div>
              </div>

              <div
                style={{ ...styles.preview, animationDelay: '0.2s' }}
                className="fade-in-up"
              >
                <div style={styles.previewItem}>
                  <span style={styles.previewLabel}>Университет</span>
                  <span style={styles.previewValue}>{onboardingData.university}</span>
                </div>
                <div style={styles.previewItem}>
                  <span style={styles.previewLabel}>Институт</span>
                  <span style={styles.previewValue}>{onboardingData.institute}</span>
                </div>
                <div style={styles.previewItem}>
                  <span style={styles.previewLabel}>Курс</span>
                  <span style={styles.previewValue}>{onboardingData.course}</span>
                </div>
                {onboardingData.group && (
                  <div style={styles.previewItem}>
                    <span style={styles.previewLabel}>Группа</span>
                    <span style={styles.previewValue}>{onboardingData.group}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                style={styles.submitButton}
                className="fade-in-up"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(135, 116, 225, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(135, 116, 225, 0.4)';
                }}
              >
                Завершить регистрацию 🎉
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <style>{`
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .slide-in-right {
          animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .slide-in-left {
          animation: slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fade-in-up {
          animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      <div style={styles.overlay}>
        <div style={styles.container}>
          {renderStep()}
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#121212',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  container: {
    width: '100%',
    maxWidth: '500px'
  },
  stepContent: {
    position: 'relative'
  },
  stepTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    marginTop: '40px'
  },
  stepSubtitle: {
    fontSize: '16px',
    color: '#8774e1',
    fontWeight: '500',
    marginBottom: '32px'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionButton: {
    padding: '20px',
    borderRadius: '16px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  coursesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  courseButton: {
    padding: '32px 20px',
    borderRadius: '16px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '28px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  form: {
    marginBottom: '24px'
  },
  field: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#999',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  textarea: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    resize: 'none',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  charCount: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'right',
    marginTop: '4px'
  },
  hint: {
    fontSize: '13px',
    color: '#666',
    marginTop: '8px',
    fontStyle: 'italic'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '24px'
  },
  submitButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  },
  skipButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: 'transparent',
    color: '#999',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  preview: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    marginBottom: '24px'
  },
  previewItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #333'
  },
  previewLabel: {
    fontSize: '14px',
    color: '#999'
  },
  previewValue: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '500'
  }
};

export default Onboarding;