import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Trash2, Save, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { updateDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import {
  PROMPT_OPTIONS,
  PROMPT_MAX_LENGTH,
  PROMPTS_BY_CATEGORY,
  INTEREST_OPTIONS,
  MAX_INTERESTS,
  GOAL_OPTIONS,
  BIO_MIN_LENGTH,
  BIO_MAX_LENGTH,
  MAX_PHOTOS,
  MIN_AGE,
  MAX_AGE,
  LOOKING_FOR_OPTIONS
} from '../../constants/datingConstants';

const Z_MODAL = 3000;

function EditDatingProfileModal({ onClose, onSuccess }) {
  const { datingProfile, setDatingProfile } = useStore();
  
  const [age, setAge] = useState(datingProfile?.age || 20);
  const [lookingFor, setLookingFor] = useState(datingProfile?.looking_for || 'female');
  const [bio, setBio] = useState(datingProfile?.bio || '');
  const [goals, setGoals] = useState(datingProfile?.goals || []);
  const [interests, setInterests] = useState(datingProfile?.interests || []);
  
  const [prompt, setPrompt] = useState(
    datingProfile?.prompts 
      ? {
          question: datingProfile.prompts.question,
          answer: datingProfile.prompts.answer
        }
      : null
  );
  
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (datingProfile?.photos) {
      setExistingPhotos(datingProfile.photos);
    }
  }, [datingProfile?.photos]);

  useEffect(() => {
    return () => {
      if (newPreviews.length > 0) {
        revokeObjectURLs(newPreviews);
      }
    };
  }, [newPreviews]);

  const totalPhotos = existingPhotos.length + newPhotos.length;

  const getPhotoUrl = (photo) => {
    if (typeof photo === 'object' && photo.url) return photo.url;
    if (typeof photo === 'string') return photo;
    return '';
  };

  const handlePhotoUpload = async (e) => {
    if (!e.target.files.length) return;
    hapticFeedback('light');
    
    if (totalPhotos + e.target.files.length > MAX_PHOTOS) {
      alert(`Максимум ${MAX_PHOTOS} фото`);
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

  const handlePromptSelect = (promptOption) => {
    setEditingPrompt({ 
      question: promptOption.question,
      placeholder: promptOption.placeholder,
      answer: ''
    });
    setShowPromptSelector(false);
  };

  const handlePromptSave = (answer) => {
    setPrompt({
      question: editingPrompt.question,
      answer: answer.trim()
    });
    setEditingPrompt(null);
  };

  const handlePromptEdit = () => {
    setEditingPrompt({
      question: prompt.question,
      answer: prompt.answer,
      placeholder: PROMPT_OPTIONS.find(p => p.question === prompt.question)?.placeholder || ''
    });
  };

  const handlePromptDelete = () => {
    hapticFeedback('medium');
    setPrompt(null);
  };

  const handleSave = async () => {
    if (totalPhotos === 0) {
      alert('Минимум 1 фото обязательно');
      return;
    }

    if (bio.trim().length > 0) {
      if (bio.trim().length < BIO_MIN_LENGTH) {
        alert(`Био должно содержать минимум ${BIO_MIN_LENGTH} символов`);
        return;
      }
      if (bio.trim().length > BIO_MAX_LENGTH) {
        alert(`Био должно содержать максимум ${BIO_MAX_LENGTH} символов`);
        return;
      }
      
      const bioWithoutEmoji = bio.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      const lettersOnly = bioWithoutEmoji.replace(/[^\wа-яА-ЯёЁ\s]/g, '');
      if (lettersOnly.trim().length < BIO_MIN_LENGTH) {
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
      
      if (prompt && prompt.question && prompt.answer) {
        formData.append('prompt_question', prompt.question);
        formData.append('prompt_answer', prompt.answer);
      }
      
      newPhotos.forEach((file, index) => {
        formData.append('photos', file, `photo_${index}.jpg`);
      });
      
      const keepPhotos = existingPhotos.map(photo => {
        let url = '';
        
        if (typeof photo === 'object' && photo.url) {
          url = photo.url;
        } else if (typeof photo === 'string') {
          url = photo;
        }
        
        if (url.includes('/uploads/images/')) {
          const lastIndex = url.lastIndexOf('/uploads/images/');
          return url.substring(lastIndex);
        }
        
        return null;
      }).filter(url => url);

      formData.append('keep_photos', JSON.stringify(keepPhotos));
      
      const updated = await updateDatingProfile(formData);
      setDatingProfile(updated);
      
      hapticFeedback('success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={styles.overlay} onClick={loading ? undefined : onClose} />

      <div style={styles.modal}>
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color={theme.colors.text} />
        </button>

        <div style={styles.content}>
          
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Твои фото</h3>
            <p style={styles.sectionDesc}>Первое фото будет главным. Максимум {MAX_PHOTOS} фото.</p>
            
            <div style={styles.photoGrid}>
              {existingPhotos.map((photo, idx) => (
                <div key={`existing-${idx}`} style={styles.photoItem}>
                  <img 
                    src={getPhotoUrl(photo)} 
                    alt="" 
                    style={styles.photoPreview}
                    onError={(e) => {
                      console.error('Ошибка загрузки фото:', photo);
                      e.target.style.display = 'none';
                    }}
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
              
              {totalPhotos < MAX_PHOTOS && (
                <label style={styles.uploadButton}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{display: 'none'}}
                    disabled={loading}
                  />
                  <Camera size={32} color="#ff6b9d" />
                  <span style={styles.uploadText}>Добавить</span>
                </label>
              )}
            </div>

            <div style={styles.photoCounter}>
              {totalPhotos} / {MAX_PHOTOS} фото
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Кого ищешь?</h3>
            <div style={styles.buttonGroup}>
              {LOOKING_FOR_OPTIONS.map(option => (
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

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>О себе</h3>
            <p style={styles.sectionDesc}>{BIO_MIN_LENGTH}-{BIO_MAX_LENGTH} символов</p>
            
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Например: Люблю программировать по ночам, пить кофе литрами и участвовать в хакатонах 💻"
              style={styles.textarea}
              maxLength={BIO_MAX_LENGTH}
            />
            
            <div style={styles.charCounter}>
              {bio.length} / {BIO_MAX_LENGTH}
            </div>
          </div>

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

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Ледокол для знакомства</h3>
            <p style={styles.sectionDesc}>Ответь на вопрос — это поможет начать диалог</p>
            
            {prompt ? (
              <div style={styles.promptCardWrapper}>
                <div style={styles.promptCard}>
                  <div style={styles.promptQuestion}>💬 {prompt.question}</div>
                  <div style={styles.promptAnswer}>{prompt.answer}</div>
                </div>
                
                <div style={styles.promptButtonsRow}>
                  <button 
                    onClick={handlePromptEdit}
                    style={styles.promptEditButton}
                  >
                    <Edit2 size={18} />
                    <span>Редактировать</span>
                  </button>
                  <button 
                    onClick={handlePromptDelete}
                    style={styles.promptDeleteButton}
                  >
                    <Trash2 size={18} />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  hapticFeedback('light');
                  setShowPromptSelector(true);
                }}
                style={styles.addPromptButton}
              >
                + Добавить вопрос
              </button>
            )}
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Возраст</h3>
            <input
              type="number"
              min={MIN_AGE}
              max={MAX_AGE}
              value={age}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= MIN_AGE && val <= MAX_AGE) {
                  setAge(val);
                }
              }}
              style={styles.ageInput}
            />
          </div>
        </div>

        <div style={styles.fixedButtonsContainer}>
          <button 
            onClick={onClose}
            disabled={loading}
            style={styles.cancelButton}
          >
            Отмена
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || totalPhotos === 0}
            style={{
              ...styles.saveButton,
              opacity: loading || totalPhotos === 0 ? 0.5 : 1,
            }}
          >
            <Save size={18} />
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {showPromptSelector && (
        <>
          <div style={styles.promptSelectorOverlay} onClick={() => setShowPromptSelector(false)} />
          <div style={styles.promptSelectorModal}>
            <div style={styles.promptSelectorHandle} />
            
            <div style={styles.promptSelectorHeader}>
              <h2 style={styles.promptSelectorTitle}>Выбери вопрос</h2>
              <button onClick={() => setShowPromptSelector(false)} style={styles.promptSelectorCloseBtn}>
                <X size={24} color={theme.colors.text} />
              </button>
            </div>
            
            <div style={styles.promptSelectorContent}>
              {Object.entries(PROMPTS_BY_CATEGORY).map(([category, categoryPrompts]) => (
                <div key={category} style={styles.promptCategoryBlock}>
                  <div style={styles.promptCategoryTitle}>{category}</div>
                  
                  {categoryPrompts.map(promptOption => (
                    <button
                      key={promptOption.id}
                      onClick={() => handlePromptSelect(promptOption)}
                      style={styles.promptOptionButton}
                    >
                      <span>{promptOption.question}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {editingPrompt && (
        <>
          <div style={styles.promptAnswerOverlay} onClick={() => setEditingPrompt(null)} />
          <div style={styles.promptAnswerModal}>
            <div style={styles.promptAnswerHandle} />
            
            <div style={styles.promptAnswerHeader}>
              <h3 style={styles.promptAnswerTitle}>Ледокол для знакомства</h3>
              <button onClick={() => setEditingPrompt(null)} style={styles.promptAnswerCloseBtn}>
                <X size={22} color={theme.colors.text} />
              </button>
            </div>

            <div style={styles.promptAnswerContent}>
              <div style={styles.promptAnswerQuestion}>
                💬 {editingPrompt.question}
              </div>
              
              <div style={styles.promptAnswerHintBox}>
                <div style={styles.promptAnswerHintIcon}>💡</div>
                <div style={styles.promptAnswerHintText}>
                  Будь искренним и покажи свою личность — это поможет найти того, с кем тебе будет интересно
                </div>
              </div>
              
              <textarea
                value={editingPrompt.tempAnswer !== undefined ? editingPrompt.tempAnswer : editingPrompt.answer || ''}
                onChange={(e) => setEditingPrompt(prev => ({ ...prev, tempAnswer: e.target.value }))}
                placeholder={editingPrompt.placeholder}
                maxLength={PROMPT_MAX_LENGTH}
                style={styles.promptAnswerTextarea}
                autoFocus
              />
              
              <div style={styles.promptAnswerCounter}>
                {(editingPrompt.tempAnswer !== undefined ? editingPrompt.tempAnswer : editingPrompt.answer || '').length} / {PROMPT_MAX_LENGTH}
              </div>
            </div>

            <div style={styles.promptAnswerButtons}>
              <button 
                onClick={() => setEditingPrompt(null)}
                style={styles.promptCancelButton}
              >
                Отмена
              </button>
              <button 
                onClick={() => {
                  const answer = editingPrompt.tempAnswer !== undefined 
                    ? editingPrompt.tempAnswer 
                    : (editingPrompt.answer || '');
                  if (answer.trim().length < 10) {
                    alert('Минимум 10 символов');
                    return;
                  }
                  handlePromptSave(answer);
                }}
                disabled={((editingPrompt.tempAnswer !== undefined ? editingPrompt.tempAnswer : (editingPrompt.answer || '')).trim().length < 10)}
                style={{
                  ...styles.promptSaveButton,
                  opacity: ((editingPrompt.tempAnswer !== undefined ? editingPrompt.tempAnswer : (editingPrompt.answer || '')).trim().length >= 10) ? 1 : 0.5,
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

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
    padding: '16px',
    paddingTop: 'max(60px, env(safe-area-inset-top))',
    paddingBottom: '90px',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    margin: '0 0 6px 0',
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: '0 0 12px 0',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 10,
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
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  optionButton: {
    padding: '12px 8px',
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
    padding: '12px 8px',
    borderRadius: 12,
    border: '2px solid #ff3b5c',
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    color: '#ff6b9d',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
  },
  goalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  goalButton: {
    padding: '12px',
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
    padding: '12px',
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
  textarea: {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
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
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  interestsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestButton: {
    padding: '8px 12px',
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
    padding: '8px 12px',
    borderRadius: 12,
    border: '2px solid #ff3b5c',
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    color: '#ff6b9d',
    fontSize: 13,
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
  },
  promptCardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  promptCard: {
    padding: '16px',
    background: 'rgba(255, 59, 92, 0.05)',
    border: '2px solid rgba(255, 59, 92, 0.2)',
    borderRadius: 14,
    textAlign: 'center',
  },
  promptQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6b9d',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  promptAnswer: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  promptButtonsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  promptEditButton: {
    padding: '12px',
    background: theme.colors.card,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: 12,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  promptDeleteButton: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '2px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  addPromptButton: {
    width: '100%',
    padding: '14px',
    background: 'none',
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  ageInput: {
    width: '100%',
    padding: '12px',
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
  fixedButtonsContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
    zIndex: Z_MODAL + 2,
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: 10,
  },
  cancelButton: {
    padding: '14px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '14px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  promptSelectorOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: Z_MODAL + 10,
    animation: 'fadeIn 0.2s',
  },
  promptSelectorModal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80vh',
    background: theme.colors.bg,
    borderRadius: '20px 20px 0 0',
    zIndex: Z_MODAL + 11,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
  promptSelectorHandle: {
    width: 40,
    height: 4,
    background: theme.colors.border,
    borderRadius: 2,
    margin: '12px auto 0',
  },
  promptSelectorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  promptSelectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    margin: 0,
  },
  promptSelectorCloseBtn: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
  },
  promptSelectorContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 32px',
  },
  promptCategoryBlock: {
    marginBottom: 20,
  },
  promptCategoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 10,
  },
  promptOptionButton: {
    width: '100%',
    padding: '14px',
    marginBottom: 8,
    background: theme.colors.card,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: 12,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  promptAnswerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: Z_MODAL + 20,
    animation: 'fadeIn 0.2s',
  },
  promptAnswerModal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85vh',
    background: theme.colors.bg,
    borderRadius: '20px 20px 0 0',
    zIndex: Z_MODAL + 21,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
  },
  promptAnswerHandle: {
    width: 40,
    height: 4,
    background: theme.colors.border,
    borderRadius: 2,
    margin: '12px auto 0',
    flexShrink: 0,
  },
  promptAnswerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  promptAnswerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    margin: 0,
  },
  promptAnswerCloseBtn: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptAnswerContent: {
    flex: 1,
    padding: '20px 16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  promptAnswerQuestion: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 1.3,
    textAlign: 'center',
    padding: '0 8px',
  },
  promptAnswerHintBox: {
    display: 'flex',
    gap: 12,
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.08) 0%, rgba(255, 107, 157, 0.08) 100%)',
    border: `2px solid rgba(255, 59, 92, 0.25)`,
    borderRadius: 14,
    alignItems: 'flex-start',
  },
  promptAnswerHintIcon: {
    fontSize: 24,
    flexShrink: 0,
    lineHeight: 1,
  },
  promptAnswerHintText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 1.5,
    fontWeight: '500',
  },
  promptAnswerTextarea: {
    width: '100%',
    minHeight: 140,
    padding: '16px',
    background: theme.colors.card,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: 14,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 1.5,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  promptAnswerCounter: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    fontWeight: '500',
  },
  promptAnswerButtons: {
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: 10,
    flexShrink: 0,
  },
  promptCancelButton: {
    padding: '14px',
    borderRadius: 12,
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  promptSaveButton: {
    padding: '14px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.4)',
    transition: 'all 0.2s',
  },
};

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

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
`;
if (!document.getElementById('edit-dating-styles')) {
  styleSheet.id = 'edit-dating-styles';
  document.head.appendChild(styleSheet);
}

export default EditDatingProfileModal;