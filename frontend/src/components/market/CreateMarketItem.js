// ===== 📄 ФАЙЛ: frontend/src/components/market/CreateMarketItem.js =====
import React, { useState, useRef } from 'react';
import { Trash2, MapPin, Check, AlertCircle, Camera, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store';
import { createMarketItem, updateMarketItem } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { processImageFiles } from '../../utils/media';
import { toast } from '../shared/Toast';
import SwipeableModal from '../shared/SwipeableModal';


const MAX_IMAGES = 3;
const MIN_TITLE_LEN = 5;
const MAX_TITLE_LEN = 50;
const MIN_DESC_LEN = 20;
const MAX_DESC_LEN = 1000;


const CreateMarketItem = ({ editItem = null, onClose, onSuccess }) => {
  const { user, addMarketItem, updateMarketItem: updateInStore } = useStore();

  // ===== STATE =====
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [category, setCategory] = useState(editItem?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const [images, setImages] = useState(
    editItem?.images?.map(img => ({ 
      file: null, 
      preview: typeof img === 'string' ? img : img.url 
    })) || []
  );
  
  const [title, setTitle] = useState(editItem?.title || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [price, setPrice] = useState(editItem?.price || '');
  const [condition, setCondition] = useState(editItem?.condition || 'good');
  const [location, setLocation] = useState(editItem?.location || '');

  const [errors, setErrors] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const fileInputRef = useRef(null);

  // ===== CONSTANTS =====
  
  const standardCategories = [
    { id: 'textbooks', label: 'Учебники', icon: '📚' },
    { id: 'electronics', label: 'Электроника', icon: '💻' },
    { id: 'clothing', label: 'Одежда', icon: '👕' },
    { id: 'furniture', label: 'Мебель', icon: '🛋️' },
    { id: 'sports', label: 'Спорт', icon: '⚽' },
    { id: 'appliances', label: 'Техника', icon: '🔌' },
  ];

  const suggestedCategories = [
    'Конспекты', 'Для общаги', 'Канцелярия', 
    'Проездные', 'Услуги', 'Игры', 
    'Хобби', 'Билеты', 'Косметика', 'Еда'
  ];

  const conditions = [
    { id: 'new', label: 'Новое', icon: '✨' },
    { id: 'like_new', label: 'Как новое', icon: '⭐' },
    { id: 'good', label: 'Хорошее', icon: '👍' },
    { id: 'fair', label: 'Норм', icon: '👌' },
  ];

  // ===== VALIDATION HELPERS =====
  const getBorderColor = (isValid, attemptedSubmit) => {
    if (!attemptedSubmit) return theme.colors.border;
    return isValid ? theme.colors.success : theme.colors.error;
  };
  
  const isStep1Valid = () => !!category && category.trim().length > 0;
  const isStep2Valid = () => images.length > 0;
  const isStep3Valid = () => (
    title.trim().length >= MIN_TITLE_LEN &&
    description.trim().length >= MIN_DESC_LEN &&
    price && parseInt(price) >= 0
  );

  // ===== HANDLERS =====

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      hapticFeedback('error');
      toast.warning(`Максимум ${MAX_IMAGES} фото`);
      return;
    }

    setLoading(true);
    try {
      const processed = await processImageFiles(files);
      setImages(prev => [...prev, ...processed]);
      if (errors.images) setErrors({ ...errors, images: null });
      hapticFeedback('light');
    } catch (err) {
      console.error("Ошибка фото:", err);
      toast.error("Ошибка загрузки фото");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    hapticFeedback('medium');
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!isStep1Valid()) return;
      hapticFeedback('light');
      setStep(2);
    } 
    else if (step === 2) {
      if (!isStep2Valid()) return;
      hapticFeedback('light');
      setStep(3);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setStep(prev => prev - 1);
  };

  const handleSelectCategory = (id) => {
    hapticFeedback('medium');
    setCategory(id);
    setShowCategoryInput(false);
  };

  const handleCustomCategoryInput = (val) => {
    setCustomCategory(val);
    setCategory(val); 
  };

  const handleSuggestionClick = (val) => {
    hapticFeedback('light');
    setCustomCategory(val);
    setCategory(val);
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    
    if (!isStep3Valid()) {
      hapticFeedback('error');
      return;
    }

    setLoading(true);
    hapticFeedback('heavy');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', parseInt(price, 10));
      formData.append('category', category);
      formData.append('condition', condition);
      formData.append('location', location);
      formData.append('telegram_id', user.telegram_id);

      if (editItem) {
        const keepImages = images
          .filter(img => !img.file)
          .map(img => img.preview.split('/').pop());
        formData.append('keep_images', JSON.stringify(keepImages));
      }

      images.forEach((img) => {
        if (img.file) {
          const fieldName = editItem ? 'new_images' : 'images';
          formData.append(fieldName, img.file);
        }
      });

      let result;
      if (editItem) {
        result = await updateMarketItem(editItem.id, formData);
        updateInStore(result);
      } else {
        result = await createMarketItem(formData);
        addMarketItem(result);
      }

      setLoading(false);
      hapticFeedback('success');
      toast.success(editItem ? 'Товар обновлён' : 'Товар опубликован');

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 300);

    } catch (err) {
      console.error(err);
      setLoading(false);
      hapticFeedback('error');
      toast.error(err.response?.data?.detail || 'Ошибка публикации');
    }
  };

  const renderInputLabel = (labelText, currentVal, min, max, isRequired = false) => {
    const len = currentVal ? currentVal.trim().length : 0;
    const isValid = len >= min && len <= max;
    const isError = len > 0 && !isValid;
    let counterColor = theme.colors.textTertiary;
    if (isError) counterColor = theme.colors.error;
    if (isValid) counterColor = theme.colors.success;

    return (
      <div style={styles.labelRow}>
        <span style={styles.label}>
          {labelText}{isRequired && '*'}
        </span>
        
        <div style={styles.counterContainer}>
          <span style={{...styles.counterText, color: counterColor}}>
            {len}/{max}
          </span>
          
          {len > 0 && (
            isValid 
              ? <Check size={14} color={theme.colors.success} />
              : <AlertCircle size={14} color={theme.colors.error} />
          )}
        </div>
      </div>
    );
  };

  // Custom Title Component
  const customTitle = (
    <div style={styles.titleWrapper}>
      {editItem ? 'Редактирование' : 'Новое объявление'}
    </div>
  );

  return (
    <SwipeableModal
      isOpen={true}
      onClose={onClose}
      title={customTitle}
    >
      <div style={styles.container}>
        {/* STEPPER */}
        <div style={styles.stepperWrapper}>
          <div style={styles.stepperContainer}>
            <div style={styles.stepperLine} />
            {[1, 2, 3].map((s) => {
              // ✅ Вычисляем стили ВНУТРИ map для правильного реактивного обновления
              const isActive = step >= s;
              const isCurrent = step === s;
              
              return (
                <div 
                  key={s} 
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isActive ? theme.colors.market : theme.colors.bg,
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: isActive ? theme.colors.market : theme.colors.border,
                    color: isActive ? '#fff' : theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 14,
                    zIndex: 1,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    boxShadow: isCurrent ? `0 0 0 4px rgba(16, 185, 129, 0.2)` : 'none',
                  }}
                >
                  {s}
                </div>
              );
            })}
          </div>
          
          <div style={styles.stepLabels}>
            <span style={step >= 1 ? styles.stepLabelActive : styles.stepLabel}>Категория</span>
            <span style={step >= 2 ? styles.stepLabelActive : styles.stepLabel}>Фото</span>
            <span style={step >= 3 ? styles.stepLabelActive : styles.stepLabel}>Детали</span>
          </div>
        </div>

        {/* CONTENT */}
        <div style={styles.content}>
          
          {/* STEP 1: CATEGORY */}
          {step === 1 && (
            <div style={styles.stepContent}>
              {!showCategoryInput ? (
                <>
                  <div style={styles.categoriesGrid}>
                    {standardCategories.map(cat => {
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          style={{
                            background: isSelected 
                              ? 'rgba(16, 185, 129, 0.1)' 
                              : theme.colors.bgSecondary,
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: isSelected 
                              ? theme.colors.market 
                              : theme.colors.border,
                            color: theme.colors.text,
                            borderRadius: 16,
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => handleSelectCategory(cat.id)}
                        >
                          <span style={styles.catIcon}>{cat.icon}</span>
                          <span style={styles.catLabel}>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <button style={styles.otherButton} onClick={() => setShowCategoryInput(true)}>
                    <span>💡 Другая категория...</span>
                  </button>
                </>
              ) : (
                <div style={styles.customCatBlock}>
                  <button style={styles.cancelCustomBtn} onClick={() => setShowCategoryInput(false)}>
                    <ChevronLeft size={18} />
                    Назад к списку
                  </button>

                  <div style={styles.suggestionsLabel}>Популярное:</div>
                  <div style={styles.suggestions}>
                    {suggestedCategories.map(s => (
                      <button key={s} style={styles.suggestionChip} onClick={() => handleSuggestionClick(s)}>
                        {s}
                      </button>
                    ))}
                  </div>

                  <div style={styles.bottomInputContainer}>
                    <div style={styles.suggestionsLabel}>Своя категория:</div>
                    <input 
                      autoFocus
                      placeholder="Напишите категорию..."
                      value={customCategory}
                      onChange={e => handleCustomCategoryInput(e.target.value)}
                      style={styles.customInput}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PHOTOS */}
          {step === 2 && (
            <div style={styles.stepContent}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>Фотографии*</span>
                <span style={styles.counter}>{images.length}/{MAX_IMAGES}</span>
              </div>

              <div style={styles.photosGrid}>
                {images.map((img, idx) => (
                  <div key={idx} style={styles.photoWrapper}>
                    <img src={img.preview} alt="preview" style={styles.photoPreview} />
                    <button style={styles.removePhotoButton} onClick={() => removeImage(idx)}>
                      <Trash2 size={14} />
                    </button>
                    {idx === 0 && <div style={styles.coverBadge}>Обложка</div>}
                  </div>
                ))}

                {images.length < MAX_IMAGES && (
                  <button 
                    style={styles.addPhotoButton}
                    onClick={() => fileInputRef.current.click()}
                  >
                    {loading ? (
                      <div style={styles.spinner} />
                    ) : (
                      <>
                        <Camera size={24} color={theme.colors.market} />
                        <span style={styles.addPhotoText}>Добавить</span>
                      </>
                    )}
                  </button>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                />
              </div>

              <div style={styles.divider} />
              
              <div style={styles.sectionTitle}>Состояние*</div>
              <div style={styles.conditionsGrid}>
                {conditions.map(c => {
                  const isActive = condition === c.id;
                  return (
                    <button
                      key={c.id}
                      style={{
                        backgroundColor: isActive ? theme.colors.market : theme.colors.bgSecondary,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: isActive ? theme.colors.market : theme.colors.border,
                        color: isActive ? '#ffffff' : theme.colors.text,
                        fontWeight: isActive ? 600 : 400,
                        borderRadius: 12,
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => { setCondition(c.id); hapticFeedback('light'); }}
                    >
                      <span>{c.icon} {c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: DETAILS */}
          {step === 3 && (
            <div style={styles.stepContentCompact}>
              
              {/* НАЗВАНИЕ */}
              <div style={styles.inputGroup}>
                {renderInputLabel("Название", title, MIN_TITLE_LEN, MAX_TITLE_LEN, true)}
                <input
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 14px',
                    background: theme.colors.bgSecondary,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: getBorderColor(title.trim().length >= MIN_TITLE_LEN, attemptedSubmit),
                    borderRadius: 12,
                    color: theme.colors.text,
                    fontSize: 16,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="iPhone 13, Велосипед..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={MAX_TITLE_LEN}
                />
              </div>

              {/* ЦЕНА */}
              <div style={styles.inputGroup}>
                <div style={styles.labelRow}>
                  <span style={styles.label}>Цена (₽)*</span>
                </div>
                <input
                  type="number"
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 14px',
                    background: theme.colors.bgSecondary,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: getBorderColor(price && parseInt(price) >= 0, attemptedSubmit),
                    borderRadius: 12,
                    color: theme.colors.text,
                    fontSize: 16,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>

              {/* ОПИСАНИЕ */}
              <div style={styles.inputGroup}>
                {renderInputLabel("Описание", description, MIN_DESC_LEN, MAX_DESC_LEN, true)}
                <textarea
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: theme.colors.bgSecondary,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: getBorderColor(description.trim().length >= MIN_DESC_LEN, attemptedSubmit),
                    borderRadius: 12,
                    color: theme.colors.text,
                    fontSize: 15,
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  placeholder={`Минимум ${MIN_DESC_LEN} символов...`}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* ЛОКАЦИЯ */}
              <div style={styles.inputGroup}>
                <div style={styles.labelRow}>
                  <span style={styles.label}>
                    Где забирать? <span style={{color: theme.colors.textTertiary, fontWeight: 400}}>(опционально)</span>
                  </span>
                </div>
                <div style={styles.inputWrapper}>
                  <MapPin size={16} style={styles.inputIcon} />
                  <input 
                    style={styles.inputWithIcon}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Например: Покровка, R-корпус"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          {step > 1 && (
            <button style={styles.backButton} onClick={handleBack} disabled={loading}>
              Назад
            </button>
          )}
          
          {step < 3 ? (
            <button 
              style={(!isStep1Valid() && step === 1) || (!isStep2Valid() && step === 2)
                ? styles.nextButtonDisabled 
                : styles.nextButton
              } 
              onClick={handleNext}
              disabled={(step === 1 && !isStep1Valid()) || (step === 2 && !isStep2Valid())}
            >
              Далее
            </button>
          ) : (
            <button 
              style={!isStep3Valid() || loading ? styles.submitButtonDisabled : styles.submitButton} 
              onClick={handleSubmit} 
              disabled={!isStep3Valid() || loading}
            >
              {loading ? '...' : 'Разместить'}
            </button>
          )}
        </div>
      </div>
    </SwipeableModal>
  );
};


const styles = {
  // Container
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '60vh',
    maxHeight: '75vh',
  },

  titleWrapper: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },

  // Stepper
  stepperWrapper: {
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.md,
  },

  stepperContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    margin: '16px 40px 8px',
  },

  stepperLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    background: theme.colors.border,
    zIndex: 0,
    transform: 'translateY(-50%)',
  },

  stepLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    margin: '0 20px',
  },

  stepLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    width: 60,
    textAlign: 'center'
  },

  stepLabelActive: {
    fontSize: 11,
    color: theme.colors.market,
    fontWeight: 600,
    width: 60,
    textAlign: 'center'
  },

  // Content
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: theme.spacing.sm,
  },

  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  stepContentCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  // Step 1: Categories
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12
  },

  catIcon: {
    fontSize: 28
  },

  catLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: 500
  },

  otherButton: {
    width: '100%',
    padding: '14px',
    marginTop: 12,
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 16,
    color: theme.colors.textSecondary,
    fontWeight: 500,
    cursor: 'pointer',
  },
  
  // Custom Category
  customCatBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    height: '100%'
  },

  cancelCustomBtn: {
    alignSelf: 'flex-start',
    padding: '8px 0',
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    fontSize: 14,
  },

  suggestionsLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },

  suggestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },

  suggestionChip: {
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: '8px 14px',
    color: theme.colors.text,
    fontSize: 13,
    cursor: 'pointer',
  },

  bottomInputContainer: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 10
  },

  customInput: {
    width: '100%',
    height: 48,
    padding: '0 16px',
    background: theme.colors.bgSecondary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 14,
    color: theme.colors.text,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },

  // Step 2: Photos & Condition
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.colors.text
  },

  counter: {
    fontSize: 13,
    color: theme.colors.textTertiary
  },

  photosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12
  },

  photoWrapper: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden'
  },

  photoPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    background: 'rgba(16, 185, 129, 0.9)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    textAlign: 'center',
    padding: 2,
  },

  addPhotoButton: {
    aspectRatio: '1',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'pointer',
    color: theme.colors.textSecondary,
  },

  addPhotoText: {
    fontSize: 11,
    fontWeight: 500
  },

  divider: {
    height: 1,
    background: theme.colors.border,
    margin: '8px 0'
  },
  
  conditionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10
  },

  // Step 3
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%'
  },

  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  counterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },

  counterText: {
    fontSize: 12,
    fontWeight: 500
  },

  label: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 4,
    fontWeight: 500
  },

  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%'
  },

  inputIcon: {
    position: 'absolute',
    left: 12,
    color: theme.colors.textSecondary
  },

  inputWithIcon: {
    width: '100%',
    height: 44,
    padding: '0 12px 0 40px',
    background: theme.colors.bgSecondary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 12,
    color: theme.colors.text,
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
  },

  // Footer & Buttons
  footer: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: 12,
    background: theme.colors.bg,
    marginTop: 'auto',
  },

  backButton: {
    flex: 1,
    height: 48,
    background: theme.colors.bgSecondary,
    border: 'none',
    borderRadius: 14,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },

  nextButton: {
    flex: 2,
    height: 48,
    background: theme.colors.market,
    border: 'none',
    borderRadius: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },

  nextButtonDisabled: {
    flex: 2,
    height: 48,
    background: theme.colors.bgSecondary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 14,
    color: theme.colors.textDisabled,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'not-allowed',
    opacity: 0.5,
  },

  submitButton: {
    flex: 2,
    height: 48,
    background: theme.colors.market,
    border: 'none',
    borderRadius: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },

  submitButtonDisabled: {
    flex: 2,
    height: 48,
    background: theme.colors.bgSecondary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: 14,
    color: theme.colors.textDisabled,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'not-allowed',
    opacity: 0.5,
  },

  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};


const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin { 
    to { transform: rotate(360deg); } 
  }
`;
if (!document.getElementById('create-market-item-styles')) {
  styleSheet.id = 'create-market-item-styles';
  document.head.appendChild(styleSheet);
}


export default CreateMarketItem;