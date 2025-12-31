// ===== 📄 ФАЙЛ: src/components/market/CreateMarketItem.js =====

import React, { useState, useRef } from 'react';
import { X, Trash2, MapPin, Check, AlertCircle, Camera, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store';
import { createMarketItem, updateMarketItem } from '../../api';
import theme from '../../theme';
import { Z_CREATE_MARKET_ITEM } from '../../constants/zIndex';
import { processImageFiles } from '../../utils/media';

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
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Data
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
    { id: 'like-new', label: 'Как новое', icon: '⭐' },
    { id: 'good', label: 'Хорошее', icon: '👍' },
    { id: 'fair', label: 'Норм', icon: '👌' },
  ];

  // ===== VALIDATION HELPERS =====

  const isStep1Valid = () => !!category && category.trim().length > 0;
  const isStep2Valid = () => images.length > 0;
  const isStep3Valid = () => (
    title.trim().length >= MIN_TITLE_LEN &&
    description.trim().length >= MIN_DESC_LEN &&
    price && parseInt(price) >= 0
  );

  // ===== HANDLERS =====

  const haptic = (type) => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      haptic('error');
      alert(`Максимум ${MAX_IMAGES} фото`);
      return;
    }

    setLoading(true);
    try {
      const processed = await processImageFiles(files);
      setImages(prev => [...prev, ...processed]);
      if (errors.images) setErrors({ ...errors, images: null });
      haptic('light');
    } catch (err) {
      console.error("Ошибка фото:", err);
      alert("Ошибка загрузки фото");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    haptic('medium');
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!isStep1Valid()) return;
      haptic('light');
      setStep(2);
    } 
    else if (step === 2) {
      if (!isStep2Valid()) return;
      haptic('light');
      setStep(3);
    }
  };

  const handleBack = () => {
    haptic('light');
    setStep(prev => prev - 1);
  };

  const handleSelectCategory = (id) => {
    haptic('medium');
    setCategory(id);
    setShowCategoryInput(false);
  };

  const handleCustomCategoryInput = (val) => {
    setCustomCategory(val);
    setCategory(val); 
  };

  const handleSuggestionClick = (val) => {
    haptic('light');
    setCustomCategory(val);
    setCategory(val);
  };

  const handleSubmit = async () => {
    if (!isStep3Valid()) return;

    setLoading(true);
    haptic('heavy');

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
      setShowSuccess(true);
      haptic('success');
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      console.error(err);
      setLoading(false);
      haptic('error');
      alert('Ошибка при создании.');
    }
  };

  // ✅ ЛОГИКА СЧЕТЧИКА (Идентична CreatePost)
  const renderInputLabel = (labelText, currentVal, min, max, isRequired = false) => {
    const len = currentVal ? currentVal.trim().length : 0;
    const isValid = len >= min && len <= max;
    const isError = len > 0 && !isValid;
    
    // Цвет счетчика
    let counterColor = theme.colors.textTertiary;
    if (isError) counterColor = theme.colors.error;
    if (isValid) counterColor = theme.colors.success;

    return (
      <div style={styles.labelRow}>
        <span style={styles.label}>
          {labelText}
          {isRequired && <span style={{color: theme.colors.error, marginLeft: 2}}>*</span>}
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

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* SUCCESS POPUP */}
        {showSuccess && (
          <div style={styles.successOverlay}>
            <div style={styles.successCard}>
              <div style={styles.successIconCircle}>
                <Check size={40} color="#fff" />
              </div>
              <h3 style={styles.successTitle}>Товар опубликован!</h3>
              <p style={styles.successText}>Удачи в продаже</p>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={styles.header}>
          <button style={styles.closeButton} onClick={onClose} disabled={loading}>
            <X size={24} />
          </button>
          <div style={styles.headerTitle}>
            {editItem ? 'Редактирование' : 'Новое объявление'}
          </div>
          <div style={{width: 24}} /> 
        </div>

        {/* STEPPER */}
        <div style={styles.stepperContainer}>
          <div style={styles.stepperLine} />
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              style={{
                ...styles.stepCircle,
                ...(step >= s ? styles.stepCircleActive : {}),
                ...(step === s ? styles.stepCircleCurrent : {})
              }}
            >
              {s}
            </div>
          ))}
        </div>
        
        <div style={styles.stepLabels}>
           <span style={step >= 1 ? styles.stepLabelActive : styles.stepLabel}>Категория</span>
           <span style={step >= 2 ? styles.stepLabelActive : styles.stepLabel}>Фото</span>
           <span style={step >= 3 ? styles.stepLabelActive : styles.stepLabel}>Детали</span>
        </div>

        {/* CONTENT */}
        <div style={styles.content}>
          
          {/* STEP 1: CATEGORY */}
          {step === 1 && (
            <div style={styles.stepContent}>
              {!showCategoryInput ? (
                <>
                  <div style={styles.categoriesGrid}>
                    {standardCategories.map(cat => (
                      <button
                        key={cat.id}
                        style={{
                          ...styles.catCard,
                          ...(category === cat.id ? styles.catCardActive : {})
                        }}
                        onClick={() => handleSelectCategory(cat.id)}
                      >
                        <span style={styles.catIcon}>{cat.icon}</span>
                        <span style={styles.catLabel}>{cat.label}</span>
                      </button>
                    ))}
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
                <span style={styles.sectionTitle}>
                  Фотографии<span style={{color: theme.colors.error, marginLeft: 2}}>*</span>
                </span>
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
              
              <div style={styles.sectionTitle}>
                Состояние<span style={{color: theme.colors.error, marginLeft: 2}}>*</span>
              </div>
              <div style={styles.conditionsGrid}>
                {conditions.map(c => {
                  const isActive = condition === c.id;
                  return (
                    <button
                      key={c.id}
                      // ✅ ФИКС ЦВЕТА: Явно задаем цвета через условие, никаких наложений стилей
                      style={{
                        ...styles.conditionChip, // Базовые размеры
                        backgroundColor: isActive ? theme.colors.market : theme.colors.bgSecondary,
                        borderColor: isActive ? theme.colors.market : theme.colors.border,
                        color: isActive ? '#ffffff' : theme.colors.text,
                        fontWeight: isActive ? 600 : 400
                      }}
                      onClick={() => { setCondition(c.id); haptic('light'); }}
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
                  style={styles.input}
                  placeholder="iPhone 13, Велосипед..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={MAX_TITLE_LEN}
                />
              </div>

              {/* ЦЕНА */}
              <div style={styles.inputGroup}>
                <div style={styles.labelRow}>
                  <span style={styles.label}>
                    Цена (₽)<span style={{color: theme.colors.error, marginLeft: 2}}>*</span>
                  </span>
                </div>
                <input
                  type="number"
                  style={styles.input}
                  placeholder="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>

              {/* ОПИСАНИЕ */}
              <div style={styles.inputGroup}>
                {renderInputLabel("Описание", description, MIN_DESC_LEN, MAX_DESC_LEN, true)}
                <textarea
                  style={styles.textarea}
                  placeholder={`Минимум ${MIN_DESC_LEN} символов...`}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={5}
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
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', zIndex: Z_CREATE_MARKET_ITEM,
    display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.2s ease',
  },
  modal: {
    width: '100%', height: '90vh', background: theme.colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease',
    position: 'relative',
  },

  // Success Popup
  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(10, 10, 10, 0.95)', zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '24px 24px 0 0', animation: 'fadeIn 0.3s ease',
  },
  successCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.4s ease',
  },
  successIconCircle: {
    width: 80, height: 80, borderRadius: '50%', background: theme.colors.market,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
  },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 },
  successText: { fontSize: 15, color: theme.colors.textSecondary },

  // Header
  header: {
    padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  headerTitle: { fontSize: 17, fontWeight: 600, color: theme.colors.text },
  closeButton: { background: 'none', border: 'none', color: theme.colors.textSecondary, cursor: 'pointer' },

  // Stepper
  stepperContainer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'relative', margin: '20px 40px 10px',
  },
  stepperLine: {
    position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
    background: theme.colors.border, zIndex: 0, transform: 'translateY(-50%)',
  },
  stepCircle: {
    width: 32, height: 32, borderRadius: '50%',
    background: theme.colors.bg, border: `2px solid ${theme.colors.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: theme.colors.textSecondary, fontWeight: 600, fontSize: 14,
    zIndex: 1, position: 'relative', transition: 'all 0.3s ease',
  },
  stepCircleActive: { background: theme.colors.market, borderColor: theme.colors.market, color: '#fff' },
  stepCircleCurrent: { boxShadow: `0 0 0 4px rgba(16, 185, 129, 0.2)` },
  stepLabels: {
    display: 'flex', justifyContent: 'space-between', margin: '0 20px 20px',
    paddingBottom: 10, borderBottom: `1px solid ${theme.colors.border}`,
  },
  stepLabel: { fontSize: 11, color: theme.colors.textSecondary, width: 60, textAlign: 'center' },
  stepLabelActive: { fontSize: 11, color: theme.colors.market, fontWeight: 600, width: 60, textAlign: 'center' },

  // Content
  content: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  stepContent: { display: 'flex', flexDirection: 'column', gap: 20, height: '100%' },
  stepContentCompact: { display: 'flex', flexDirection: 'column', gap: 12 },

  // Step 1: Categories
  categoriesGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  catCard: {
    background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.border}`,
    borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 8, cursor: 'pointer', transition: 'all 0.2s',
  },
  catCardActive: { background: 'rgba(16, 185, 129, 0.1)', borderColor: theme.colors.market },
  catIcon: { fontSize: 28 },
  catLabel: { fontSize: 14, color: theme.colors.text, fontWeight: 500 },
  otherButton: {
    width: '100%', padding: '14px', marginTop: 12,
    background: theme.colors.card, border: `1px solid ${theme.colors.border}`,
    borderRadius: 16, color: theme.colors.textSecondary, fontWeight: 500, cursor: 'pointer',
  },
  
  // Custom Category
  customCatBlock: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%' },
  cancelCustomBtn: {
    alignSelf: 'flex-start', padding: '8px 0', background: 'transparent',
    border: 'none', color: theme.colors.textSecondary,
    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14,
  },
  suggestionsLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    background: theme.colors.card, border: `1px solid ${theme.colors.border}`,
    borderRadius: 20, padding: '8px 14px', color: theme.colors.text, fontSize: 13, cursor: 'pointer',
  },
  bottomInputContainer: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 },
  customInput: {
    width: '100%', height: 48, padding: '0 16px', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: 14, color: theme.colors.text, fontSize: 16, outline: 'none',
    boxSizing: 'border-box',
  },

  // Step 2: Photos & Condition
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: theme.colors.text },
  counter: { fontSize: 13, color: theme.colors.textTertiary },
  photosGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  photoWrapper: { position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%', objectFit: 'cover' },
  removePhotoButton: {
    position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff',
    border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  coverBadge: {
    position: 'absolute', bottom: 4, left: 4, right: 4, background: 'rgba(16, 185, 129, 0.9)',
    color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, textAlign: 'center', padding: 2,
  },
  addPhotoButton: {
    aspectRatio: '1', borderRadius: 12, border: `2px dashed ${theme.colors.border}`, background: 'transparent',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: theme.colors.textSecondary,
  },
  addPhotoText: { fontSize: 11, fontWeight: 500 },
  divider: { height: 1, background: theme.colors.border, margin: '8px 0' },
  
  conditionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  conditionChip: {
    borderRadius: 12, padding: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer',
    borderWidth: 1, borderStyle: 'solid',
    transition: 'all 0.2s',
  },

  // Step 3
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  counterContainer: { display: 'flex', alignItems: 'center', gap: 6 },
  counterText: { fontSize: 12, fontWeight: 500 },
  label: { fontSize: 13, color: theme.colors.textSecondary, marginLeft: 4, fontWeight: 500 },
  input: {
    width: '100%', height: 44, padding: '0 14px', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: 12, color: theme.colors.text, fontSize: 16,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '12px 14px', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: 12, color: theme.colors.text, fontSize: 15, resize: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' },
  inputIcon: { position: 'absolute', left: 12, color: theme.colors.textSecondary },
  inputWithIcon: {
    width: '100%', height: 44, padding: '0 12px 0 40px', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: 12, color: theme.colors.text, fontSize: 15,
    boxSizing: 'border-box',
  },

  // Footer & Buttons
  footer: {
    padding: 16, borderTop: `1px solid ${theme.colors.border}`, display: 'flex', gap: 12, background: theme.colors.bg,
  },
  backButton: {
    flex: 1, height: 48, background: theme.colors.bgSecondary, border: 'none', borderRadius: 14,
    color: theme.colors.text, fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  nextButton: {
    flex: 2, height: 48, background: theme.colors.market, border: 'none', borderRadius: 14,
    color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  nextButtonDisabled: {
    flex: 2, height: 48, background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: 14,
    color: theme.colors.textDisabled, fontSize: 16, fontWeight: 600, cursor: 'not-allowed', opacity: 0.5,
  },
  submitButton: {
    flex: 2, height: 48, background: theme.colors.market, border: 'none', borderRadius: 14,
    color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
  },
  submitButtonDisabled: {
    flex: 2, height: 48, background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: 14,
    color: theme.colors.textDisabled, fontSize: 16, fontWeight: 600, cursor: 'not-allowed', opacity: 0.5,
  },
  spinner: {
    width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes popIn { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
`;
document.head.appendChild(styleSheet);

export default CreateMarketItem;