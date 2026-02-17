import React, { useState, useRef, useEffect } from 'react';
import { Camera, Trash2, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { updateDatingProfile } from '../../api';
import { processImageFiles, revokeObjectURLs } from '../../utils/media';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import {
  PROMPT_OPTIONS,
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
import PromptSelectorModal from './PromptSelectorModal';
import PromptAnswerModal from './PromptAnswerModal';

const Z_MODAL = 1500;
const PHOTO_STORAGE_MARKER = '/uploads/images/';

const normalizePhotoPath = (photo) => {
  const url = typeof photo === 'object' && photo?.url
    ? photo.url
    : typeof photo === 'string'
      ? photo
      : '';

  if (!url) return '';

  if (url.includes(PHOTO_STORAGE_MARKER)) {
    const markerIndex = url.lastIndexOf(PHOTO_STORAGE_MARKER);
    return url.substring(markerIndex);
  }

  return url.trim();
};

const normalizeStringArray = (items = []) =>
  [...items]
    .map((item) => String(item))
    .sort((a, b) => a.localeCompare(b))
    .join('|');

const normalizePromptValue = (prompt) => ({
  question: (prompt?.question || '').trim(),
  answer: (prompt?.answer || '').trim(),
});

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
  
  const [existingPhotos, setExistingPhotos] = useState(datingProfile?.photos || []);
  const [newPhotos, setNewPhotos] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const fileInputRef = useRef(null);
  const initialSnapshotRef = useRef({
    age: Number(datingProfile?.age || 20),
    lookingFor: datingProfile?.looking_for || 'female',
    bio: (datingProfile?.bio || '').trim(),
    goals: normalizeStringArray(datingProfile?.goals || []),
    interests: normalizeStringArray(datingProfile?.interests || []),
    prompt: normalizePromptValue(datingProfile?.prompts),
    photos: (datingProfile?.photos || []).map(normalizePhotoPath).filter(Boolean),
  });

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
      toast.warning(`Максимум ${MAX_PHOTOS} фото`);
      return;
    }
    
    setLoading(true);
    try {
      const processed = await processImageFiles(e.target.files);
      setNewPhotos(prev => [...prev, ...processed.map(p => p.file)]);
      setNewPreviews(prev => [...prev, ...processed.map(p => p.preview)]);
    } catch (e) {
      toast.error('Ошибка обработки фото');
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
        toast.warning(`Можно выбрать максимум ${MAX_INTERESTS} интересов`);
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

  const confirmClose = () => {
    setShowConfirmation(false);
    onClose();
  };

  const handleBack = () => {
    if (loading) return;

    if (showConfirmation) {
      setShowConfirmation(false);
      return;
    }

    if (editingPrompt) {
      setEditingPrompt(null);
      return;
    }

    if (showPromptSelector) {
      setShowPromptSelector(false);
      return;
    }

    if (hasUnsavedChanges) {
      hapticFeedback('light');
      setShowConfirmation(true);
      return;
    }

    onClose();
  };

  const handleSave = async () => {
    if (totalPhotos === 0) {
      toast.warning('Минимум 1 фото обязательно');
      return;
    }

    if (bio.trim().length > 0) {
      if (bio.trim().length < BIO_MIN_LENGTH) {
        toast.warning(`Био должно содержать минимум ${BIO_MIN_LENGTH} символов`);
        return;
      }
      if (bio.trim().length > BIO_MAX_LENGTH) {
        toast.warning(`Био должно содержать максимум ${BIO_MAX_LENGTH} символов`);
        return;
      }
      
      const bioWithoutEmoji = bio.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      const lettersOnly = bioWithoutEmoji.replace(/[^\wа-яА-ЯёЁ\s]/g, '');
      if (lettersOnly.trim().length < BIO_MIN_LENGTH) {
        toast.warning('Напиши хотя бы пару слов');
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
      
      const keepPhotos = existingPhotos
        .map(normalizePhotoPath)
        .filter(Boolean);

      formData.append('keep_photos', JSON.stringify(keepPhotos));
      
      const updated = await updateDatingProfile(formData);
      setDatingProfile(updated);
      
      hapticFeedback('success');
      toast.success('Изменения профиля сохранены');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast.error(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const hasUnsavedChanges = (() => {
    const initialSnapshot = initialSnapshotRef.current;
    const currentPrompt = normalizePromptValue(prompt);
    const currentPhotos = existingPhotos.map(normalizePhotoPath).filter(Boolean);
    const initialPhotos = initialSnapshot.photos;

    if (Number(age) !== initialSnapshot.age) return true;
    if (lookingFor !== initialSnapshot.lookingFor) return true;
    if (bio.trim() !== initialSnapshot.bio) return true;
    if (normalizeStringArray(goals) !== initialSnapshot.goals) return true;
    if (normalizeStringArray(interests) !== initialSnapshot.interests) return true;
    if (currentPrompt.question !== initialSnapshot.prompt.question) return true;
    if (currentPrompt.answer !== initialSnapshot.prompt.answer) return true;
    if (newPhotos.length > 0) return true;
    if (currentPhotos.length !== initialPhotos.length) return true;

    for (let index = 0; index < currentPhotos.length; index += 1) {
      if (currentPhotos[index] !== initialPhotos[index]) {
        return true;
      }
    }

    return false;
  })();

  const isMainVisible = hasUnsavedChanges && !showPromptSelector && !editingPrompt && !showConfirmation;
  const canSave = isMainVisible && !loading && totalPhotos > 0;

  useTelegramScreen({
    id: 'edit-dating-profile-modal',
    title: 'Редактировать профиль',
    priority: 120,
    back: {
      visible: true,
      onClick: showConfirmation ? () => setShowConfirmation(false) : handleBack,
    },
    main: showConfirmation
      ? {
          visible: true,
          text: 'Выйти',
          onClick: confirmClose,
          enabled: !loading,
          loading: false,
          color: theme.colors.error,
        }
      : {
          visible: isMainVisible,
          text: 'Сохранить изменения',
          onClick: handleSave,
          enabled: canSave,
          loading,
          color: theme.colors.dating.action,
        },
    secondary: {
      visible: showConfirmation,
      text: 'Вернуться',
      onClick: () => setShowConfirmation(false),
      enabled: !loading,
      loading: false,
    },
  });

  return (
    <>
      <div
        style={{
          ...styles.overlay,
          pointerEvents: showConfirmation ? 'none' : 'auto',
        }}
        onClick={loading || showConfirmation ? undefined : handleBack}
      />

      <div
        style={{
          ...styles.modal,
          pointerEvents: showConfirmation ? 'none' : 'auto',
        }}
      >
        <DrilldownHeader title="Редактировать профиль" onBack={handleBack} />

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

      </div>
      <PromptSelectorModal
        isOpen={showPromptSelector}
        onClose={() => setShowPromptSelector(false)}
        onSelect={handlePromptSelect}
      />

      <PromptAnswerModal
        isOpen={!!editingPrompt}
        onClose={() => setEditingPrompt(null)}
        prompt={editingPrompt}
        onSave={handlePromptSave}
      />

      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Выйти без сохранения?"
        message="Несохранённые изменения будут потеряны."
        confirmText="Выйти"
        cancelText="Вернуться"
        confirmType="danger"
        onConfirm={confirmClose}
        onCancel={() => setShowConfirmation(false)}
      />
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
    paddingTop: '16px',
    paddingBottom: 'var(--screen-bottom-offset)',
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
    background: theme.colors.dating.actionGradient,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: `0 4px 12px ${theme.colors.dating.actionGlow}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
