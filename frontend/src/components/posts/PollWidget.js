import React, { useState, useEffect } from 'react';
import { Check, BarChart2 } from 'lucide-react';
import { useStore } from '../../store';
import { votePoll } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';

const PollWidget = ({ poll, postId, compact = true }) => {
  const { user } = useStore();
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    // Проверяем LocalStorage
    const savedVotes = localStorage.getItem('poll_votes');
    if (savedVotes) {
      const votes = JSON.parse(savedVotes);
      if (votes[`poll_${poll.id}`]) {
        setSelectedOptions(votes[`poll_${poll.id}`]);
        setHasVoted(true);
      }
    }
    
    // Проверяем серверные голоса
    if (poll.user_votes && poll.user_votes.length > 0) {
      setSelectedOptions(poll.user_votes);
      setHasVoted(true);
    }
  }, [poll]);

  const handleOptionToggle = (index) => {
    if (hasVoted || isVoting) return;

    if (poll.allow_multiple) {
      setSelectedOptions(prev =>
        prev.includes(index)
          ? prev.filter(i => i !== index)
          : [...prev, index]
      );
    } else {
      setSelectedOptions([index]);
    }
    hapticFeedback('light');
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) return;

    setIsVoting(true);
    hapticFeedback('medium');

    try {
      await votePoll(poll.id, selectedOptions);
      
      // Сохраняем в LocalStorage
      const savedVotes = JSON.parse(localStorage.getItem('poll_votes') || '{}');
      savedVotes[`poll_${poll.id}`] = selectedOptions;
      localStorage.setItem('poll_votes', JSON.stringify(savedVotes));
      
      setHasVoted(true);
      
      // Обновляем локальные результаты
      const updatedOptions = poll.options.map((opt, idx) => ({
        ...opt,
        votes: selectedOptions.includes(idx) ? opt.votes + 1 : opt.votes,
      }));
      setLocalPoll({ ...poll, options: updatedOptions });
      
      hapticFeedback('success');
    } catch (error) {
      console.error('Vote error:', error);
      hapticFeedback('error');
    } finally {
      setIsVoting(false);
    }
  };

  const totalVotes = localPoll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <BarChart2 size={16} color={theme.colors.polls || theme.colors.primary} />
        <span style={styles.questionText}>{poll.question}</span>
      </div>

      <div style={styles.optionsList}>
        {localPoll.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

          return (
            <div
              key={index}
              onClick={() => handleOptionToggle(index)}
              style={{
                ...styles.optionRow,
                cursor: hasVoted ? 'default' : 'pointer',
                borderColor: isSelected ? (theme.colors.polls || theme.colors.primary) : theme.colors.border,
              }}
            >
              {/* Прогресс-бар (если проголосовал) */}
              {hasVoted && (
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${percentage}%`,
                  }}
                />
              )}

              {/* Контент */}
              <div style={styles.optionContent}>
                {!hasVoted && (
                  <div style={{
                    ...styles.checkbox,
                    borderColor: isSelected ? (theme.colors.polls || theme.colors.primary) : theme.colors.border,
                    background: isSelected ? (theme.colors.polls || theme.colors.primary) : 'transparent',
                  }}>
                    {isSelected && <Check size={14} color="#fff" />}
                  </div>
                )}

                <span style={styles.optionText}>{option.text}</span>

                {hasVoted && (
                  <span style={styles.percentage}>{percentage.toFixed(0)}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!hasVoted && (
        <button
          onClick={handleVote}
          disabled={selectedOptions.length === 0 || isVoting}
          style={{
            ...styles.voteButton,
            opacity: selectedOptions.length > 0 ? 1 : 0.5,
            cursor: selectedOptions.length > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {isVoting ? 'Отправка...' : '✓ Проголосовать'}
        </button>
      )}

      {hasVoted && (
        <div style={styles.stats}>
          Всего голосов: {totalVotes}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  questionText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    lineHeight: 1.4,
  },

  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  optionRow: {
    position: 'relative',
    padding: 12,
    border: '2px solid',
    borderRadius: theme.radius.md,
    transition: 'all 0.2s ease',
    overflow: 'hidden',
  },

  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    background: `${theme.colors.polls || theme.colors.primary}20`,
    transition: 'width 0.5s ease',
    zIndex: 0,
  },

  optionContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },

  optionText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },

  percentage: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.polls || theme.colors.primary,
  },

  voteButton: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: `linear-gradient(135deg, ${theme.colors.polls || theme.colors.primary} 0%, ${theme.colors.polls || theme.colors.primary}dd 100%)`,
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  stats: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
};

export default PollWidget;