import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Heart } from 'lucide-react';
import { useStore } from '../../store';
import { createDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';

// Z-Index для перекрытия
const Z_ONBOARDING = 3000;

// ===== КОНСТАНТЫ =====

// Маппинг целей знакомства
const GOAL_OPTIONS = [
  { label: '💘 Отношения', value: 'relationship' },
  { label: '🤝 Дружба', value: 'friends' },
  { label: '📚 Учеба', value: 'study' },
  { label: '🎉 Тусовки', value: 'hangout' }
];

// Интересы для студентов
const INTEREST_OPTIONS = [
  { label: '💻 IT', value: 'it' },
  { label: '🎮 Игры', value: 'games' },
  { label: '📚 Книги', value: 'books' },
  { label: '🎵 Музыка', value: 'music' },
  { label: '🎬 Кино', value: 'movies' },
  { label: '⚽ Спорт', value: 'sport' },
  { label: '🎨 Творчество', value: 'art' },
  { label: '🌍 Путешествия', value: 'travel' },
  { label: '☕ Кофе', value: 'coffee' },
  { label: '🎉 Вечеринки', value: 'party' },
  { label: '📸 Фото', value: 'photo' },
  { label: '🍕 Еда', value: 'food' },
  { label: '🎓 Наука', value: 'science' },
  { label: '🚀 Стартапы', value: 'startup' },
  { label: '🏋️ Фитнес', value: 'fitness' },
];

const MAX_PHOTOS = 3;
const MAX_GOALS = 2;
const MAX_INTERESTS = 5;

function DatingOnboarding({ onClose }) {
  const { setDatingProfile } = useStore();
  
  // 0: Landing, 1: Gender, 2: Age, 3: LookingFor, 4: Photos, 5: Bio&Goals, 6: Interests, 7: Loading
  const [step, setStep] = useState(0); 
  const [direction, setDirection] = useState('forward');
  const [loading, setLoading] = useState(false);

  // Данные анкеты
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState(20);
  const [lookingFor, setLookingFor] = useState(null); 
  const [photos, setPhotos] = useState([]);         
  const [previews, setPreviews] = useState([]);     
  const [bio, setBio] = useState('');
  const [goals, setGoals] = useState([]);
  const [interests, setInterests] = useState([]);

  const fileInputRef = useRef(null);
  const ageScrollRef = useRef(null);

  // ✅ Cleanup превью при размонтировании
  useEffect(() => {
    return () => {
      if (previews.length > 0) {
        console.log('🧹 Очистка', previews.length, 'превью');
        revokeObjectURLs(previews);
      }
    };
  }, [previews]);

  // ✅ Центрирование age picker
  useEffect(() => {
    if (step === 2 && ageScrollRef.current) {
      const itemWidth = 60;
      const initialIndex = age - 16;
      setTimeout(() => {
        ageScrollRef.current.scrollLeft = initialIndex * itemWidth;
      }, 100);
    }
  }, [step, age]);

  // ===== НАВИГАЦИЯ =====

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

  // ===== ЛОГИКА AGE PICKER =====
  
  const handleAgeScroll = () => {
    if (!ageScrollRef.current) return;
    
    const scrollLeft = ageScrollRef.current.scrollLeft;
    const itemWidth = 60;
    const centerIndex = Math.round(scrollLeft / itemWidth);
    const selectedAge = 16 + centerIndex;
    
    if (selectedAge !== age && selectedAge >= 16 && selectedAge <= 50) {
      setAge(selectedAge);
    }
  };

  // ===== ЛОГИКА ФОТО =====

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

  // ===== ЛОГИКА ЦЕЛЕЙ =====

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

  // ===== ЛОГИКА ИНТЕРЕСОВ =====

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

  // ===== ОТПРАВКА =====

  const handleSubmit = async () => {
    // Валидация фото
    if (photos.length === 0) {
      alert('Загрузите хотя бы одно фото');
      return;
    }

    // Валидация bio
    if (bio.trim().length > 0) {
      if (bio.trim().length < 10) {
        alert('Био должно содержать минимум 10 символов');
        return;
      }
      if (bio.trim().length > 200) {
        alert('Био должно содержать максимум 200 символов');
        return;
      }

      const bioWithoutEmoji = bio.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      const lettersOnly = bioWithoutEmoji.replace(/[^\wа-яА-ЯёЁ\s]/g, '');
      if (lettersOnly.trim().length < 10) {
        alert('Напиши хотя бы пару слов 😊');
        return;
      }
    }

    setLoading(true);
    hapticFeedback('success');
    setDirection('forward');
    setTimeout(() => setStep(7), 50);

    try {
      const profileData = {
        gender,
        age,
        looking_for: lookingFor,
        bio: bio.trim() || undefined,
        goals,
        interests, // Добавляем интересы
        photos
      };

      console.log('📤 Отправка профиля:', profileData);

      const newProfile = await createDatingProfile(profileData);
      
      setDatingProfile(newProfile);
      
      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
      
    } catch (error) {
      console.error('Ошибка создания профиля:', error);
      const errorMsg = error.response?.data?.detail || 'Ошибка создания анкеты';
      alert(errorMsg);
      setStep(6);
      setLoading(false);
    }
  };

  // ===== РЕНДЕР ШАГОВ =====

  const renderStep = () => {
    const animationClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

    switch (step) {
      case 0: // LANDING
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.landingIcon}>
              <Heart size={48} color="#fff" fill="#fff" />
            </div>
            <div style={styles.stepTitle}>Campus Dating</div>
            <div style={styles.stepSubtitle}>
              Найди пару, друзей или компанию для учебы в своем вузе
            </div>
            
            <div style={styles.featuresList}>
              <div style={styles.featureItem}>🎓 Только студенты твоего вуза</div>
              <div style={styles.featureItem}>🔒 Приватно и безопасно</div>
              <div style={styles.featureItem}>✨ Бесплатно навсегда</div>
            </div>

            <button 
              style={styles.submitButton}
              className="fade-in-up"
              onClick={goToNextStep}
            >
              Создать анкету
            </button>
          </div>
        );

      case 1: // GENDER
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Твой пол</div>
            <div style={styles.stepSubtitle}>Шаг 1 из 6</div>
            
            <div style={styles.optionsList}>
              {[
                { label: '👨 Парень', value: 'male' },
                { label: '👩 Девушка', value: 'female' }
              ].map((option, idx) => (
                <button
                  key={option.value}
                  style={{
                    ...styles.optionButton,
                    animationDelay: `${idx * 0.1}s`
                  }}
                  className="fade-in-up"
                  onClick={() => { setGender(option.value); goToNextStep(); }}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 2: // AGE
        const ages = Array.from({ length: 35 }, (_, i) => i + 16); // 16-50
        
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Сколько тебе лет?</div>
            <div style={styles.stepSubtitle}>Шаг 2 из 6</div>
            
            <div style={styles.agePickerContainer}>
              <div style={styles.ageDisplay}>{age}</div>
              
              <div 
                ref={ageScrollRef}
                className="age-scroller"
                style={styles.ageScroller}
                onScroll={handleAgeScroll}
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
            
            <div style={styles.buttonGroup}>
              <button 
                style={styles.submitButton}
                onClick={goToNextStep}
              >
                Далее
              </button>
              <button style={styles.backButton} onClick={goBack}>Назад</button>
            </div>
          </div>
        );

      case 3: // LOOKING FOR
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Кого ищешь?</div>
            <div style={styles.stepSubtitle}>Шаг 3 из 6</div>
            
            <div style={styles.optionsList}>
              {[
                { label: '👩 Девушек', value: 'female' },
                { label: '👨 Парней', value: 'male' },
                { label: '👥 Неважно', value: 'all' }
              ].map((option, idx) => (
                <button
                  key={option.value}
                  style={{
                    ...styles.optionButton,
                    animationDelay: `${idx * 0.1}s`
                  }}
                  className="fade-in-up"
                  onClick={() => { setLookingFor(option.value); goToNextStep(); }}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            
            <button style={styles.backButton} onClick={goBack}>Назад</button>
          </div>
        );

      case 4: // PHOTOS
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Твои фото</div>
            <div style={styles.stepSubtitle}>Шаг 4 из 6 · Минимум 1, максимум {MAX_PHOTOS}</div>

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

            <div style={styles.buttonGroup}>
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
              <button style={styles.backButton} onClick={goBack}>Назад</button>
            </div>
          </div>
        );

      case 5: // BIO & GOALS
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Расскажи о себе</div>
            <div style={styles.stepSubtitle}>Шаг 5 из 6</div>

            <div className="fade-in-up">
              <label style={styles.label}>Пару слов о себе (минимум 10 символов)</label>
              <textarea
                placeholder="Учусь на программиста, люблю кофе и хакатоны..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={styles.textarea}
                rows={4}
                maxLength={200}
              />
              <div style={styles.charCount}>{bio.length}/200</div>
            </div>

            <div className="fade-in-up" style={{ animationDelay: '0.1s', marginTop: 24 }}>
              <label style={styles.label}>Цель знакомства (максимум {MAX_GOALS})</label>
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

            <div style={styles.buttonGroup}>
              <button style={styles.submitButton} onClick={goToNextStep}>
                Далее
              </button>
              <button style={styles.backButton} onClick={goBack}>Назад</button>
            </div>
          </div>
        );

      case 6: // INTERESTS
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Твои интересы</div>
            <div style={styles.stepSubtitle}>Шаг 6 из 6 · Выбери до {MAX_INTERESTS}</div>

            <div className="fade-in-up">
              <div style={styles.interestsContainer}>
                {INTEREST_OPTIONS.map(({ label, value }, idx) => (
                  <button
                    key={value}
                    onClick={() => toggleInterest(value)}
                    style={{
                      ...styles.interestTag,
                      ...(interests.includes(value) ? styles.interestTagActive : {}),
                      animationDelay: `${idx * 0.03}s`
                    }}
                    className="fade-in-up"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.buttonGroup}>
              <button 
                style={{
                  ...styles.submitButton,
                  opacity: interests.length === 0 ? 0.7 : 1
                }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Создаю...' : 'Завершить ✨'}
              </button>
              <button style={styles.backButton} onClick={goBack}>Назад</button>
            </div>
          </div>
        );

      case 7: // LOADING
        return (
          <div style={{ ...styles.stepContent, textAlign: 'center', marginTop: 100 }} className="fade-in-up">
            <div style={styles.spinnerLarge}></div>
            <h2 style={{ ...styles.stepTitle, marginTop: 20 }}>Создаем профиль...</h2>
            <p style={{ color: '#666', marginTop: 8 }}>Обрабатываем фото и сохраняем данные</p>
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
    zIndex: Z_ONBOARDING,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    overflowY: 'auto'
  },
  container: {
    width: '100%',
    maxWidth: '500px',
    paddingBottom: '20px'
  },
  stepContent: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  
  // Header styles
  stepTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    textAlign: 'center'
  },
  stepSubtitle: {
    fontSize: '16px',
    color: '#ff6b9d',
    fontWeight: '500',
    marginBottom: '32px',
    textAlign: 'center'
  },
  landingIcon: {
    width: 80, 
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    margin: '0 auto 24px',
    boxShadow: '0 10px 30px rgba(255, 59, 92, 0.4)',
  },
  featuresList: {
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12,
    marginBottom: 40,
    alignItems: 'center',
    color: '#ccc',
    fontSize: 15
  },
  featureItem: {
    background: 'rgba(255,255,255,0.05)',
    padding: '10px 20px',
    borderRadius: 20,
  },

  // Buttons & Inputs
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
    transition: 'all 0.2s',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between'
  },

  // Age Picker
  agePickerContainer: {
    position: 'relative',
    width: '100%',
    height: '280px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 32,
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
    scrollBehavior: 'smooth',
    width: '100%',
    height: '60px',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
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
    transition: 'all 0.2s ease',
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
  
  // Photos
  photosGrid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(3, 1fr)', 
    gap: 12, 
    marginBottom: 24 
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

  // Bio & Tags
  label: { 
    display: 'block', 
    fontSize: '14px', 
    fontWeight: '600', 
    color: '#999', 
    marginBottom: '8px' 
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
    transition: 'border-color 0.2s'
  },
  charCount: { 
    fontSize: '12px', 
    color: '#666', 
    textAlign: 'right', 
    marginTop: '4px' 
  },
  tagsContainer: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    gap: 8 
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

  // Interests
  interestsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
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

  // Controls
  buttonGroup: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12, 
    marginTop: 32 
  },
  submitButton: {
    width: '100%', 
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
    width: '100%', 
    padding: '16px', 
    borderRadius: '12px', 
    border: '2px solid #333',
    backgroundColor: 'transparent', 
    color: '#999', 
    fontSize: '16px', 
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '12px'
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
    margin: '0 auto'
  }
};

export default DatingOnboarding;