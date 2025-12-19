import React, { useState } from 'react';
import { X, Hash } from 'lucide-react';
import { useStore } from '../store';
import { createPost } from '../api';
import { hapticFeedback } from '../utils/telegram';

function CreatePost() {
  const { setShowCreateModal, addNewPost } = useStore(); // ИСПРАВЛЕНО
  
  // Состояние формы
  const [category, setCategory] = useState('study');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Обработка добавления тега
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      hapticFeedback('light');
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  // Удаление тега
  const handleRemoveTag = (tagToRemove) => {
    hapticFeedback('light');
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Обработка Enter в поле тегов
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Закрытие модального окна
  const handleClose = () => {
    hapticFeedback('light');
    setShowCreateModal(false); // ИСПРАВЛЕНО
  };

  // Публикация поста
  const handlePublish = async () => {
    // Валидация
    if (!title.trim() || !body.trim()) {
      hapticFeedback('error');
      alert('Заполните заголовок и описание');
      return;
    }

    hapticFeedback('medium');
    setIsSubmitting(true);

    try {
      const newPost = await createPost({
        category,
        title: title.trim(),
        body: body.trim(),
        tags,
        uni: 'МГСУ',
        institute: 'ИЦИТ',
        course: 3
      });

      // Добавляем пост в store
      addNewPost(newPost);
      
      // Закрываем модалку
      setShowCreateModal(false); // ИСПРАВЛЕНО
      
      // Показываем уведомление
      hapticFeedback('success');
      console.log('Пост опубликован:', newPost);
      
    } catch (error) {
      console.error('Ошибка при создании поста:', error);
      hapticFeedback('error');
      alert('Не удалось создать пост. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Категории
  const categories = [
    { value: 'study', label: 'Учёба' },
    { value: 'help', label: 'Помощь' },
    { value: 'hangout', label: 'Движ' },
    { value: 'dating', label: 'Знакомства' }
  ];

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        
        {/* Шапка */}
        <div style={styles.header}>
          <button onClick={handleClose} style={styles.cancelButton} disabled={isSubmitting}>
            Отменить
          </button>
          <h2 style={styles.headerTitle}>Создать пост</h2>
          <button 
            onClick={handlePublish} 
            style={{
              ...styles.publishButton,
              opacity: isSubmitting ? 0.5 : 1,
              cursor: isSubmitting ? 'default' : 'pointer'
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>

        {/* Форма */}
        <div style={styles.content}>
          
          {/* Категория */}
          <div style={styles.field}>
            <label style={styles.label}>КАТЕГОРИЯ</label>
            <select 
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                hapticFeedback('light');
              }}
              style={styles.select}
              disabled={isSubmitting}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Заголовок */}
          <div style={styles.field}>
            <label style={styles.label}>ЗАГОЛОВОК</label>
            <input 
              type="text"
              placeholder="Введите заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              maxLength={100}
              disabled={isSubmitting}
            />
            <div style={styles.charCount}>
              {title.length}/100
            </div>
          </div>

          {/* Описание */}
          <div style={styles.field}>
            <label style={styles.label}>ОПИСАНИЕ</label>
            <textarea 
              placeholder="Расскажите подробнее..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={styles.textarea}
              rows={6}
              maxLength={500}
              disabled={isSubmitting}
            />
            <div style={styles.charCount}>
              {body.length}/500
            </div>
          </div>

          {/* Теги */}
          <div style={styles.field}>
            <label style={styles.label}>ТЕГИ (максимум 5)</label>
            <div style={styles.tagInputWrapper}>
              <Hash size={18} style={{ color: '#666', flexShrink: 0 }} />
              <input 
                type="text"
                placeholder="сопромат, помощь, срочно"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagKeyPress}
                onBlur={handleAddTag}
                style={styles.tagInput}
                disabled={isSubmitting || tags.length >= 5}
              />
            </div>
            
            {/* Список тегов */}
            {tags.length > 0 && (
              <div style={styles.tagsList}>
                {tags.map(tag => (
                  <span key={tag} style={styles.tag}>
                    #{tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      style={styles.tagRemove}
                      disabled={isSubmitting}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            <div style={styles.hint}>
              Нажмите Enter или уберите фокус, чтобы добавить тег
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#121212',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column'
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #333',
    backgroundColor: '#1a1a1a'
  },
  cancelButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px'
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    margin: 0
  },
  publishButton: {
    background: 'none',
    border: 'none',
    color: '#8774e1',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 16px',
    paddingBottom: '40px'
  },
  field: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '20px',
    paddingRight: '40px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    resize: 'none',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  charCount: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'right',
    marginTop: '4px'
  },
  tagInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e'
  },
  tagInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    outline: 'none'
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px'
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500'
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    opacity: 0.8
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px'
  }
};

export default CreatePost;