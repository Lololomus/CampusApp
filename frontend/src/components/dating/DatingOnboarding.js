import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Heart, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { createDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';

// Z-Index для перекрытия (как в основном онбординге)
const Z_ONBOARDING = 3000;

function DatingOnboarding() {
  const { setDatingProfile } = useStore();
  
  // 0: Landing, 1: Gender, 2: LookingFor, 3: Photos, 4: Bio, 5: Loading
  const [step, setStep] = useState(0); 
  const [direction, setDirection] = useState('forward');
  const [loading, setLoading] = useState(false);

  // Данные анкеты
  const [gender, setGender] = useState(null);       
  const [lookingFor, setLookingFor] = useState(null); 
  const [photos, setPhotos] = useState([]);         
  const [previews, setPreviews] = useState([]);     
  const [bio, setBio] = useState('');
  const [goals, setGoals] = useState([]);

  const fileInputRef = useRef(null);

  // ✅ Cleanup превью при размонтировании компонента
  useEffect(() => {
    return () => {
      if (previews.length > 0) {
        console.log('🧹 Очистка', previews.length, 'превью');
        revokeObjectURLs(previews);
      }
    };
  }, [previews]);

  // ===== НАВИГАЦИЯ (с анимациями как в Onboarding.js) =====

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

  // ===== ЛОГИКА ФОТО =====

  const handlePhotoUpload = async (e) => {
    if (!e.target.files.length) return;
    hapticFeedback('light');

    if (photos.length + e.target.files.length > 5) {
      alert('Максимум 5 фото'); 
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

  const toggleGoal = (goal) => {
    hapticFeedback('light');
    setGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]);
  };

  // ===== ОТПРАВКА =====

  const handleSubmit = async () => {
    // ✅ Валидация фото
    if (photos.length === 0) {
      alert('Загрузите хотя бы одно фото');
      return;
    }

    // ✅ Валидация био
    if (bio.trim().length > 0) {
      // Проверка длины
      if (bio.trim().length < 10) {
        alert('Био должно содержать минимум 10 символов');
        return;
      }
      if (bio.trim().length > 200) {
        alert('Био должно содержать максимум 200 символов');
        return;
      }

      // Проверка что не только эмодзи
      const bioWithoutEmoji = bio.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      const lettersOnly = bioWithoutEmoji.replace(/[^\wа-яА-ЯёЁ]/g, '');
      if (lettersOnly.length < 10) {
        alert('Напиши хотя бы пару слов 😊');
        return;
      }
    }

    setLoading(true);
    hapticFeedback('success');
    setDirection('forward');
    setTimeout(() => setStep(5), 50); // Экран загрузки

    try {
      const profileData = {
        gender,
        looking_for: lookingFor,
        bio: bio.trim() || undefined, // Отправляем только если есть
        goals,
        photos
      };

      const newProfile = await createDatingProfile(profileData);
      setDatingProfile(newProfile);
      
    } catch (error) {
      console.error(error);
      // ✅ Показываем ошибку от сервера
      const errorMsg = error.response?.data?.detail || 'Ошибка создания анкеты';
      alert(errorMsg);
      setStep(4); // Вернуть назад
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
              Найди пару, друзей или компанию для учебы в своем вузе.
            </div>
            
            <div style={styles.featuresList}>
              <div style={styles.featureItem}>🎓 Только студенты твоего вуза</div>
              <div style={styles.featureItem}>🔒 Приватно и безопасно</div>
              <div style={styles.featureItem}>✨ Бесплатно</div>
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
            <div style={styles.stepSubtitle}>Шаг 1 из 4</div>
            
            <div style={styles.optionsList}>
              <button
                style={{
                  ...styles.optionButton,
                  ...(gender === 'male' ? styles.optionButtonActive : {})
                }}
                className="fade-in-up"
                onClick={() => { setGender('male'); goToNextStep(); }}
              >
                👨 Я Парень
              </button>
              <button
                style={{
                  ...styles.optionButton,
                  ...(gender === 'female' ? styles.optionButtonActive : {})
                }}
                className="fade-in-up"
                styleDelay="0.1s"
                onClick={() => { setGender('female'); goToNextStep(); }}
              >
                👩 Я Девушка
              </button>
            </div>
          </div>
        );

      case 2: // LOOKING FOR
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Кого ищем?</div>
            <div style={styles.stepSubtitle}>Шаг 2 из 4</div>
            
            <div style={styles.optionsList}>
              {['female', 'male', 'all'].map((type, idx) => (
                <button
                  key={type}
                  style={{
                    ...styles.optionButton,
                    animationDelay: `${idx * 0.1}s`
                  }}
                  className="fade-in-up"
                  onClick={() => { setLookingFor(type); goToNextStep(); }}
                >
                  {type === 'female' && 'Девушек'}
                  {type === 'male' && 'Парней'}
                  {type === 'all' && 'Всех (Дружба)'}
                </button>
              ))}
            </div>
            
            <button style={styles.backButton} onClick={goBack}>Назад</button>
          </div>
        );

      case 3: // PHOTOS
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>Твои фото</div>
            <div style={styles.stepSubtitle}>Шаг 3 из 4 · Загрузи 1-5 фото</div>

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
              
              {previews.length < 5 && (
                <button 
                  style={styles.addPhotoBtn} 
                  onClick={() => fileInputRef.current.click()}
                  className="fade-in-up"
                >
                  {loading ? <div style={styles.spinner}></div> : <Camera size={32} color="#666" />}
                  <span style={styles.addPhotoText}>{loading ? '...' : 'Добавить'}</span>
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

      case 4: // BIO & GOALS
        return (
          <div style={styles.stepContent} className={animationClass}>
            <div style={styles.stepTitle}>О себе</div>
            <div style={styles.stepSubtitle}>Шаг 4 из 4 · Финал</div>

            <div className="fade-in-up">
              <label style={styles.label}>Пару слов о себе (минимум 10 символов)</label>
              <textarea
                placeholder="Учусь на архитектора, люблю техно..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={styles.textarea}
                rows={4}
                maxLength={200}
              />
              <div style={styles.charCount}>{bio.length}/200</div>
            </div>

            <div className="fade-in-up" style={{ animationDelay: '0.1s', marginTop: 20 }}>
              <label style={styles.label}>Цель знакомства</label>
              <div style={styles.tagsContainer}>
                {['💘 Отношения', '🤝 Дружба', '☕ Общение', '📚 Учеба', '🎉 Тусовки'].map(goal => (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    style={{
                      ...styles.tag,
                      ...(goals.includes(goal) ? styles.tagActive : {})
                    }}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.buttonGroup}>
              <button style={styles.submitButton} onClick={handleSubmit}>
                Завершить ✨
              </button>
              <button style={styles.backButton} onClick={goBack}>Назад</button>
            </div>
          </div>
        );

      case 5: // LOADING
        return (
          <div style={{ ...styles.stepContent, textAlign: 'center', marginTop: 100 }} className="fade-in-up">
            <div style={styles.spinnerLarge}></div>
            <h2 style={{ ...styles.stepTitle, marginTop: 20 }}>Создаем профиль...</h2>
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
    overflowY: 'auto' // На случай маленьких экранов
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
    color: '#8774e1',
    fontWeight: '500',
    marginBottom: '32px',
    textAlign: 'center'
  },
  landingIcon: {
    width: 80, height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 24px',
    boxShadow: '0 10px 30px rgba(245, 87, 108, 0.4)',
  },
  featuresList: {
    display: 'flex', flexDirection: 'column', gap: 12,
    marginBottom: 40,
    alignItems: 'center',
    color: '#ccc',
    fontSize: 15
  },
  featureItem: {
    background: 'rgba(255,255,255,0.05)',
    padding: '8px 16px',
    borderRadius: 20,
  },

  // Buttons & Inputs matching Onboarding.js
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  optionButtonActive: {
    borderColor: '#8774e1',
    backgroundColor: 'rgba(135, 116, 225, 0.1)',
  },
  
  // Photos
  photosGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  photoItem: { aspectRatio: '1', position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid #333' },
  photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  addPhotoBtn: {
    aspectRatio: '1', borderRadius: 16,
    background: '#1e1e1e', border: '2px dashed #333',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#666', gap: 4
  },
  addPhotoText: { fontSize: 12 },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 24, height: 24, borderRadius: '50%',
    background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  mainBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10,
    textAlign: 'center', padding: '4px 0', fontWeight: 600
  },

  // Bio & Tags
  label: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#999', marginBottom: '8px' },
  textarea: {
    width: '100%', padding: '16px', borderRadius: '12px',
    border: '2px solid #333', backgroundColor: '#1e1e1e',
    color: '#fff', fontSize: '16px', outline: 'none', resize: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit'
  },
  charCount: { fontSize: '12px', color: '#666', textAlign: 'right', marginTop: '4px' },
  hint: { fontSize: '12px', color: '#f5576c', marginTop: '4px' },
  tagsContainer: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: {
    padding: '8px 16px', borderRadius: 20,
    background: '#1e1e1e', border: '1px solid #333',
    color: '#999', fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
  },
  tagActive: {
    background: '#8774e1', border: '1px solid #8774e1', color: '#fff'
  },

  // Controls
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 },
  submitButton: {
    width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
    backgroundColor: '#8774e1', color: '#fff', fontSize: '16px', fontWeight: '600',
    cursor: 'pointer', transition: 'all 0.2s',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  },
  backButton: {
    width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #333',
    backgroundColor: 'transparent', color: '#999', fontSize: '16px', fontWeight: '500',
    cursor: 'pointer', marginTop: 12
  },
  spinner: {
    width: 24, height: 24, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff',
    animation: 'spin 1s linear infinite'
  },
  spinnerLarge: {
    width: 40, height: 40, borderRadius: '50%',
    border: '4px solid rgba(135, 116, 225, 0.1)', borderTopColor: '#8774e1',
    animation: 'spin 1s linear infinite', margin: '0 auto'
  }
};

export default DatingOnboarding;