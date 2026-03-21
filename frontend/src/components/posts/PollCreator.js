// ===== FILE: PollCreator.js =====
import React, { useState } from 'react';
import { Plus, X, Circle, CheckCircle2, Users, VenetianMask, BarChart2, HelpCircle, Settings, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import theme from '../../theme';

const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const POLL_COLOR = theme.colors.premium.primary; // #D4FF00

const PollCreator = ({ pollData, onChange, onClose }) => {
  const { options, type, correctOption, allowMultiple, isAnonymous, explanation } = pollData;

  const [showSettings, setShowSettings] = useState(false);
  const [showExplanationInput, setShowExplanationInput] = useState(Boolean(explanation));

  const isQuiz = type === 'quiz';

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange({ ...pollData, options: newOptions });
  };

  const handleAddOption = () => {
    if (options.length < 10) onChange({ ...pollData, options: [...options, ''] });
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      let newCorrect = correctOption;
      if (correctOption === index) newCorrect = null;
      else if (correctOption > index) newCorrect = correctOption - 1;
      onChange({ ...pollData, options: newOptions, correctOption: newCorrect });
    }
  };

  const handleSetType = (newType) => {
    onChange({
      ...pollData,
      type: newType,
      correctOption: newType === 'quiz' ? (correctOption ?? 0) : null,
      allowMultiple: newType === 'quiz' ? false : allowMultiple,
      explanation: newType === 'quiz' ? explanation : null,
    });
    if (newType !== 'quiz') setShowExplanationInput(false);
  };

  return (
    <div style={{
      background: '#242426', borderRadius: 16, padding: 16, boxSizing: 'border-box',
      border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 0,
      position: 'relative',
    }}>
      {onClose && (
        <button
          onClick={onClose}
          className="poll-spring-btn"
          style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(44,44,46,0.9)', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', zIndex: 1 }}
        >
          <X size={14} />
        </button>
      )}
      <style>{`
        @keyframes slideInOption {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .poll-option-animate { animation: slideInOption 0.25s ${EASING} forwards; }
        .poll-spring-btn { transition: transform 0.15s ${EASING}, opacity 0.15s, background-color 0.2s, border-color 0.2s; cursor: pointer; }
        .poll-spring-btn:active { transform: scale(0.96); opacity: 0.8; }
      `}</style>

      {/* Бейдж типа */}
      <div style={{ fontSize: 11, fontWeight: 800, color: isQuiz ? '#0A84FF' : POLL_COLOR, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        {isQuiz ? 'ВИКТОРИНА' : 'ОПРОС'}
      </div>

      {/* Варианты ответов */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {options.map((option, index) => {
          const isCorrect = isQuiz && correctOption === index;
          return (
            <div key={index} className="poll-option-animate" style={{ display: 'flex', alignItems: 'center' }}>
              {isQuiz && (
                <button
                  onClick={() => onChange({ ...pollData, correctOption: index })}
                  className="poll-spring-btn"
                  style={{ background: 'none', border: 'none', padding: 0, display: 'flex', color: isCorrect ? '#32D74B' : '#8E8E93', marginRight: 12, flexShrink: 0 }}
                >
                  {isCorrect ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
              )}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#2C2C2E', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', padding: '10px 12px' }}>
                <input
                  type="text"
                  placeholder={`Вариант ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#FFF', fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              {index > 1 && (
                <button
                  onClick={() => handleRemoveOption(index)}
                  className="poll-spring-btn"
                  style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8E8E93', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Добавить вариант */}
      {options.length < 10 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {isQuiz && <div style={{ width: 22 }} />}
          <button
            onClick={handleAddOption}
            className="poll-spring-btn"
            style={{ flex: 1, background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: POLL_COLOR, fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={16} strokeWidth={2.5} /> Добавить вариант
          </button>
        </div>
      )}

      {/* Добавить объяснение (только викторина) */}
      {isQuiz && (
        <div style={{ marginTop: 12, paddingLeft: 34 }}>
          {!showExplanationInput && !explanation ? (
            <button
              onClick={() => setShowExplanationInput(true)}
              className="poll-spring-btn"
              style={{ background: 'transparent', border: 'none', color: '#8E8E93', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', cursor: 'pointer' }}
            >
              <Plus size={14} strokeWidth={2.5} /> Добавить объяснение
            </button>
          ) : (
            <div className="poll-option-animate" style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'rgba(212,255,0,0.03)', border: '1px solid rgba(212,255,0,0.15)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Lightbulb size={16} color={POLL_COLOR} style={{ flexShrink: 0, marginTop: 2 }} />
                <textarea
                  placeholder="Объяснение правильного ответа. Появится после голосования..."
                  value={explanation || ''}
                  onChange={(e) => onChange({ ...pollData, explanation: e.target.value || null })}
                  autoFocus
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#FFF', fontSize: 14, lineHeight: 1.4, minHeight: 60, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Пунктирный разделитель */}
      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '16px 0' }} />

      {/* Настройки (collapsible) */}
      <div>
        <div
          onClick={() => setShowSettings(!showSettings)}
          className="poll-spring-btn"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSettings ? 12 : 0, cursor: 'pointer', padding: '4px 0', background: 'none', border: 'none', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: showSettings ? '#FFF' : '#8E8E93', fontSize: 13, fontWeight: 600, transition: 'color 0.2s' }}>
            <Settings size={14} /> Настройки {isQuiz ? 'викторины' : 'опроса'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8E8E93' }}>
            {!isQuiz && <BarChart2 size={14} color={POLL_COLOR} />}
            {isQuiz && <HelpCircle size={14} color={POLL_COLOR} />}
            {allowMultiple && !isQuiz && <Users size={14} color={POLL_COLOR} />}
            {isAnonymous && <VenetianMask size={14} color={POLL_COLOR} />}
            <span style={{ marginLeft: 4 }}>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </div>
        </div>

        {showSettings && (
          <div className="poll-option-animate">
            {/* Переключатель типа */}
            <div style={{ display: 'flex', background: '#2C2C2E', borderRadius: 10, padding: 4, marginBottom: 10 }}>
              <button
                onClick={() => handleSetType('regular')}
                className="poll-spring-btn"
                style={{ flex: 1, padding: 8, background: type === 'regular' ? 'rgba(212,255,0,0.12)' : 'transparent', color: type === 'regular' ? POLL_COLOR : '#8E8E93', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <BarChart2 size={14} /> Опрос
              </button>
              <button
                onClick={() => handleSetType('quiz')}
                className="poll-spring-btn"
                style={{ flex: 1, padding: 8, background: type === 'quiz' ? 'rgba(10,132,255,0.12)' : 'transparent', color: type === 'quiz' ? '#0A84FF' : '#8E8E93', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <HelpCircle size={14} /> Викторина
              </button>
            </div>

            {/* Флаги */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => !isQuiz && onChange({ ...pollData, allowMultiple: !allowMultiple })}
                disabled={isQuiz}
                className="poll-spring-btn"
                style={{
                  background: allowMultiple ? 'rgba(212,255,0,0.1)' : '#2C2C2E',
                  border: `1px solid ${allowMultiple ? POLL_COLOR : 'transparent'}`,
                  color: allowMultiple ? POLL_COLOR : '#8E8E93',
                  opacity: isQuiz ? 0.4 : 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Users size={16} /> Мультивыбор
              </button>
              <button
                onClick={() => onChange({ ...pollData, isAnonymous: !isAnonymous })}
                className="poll-spring-btn"
                style={{
                  background: isAnonymous ? 'rgba(212,255,0,0.05)' : '#2C2C2E',
                  border: `1px solid ${isAnonymous ? POLL_COLOR : 'transparent'}`,
                  color: isAnonymous ? POLL_COLOR : '#8E8E93',
                  padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <VenetianMask size={16} /> Анонимно
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollCreator;
