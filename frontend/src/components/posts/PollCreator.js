import React from 'react';
import { Plus, X, Circle, CheckCircle } from 'lucide-react';
import theme from '../../theme';
import { POLL_TYPE_LABELS } from '../../types';

const PollCreator = ({ pollData, onChange }) => {
  const {
    question,
    options,
    type,
    correctOption,
    allowMultiple,
    isAnonymous,
  } = pollData;

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange({ ...pollData, options: newOptions });
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      onChange({ ...pollData, options: [...options, ''] });
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      let newCorrect = correctOption;
      
      if (correctOption === index) {
        newCorrect = null;
      } else if (correctOption > index) {
        newCorrect = correctOption - 1;
      }
      
      onChange({ 
        ...pollData, 
        options: newOptions,
        correctOption: newCorrect
      });
    }
  };

  return (
    <div style={styles.container}>
      {/* Тип опроса */}
      <div style={styles.row}>
        <select
          value={type}
          onChange={(e) => onChange({ 
            ...pollData, 
            type: e.target.value,
            correctOption: e.target.value === 'quiz' ? 0 : null
          })}
          style={styles.select}
        >
          {Object.entries(POLL_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Вопрос */}
      <div style={styles.row}>
        <input
          type="text"
          placeholder="Ваш вопрос..."
          value={question}
          onChange={(e) => onChange({ ...pollData, question: e.target.value })}
          style={styles.input}
        />
      </div>

      {/* Варианты ответов */}
      <div style={styles.optionsList}>
        {options.map((option, index) => (
          <div key={index} style={styles.optionRow}>
            {type === 'quiz' && (
              <button
                onClick={() => onChange({ ...pollData, correctOption: index })}
                style={styles.quizSelectBtn}
                title="Отметить как правильный ответ"
              >
                {correctOption === index ? (
                  <CheckCircle size={20} color={theme.colors.success} />
                ) : (
                  <Circle size={20} color={theme.colors.textDisabled} />
                )}
              </button>
            )}
            
            <input
              type="text"
              placeholder={`Вариант ${index + 1}`}
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              style={styles.optionInput}
            />
            
            <button
              onClick={() => handleRemoveOption(index)}
              disabled={options.length <= 2}
              style={{
                ...styles.removeBtn,
                opacity: options.length <= 2 ? 0.3 : 1,
                cursor: options.length <= 2 ? 'default' : 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {options.length < 10 && (
        <button onClick={handleAddOption} style={styles.addBtn}>
          <Plus size={16} />
          Добавить вариант
        </button>
      )}

      {/* Настройки */}
      <div style={styles.toggles}>
        <label style={{
          ...styles.toggleLabel,
          opacity: type === 'quiz' ? 0.5 : 1
        }}>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => onChange({ ...pollData, allowMultiple: e.target.checked })}
            disabled={type === 'quiz'}
            style={styles.checkbox}
          />
          Множественный выбор
        </label>
        
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => onChange({ ...pollData, isAnonymous: e.target.checked })}
            style={styles.checkbox}
          />
          Анонимное голосование
        </label>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  
  row: {
    marginBottom: 0,
  },
  
  select: {
    width: '100%',
    padding: 10,
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    outline: 'none',
    fontSize: theme.fontSize.sm,
  },
  
  input: {
    width: '100%',
    padding: 10,
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  
  optionInput: {
    flex: 1,
    padding: '8px 10px',
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    outline: 'none',
    fontSize: theme.fontSize.sm,
  },
  
  quizSelectBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
  },
  
  removeBtn: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
  },
  
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    cursor: 'pointer',
    padding: '8px 0',
  },
  
  toggles: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
  },
  
  checkbox: {
    accentColor: theme.colors.primary,
    width: 16,
    height: 16,
  },
};

export default PollCreator;