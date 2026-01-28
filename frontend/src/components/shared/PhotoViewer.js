// ===== 📄 ФАЙЛ: src/components/shared/PhotoViewer.js =====

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const Z_PHOTO_VIEWER = 4000;

function PhotoViewer({ photos = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [scale, setScale] = useState(1);
  const startXRef = useRef(0);
  const imageRef = useRef(null);

  // ===== НАВИГАЦИЯ =====
  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setScale(1);
    }
  };

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setScale(1);
    }
  };

  // ===== КЛАВИАТУРА (Desktop) =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onClose]);

  // ===== СВАЙП НАВИГАЦИЯ =====
  const handleTouchStart = (e) => {
    if (scale > 1) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || scale > 1) return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - startXRef.current;
    setDragX(delta);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const threshold = 80;
    
    if (dragX < -threshold && currentIndex < photos.length - 1) {
      goToNext();
    } else if (dragX > threshold && currentIndex > 0) {
      goToPrev();
    }
    
    setDragX(0);
    setIsDragging(false);
  };

  // ===== PINCH-TO-ZOOM =====
  const handleDoubleClick = () => {
    setScale(scale === 1 ? 2 : 1);
  };

  const currentPhoto = photos[currentIndex];
  const photoUrl = currentPhoto?.url || currentPhoto;

  return createPortal(
    <>
      <style>{styles.keyframes}</style>
      
      {/* Overlay */}
      <div 
        style={styles.overlay} 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Container */}
      <div 
        style={styles.container}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </div>
          <button 
            style={styles.closeButton} 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Image */}
        <div 
          style={styles.imageWrapper}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            ref={imageRef}
            src={photoUrl}
            alt={`Photo ${currentIndex + 1}`}
            style={{
              ...styles.image,
              transform: `translateX(${isDragging ? dragX : 0}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.3s ease',
            }}
            onDoubleClick={handleDoubleClick}
          />
        </div>

        {/* Navigation Buttons (Desktop) */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button 
                style={styles.navButtonLeft} 
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
              >
                <ChevronLeft size={32} strokeWidth={3} />
              </button>
            )}
            {currentIndex < photos.length - 1 && (
              <button 
                style={styles.navButtonRight} 
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
              >
                <ChevronRight size={32} strokeWidth={3} />
              </button>
            )}
          </>
        )}

        {/* Indicators */}
        {photos.length > 1 && (
          <div style={styles.indicators}>
            {photos.map((_, idx) => (
              <div 
                key={idx} 
                style={{
                  ...styles.indicator,
                  opacity: idx === currentIndex ? 1 : 0.4,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
              />
            ))}
          </div>
        )}

      </div>
    </>,
    document.body
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    backdropFilter: 'blur(8px)',
    zIndex: Z_PHOTO_VIEWER - 1,
    animation: 'fadeIn 0.2s ease',
  },
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: Z_PHOTO_VIEWER,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.3s ease',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    zIndex: 10,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
  },
  counter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    touchAction: 'pan-y',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  navButtonLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'background 0.2s',
  },
  navButtonRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'background 0.2s',
  },
  indicators: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    padding: '0 20px',
    zIndex: 10,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
    transition: 'opacity 0.2s',
    cursor: 'pointer',
  },
  keyframes: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
};

export default PhotoViewer;