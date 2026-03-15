// ===== FILE: PollWidget.js =====
import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { votePoll, triggerRegistrationPrompt } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';

const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const POLL_COLOR = '#D4FF00';
const SUCCESS = '#32D74B';
const ERROR = '#FF453A';
const INFO = '#0A84FF';

const PollWidget = ({ poll, showQuestion = true }) => {
  const isRegistered = useStore((state) => Boolean(state.isRegistered));
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);
  const [isVoting, setIsVoting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const savedVotes = localStorage.getItem('poll_votes');
    if (savedVotes) {
      const votes = JSON.parse(savedVotes);
      if (votes[`poll_${poll.id}`]) {
        setSelectedOptions(votes[`poll_${poll.id}`]);
        setHasVoted(true);
        if (poll.explanation) setShowExplanation(true);
      }
    }
    if (poll.user_votes && poll.user_votes.length > 0) {
      setSelectedOptions(poll.user_votes);
      setHasVoted(true);
      if (poll.explanation) setShowExplanation(true);
    }
  }, [poll]);

  const isQuiz = poll.type === 'quiz';
  const shouldShowQuestion = showQuestion && Boolean((poll.question || '').trim());
  const totalVotes = localPoll.options.reduce((sum, opt) => sum + opt.votes, 0);

  const submitVote = async (indices) => {
    if (isVoting) return;
    if (!isRegistered) {
      triggerRegistrationPrompt('vote_poll');
      return;
    }
    setIsVoting(true);
    hapticFeedback('medium');
    try {
      const result = await votePoll(poll.id, indices);
      const savedVotes = JSON.parse(localStorage.getItem('poll_votes') || '{}');
      savedVotes[`poll_${poll.id}`] = indices;
      localStorage.setItem('poll_votes', JSON.stringify(savedVotes));
      setSelectedOptions(indices);
      setHasVoted(true);
      const updatedOptions = poll.options.map((opt, idx) => ({
        ...opt,
        votes: indices.includes(idx) ? opt.votes + 1 : opt.votes,
      }));
      setLocalPoll({ ...poll, options: updatedOptions });
      if (isQuiz && result.is_correct) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: [POLL_COLOR, SUCCESS, '#FFFFFF'] });
      }
      if (poll.explanation) setTimeout(() => setShowExplanation(true), 400);
      hapticFeedback('success');
    } catch {
      hapticFeedback('error');
    } finally {
      setIsVoting(false);
    }
  };

  const handleOptionToggle = (index) => {
    if (hasVoted || isVoting) return;
    if (isQuiz) return;
    if (poll.allow_multiple) {
      setSelectedOptions(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    } else {
      setSelectedOptions([index]);
    }
    hapticFeedback('light');
  };

  const handleQuizVote = (index) => {
    if (hasVoted || isVoting) return;
    submitVote([index]);
  };

  const handleVote = () => {
    if (selectedOptions.length === 0) return;
    submitVote(selectedOptions);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        @keyframes fillBarWidget {
          from { width: 0%; }
          to   { width: var(--target-width); }
        }
        .poll-bar-fill-w { animation: fillBarWidget 0.8s ${EASING} forwards; }
        .poll-spring-w { transition: transform 0.15s ${EASING}, opacity 0.15s; cursor: pointer; }
        .poll-spring-w:active { transform: scale(0.96); opacity: 0.8; }
        @keyframes slideInPollW {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .poll-explain-w { animation: slideInPollW 0.3s ${EASING} forwards; }
      `}</style>

      {/* Шапка: бейдж + вопрос */}
      <div style={{ display: 'flex', alignItems: 'center', gap: shouldShowQuestion ? 8 : 0 }}>
        <span style={{
          background: isQuiz ? 'rgba(10,132,255,0.12)' : 'rgba(212,255,0,0.12)',
          color: isQuiz ? INFO : POLL_COLOR,
          padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', flexShrink: 0,
        }}>
          {isQuiz ? 'ВИКТОРИНА' : 'ОПРОС'}
        </span>
        {shouldShowQuestion && (
          <span style={{ fontSize: 15, fontWeight: 600, color: '#FFF', lineHeight: 1.4 }}>{poll.question}</span>
        )}
      </div>

      {/* Варианты */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {localPoll.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          const isCorrect = isQuiz && poll.correct_option === index;
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

          if (hasVoted) {
            let bgColor = 'rgba(255,255,255,0.015)';
            let borderColor = 'rgba(255,255,255,0.03)';
            let fillBg = 'rgba(255,255,255,0.05)';
            let textColor = '#EAEAEA';
            let fontWeight = 400;
            let Icon = null;

            if (isQuiz) {
              if (isCorrect) {
                borderColor = 'rgba(50,215,75,0.4)';
                fillBg = 'rgba(50,215,75,0.15)';
                textColor = SUCCESS;
                fontWeight = 700;
                Icon = <CheckCircle2 size={18} color={SUCCESS} />;
              } else if (isSelected) {
                borderColor = 'rgba(255,69,58,0.4)';
                fillBg = 'rgba(255,69,58,0.15)';
                textColor = ERROR;
                fontWeight = 700;
                Icon = <XCircle size={18} color={ERROR} />;
              }
            } else if (isSelected) {
              borderColor = 'rgba(212,255,0,0.4)';
              fillBg = 'rgba(212,255,0,0.15)';
              textColor = POLL_COLOR;
              fontWeight = 700;
              Icon = <CheckCircle2 size={18} color={POLL_COLOR} />;
            }

            return (
              <div key={index} style={{ position: 'relative', height: 44, borderRadius: 12, background: bgColor, border: `1px solid ${borderColor}`, overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
                <div className="poll-bar-fill-w" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: fillBg, '--target-width': `${percentage}%` }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Icon}
                    <span style={{ fontSize: 14, fontWeight, color: textColor }}>{option.text}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{percentage.toFixed(0)}%</span>
                </div>
              </div>
            );
          }

          // До голосования
          const preVoteBg = (!isQuiz && isSelected) ? 'rgba(212,255,0,0.05)' : 'rgba(255,255,255,0.015)';
          const preVoteBorder = (!isQuiz && isSelected) ? 'rgba(212,255,0,0.5)' : 'rgba(255,255,255,0.03)';
          const preVoteTextColor = (!isQuiz && isSelected) ? POLL_COLOR : '#FFF';
          const preVoteFontWeight = (!isQuiz && isSelected) ? 600 : 500;

          return (
            <div
              key={index}
              onClick={isQuiz ? () => handleQuizVote(index) : () => handleOptionToggle(index)}
              className="poll-spring-w"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: preVoteBg, border: `1px solid ${preVoteBorder}`, cursor: hasVoted ? 'default' : 'pointer', transition: 'all 0.2s ease' }}
            >
              {!isQuiz && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? POLL_COLOR : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? POLL_COLOR : 'transparent', flexShrink: 0, transition: 'all 0.2s ease' }}>
                  {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
                </div>
              )}
              <span style={{ fontSize: 14, fontWeight: preVoteFontWeight, color: preVoteTextColor }}>{option.text}</span>
            </div>
          );
        })}
      </div>

      {/* Объяснение викторины */}
      {hasVoted && isQuiz && poll.explanation && showExplanation && (
        <div className="poll-explain-w" style={{ paddingLeft: 12, borderLeft: `2px solid ${selectedOptions.includes(poll.correct_option) ? SUCCESS : ERROR}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: selectedOptions.includes(poll.correct_option) ? SUCCESS : ERROR, marginBottom: 4 }}>
            {selectedOptions.includes(poll.correct_option) ? '🎉 Правильно!' : '💡 Ошибочка!'}
          </div>
          <div style={{ fontSize: 13, color: '#EAEAEA', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {poll.explanation}
          </div>
        </div>
      )}

      {/* Футер: голосов + кнопка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#8E8E93' }}>
          {totalVotes} голосов{poll.is_anonymous ? ' • Анонимно' : ''}
        </span>
        {!hasVoted && !isQuiz && (
          <button
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || isVoting}
            className="poll-spring-w"
            style={{
              background: selectedOptions.length > 0 ? POLL_COLOR : 'rgba(255,255,255,0.05)',
              color: selectedOptions.length > 0 ? '#000' : 'rgba(255,255,255,0.3)',
              border: 'none', padding: '8px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              pointerEvents: selectedOptions.length > 0 ? 'auto' : 'none',
            }}
          >
            {isVoting ? '...' : 'Голосовать'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PollWidget;
