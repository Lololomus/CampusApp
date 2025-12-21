import React, { useState } from 'react';
import { X } from 'lucide-react';
import { updatePost } from '../api';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';

function EditPost({ post, onClose, onUpdate }) {
  const [category, setCategory] = useState(post.category);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState(post.tags?.join(', ') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Валидация
    if (!title.trim()) {
      setError('Введите заголовок');
      return;
    }
    if (title.length < 3 || title.length > 100) {
      setError('Заголовок должен быть от 3 до 100 символов');
      return;
    }
    if (!body.trim()) {
      setError('Введите описание');
      return;
    }
    if (body.length < 10 || body.length > 1000) {
      setError('Описание должно быть от 10 до 1000 символов');
      return;
    }
    if (!category) {
      setError('Выберите категорию');
      return;
    }

    // Парсим теги
    const tagsList = tags
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(t => t.length > 0);

    if (tagsList.length > 5) {
      setError('Максимум 5 тегов');
      return;
    }

    setLoading(true);
    setError('');
    hapticFeedback('medium');

    try {
      const updatedPost = await updatePost(post.id, {
        title: title.trim(),
        body: body.trim(),
        category,
        tags: tagsList
      });

      hapticFeedback('success');
      onUpdate(updatedPost);
      onClose();
    } catch (err) {
      setError('Не удалось обновить пост. Попробуйте снова.');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Проверяем были ли изменения
    const hasChanges = 
      category !== post.category ||
      title !== post.title ||
      body !== post.body ||
      tags !== (post.tags?.join(', ') || '');

    if (hasChanges) {
      if (window.confirm('Отменить изменения?')) {
        hapticFeedback('light');
        onClose();
      }
    } else {
      hapticFeedback('light');
      onClose();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={handleCancel} style={styles.closeButton}>
            <X size={24} />
          </button>
          <h2 style={styles.title}>Редактировать пост</h2>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Категория */}
          <div style={styles.field}>
            <label style={styles.label}>Категория</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={styles.select}
            >
              <option value="">Выберите категорию</option>
              <option value="study">Учёба</option>
              <option value="help">Помощь</option>
              <option value="hangout">Движ</option>
              <option value="dating">Знакомства</option>
            </select>
          </div>

          {/* Заголовок */}
          <div style={styles.field}>
            <label style={styles.label}>
              Заголовок <span style={styles.counter}>{title.length}/100</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="О чём пост?"
              maxLength={100}
              style={styles.input}
            />
          </div>

          {/* Описание */}
          <div style={styles.field}>
            <label style={styles.label}>
              Описание <span style={styles.counter}>{body.length}/1000</span>
            </label>
            <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Подробнее..."
            maxLength={1000}
            style={styles.textarea}
            />
          </div>

          {/* Теги */}
          <div style={styles.field}>
            <label style={styles.label}>Теги (через запятую, макс 5)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="программирование, python, web"
              style={styles.input}
            />
          </div>

          {/* Ошибка */}
          {error && (
            <div style={styles.error}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleCancel} style={styles.cancelButton}>
            Отменить
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Сохранение...' : 'Сохранить ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #2a2a2a',
    position: 'relative',
    flexShrink: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    left: '12px',
    borderRadius: '8px',
    transition: 'background 0.2s',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: '17px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    minHeight: 0,
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#ccc',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  counter: {
    fontSize: '11px',
    color: '#666',
    fontWeight: '400',
    textTransform: 'none',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    minHeight: '120px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  error: {
    padding: '12px 14px',
    backgroundColor: '#2a1515',
    border: '1px solid #ff4444',
    borderRadius: '10px',
    color: '#ff6666',
    fontSize: '13px',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #2a2a2a',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    flexShrink: 0,
    backgroundColor: '#1a1a1a',
  },
  cancelButton: {
    flex: 1,
    padding: '13px',
    borderRadius: '10px',
    border: '1px solid #2a2a2a',
    backgroundColor: 'transparent',
    color: '#ccc',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  submitButton: {
    flex: 1,
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #8774e1 0%, #9d7ff5 100%)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(135, 116, 225, 0.3)',
    transition: 'all 0.2s',
  },
};

export default EditPost;