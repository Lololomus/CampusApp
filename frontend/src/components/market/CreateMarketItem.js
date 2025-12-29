// ===== 📄 ФАЙЛ: src/components/Market/CreateMarketItem.js =====

import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { createMarketItem, updateMarketItem } from '../../api';
import theme from '../../theme';
import { Z_CREATE_MARKET_ITEM } from '../../constants/zIndex';

const CreateMarketItem = ({ editItem = null, onClose, onSuccess }) => {
  const { user, addMarketItem, updateMarketItem: updateInStore } = useStore();

  // ===== STATE =====
  const [step, setStep] = useState(1); // 1, 2, 3
  const [loading, setLoading] = useState(false);

  // Form data
  const [category, setCategory] = useState(editItem?.category || '');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  
  const [images, setImages] = useState(editItem?.images || []);
  
  const [title, setTitle] = useState(editItem?.title || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [price, setPrice] = useState(editItem?.price || '');
  const [condition, setCondition] = useState(editItem?.condition || 'good');
  const [location, setLocation] = useState(editItem?.location || user?.institute || '');

  // ===== КОНСТАНТЫ =====

  // 6 стандартных категорий
  const standardCategories = [
    { id: 'textbooks', label: 'Учебники', icon: '📚' },
    { id: 'electronics', label: 'Электроника', icon: '💻' },
    { id: 'furniture', label: 'Мебель', icon: '🛋️' },
    { id: 'clothing', label: 'Одежда', icon: '👕' },
    { id: 'sports', label: 'Спорт', icon: '⚽' },
    { id: 'appliances', label: 'Техника', icon: '🔌' },
  ];

  // 10 непопулярных категорий для подсказок
  const suggestedCategories = [
    'Канцелярия',
    'Игры и приставки',
    'Декор для комнаты',
    'Хобби и творчество',
    'Товары для питомцев',
    'Растения',
    'Косметика и уход',
    'Книги и журналы',
    'Музыкальные инструменты',
    'Коллекции',
  ];

  const conditions = [
    { value: 'new', label: 'Новое', icon: '✨' },
    { value: 'like-new', label: 'Как новое', icon: '⭐' },
    { value: 'good', label: 'Хорошее', icon: '👍' },
    { value: 'fair', label: 'Удовлетворительное', icon: '👌' },
  ];

  // ===== STEP NAVIGATION =====

  const handleNext = () => {
    // Валидация Step 1
    if (step === 1 && !category) {
      alert('Выберите категорию');
      return;
    }

    // Валидация Step 2
    if (step === 2 && images.length === 0) {
      alert('Добавьте хотя бы 1 фото');
      return;
    }

    if (step < 3) {
      haptic('light');
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      haptic('light');
      setStep(step - 1);
    }
  };

  // ===== STEP 1: КАТЕГОРИЯ =====

  const handleSelectCategory = (categoryId) => {
    haptic('medium');
    setCategory(categoryId);
    setShowCategoryInput(false);
    setCustomCategory('');
  };

  const handleOtherCategory = () => {
    haptic('light');
    setShowCategoryInput(true);
    setCategory('');
  };

  const handleApplyCustomCategory = () => {
    if (!customCategory.trim()) {
      alert('Введите название категории');
      return;
    }

    if (customCategory.length > 50) {
      alert('Максимум 50 символов');
      return;
    }

    // Валидация: только буквы, цифры, пробелы
    const validPattern = /^[а-яА-ЯёЁa-zA-Z0-9\s]+$/;
    if (!validPattern.test(customCategory)) {
      alert('Категория может содержать только буквы, цифры и пробелы');
      return;
    }

    haptic('medium');
    setCategory(customCategory.trim());
    setShowCategoryInput(false);
  };

  const handleSuggestionClick = (suggestion) => {
    haptic('light');
    setCustomCategory(suggestion);
  };

  // ===== STEP 2: ФОТО =====

  const handleAddImage = () => {
    if (images.length >= 5) {
      alert('Максимум 5 фото');
      return;
    }

    haptic('medium');

    // Всегда используем input, чтобы получить реальный файл (Base64),
    // даже внутри WebApp, иначе сервер не примет ссылку-заглушку.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Проверка на размер (опционально, например 10МБ)
        if (file.size > 10 * 1024 * 1024) {
          alert('Файл слишком большой');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          setImages(prev => [...prev, event.target.result]);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleRemoveImage = (index) => {
    haptic('medium');
    setImages(images.filter((_, i) => i !== index));
  };

  const handleReorderImages = (fromIndex, toIndex) => {
    haptic('light');
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    setImages(newImages);
  };

  // ===== STEP 3: ДЕТАЛИ =====

  const handleSubmit = async () => {
    // Валидация
    if (!title.trim() || title.length < 5 || title.length > 100) {
      alert('Название: от 5 до 100 символов');
      return;
    }

    if (!description.trim() || description.length < 20 || description.length > 1000) {
      alert('Описание: от 20 до 1000 символов');
      return;
    }

    if (!price || price < 0 || price > 1000000) {
      alert('Цена: от 0 до 1 000 000 ₽');
      return;
    }

    if (images.length === 0) {
      alert('Добавьте минимум 1 фото');
      return;
    }

    setLoading(true);
    haptic('medium');

    try {
      // Подготовка FormData для multipart/form-data
      const formData = new FormData();
      formData.append('category', category);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', parseInt(price));
      formData.append('condition', condition);
      
      if (location.trim()) {
        formData.append('location', location.trim());
      }

        // Добавляем изображения
        // Если редактирование - нужно указать какие оставить
        if (editItem) {
        const keepImages = images
          // Оставляем старые (это либо строки-ссылки, либо объекты {url:...}, но НЕ data:base64)
          .filter(img => (typeof img === 'string' && !img.startsWith('data:')) || typeof img === 'object')
          .map(img => {
            // Вытаскиваем имя файла из URL
            const url = typeof img === 'object' ? img.url : img;
            return url.split('/').pop();
          });
        formData.append('keep_images', JSON.stringify(keepImages));
      }

      // Новые изображения (base64)
      images.forEach((img, index) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
          // Base64 → File
          const blob = dataURLtoBlob(img);
          // ⚠️ ВАЖНО: Для создания поле 'images', для редактирования 'new_images'
          const fieldName = editItem ? 'new_images' : 'images';
          formData.append(fieldName, blob, `image_${index}.jpg`);
        }
      });

      let result;
      if (editItem) {
        result = await updateMarketItem(editItem.id, formData);
        updateInStore(editItem.id, result);
      } else {
        result = await createMarketItem(formData);
        addMarketItem(result);
      }

      // Success!
      haptic('success');
      showSuccessAnimation();
      
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Ошибка создания товара:', error);
      alert('Не удалось разместить товар');
      haptic('error');
    } finally {
      setLoading(false);
    }
  };

  // ===== HELPERS =====

  const haptic = (type) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const showSuccessAnimation = () => {
    // TODO: конфетти анимация
    console.log('🎉 Success!');
  };

  // ===== RENDER =====

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.headerButton} onClick={onClose}>
            <span style={styles.headerIcon}>✕</span>
          </button>

          <div style={styles.headerTitle}>
            {editItem ? 'Редактировать товар' : 'Создать объявление'}
          </div>

          <div style={styles.headerSpacer} />
        </div>

        {/* Progress */}
        <div style={styles.progress}>
          <div style={styles.progressSteps}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  ...styles.progressStep,
                  ...(s === step ? styles.progressStepActive : {}),
                  ...(s < step ? styles.progressStepDone : {}),
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div style={styles.progressLabels}>
            <span style={step === 1 ? styles.progressLabelActive : {}}>Категория</span>
            <span style={step === 2 ? styles.progressLabelActive : {}}>Фото</span>
            <span style={step === 3 ? styles.progressLabelActive : {}}>Детали</span>
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* ===== STEP 1: КАТЕГОРИЯ ===== */}
          {step === 1 && (
            <div style={styles.stepContent}>
              <div style={styles.stepTitle}>Выберите категорию</div>

              {!showCategoryInput ? (
                <>
                  {/* Grid 3x2 */}
                  <div style={styles.categoryGrid}>
                    {standardCategories.map((cat) => (
                      <button
                        key={cat.id}
                        style={{
                          ...styles.categoryButton,
                          ...(category === cat.id ? styles.categoryButtonActive : {}),
                        }}
                        onClick={() => handleSelectCategory(cat.id)}
                      >
                        <span style={styles.categoryIcon}>{cat.icon}</span>
                        <span style={styles.categoryLabel}>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Кнопка ДРУГОЕ */}
                  <button style={styles.otherButton} onClick={handleOtherCategory}>
                    💡 Другое
                  </button>
                </>
              ) : (
                <>
                  {/* Custom категория */}
                  <div style={styles.customCategoryBlock}>
                    <input
                      type="text"
                      placeholder="Введите категорию"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      style={styles.customInput}
                      maxLength={50}
                      autoFocus
                    />

                    <div style={styles.charCount}>
                      {customCategory.length} / 50
                    </div>

                    {/* Подсказки */}
                    <div style={styles.suggestionsTitle}>Популярные категории:</div>
                    <div style={styles.suggestions}>
                      {suggestedCategories.map((sug, index) => (
                        <button
                          key={index}
                          style={styles.suggestionChip}
                          onClick={() => handleSuggestionClick(sug)}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>

                    <div style={styles.customActions}>
                      <button style={styles.cancelButton} onClick={() => setShowCategoryInput(false)}>
                        Отмена
                      </button>
                      <button style={styles.applyButton} onClick={handleApplyCustomCategory}>
                        Применить
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== STEP 2: ФОТО ===== */}
          {step === 2 && (
            <div style={styles.stepContent}>
              <div style={styles.stepTitle}>Добавьте фото</div>
              <div style={styles.stepHint}>
                💡 Первое фото будет обложкой. Максимум 5 фото.
              </div>

              {/* Grid фото */}
              <div style={styles.photoGrid}>
                {images.map((img, index) => (
                  <div key={index} style={styles.photoSlot}>
                    <img
                      src={typeof img === 'string' ? img : img.url}
                      alt={`Фото ${index + 1}`}
                      style={styles.photoPreview}
                    />
                    
                    {/* Badge "Обложка" на первом */}
                    {index === 0 && (
                      <div style={styles.coverBadge}>Обложка</div>
                    )}

                    {/* Кнопка удаления */}
                    <button
                      style={styles.photoRemove}
                      onClick={() => handleRemoveImage(index)}
                    >
                      ✕
                    </button>

                    {/* Drag handles (для переноса) */}
                    {index > 0 && (
                      <button
                        style={styles.photoMoveLeft}
                        onClick={() => handleReorderImages(index, index - 1)}
                      >
                        ←
                      </button>
                    )}
                    {index < images.length - 1 && (
                      <button
                        style={styles.photoMoveRight}
                        onClick={() => handleReorderImages(index, index + 1)}
                      >
                        →
                      </button>
                    )}
                  </div>
                ))}

                {/* Кнопка добавить */}
                {images.length < 5 && (
                  <button style={styles.photoAddButton} onClick={handleAddImage}>
                    <span style={styles.photoAddIcon}>+</span>
                    <span style={styles.photoAddLabel}>Добавить</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 3: ДЕТАЛИ ===== */}
          {step === 3 && (
            <div style={styles.stepContent}>
              <div style={styles.stepTitle}>Детали товара</div>

              {/* Название */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Название</label>
                <input
                  type="text"
                  placeholder="Например: iPhone 13 Pro 256GB"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={styles.input}
                  maxLength={100}
                />
                <div style={styles.charCount}>{title.length} / 100</div>
              </div>

              {/* Описание */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Описание</label>
                <textarea
                  placeholder="Опишите состояние, причину продажи..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.textarea}
                  maxLength={1000}
                  rows={5}
                />
                <div style={styles.charCount}>{description.length} / 1000</div>
              </div>

              {/* Цена */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Цена (₽)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={styles.input}
                  min={0}
                  max={1000000}
                />
              </div>

              {/* Состояние */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Состояние</label>
                <div style={styles.conditionGrid}>
                  {conditions.map((cond) => (
                    <button
                      key={cond.value}
                      style={{
                        ...styles.conditionButton,
                        ...(condition === cond.value ? styles.conditionButtonActive : {}),
                      }}
                      onClick={() => {
                        haptic('light');
                        setCondition(cond.value);
                      }}
                    >
                      <span style={styles.conditionIcon}>{cond.icon}</span>
                      <span style={styles.conditionLabel}>{cond.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Место встречи */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Место встречи (опционально)</label>
                <input
                  type="text"
                  placeholder="Например: Шаболовская, м. Шаболовская"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={styles.input}
                  maxLength={200}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          {step > 1 && (
            <button style={styles.backButton} onClick={handleBack}>
              ← Назад
            </button>
          )}

          {step < 3 ? (
            <button style={styles.nextButton} onClick={handleNext}>
              Далее →
            </button>
          ) : (
            <button
              style={styles.submitButton}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Размещение...' : '🚀 Разместить объявление'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    zIndex: Z_CREATE_MARKET_ITEM,
    animation: 'fadeIn 0.3s ease',
  },

  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.bg,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  headerButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.sm,
  },

  headerIcon: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
  },

  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },

  headerSpacer: {
    width: 40,
  },

  progress: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  progressSteps: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },

  progressStep: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: theme.colors.card,
    border: `2px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    transition: theme.transitions.normal,
  },

  progressStepActive: {
    background: theme.colors.market,
    borderColor: theme.colors.market,
    color: theme.colors.text,
    transform: 'scale(1.1)',
  },

  progressStepDone: {
    background: theme.colors.market,
    borderColor: theme.colors.market,
    color: theme.colors.text,
  },

  progressLabels: {
    display: 'flex',
    justifyContent: 'space-around',
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.medium,
  },

  progressLabelActive: {
    color: theme.colors.text,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.lg,
  },

  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },

  stepTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },

  stepHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    background: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },

  // Step 1: Категории
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.md,
  },

  categoryButton: {
    background: theme.colors.card,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: theme.transitions.normal,
  },

  categoryButtonActive: {
    background: theme.colors.market,
    border: `2px solid ${theme.colors.market}`,
  },

  categoryIcon: {
    fontSize: 32,
  },

  categoryLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },

  otherButton: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },

  // Custom категория
  customCategoryBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },

  customInput: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    outline: 'none',
  },

  charCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    textAlign: 'right',
  },

  suggestionsTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
    marginTop: theme.spacing.md,
  },

  suggestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  suggestionChip: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.full,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
    transition: theme.transitions.fast,
  },

  customActions: {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },

  cancelButton: {
    flex: 1,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },

  applyButton: {
    flex: 2,
    background: theme.colors.market,
    border: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },

  // Step 2: Фото
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.md,
  },

  photoSlot: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },

  photoPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  coverBadge: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    left: theme.spacing.xs,
    right: theme.spacing.xs,
    background: 'rgba(16, 185, 129, 0.9)',
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    padding: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    textAlign: 'center',
  },

  photoRemove: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '50%',
    width: 24,
    height: 24,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
  },

  photoMoveLeft: {
    position: 'absolute',
    left: theme.spacing.xs,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '50%',
    width: 28,
    height: 28,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
  },

  photoMoveRight: {
    position: 'absolute',
    right: theme.spacing.xs,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.7)',
    border: 'none',
    borderRadius: '50%',
    width: 28,
    height: 28,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
  },

  photoAddButton: {
    aspectRatio: '1',
    background: theme.colors.card,
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },

  photoAddIcon: {
    fontSize: 32,
    color: theme.colors.textSecondary,
  },

  photoAddLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },

  // Step 3: Детали
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },

  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },

  input: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    outline: 'none',
  },

  textarea: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },

  conditionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
  },

  conditionButton: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
    transition: theme.transitions.fast,
  },

  conditionButtonActive: {
    background: theme.colors.market,
    border: `1px solid ${theme.colors.market}`,
  },

  conditionIcon: {
    fontSize: theme.fontSize.lg,
  },

  conditionLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },

  // Footer
  footer: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  backButton: {
    flex: 1,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },

  nextButton: {
    flex: 2,
    background: theme.colors.market,
    border: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },

  submitButton: {
    flex: 1,
    background: theme.colors.market,
    border: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },
};

// CSS Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

export default CreateMarketItem;