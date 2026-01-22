import React from 'react';
import { Plus, X, Circle, CheckCircle, Users, EyeOff, Check, BarChart2, HelpCircle } from 'lucide-react';
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
      {/* Анимации */}
      <style>
        {`
          @keyframes slideInOption {
            from { opacity: 0; transform: translateY(-10px); height: 0; margin-bottom: 0; }
            to { opacity: 1; transform: translateY(0); height: 42px; margin-bottom: 0; }
          }
          .poll-option-animate {
            animation: slideInOption 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
        `}
      </style>

      {/* Тип опроса - Переключатель */}
      <div style={styles.toggleWrapper}>
        <button 
            onClick={() => onChange({ 
                ...pollData, 
                type: 'regular',
                correctOption: null 
            })} 
            style={type === 'regular' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
        >
            <BarChart2 size={16} />
            Опрос
        </button>
        <button 
            onClick={() => onChange({ 
                ...pollData, 
                type: 'quiz',
                correctOption: 0 
            })} 
            style={type === 'quiz' ? {...styles.toggleButton, ...styles.toggleButtonActive} : styles.toggleButton}
        >
            <HelpCircle size={16} />
            Викторина
        </button>
      </div>

      {/* Вопрос */}
      <div style={styles.row}>
        <input
          type="text"
          placeholder="Задайте вопрос..."
          value={question}
          onChange={(e) => onChange({ ...pollData, question: e.target.value })}
          style={styles.input}
        />
      </div>

      {/* Варианты ответов */}
      <div style={styles.optionsList}>
        {options.map((option, index) => (
          <div 
            key={index} 
            style={styles.optionRow}
            className="poll-option-animate" // Класс для анимации
          >
            {type === 'quiz' && (
              <button
                onClick={() => onChange({ ...pollData, correctOption: index })}
                style={styles.quizSelectBtn}
                title="Отметить как правильный ответ"
              >
                {correctOption === index ? (
                  <CheckCircle size={22} color={theme.colors.success} />
                ) : (
                  <Circle size={22} color={theme.colors.textDisabled} />
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
              <X size={20} />
            </button>
          </div>
        ))}
      </div>

      {/* Кнопка добавления варианта */}
      {options.length < 10 && (
        <button onClick={handleAddOption} style={styles.addBtn}>
          <Plus size={18} />
          Добавить вариант
        </button>
      )}

      {/* Настройки (Grid 2 колонки) */}
      <div style={styles.toggles}>
        <button 
          onClick={() => onChange({ ...pollData, allowMultiple: !allowMultiple })}
          disabled={type === 'quiz'}
          style={{
            ...styles.settingBtn,
            ...(allowMultiple ? styles.settingBtnActive : {}),
            opacity: type === 'quiz' ? 0.5 : 1,
            cursor: type === 'quiz' ? 'not-allowed' : 'pointer'
          }}
        >
          <div style={styles.settingIconWrapper}>
            <Users size={18} />
          </div>
          <span style={styles.settingText}>Мультивыбор</span>
          {allowMultiple && <Check size={16} style={{marginLeft: 6, flexShrink: 0}} />}
        </button>
        
        <button 
          onClick={() => onChange({ ...pollData, isAnonymous: !isAnonymous })}
          style={{
            ...styles.settingBtn,
            ...(isAnonymous ? styles.settingBtnActive : {})
          }}
        >
          <div style={styles.settingIconWrapper}>
            <EyeOff size={18} />
          </div>
          <span style={styles.settingText}>Анонимно</span>
          {isAnonymous && <Check size={16} style={{marginLeft: 6, flexShrink: 0}} />}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  
  row: {
    marginBottom: 0,
  },
  
  // Toggle Switcher Styles
  toggleWrapper: { 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: theme.spacing.sm 
  },
  toggleButton: {
      padding: theme.spacing.md, 
      borderWidth: 2, 
      borderStyle: 'solid', 
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      background: theme.colors.bg, 
      color: theme.colors.text, 
      cursor: 'pointer', 
      fontSize: theme.fontSize.sm, 
      fontWeight: theme.fontWeight.medium, 
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
  },
  toggleButtonActive: { 
      borderColor: theme.colors.primary, 
      background: `${theme.colors.primary}15`, 
      color: theme.colors.primary 
  },
  
  input: {
    width: '100%',
    padding: '14px 16px',
    background: theme.colors.bg,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: theme.fontSize.md,
    transition: 'border-color 0.2s ease',
  },
  
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    // Анимация управляется через CSS класс
  },
  
  optionInput: {
    flex: 1,
    padding: '12px 14px',
    background: theme.colors.bg,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    outline: 'none',
    fontSize: theme.fontSize.md,
    transition: 'border-color 0.2s ease',
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
    justifyContent: 'center',
    gap: 8,
    background: `${theme.colors.primary}15`,
    border: `1px dashed ${theme.colors.primary}`,
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    cursor: 'pointer',
    padding: '14px 0',
    width: '100%',
    borderRadius: theme.radius.md,
    transition: 'all 0.2s ease',
  },
  
  toggles: {
    display: 'grid',           // Используем Grid
    gridTemplateColumns: '1fr 1fr', // 2 равные колонки
    gap: 8,
    marginTop: 4,
  },
  
  settingBtn: {
    width: '100%', // На всю ширину ячейки грида
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // Центрируем контент
    gap: 6,
    padding: '12px 8px', // Уменьшили горизонтальный паддинг
    background: theme.colors.bg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  settingBtnActive: {
    background: `${theme.colors.primary}15`,
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },

  settingIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  
  settingText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
};

export default PollCreator;