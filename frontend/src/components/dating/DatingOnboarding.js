import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Heart } from 'lucide-react';
import { useStore } from '../../store';
import { createDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import {
  PROMPT_OPTIONS,
  PROMPT_MAX_LENGTH,
  BIO_MIN_LENGTH,
  BIO_MAX_LENGTH,
  MAX_PHOTOS,
  GOAL_OPTIONS,
  MAX_GOALS,
  INTEREST_OPTIONS,
  MAX_INTERESTS
} from '../../constants/datingConstants';

function DatingOnboarding({ onClose }) {
  const { setDatingProfile } = useStore();
  
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [loading, setLoading] = useState(false);

  const [gender, setGender] = useState(null);
  const [age, setAge] = useState(20);
  const [lookingFor, setLookingFor] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [bio, setBio] = useState('');
  const [goals, setGoals] = useState([]);
  const [interests, setInterests] = useState([]);
  
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [promptAnswer, setPromptAnswer] = useState('');

  const fileInputRef = useRef(null);
  const ageScrollRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previews.length > 0) {
        revokeObjectURLs(previews);
      }
    };
  }, [previews]);

  useEffect(() => {
    if (step === 2 && ageScrollRef.current) {
      const itemWidth = 60;
      const initialIndex = age - 16;
      
      setTimeout(() => {
        ageScrollRef.current.scrollLeft = initialIndex * itemWidth;
      }, 100);

      const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        const newAge = Math.max(16, Math.min(50, age + delta));
        
        if (newAge !== age) {
          setAge(newAge);
          
          const targetScroll = (newAge - 16) * itemWidth;
          ageScrollRef.current.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
          });
        }
      };

      const scrollEl = ageScrollRef.current;
      scrollEl.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        scrollEl.removeEventListener('wheel', handleWheel);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [step, age]);

  const goToNextStep = () => {
    hapticFeedback('medium');
    setDirection('forward');
    setTimeout(() => setStep(prev => prev + 1), 50);
  };

  const goBack = () => {
    hapticFeedback('light');
    if (step > 0) {
      setDirection('backward');
      setTimeout(() => setStep(prev => prev - 1), 50);
    }
  };

  const handleAgeScroll = () => {
    if (!ageScrollRef.current) return;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollLeft = ageScrollRef.current.scrollLeft;
      const itemWidth = 60;
      const centerIndex = Math.round(scrollLeft / itemWidth);
      const selectedAge = 16 + centerIndex;
      
      if (selectedAge !== age && selectedAge >= 16 && selectedAge <= 50) {
        setAge(selectedAge);
      }
    }, 100);
  };

  const handlePhotoUpload = async (e) => {
    if (!e.target.files.length) return;
    hapticFeedback('light');

    if (photos.length + e.target.files.length > MAX_PHOTOS) {
      alert(`Максимум ${MAX_PHOTOS} фото`);
      return;
    }

    setLoading(true);
    const processed = await processImageFiles(e.target.files);
    setPhotos(prev => [...prev, ...processed.map(p => p.file)]);
    setPreviews(prev => [...prev, ...processed.map(p => p.preview)]);
    setLoading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index) => {
    hapticFeedback('medium');
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleGoal = (goalValue) => {
    hapticFeedback('light');
    
    setGoals(prev => {
      if (prev.includes(goalValue)) {
        return prev.filter(g => g !== goalValue);
      }
      
      if (prev.length >= MAX_GOALS) {
        alert(`Можно выбрать максимум ${MAX_GOALS} цели`);
        return prev;
      }
      
      return [...prev, goalValue];
    });
  };

  const toggleInterest = (interestValue) => {
    hapticFeedback('light');
    
    setInterests(prev => {
      if (prev.includes(interestValue)) {
        return prev.filter(i => i !== interestValue);
      }
      
      if (prev.length >= MAX_INTERESTS) {
        alert(`Можно выбрать максимум ${MAX_INTERESTS} интересов`);
        return prev;
      }
      
      return [...prev, interestValue];
    });
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      alert('Загрузите хотя бы 1 фото');
      return;
    }

    if (bio.trim().length === 0) {
      alert('Напиши о себе хотя бы пару слов');
      return;
    }

    if (bio.trim().length < BIO_MIN_LENGTH) {
      alert(`Биография должна быть минимум ${BIO_MIN_LENGTH} символов`);
      return;
    }

    if (bio.trim().length > BIO_MAX_LENGTH) {
      alert(`Биография не должна превышать ${BIO_MAX_LENGTH} символов`);
      return;
    }

    const bioWithoutEmoji = bio.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    const lettersOnly = bioWithoutEmoji.replace(/[^\wа-яА-ЯёЁ\s]/g, '');
    
    if (lettersOnly.trim().length < BIO_MIN_LENGTH) {
      alert(`Биография должна содержать минимум ${BIO_MIN_LENGTH} букв (без учёта эмодзи и символов)`);
      return;
    }

    if (selectedPromptId && promptAnswer.trim().length === 0) {
      alert('Закончи ответ на вопрос или убери его');
      return;
    }

    if (selectedPromptId && promptAnswer.trim().length > 0) {
      if (promptAnswer.trim().length < 10) {
        alert('Ответ должен быть минимум 10 символов');
        return;
      }
      if (promptAnswer.trim().length > PROMPT_MAX_LENGTH) {
        alert(`Ответ не должен превышать ${PROMPT_MAX_LENGTH} символов`);
        return;
      }
    }

    setLoading(true);
    hapticFeedback('success');
    setDirection('forward');
    setTimeout(() => setStep(6), 50);

    try {
      const profileData = {
        gender,
        age,
        looking_for: lookingFor,
        bio: bio.trim() || undefined,
        goals,
        interests,
        photos,
        prompt_question: selectedPromptId ? PROMPT_OPTIONS.find(p => p.id === selectedPromptId)?.question : undefined,
        prompt_answer: promptAnswer.trim() || undefined
      };

      const newProfile = await createDatingProfile(profileData);
      setDatingProfile(newProfile);

      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
    } catch (error) {
      console.error('Dating profile creation error:', error);
      const errorMsg = error.response?.data?.detail || 'Ошибка создания профиля. Попробуй ещё раз';
      alert(errorMsg);
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const animationClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

    switch (step) {
      case 0:
        return (
          <div style={styles.centeredContainer} className={animationClass}>
            <div style={styles.contentWrapper}>
              <div style={styles.landingIcon}>
                <Heart size={48} color="#fff" fill="#fff" />
              </div>
              <div style={styles.stepTitle}>Campus Dating</div>
              <div style={styles.landingSubtitle}>
                Найди пару, друзей или компанию для учебы в своем вузе
              </div>
              
              <div style={styles.featuresList}>
                <div style={styles.featureItem}>🎓 Только студенты твоего вуза</div>
                <div style={styles.featureItem}>🔒 Приватно и безопасно</div>
                <div style={styles.featureItem}>✨ Бесплатно навсегда</div>
              </div>

              <button 
                style={styles.landingButton}
                onClick={goToNextStep}
              >
                Создать анкету
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div style={styles.centeredContainer} className={animationClass}>
            <div style={styles.contentWrapper}>
              <div style={styles.stepTitle}>Основная информация</div>
              <div style={styles.stepSubtitle}>Шаг 1 из 5</div>
              
              <div style={styles.fieldGroup}>
                <div style={styles.fieldLabel}>Я</div>
                <div style={styles.genderButtons}>
                  <button
                    onClick={() => { 
                      setGender('male'); 
                      hapticFeedback('light'); 
                    }}
                    style={{
                      ...styles.genderButton,
                      ...(gender === 'male' ? styles.genderButtonActive : {})
                    }}
                  >
                    👨 Парень
                  </button>
                  <button
                    onClick={() => { 
                      setGender('female'); 
                      hapticFeedback('light'); 
                    }}
                    style={{
                      ...styles.genderButton,
                      ...(gender === 'female' ? styles.genderButtonActive : {})
                    }}
                  >
                    👩 Девушка
                  </button>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <div style={styles.fieldLabel}>Ищу</div>
                <div style={styles.lookingForButtons}>
                  <button
                    onClick={() => { 
                      setLookingFor('female'); 
                      hapticFeedback('light'); 
                    }}
                    style={{
                      ...styles.optionButton,
                      ...(lookingFor === 'female' ? styles.optionButtonActive : {})
                    }}
                  >
                    👩 Девушек
                  </button>
                  <button
                    onClick={() => { 
                      setLookingFor('male'); 
                      hapticFeedback('light'); 
                    }}
                    style={{
                      ...styles.optionButton,
                      ...(lookingFor === 'male' ? styles.optionButtonActive : {})
                    }}
                  >
                    👨 Парней
                  </button>
                  <button
                    onClick={() => { 
                      setLookingFor('all'); 
                      hapticFeedback('light'); 
                    }}
                    style={{
                      ...styles.optionButton,
                      ...(lookingFor === 'all' ? styles.optionButtonActive : {})
                    }}
                  >
                    👥 Неважно
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        const ages = Array.from({ length: 35 }, (_, i) => i + 16);
        
        return (
          <div style={styles.centeredContainer} className={animationClass}>
            <div style={styles.contentWrapper}>
              <div style={styles.stepTitle}>Сколько тебе лет?</div>
              <div style={styles.stepSubtitle}>Шаг 2 из 5</div>
              
              <div style={styles.agePickerContainer}>
                <div style={styles.ageDisplay}>{age}</div>
                
                <div 
                  ref={ageScrollRef}
                  className="age-scroller"
                  style={styles.ageScroller}
                  onScroll={handleAgeScroll}
                  onTouchEnd={() => hapticFeedback('light')}
                >
                  <div style={{ minWidth: 'calc(50% - 30px)' }} />
                  
                  {ages.map((ageValue) => {
                    const distance = Math.abs(age - ageValue);
                    const scale = Math.max(0.6, 1 - distance * 0.15);
                    const opacity = Math.max(0.3, 1 - distance * 0.2);
                    
                    return (
                      <div
                        key={ageValue}
                        style={{
                          ...styles.ageItem,
                          transform: `scale(${scale})`,
                          opacity: opacity,
                          color: distance === 0 ? '#ff6b9d' : '#999',
                          fontWeight: distance === 0 ? 700 : 400,
                        }}
                        onClick={() => {
                          setAge(ageValue);
                          hapticFeedback('light');
                          if (ageScrollRef.current) {
                            const itemWidth = 60;
                            const targetScroll = (ageValue - 16) * itemWidth;
                            ageScrollRef.current.scrollTo({
                              left: targetScroll,
                              behavior: 'smooth'
                            });
                          }
                        }}
                      >
                        {ageValue}
                      </div>
                    );
                  })}
                  
                  <div style={{ minWidth: 'calc(50% - 30px)' }} />
                </div>
                
                <div style={styles.gradientLeft} />
                <div style={styles.gradientRight} />
                <div style={styles.centerIndicator} />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div 
            style={{
              ...styles.centeredContainer,
              paddingBottom: '160px'
            }} 
            className={animationClass}
          >
            <div style={styles.contentWrapper}>
              <div style={styles.stepTitle}>Твои фото</div>
              <div style={styles.stepSubtitle}>Шаг 3 из 5 · Минимум 1, максимум {MAX_PHOTOS}</div>

              <div style={styles.photosGrid}>
                {previews.map((src, index) => (
                  <div key={index} style={styles.photoItem} className="fade-in-up">
                    <img src={src} alt="preview" style={styles.photoImg} />
                    <button onClick={() => removePhoto(index)} style={styles.removeBtn}>
                      <X size={16} />
                    </button>
                    {index === 0 && <span style={styles.mainBadge}>Главное</span>}
                  </div>
                ))}
                
                {previews.length < MAX_PHOTOS && (
                  <button 
                    style={styles.addPhotoBtn} 
                    onClick={() => fileInputRef.current.click()}
                    className="fade-in-up"
                    disabled={loading}
                  >
                    {loading ? <div style={styles.spinner}></div> : <Camera size={32} color="#666" />}
                    <span style={styles.addPhotoText}>{loading ? 'Загрузка...' : 'Добавить'}</span>
                  </button>
                )}
              </div>
              
              <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={handlePhotoUpload} />
            </div>
          </div>
        );

      case 4:
        const selectedPrompt = selectedPromptId 
          ? PROMPT_OPTIONS.find(p => p.id === selectedPromptId) 
          : null;

        return (
          <div 
            style={{
              ...styles.centeredContainer,
              paddingBottom: '160px',
              overflowY: 'auto'
            }} 
            className={animationClass}
          >
            <div style={styles.contentWrapper}>
              <div style={styles.stepTitle}>Расскажи о себе</div>
              <div style={styles.stepSubtitle}>Шаг 4 из 5</div>

              <div className="fade-in-up" style={{ width: '100%' }}>
                <label style={styles.label}>Пару слов о себе</label>
                <textarea
                  placeholder="Учусь на программиста, люблю кофе и хакатоны..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={styles.textarea}
                  rows={4}
                  maxLength={BIO_MAX_LENGTH}
                />
                <div style={styles.charCount}>
                  {bio.length}/{BIO_MAX_LENGTH}
                  {bio.length > 0 && bio.length < BIO_MIN_LENGTH && (
                    <span style={{ color: '#ff6b9d', marginLeft: 8 }}>
                      (минимум {BIO_MIN_LENGTH})
                    </span>
                  )}
                </div>
              </div>

              <div className="fade-in-up" style={{ animationDelay: '0.1s', marginTop: 24, width: '100%' }}>
                <div style={styles.promptSection}>
                  <div style={styles.promptHeader}>
                    <span style={styles.promptIcon}>💬</span>
                    <span>Ледокол для знакомства</span>
                    <span style={styles.optionalBadge}>(опционально)</span>
                  </div>
                  <div style={styles.promptHint}>
                    Ответь на вопрос — это поможет начать диалог
                  </div>

                  <select
                    value={selectedPromptId}
                    onChange={(e) => {
                      setSelectedPromptId(e.target.value);
                      setPromptAnswer('');
                      hapticFeedback('light');
                    }}
                    style={styles.promptSelect}
                  >
                    <option value="">Выбери вопрос...</option>
                    {PROMPT_OPTIONS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.question}
                      </option>
                    ))}
                  </select>

                  {selectedPromptId && (
                    <div style={styles.promptAnswerSection}>
                      <textarea
                        value={promptAnswer}
                        onChange={(e) => setPromptAnswer(e.target.value)}
                        placeholder={selectedPrompt?.placeholder || 'Твой ответ...'}
                        maxLength={PROMPT_MAX_LENGTH}
                        style={styles.promptInput}
                        rows={3}
                      />
                      <div style={styles.charCount}>
                        {promptAnswer.length}/{PROMPT_MAX_LENGTH}
                        {promptAnswer.length > 0 && promptAnswer.length < 10 && (
                          <span style={{ color: '#ff6b9d', marginLeft: 8 }}>
                            (минимум 10)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div 
            style={{
              ...styles.centeredContainer,
              paddingBottom: '160px',
              overflowY: 'auto'
            }} 
            className={animationClass}
          >
            <div style={styles.contentWrapper}>
              <div style={styles.stepTitle}>Почти готово!</div>
              <div style={styles.stepSubtitle}>Шаг 5 из 5 · Цели и интересы</div>

              <div className="fade-in-up" style={{ width: '100%' }}>
                <label style={styles.label}>
                  Цель знакомства (выбери до {MAX_GOALS})
                  <span style={styles.counter}> {goals.length}/{MAX_GOALS}</span>
                </label>
                <div style={styles.tagsContainer}>
                  {GOAL_OPTIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => toggleGoal(value)}
                      style={{
                        ...styles.tag,
                        ...(goals.includes(value) ? styles.tagActive : {})
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fade-in-up" style={{ animationDelay: '0.1s', marginTop: 24, width: '100%' }}>
                <label style={styles.label}>
                  Интересы (выбери до {MAX_INTERESTS})
                  <span style={styles.counter}> {interests.length}/{MAX_INTERESTS}</span>
                </label>
                <div style={styles.interestsContainer}>
                  {INTEREST_OPTIONS.map(({ label, value }, idx) => (
                    <button
                      key={value}
                      onClick={() => toggleInterest(value)}
                      style={{
                        ...styles.interestTag,
                        ...(interests.includes(value) ? styles.interestTagActive : {}),
                        animationDelay: `${idx * 0.02}s`
                      }}
                      className="fade-in-up"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div style={styles.centeredContainer} className="fade-in-up">
            <div style={styles.contentWrapper}>
              <div style={styles.spinnerLarge}></div>
              <h2 style={{ ...styles.stepTitle, marginTop: 20 }}>Создаём профиль...</h2>
              <p style={{ color: '#666', marginTop: 8 }}>Обрабатываем фото и сохраняем данные</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderButtons = () => {
    if (step === 0 || step === 6) return null;

    if (step === 1) {
      return (
        <div style={styles.buttonGroupFixed}>
          <button style={styles.backButton} onClick={goBack}>Назад</button>
          <button 
            onClick={goToNextStep}
            disabled={!gender || !lookingFor}
            style={{
              ...styles.submitButton,
              opacity: (!gender || !lookingFor) ? 0.5 : 1
            }}
          >
            Далее
          </button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div style={styles.buttonGroupFixed}>
          <button style={styles.backButton} onClick={goBack}>Назад</button>
          <button style={styles.submitButton} onClick={goToNextStep}>
            Далее
          </button>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div style={styles.buttonGroupFixed}>
          <button style={styles.backButton} onClick={goBack}>Назад</button>
          <button 
            style={{
              ...styles.submitButton,
              opacity: previews.length === 0 ? 0.5 : 1
            }}
            disabled={previews.length === 0}
            onClick={goToNextStep}
          >
            Далее
          </button>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div style={styles.buttonGroupFixed}>
          <button style={styles.backButton} onClick={goBack}>Назад</button>
          <button
            onClick={() => {
              if (bio.trim().length < BIO_MIN_LENGTH) {
                alert(`Био должно содержать минимум ${BIO_MIN_LENGTH} символов`);
                return;
              }
              
              if (selectedPromptId && promptAnswer.trim().length > 0 && promptAnswer.trim().length < 10) {
                alert('Ответ на промпт должен содержать минимум 10 символов');
                return;
              }
              
              goToNextStep();
            }}
            disabled={bio.trim().length < BIO_MIN_LENGTH}
            style={{
              ...styles.submitButton,
              opacity: bio.trim().length < BIO_MIN_LENGTH ? 0.5 : 1
            }}
          >
            Далее
          </button>
        </div>
      );
    }

    if (step === 5) {
      return (
        <div style={styles.buttonGroupFixed}>
          <button style={styles.backButton} onClick={goBack}>Назад</button>
          <button 
            style={{
              ...styles.submitButton,
              opacity: interests.length === 0 ? 0.7 : 1
            }}
            onClick={handleSubmit}
            disabled={loading || interests.length === 0}
          >
            {loading ? 'Создаём...' : '✨ Создать'}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <style>{`
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .slide-in-right { animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .slide-in-left { animation: slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        
        .age-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div style={styles.overlay}>
        {renderStep()}
        {renderButtons()}
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#121212',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  centeredContainer: {
    width: '100%',
    maxWidth: '500px',
    padding: '24px 24px 140px',
    textAlign: 'center',
  },

  contentWrapper: {
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  stepTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
  },
  stepSubtitle: {
    fontSize: '16px',
    color: '#ff6b9d',
    fontWeight: '500',
    marginBottom: '32px',
  },

  landingIcon: {
    width: 80, 
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 24,
    boxShadow: '0 10px 30px rgba(255, 59, 92, 0.4)',
  },
  landingSubtitle: {
    fontSize: '16px',
    color: '#999',
    lineHeight: 1.5,
    marginBottom: 32,
    maxWidth: '320px',
  },
  featuresList: {
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12,
    width: '100%',
    maxWidth: '360px',
    marginBottom: 40,
  },
  featureItem: {
    background: 'rgba(255,255,255,0.05)',
    padding: '12px 20px',
    borderRadius: 20,
    color: '#ccc',
    fontSize: 15,
  },
  landingButton: {
    width: '100%',
    maxWidth: '360px',
    padding: '18px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 8px 24px rgba(255, 59, 92, 0.4)',
  },

  fieldGroup: {
    marginBottom: 24,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: '#999',
    marginBottom: 12,
    textAlign: 'left',
  },
  genderButtons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  genderButton: {
    padding: '16px',
    borderRadius: 12,
    border: '2px solid #333',
    background: '#1e1e1e',
    color: '#999',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  genderButtonActive: {
    background: 'rgba(255, 59, 92, 0.15)',
    border: '2px solid #ff3b5c',
    color: '#ff6b9d',
    transform: 'scale(1.05)'
  },
  lookingForButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8
  },
  optionButton: {
    padding: '12px 8px',
    borderRadius: 12,
    border: '2px solid #333',
    background: '#1e1e1e',
    color: '#999',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },
  optionButtonActive: {
    background: 'rgba(255, 59, 92, 0.15)',
    border: '2px solid #ff3b5c',
    color: '#ff6b9d',
    transform: 'scale(1.05)'
  },

  agePickerContainer: {
    position: 'relative',
    width: '100%',
    height: '280px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  ageDisplay: {
    fontSize: 72,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 4px 20px rgba(255, 59, 92, 0.4))',
  },
  ageScroller: {
    display: 'flex',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x mandatory',
    width: '100%',
    height: '60px',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    cursor: 'grab',
  },
  ageItem: {
    minWidth: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 600,
    scrollSnapAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  gradientLeft: {
    position: 'absolute',
    left: 0,
    top: '100px',
    bottom: 0,
    width: '80px',
    background: 'linear-gradient(to right, #121212, transparent)',
    pointerEvents: 'none',
    zIndex: 2,
  },
  gradientRight: {
    position: 'absolute',
    right: 0,
    top: '100px',
    bottom: 0,
    width: '80px',
    background: 'linear-gradient(to left, #121212, transparent)',
    pointerEvents: 'none',
    zIndex: 2,
  },
  centerIndicator: {
    position: 'absolute',
    top: '130px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '2px',
    height: '40px',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    borderRadius: '2px',
    opacity: 0.3,
    pointerEvents: 'none',
    zIndex: 1,
  },
  
  photosGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(3, 1fr)', 
    gap: 12, 
    width: '100%',
  },
  photoItem: { 
    aspectRatio: '1', 
    position: 'relative', 
    borderRadius: 16, 
    overflow: 'hidden', 
    border: '2px solid #333',
    backgroundColor: '#1e1e1e'
  },
  photoImg: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover' 
  },
  addPhotoBtn: {
    aspectRatio: '1', 
    borderRadius: 16,
    background: '#1e1e1e', 
    border: '2px dashed #333',
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center',
    cursor: 'pointer', 
    color: '#666', 
    gap: 4,
    transition: 'all 0.2s'
  },
  addPhotoText: { fontSize: 12, fontWeight: 500 },
  removeBtn: {
    position: 'absolute', 
    top: 6, 
    right: 6,
    width: 28, 
    height: 28, 
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)', 
    border: 'none', 
    color: '#fff',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  mainBadge: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', 
    color: '#fff', 
    fontSize: 11,
    textAlign: 'center', 
    padding: '8px 0', 
    fontWeight: 600
  },

  label: { 
    display: 'block', 
    fontSize: '14px', 
    fontWeight: '600', 
    color: '#999', 
    marginBottom: '8px',
    textAlign: 'left',
    width: '100%',
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
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  },
  charCount: { 
    fontSize: '12px', 
    color: '#666', 
    textAlign: 'right', 
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  counter: {
    fontSize: 12,
    color: '#666',
    fontWeight: 400,
    marginLeft: 4
  },

  tagsContainer: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    gap: 8,
    width: '100%',
  },
  tag: {
    padding: '10px 16px', 
    borderRadius: 20,
    background: '#1e1e1e', 
    border: '2px solid #333',
    color: '#999', 
    fontSize: 14, 
    fontWeight: 500,
    cursor: 'pointer', 
    transition: 'all 0.2s'
  },
  tagActive: {
    background: 'rgba(255, 59, 92, 0.15)',
    border: '2px solid #ff3b5c',
    color: '#ff6b9d'
  },
  
  promptSection: {
    padding: '16px',
    background: '#1e1e1e',
    borderRadius: '12px',
    border: '2px solid #333',
    width: '100%',
    boxSizing: 'border-box',
  },
  promptHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  promptIcon: {
    fontSize: 18
  },
  optionalBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: '#666',
    background: 'rgba(255,255,255,0.05)',
    padding: '3px 10px',
    borderRadius: 10,
    flexShrink: 0,
    marginLeft: 6,
  },
  promptHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
    lineHeight: 1.4,
    textAlign: 'left',
  },
  promptSelect: {
    width: '100%',
    padding: '12px',
    background: '#121212',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },
  promptAnswerSection: {
    marginTop: 12
  },
  promptInput: {
    width: '100%',
    minHeight: '80px',
    padding: '12px',
    background: '#121212',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },

  interestsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  interestTag: {
    padding: '10px 16px',
    borderRadius: 20,
    background: '#1e1e1e',
    border: '2px solid #333',
    color: '#999',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  interestTagActive: {
    background: 'rgba(255, 59, 92, 0.15)',
    border: '2px solid #ff3b5c',
    color: '#ff6b9d',
  },

  buttonGroupFixed: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    padding: '20px 24px 24px',
    background: 'linear-gradient(to top, #121212 70%, transparent)',
    zIndex: 100,
    maxWidth: '500px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  submitButton: {
    flex: 1,
    padding: '18px', 
    borderRadius: '12px', 
    border: 'none',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    color: '#fff', 
    fontSize: '16px', 
    fontWeight: '600',
    cursor: 'pointer', 
    transition: 'all 0.2s',
    boxShadow: '0 8px 24px rgba(255, 59, 92, 0.4)'
  },
  backButton: {
    flex: 1,
    padding: '18px', 
    borderRadius: '12px', 
    border: '2px solid #333',
    backgroundColor: 'transparent', 
    color: '#999', 
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
  },

  spinner: {
    width: 24, 
    height: 24, 
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.1)', 
    borderTopColor: '#fff',
    animation: 'spin 1s linear infinite'
  },
  spinnerLarge: {
    width: 48, 
    height: 48, 
    borderRadius: '50%',
    border: '4px solid rgba(255, 59, 92, 0.1)',
    borderTopColor: '#ff3b5c',
    animation: 'spin 1s linear infinite',
  }
};

export default DatingOnboarding;