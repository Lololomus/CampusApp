import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';

function Onboarding() {
  const { 
    onboardingStep, 
    onboardingData,
    setOnboardingStep, 
    setOnboardingData,
    finishRegistration 
  } = useStore();

  // Локальное состояние для последнего шага
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  // Навигация между шагами
  const goToNextStep = (data) => {
    hapticFeedback('medium');
    setOnboardingData(data);
    setOnboardingStep(onboardingStep + 1);
  };

  const goBack = () => {
    hapticFeedback('light');
    if (onboardingStep > 1) {
      setOnboardingStep(onboardingStep - 1);
    }
  };

  // Завершение регистрации
  const handleFinish = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Введите ваше имя');
      return;
    }

    hapticFeedback('success');
    finishRegistration({
      name: name.trim(),
      bio: bio.trim()
    });
  };

  // Данные для шагов
  const universities = ['МГСУ', 'РУК'];
  
  const institutes = ['ИЦИТ', 'ИСА', 'ИЭУИС', 'Юридический', 'Экономический'];
  
  const courses = [1, 2, 3, 4, 5, 6];

  // Рендер текущего шага
  const renderStep = () => {
    switch (onboardingStep) {
      case 1:
        return (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Выбери ВУЗ</h2>
            <p style={styles.stepSubtitle}>Шаг 1 из 4</p>
            
            <div style={styles.optionsList}>
              {universities.map(uni => (
                <button
                  key={uni}
                  onClick={() => goToNextStep({ university: uni })}
                  style={styles.optionButton}
                >
                  {uni}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div style={styles.stepContent}>
            <button onClick={goBack} style={styles.backButton}>
              <ChevronLeft size={24} />
            </button>
            
            <h2 style={styles.stepTitle}>Твой факультет</h2>
            <p style={styles.stepSubtitle}>Шаг 2 из 4</p>
            
            <div style={styles.optionsList}>
              {institutes.map(inst => (
                <button
                  key={inst}
                  onClick={() => goToNextStep({ institute: inst })}
                  style={styles.optionButton}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div style={styles.stepContent}>
            <button onClick={goBack} style={styles.backButton}>
              <ChevronLeft size={24} />
            </button>
            
            <h2 style={styles.stepTitle}>Твой курс</h2>
            <p style={styles.stepSubtitle}>Шаг 3 из 4</p>
            
            <div style={styles.coursesGrid}>
              {courses.map(course => (
                <button
                  key={course}
                  onClick={() => goToNextStep({ course })}
                  style={styles.courseButton}
                >
                  {course}
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div style={styles.stepContent}>
            <button onClick={goBack} style={styles.backButton}>
              <ChevronLeft size={24} />
            </button>
            
            <h2 style={styles.stepTitle}>О себе</h2>
            <p style={styles.stepSubtitle}>Шаг 4 из 4</p>
            
            <form onSubmit={handleFinish} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Твое имя *</label>
                <input
                  type="text"
                  placeholder="Александр"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  maxLength={50}
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Пару слов о себе</label>
                <textarea
                  placeholder="Расскажи о своих интересах, хобби или чем занимаешься..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={styles.textarea}
                  rows={4}
                  maxLength={200}
                />
                <div style={styles.charCount}>{bio.length}/200</div>
              </div>

              <button type="submit" style={styles.submitButton}>
                Завершить регистрацию
              </button>
            </form>

            {/* Превью выбранных данных */}
            <div style={styles.preview}>
              <div style={styles.previewItem}>
                <span style={styles.previewLabel}>ВУЗ:</span>
                <span style={styles.previewValue}>{onboardingData.university}</span>
              </div>
              <div style={styles.previewItem}>
                <span style={styles.previewLabel}>Факультет:</span>
                <span style={styles.previewValue}>{onboardingData.institute}</span>
              </div>
              <div style={styles.previewItem}>
                <span style={styles.previewLabel}>Курс:</span>
                <span style={styles.previewValue}>{onboardingData.course}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (onboardingStep === 0) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {renderStep()}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#121212',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  container: {
    width: '100%',
    maxWidth: '500px'
  },
  stepContent: {
    position: 'relative'
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    background: 'none',
    border: 'none',
    color: '#8774e1',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center'
  },
  stepTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    marginTop: '40px'
  },
  stepSubtitle: {
    fontSize: '16px',
    color: '#8774e1',
    fontWeight: '500',
    marginBottom: '32px'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionButton: {
    padding: '20px',
    borderRadius: '16px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    ':hover': {
      borderColor: '#8774e1',
      backgroundColor: 'rgba(135, 116, 225, 0.1)'
    }
  },
  coursesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  courseButton: {
    padding: '32px 20px',
    borderRadius: '16px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '28px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  form: {
    marginBottom: '24px'
  },
  field: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#999',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
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
  submitButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  },
  preview: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333'
  },
  previewItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #333'
  },
  previewLabel: {
    fontSize: '14px',
    color: '#999'
  },
  previewValue: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '500'
  }
};

export default Onboarding;