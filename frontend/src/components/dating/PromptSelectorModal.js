// ===== 📄 ФАЙЛ: frontend/src/components/dating/PromptSelectorModal.js =====
import React, { useState } from 'react';
import { PROMPTS_BY_CATEGORY } from '../../constants/datingConstants';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import { hapticFeedback } from '../../utils/telegram';


const PromptSelectorModal = ({ isOpen, onClose, onSelect }) => {
  const [hoveredId, setHoveredId] = useState(null);
  
  const handleSelect = (prompt) => {
    hapticFeedback('selection');
    onSelect(prompt);
  };


  return (
    <SwipeableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Выбери вопрос"
    >
      <div style={styles.container}>
        
        {/* Подсказка */}
        <div style={styles.description}>
          Выбери вопрос, на который интересно ответить
        </div>


        {/* Категории */}
        {Object.entries(PROMPTS_BY_CATEGORY).map(([category, categoryPrompts]) => (
          <div key={category} style={styles.categoryBlock}>
            
            <div style={styles.categoryHeader}>
              <div style={styles.categoryTitle}>{category}</div>
              <div style={styles.categoryBadge}>{categoryPrompts.length}</div>
            </div>
            
            <div style={styles.optionsGrid}>
              {categoryPrompts.map(promptOption => (
                <button
                  key={promptOption.id}
                  onClick={() => handleSelect(promptOption)}
                  onMouseEnter={() => setHoveredId(promptOption.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    ...styles.optionButton,
                    borderColor: hoveredId === promptOption.id 
                      ? theme.colors.dating.primary 
                      : theme.colors.border,
                    background: hoveredId === promptOption.id
                      ? theme.colors.cardHover
                      : theme.colors.card,
                  }}
                >
                  <span style={styles.optionText}>{promptOption.question}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SwipeableModal>
  );
};


const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  
  // ===== ОПИСАНИЕ =====
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  
  // ===== КАТЕГОРИЯ =====
  categoryBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTitle: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  categoryBadge: {
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    background: theme.colors.dating.light,
    borderRadius: theme.radius.full,
    ...theme.typography.caption,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.dating.primary,
  },
  
  // ===== ОПЦИИ =====
  optionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  optionButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    color: theme.colors.text,
    cursor: 'pointer',
    transition: `border-color ${theme.transitions.fast}, background ${theme.transitions.fast}`,
    textAlign: 'left',
  },
  optionText: {
    ...theme.typography.body,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 1.4,
    width: '100%',
  },
};


export default PromptSelectorModal;