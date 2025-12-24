import React from 'react';
import { Settings, Edit, Heart, LogOut, X } from 'lucide-react';

function ProfileMenuModal({ onClose, onEdit, onLogout }) {
  const handleSettings = () => {
    console.log('Открыть настройки');
    onClose();
  };

  const handleDatingSettings = () => {
    console.log('Открыть настройки знакомств');
    onClose();
  };

  const handleEditProfile = () => {
    onEdit();
    onClose();
  };

  const handleLogout = () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      onLogout();
      onClose();
    }
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Меню профиля</h3>
          <button style={styles.closeButton} onClick={onClose}>
            <X size={24} color="#888" />
          </button>
        </div>

        <div style={styles.menuItems}>
          <button style={styles.menuItem} onClick={handleEditProfile}>
            <Edit size={20} color="#8774e1" />
            <span>Редактировать профиль</span>
          </button>

          <button style={styles.menuItem} onClick={handleSettings}>
            <Settings size={20} color="#8774e1" />
            <span>Настройки приложения</span>
          </button>

          <button style={styles.menuItem} onClick={handleDatingSettings}>
            <Heart size={20} color="#8774e1" />
            <span>Настройки знакомств</span>
          </button>

          <div style={styles.divider} />

          <button style={styles.menuItemDanger} onClick={handleLogout}>
            <LogOut size={20} color="#ff6b9d" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#1a1a1a',
    borderTopLeftRadius: '24px',
    borderTopRightRadius: '24px',
    padding: '24px',
    zIndex: 1001,
    animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  menuItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    fontSize: '16px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  menuItemDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(255, 107, 157, 0.1)',
    border: '1px solid rgba(255, 107, 157, 0.3)',
    borderRadius: '12px',
    fontSize: '16px',
    color: '#ff6b9d',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  divider: {
    height: '1px',
    background: '#2a2a2a',
    margin: '16px 0',
  },
};

export default ProfileMenuModal;