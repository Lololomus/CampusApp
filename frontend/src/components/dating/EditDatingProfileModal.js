// ===== 📄 ФАЙЛ: src/components/dating/EditDatingProfileModal.js =====

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Trash2, Save } from 'lucide-react';
import { useStore } from '../../store';
import { updateDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';

const Z_MODAL = 3000;
const MAX_INTERESTS = 5;

// ===== КОНСТАНТЫ =====
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

const GOAL_OPTIONS = [
  { value: 'relationship', label: '💘 Отношения' },
  { value: 'friends', label: '🤝 Дружба' },
  { value: 'study', label: '📚 Учеба' },
  { value: 'hangout', label: '🎉 Тусовки' },
];

function EditDatingProfileModal({ onClose, onSuccess }) {
  const { datingProfile, setDatingProfile } = useStore();
  
  // State
  const [age, setAge] = useState(datingProfile?.age || 20);
  const [lookingFor, setLookingFor] = useState(datingProfile?.looking_for || 'female');
  const [bio, setBio] = useState(datingProfile?.bio || '');
  const [goals, setGoals] = useState(datingProfile?.goals || []);
  const [interests, setInterests] = useState(datingProfile?.interests || []);
  const [existingPhotos, setExistingPhotos] = useState(datingProfile?.photos || []);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (newPreviews.length > 0) {
        revokeObjectURLs(newPreviews);
      }
    };
  }, [newPreviews]);

  const totalPhotos = existingPhotos.length + newPhotos.length;

  const handlePhotoUpload = async (e) => {
    if (!e.target.files.length) return;
    hapticFeedback('light');
    
    if (totalPhotos + e.target.files.length > 3) {
      alert('Максимум 3 фото');
      return;
    }
    
    setLoading(true);
    try {
      const processed = await processImageFiles(e.target.files);
      setNewPhotos(prev => [...prev, ...processed.map(p => p.file)]);
      setNewPreviews(prev => [...prev, ...processed.map(p => p.preview)]);
    } catch (e) {
      alert('Ошибка обработки фото');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeExistingPhoto = (index) => {
    hapticFeedback('medium');
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index) => {
    hapticFeedback('medium');
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
    setNewPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleGoal = (goal) => {
    hapticFeedback('light');
    setGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal) 
        : [...prev, goal]
    );
  };

  const toggleInterest = (interest) => {
    hapticFeedback('light');
    setInterests(prev => {
      if (prev.includes(interest)) {
        return prev.filter(i => i !== interest);
      }
      if (prev.length >= MAX_INTERESTS) {
        alert(`Можно выбрать максимум ${MAX_INTERESTS} интересов`);
        return prev;
      }
      return [...prev, interest];
    });
  };

  const handleSave = async () => {
    // Валидация
    if (totalPhotos === 0) {
      alert('Минимум 1 фото обязательно');
      return;
    }

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
    hapticFeedback('medium');
    
    try {
      const formData = new FormData();
      formData.append('gender', datingProfile.gender);
      formData.append('age', age);
      formData.append('looking_for', lookingFor);
      formData.append('bio', bio.trim());
      formData.append('goals', JSON.stringify(goals));
      formData.append('interests', JSON.stringify(interests));
      
      // Новые фото
      newPhotos.forEach((file, index) => {
        formData.append('photos', file, `photo_${index}.jpg`);
      });
      
      // Старые фото (только относительный путь)
      const keepPhotos = existingPhotos.map(p => {
        let url = typeof p === 'string' ? p : (p.url || '');
        if (url.includes('/uploads/images/')) {
          url = url.substring(url.indexOf('/uploads/images/'));
        }
        return url;
      }).filter(url => url);

      formData.append('keep_photos', JSON.stringify(keepPhotos));
      
      console.log('📤 Отправка:');
      console.log('- Age:', age);
      console.log('- Interests:', interests);
      console.log('- Новых фото:', newPhotos.length);
      console.log('- Старых фото:', keepPhotos.length);
      
      const updated = await updateDatingProfile(formData);
      
      console.log('✅ Получен профиль:', updated);
      
      setDatingProfile(updated);
      
      hapticFeedback('success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('❌ Ошибка:', error);
      console.error('Response:', error.response?.data);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div style={styles.overlay} onClick={loading ? undefined : onClose} />

      {/* Modal */}
      <div style={styles.modal}>
        {/* Close Button */}
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color={theme.colors.text} />
        </button>

        {/* Content */}
        <div style={styles.content}>
          
          {/* SECTION: Фото */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Твои фото</h3>
            <p style={styles.sectionDesc}>Первое фото будет главным. Максимум 3 фото.</p>
            
            <div style={styles.photoGrid}>
              {existingPhotos.map((photo, idx) => (
                <div key={`existing-${idx}`} style={styles.photoItem}>
                  <img 
                    src={typeof photo === 'string' ? photo : photo.url} 
                    alt="" 
                    style={styles.photoPreview}
                  />
                  <button 
                    onClick={() => removeExistingPhoto(idx)}
                    style={styles.photoDelete}
                  >
                    <Trash2 size={16} />
                  </button>
                  {idx === 0 && <div style={styles.mainBadge}>Главное</div>}
                </div>
              ))}
              
              {newPreviews.map((preview, idx) => (
                <div key={`new-${idx}`} style={styles.photoItem}>
                  <img src={preview} alt="" style={styles.photoPreview} />
                  <button 
                    onClick={() => removeNewPhoto(idx)}
                    style={styles.photoDelete}
                  >
                    <Trash2 size={16} />
                  </button>
                  {existingPhotos.length === 0 && idx === 0 && (
                    <div style={styles.mainBadge}>Главное</div>
                  )}
                </div>
              ))}
              
              {totalPhotos < 3 && (
                <label style={styles.uploadButton}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{display: 'none'}}
                  />
                  <Camera size={32} color="#ff6b9d" />
                  <span style={styles.uploadText}>Добавить</span>
                </label>
              )}
            </div>

            <div style={styles.photoCounter}>
              {totalPhotos} / 3 фото
            </div>
          </div>

          {/* SECTION: Предпочтения */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Кого ищешь?</h3>
            <div style={styles.buttonGroup}>
              {[
                { value: 'male', label: '👨 Парней' },
                { value: 'female', label: '👩 Девушек' },
                { value: 'all', label: '👥 Неважно' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    hapticFeedback('light');
                    setLookingFor(option.value);
                  }}
                  style={
                    lookingFor === option.value 
                      ? styles.optionButtonActive 
                      : styles.optionButton
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION: Цели */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Цели знакомства</h3>
            <p style={styles.sectionDesc}>Можно выбрать несколько</p>
            <div style={styles.goalsGrid}>
              {GOAL_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleGoal(option.value)}
                  style={
                    goals.includes(option.value) 
                      ? styles.goalButtonActive 
                      : styles.goalButton
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION: Био */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>О себе</h3>
            <p style={styles.sectionDesc}>10-200 символов</p>
            
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Например: Люблю программировать по ночам, пить кофе литрами и участвовать в хакатонах 💻"
              style={styles.textarea}
              maxLength={200}
            />
            
            <div style={styles.charCounter}>
              {bio.length} / 200
            </div>
          </div>

          {/* SECTION: Интересы */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Интересы</h3>
            <p style={styles.sectionDesc}>Выбери до {MAX_INTERESTS}</p>
            
            <div style={styles.interestsGrid}>
              {INTEREST_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleInterest(option.value)}
                  style={
                    interests.includes(option.value) 
                      ? styles.interestButtonActive 
                      : styles.interestButton
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION: Возраст */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Возраст</h3>
            <input
              type="number"
              min="16"
              max="50"
              value={age}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 16 && val <= 50) {
                  setAge(val);
                }
              }}
              style={styles.ageInput}
            />
          </div>
        </div>

        {/* Fixed Save Button */}
        <div style={styles.saveButtonContainer}>
          <button 
            onClick={handleSave}
            disabled={loading || totalPhotos === 0}
            style={{
              ...styles.saveButton,
              opacity: loading || totalPhotos === 0 ? 0.5 : 1,
              cursor: loading || totalPhotos === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={20} />
            {loading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </>
  );
}

// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: Z_MODAL,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: Z_MODAL + 1,
    backgroundColor: theme.colors.bg,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInFromRight 0.35s cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
  closeButton: {
    position: 'fixed',
    top: 'max(16px, env(safe-area-inset-top))',
    right: 16,
    zIndex: Z_MODAL + 2,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
    paddingTop: 'max(60px, env(safe-area-inset-top))',
    paddingBottom: '100px',
  },
  
  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    margin: '0 0 8px 0',
  },
  sectionDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: '0 0 16px 0',
  },
  
  // Photos
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 12,
  },
  photoItem: {
    position: 'relative',
    aspectRatio: '3/4',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    padding: '3px 6px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    backdropFilter: 'blur(10px)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadButton: {
    aspectRatio: '3/4',
    borderRadius: 12,
    border: `2px dashed ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  uploadText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  photoCounter: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  
  // Buttons
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  optionButton: {
    padding: '14px 8px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  optionButtonActive: {
    padding: '14px 8px',
    borderRadius: 12,
    border: '2px solid #ff3b5c',
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    color: '#ff6b9d',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
  },
  
  // Goals
  goalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  goalButton: {
    padding: '14px 12px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  goalButtonActive: {
    padding: '14px 12px',
    borderRadius: 12,
    border: '2px solid #ff3b5c',
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    color: '#ff6b9d',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
  },
  
  // Bio
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '14px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: 'inherit',
    resize: 'vertical',
    marginBottom: 8,
    lineHeight: 1.5,
    boxSizing: 'border-box',
    outline: 'none',
  },
  charCounter: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },

  // Interests
  interestsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestButton: {
    padding: '10px 14px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  interestButtonActive: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '2px solid #ff3b5c',
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    color: '#ff6b9d',
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
  },

  // Age
  ageInput: {
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    fontWeight: '600',
    outline: 'none',
  },
  
  // Fixed Save Button
  saveButtonContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
    zIndex: Z_MODAL + 2,
  },
  saveButton: {
    width: '100%',
    padding: '16px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s',
  },
};

// Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInFromRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  button:active {
    transform: scale(0.97) !important;
  }
`;
if (!document.getElementById('edit-dating-styles')) {
  styleSheet.id = 'edit-dating-styles';
  document.head.appendChild(styleSheet);
}

export default EditDatingProfileModal;