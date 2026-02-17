// ===== 📄App.js =====
import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';

// Основные экраны
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import Market from './components/market/Market';
import DatingFeed from './components/dating/DatingFeed';
import Profile from './components/profile/Profile';

// Модалки
import CreateContentModal from './components/shared/CreateContentModal';
import EditContentModal from './components/shared/EditContentModal';
import CreateMarketItem from './components/market/CreateMarketItem';
import AuthModal from './components/AuthModal';
import EditProfile from './components/profile/EditProfile';
import DevAuthPanel from './components/shared/DevAuthPanel';

// Дополнительные компоненты
import Onboarding from './components/Onboarding';
import UserPosts from './components/profile/UserPosts';
import UserRequests from './components/profile/UserRequests';
import UserMarketItems from './components/profile/UserMarketItems';
import PostDetail from './components/posts/PostDetail';
import ToastContainer from './components/shared/Toast';

// Панели модерации (новое)
import AmbassadorPanel from './components/moderation/AmbassadorPanel';
import AdminPanel from './components/moderation/AdminPanel';

import './App.css';

function App() {
  const { 
    activeTab, 
    showCreateModal,
    setShowCreateModal,
    showCreateMarketItem,
    editingMarketItem,
    setEditingMarketItem,
    setShowCreateMarketItem,
    onboardingStep,
    showUserPosts,
    showUserRequests,
    showUserMarketItems,
    showEditModal,
    editingContent,
    editingType,
    closeEditing,
    viewPostId,
    setUpdatedPost,
    authStatus,
    bootstrapAuth
  } = useStore();

  // Инициализация Telegram + auth bootstrap
  useEffect(() => {
    initTelegramApp();
    bootstrapAuth();
  }, [bootstrapAuth]);

  // Рендеринг основного контента
  const renderContent = () => {
    // Приоритет: дополнительные экраны профиля
    if (showUserMarketItems) return <UserMarketItems />;
    if (showUserPosts) return <UserPosts />;
    if (showUserRequests) return <UserRequests />;

    // Основные табы
    switch (activeTab) {
      case 'feed': 
        return <Feed />;
      case 'market': 
        return <Market />;
      case 'people': 
        return <DatingFeed />; // или <People /> если переименовали
      case 'profile': 
        return <Profile />;
      
      // Панели модерации (новое)
      case 'ambassador': 
        return <AmbassadorPanel />;
      case 'admin': 
        return <AdminPanel />;
      
      default: 
        return <Feed />;
    }
  };
  
  // Скрываем навигацию на панелях модерации (новое)
  const hideNavigation = activeTab === 'ambassador' || activeTab === 'admin';

  // Ранний выход для онбординга
  if (onboardingStep > 0) {
    return (
      <div style={styles.app}>
        <Onboarding />
      </div>
    );
  }

  if (authStatus === 'loading') {
    return (
      <div style={styles.app}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>   
      {renderContent()}
      
      {/* Условно скрываем навигацию на панелях модерации */}
      {!hideNavigation && <Navigation />}
      
      {/* Детальный просмотр поста */}
      {viewPostId && <PostDetail />}

      {/* Модалка создания контента */}
      {showCreateModal && (
        <CreateContentModal 
          onClose={() => setShowCreateModal(false)} 
        />
      )}

      {/* Модалка редактирования контента */}
      {editingContent && (
        <EditContentModal
          key={editingContent?.id || Date.now()} 
          contentType={editingType}
          initialData={editingContent}
          onClose={closeEditing}
          onSuccess={(updatedData) => {
            if (editingType === 'post' && updatedData?.id) {
              setUpdatedPost(updatedData.id, updatedData);
            }
            closeEditing();
          }}
        />
      )}

      {/* Модалка создания/редактирования товара */}
      {showCreateMarketItem && (
        <CreateMarketItem 
          editItem={editingMarketItem}
          onClose={() => {
            setEditingMarketItem(null);
            setShowCreateMarketItem(false);
          }}
          onSuccess={() => {
            setEditingMarketItem(null);
            setShowCreateMarketItem(false);
          }}
        />
      )}

      {/* Модалка авторизации */}
      <AuthModal />
      <DevAuthPanel />
      
      {/* Модалка редактирования профиля */}
      {showEditModal && <EditProfile />}
      
      {/* Toast уведомления */}
      <ToastContainer />

      {/* CSS анимации (из нового кода) */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    paddingBottom: '80px',
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default App;
