// ===== FILE: PollView.js =====
import React, { useState } from 'react';
import { CheckCircle2, XCircle, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { votePoll, triggerRegistrationPrompt } from '../../api';
import { useStore } from '../../store';
import { toast } from '../shared/Toast';

const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const POLL_COLOR = '#D4FF00';
const SUCCESS = '#32D74B';
const ERROR = '#FF453A';
const INFO = '#0A84FF';

const PollView = ({ poll, onVoteUpdate, showQuestion = true }) => {
  const isRegistered = useStore((state) => Boolean(state.isRegistered));
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastIsCorrect, setLastIsCorrect] = useState(null);
  const [showExplanation, setShowExplanation] = useState(
    !!(poll.user_votes && poll.user_votes.length > 0 && poll.explanation)
  );

  const hasVoted = poll.user_votes && poll.user_votes.length > 0;
  const isQuiz = poll.type === 'quiz';
  const showResults = hasVoted || poll.is_closed;
  const shouldShowQuestion = showQuestion && Boolean((poll.question || '').trim());

  const handleOptionToggle = (index) => {
    if (hasVoted || loading || poll.is_closed) return;
    if (isQuiz) return;
    if (poll.allow_multiple) {
      setSelectedOptions(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    } else {
      setSelectedOptions([index]);
    }
  };

  const handleQuizVote = async (index) => {
    if (hasVoted || loading || poll.is_closed) return;
    if (!isRegistered) {
      triggerRegistrationPrompt('vote_poll');
      return;
    }
    setLoading(true);
    try {
      const result = await votePoll(poll.id, [index]);
      setLastIsCorrect(result.is_correct);
      if (result.is_correct) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: [POLL_COLOR, SUCCESS, '#FFFFFF'] });
      }
      if (poll.explanation) setTimeout(() => setShowExplanation(true), 400);
      if (onVoteUpdate) onVoteUpdate();
    } catch {
      toast.error('Ошибка голосования');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (e) => {
    e.stopPropagation();
    if (selectedOptions.length === 0) return;
    if (!isRegistered) {
      triggerRegistrationPrompt('vote_poll');
      return;
    }
    setLoading(true);
    try {
      await votePoll(poll.id, selectedOptions);
      if (onVoteUpdate) onVoteUpdate();
    } catch {
      toast.error('Ошибка голосования');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#0A0A0C', borderRadius: 16, padding: 16, width: '100%', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
      <style>{`
        @keyframes fillBar {
          from { width: 0%; }
          to   { width: var(--target-width); }
        }
        .poll-bar-fill { animation: fillBar 0.8s ${EASING} forwards; }
        @keyframes slideInOption {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .poll-option-animate { animation: slideInOption 0.3s ${EASING} forwards; }
        .poll-spring-btn { transition: transform 0.15s ${EASING}, opacity 0.15s; cursor: pointer; }
        .poll-spring-btn:active { transform: scale(0.96); opacity: 0.8; }
      `}</style>

      {/* Шапка: бейдж + анонимность */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          background: isQuiz ? 'rgba(10,132,255,0.12)' : 'rgba(212,255,0,0.12)',
          color: isQuiz ? INFO : POLL_COLOR,
          padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
        }}>
          {isQuiz ? 'ВИКТОРИНА' : 'ОПРОС'}
        </span>
        {poll.is_anonymous && <span style={{ fontSize: 12, color: '#8E8E93' }}>Анонимно</span>}
      </div>

      {shouldShowQuestion && (
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#FFF' }}>{poll.question}</h3>
      )}

      {/* Варианты */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((option, index) => {
          const isCorrect = isQuiz && poll.correct_option === index;
          const userChoseThis = poll.user_votes && poll.user_votes.includes(index);
          const isSelected = selectedOptions.includes(index);

          if (showResults) {
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
              } else if (userChoseThis) {
                borderColor = 'rgba(255,69,58,0.4)';
                fillBg = 'rgba(255,69,58,0.15)';
                textColor = ERROR;
                fontWeight = 700;
                Icon = <XCircle size={18} color={ERROR} />;
              }
            } else if (userChoseThis) {
              borderColor = 'rgba(212,255,0,0.4)';
              fillBg = 'rgba(212,255,0,0.15)';
              textColor = POLL_COLOR;
              fontWeight = 700;
              Icon = <CheckCircle2 size={18} color={POLL_COLOR} />;
            }

            return (
              <div key={index} style={{ position: 'relative', height: 44, borderRadius: 12, background: bgColor, border: `1px solid ${borderColor}`, overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 14px', transition: 'all 0.3s ease' }}>
                <div className="poll-bar-fill" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: fillBg, '--target-width': `${option.percentage}%` }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Icon}
                    <span style={{ fontSize: 14, fontWeight, color: textColor }}>{option.text}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{Math.round(option.percentage)}%</span>
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
              className="poll-spring-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: preVoteBg, border: `1px solid ${preVoteBorder}`, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
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

      {/* Объяснение (квиз, после голосования) */}
      {showResults && isQuiz && poll.explanation && showExplanation && (
        <div
          className="poll-option-animate"
          style={{ marginTop: 16, paddingLeft: 12, borderLeft: `2px solid ${lastIsCorrect === false ? ERROR : SUCCESS}` }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: lastIsCorrect === false ? ERROR : SUCCESS, marginBottom: 4 }}>
            {lastIsCorrect === false ? '💡 Ошибочка!' : '🎉 Правильно!'}
          </div>
          <div style={{ fontSize: 13, color: '#EAEAEA', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
            {poll.explanation}
          </div>
        </div>
      )}

      {/* Футер */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: '#8E8E93' }}>
          {poll.total_votes} голосов{poll.is_anonymous ? ' • Анонимно' : ''}
        </span>
        {!hasVoted && !poll.is_closed && !isQuiz && (
          <button
            onClick={handleVote}
            disabled={loading || selectedOptions.length === 0}
            className="poll-spring-btn"
            style={{
              background: selectedOptions.length > 0 ? POLL_COLOR : 'rgba(255,255,255,0.05)',
              color: selectedOptions.length > 0 ? '#000' : 'rgba(255,255,255,0.3)',
              border: 'none', padding: '8px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
              pointerEvents: selectedOptions.length > 0 ? 'auto' : 'none',
            }}
          >
            {loading ? '...' : 'Голосовать'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PollView;
