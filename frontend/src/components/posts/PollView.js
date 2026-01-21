import React, { useState } from 'react';
import { Check, X, Award } from 'lucide-react';
import { votePoll } from '../../api';
import theme from '../../theme';

const PollView = ({ poll, onVoteUpdate }) => {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Определяем, голосовал ли юзер
  // user_votes - это массив индексов [0, 2]
  const hasVoted = poll.user_votes && poll.user_votes.length > 0;
  const isQuiz = poll.type === 'quiz';
  const showResults = hasVoted || poll.is_closed;

  const handleOptionToggle = (index) => {
    if (hasVoted || loading || poll.is_closed) return;
    
    if (poll.allow_multiple) {
      setSelectedOptions(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    } else {
      setSelectedOptions([index]);
    }
  };

  const handleVote = async (e) => {
    e.stopPropagation(); // Чтобы не открыть пост при клике
    if (selectedOptions.length === 0) return;
    
    setLoading(true);
    try {
      await votePoll(poll.id, selectedOptions);
      if (onVoteUpdate) onVoteUpdate();
    } catch (error) {
      alert('Ошибка голосования');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={styles.container}
      onClick={(e) => e.stopPropagation()} // Блокируем клик на карточку поста
    >
      <div style={styles.header}>
        <span style={styles.question}>{poll.question}</span>
        {isQuiz && (
          <div style={styles.quizBadge}>
            <Award size={14} /> Викторина
          </div>
        )}
      </div>

      <div style={styles.optionsList}>
        {poll.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          const isCorrect = isQuiz && poll.correct_option === index;
          const userChoseThis = poll.user_votes && poll.user_votes.includes(index);
          
          // Цветовая логика
          let borderColor = theme.colors.border;
          let bgColor = 'transparent';
          let textColor = theme.colors.text;

          if (showResults) {
            if (isQuiz) {
              if (isCorrect) {
                borderColor = theme.colors.success;
                bgColor = 'rgba(76, 175, 80, 0.1)';
              } else if (userChoseThis && !isCorrect) {
                borderColor = theme.colors.error;
                bgColor = 'rgba(244, 67, 54, 0.1)';
              }
            } else if (userChoseThis) {
              borderColor = theme.colors.primary;
              bgColor = 'rgba(135, 116, 225, 0.1)';
            }
          } else if (isSelected) {
            borderColor = theme.colors.primary;
            bgColor = 'rgba(135, 116, 225, 0.05)';
          }

          return (
            <div 
              key={index}
              onClick={() => handleOptionToggle(index)}
              style={{
                ...styles.optionItem,
                borderColor: borderColor,
                backgroundColor: bgColor,
                cursor: showResults ? 'default' : 'pointer'
              }}
            >
              {/* Прогресс бар (фон) */}
              {showResults && (
                <div style={{
                  ...styles.progressBar,
                  width: `${option.percentage}%`,
                  backgroundColor: isCorrect && isQuiz ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255,0.08)'
                }} />
              )}

              <div style={styles.optionContent}>
                <div style={styles.leftSide}>
                  {!showResults && (
                    <div style={{
                      ...styles.radioCircle,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.textDisabled,
                      backgroundColor: isSelected ? theme.colors.primary : 'transparent'
                    }}>
                      {isSelected && <Check size={10} color="#fff" />}
                    </div>
                  )}
                  
                  <span style={{ color: textColor, fontWeight: userChoseThis ? '600' : '400' }}>
                    {option.text}
                  </span>

                  {showResults && isQuiz && isCorrect && <Check size={16} color={theme.colors.success} style={{ marginLeft: 8 }} />}
                  {showResults && isQuiz && userChoseThis && !isCorrect && <X size={16} color={theme.colors.error} style={{ marginLeft: 8 }} />}
                </div>

                {showResults && (
                  <span style={styles.percentage}>
                    {Math.round(option.percentage)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <span style={styles.metaText}>
          {poll.total_votes} голосов • {poll.is_anonymous ? 'Анонимно' : 'Публично'}
        </span>
        
        {!hasVoted && !poll.is_closed && (
          <button 
            onClick={handleVote}
            disabled={loading || selectedOptions.length === 0}
            style={{
              ...styles.voteButton,
              opacity: selectedOptions.length === 0 ? 0.5 : 1,
              cursor: selectedOptions.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '...' : 'Голосовать'}
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  question: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text
  },
  quizBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(135, 116, 225, 0.1)',
    color: theme.colors.primary,
    fontWeight: '600'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  optionItem: {
    position: 'relative',
    padding: '10px 12px',
    borderRadius: theme.radius.sm,
    borderWidth: '1px',
    borderStyle: 'solid',
    overflow: 'hidden',
    transition: 'all 0.2s ease'
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    transition: 'width 0.5s ease-out',
    zIndex: 0
  },
  optionContent: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1
  },
  leftSide: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    borderWidth: '2px',
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  percentage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  footer: {
    marginTop: theme.spacing.md,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`
  },
  metaText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary
  },
  voteButton: {
    padding: '6px 16px',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    transition: theme.transitions.fast
  }
};

export default PollView;