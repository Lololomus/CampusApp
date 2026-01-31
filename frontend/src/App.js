// ===== 📄 ФАЙЛ: src/App.js =====

import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import CreateContentModal from './components/shared/CreateContentModal';
import EditContentModal from './components/shared/EditContentModal';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import EditProfile from './components/EditProfile';
import Profile from './components/Profile';
import UserPosts from './components/UserPosts';
import DatingFeed from './components/dating/DatingFeed';
import Market from './components/market/Market';
import CreateMarketItem from './components/market/CreateMarketItem';
// 🔧 ИНТЕГРАЦИЯ: Импортируем PostDetail
import PostDetail from './components/posts/PostDetail'; 
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
    showEditModal,
    editingContent,
    editingType,
    closeEditing,
    // 🔧 ИНТЕГРАЦИЯ: Достаем viewPostId
    viewPostId 
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    if (showUserPosts) return <UserPosts />;

    switch (activeTab) {
      case 'feed': return <Feed />;
      case 'market': return <Market />;
      case 'people': return <DatingFeed />;
      case 'profile': return <Profile />;
      default: return <Feed />;
    }
  };
  
  if (onboardingStep > 0) {
    return <div style={styles.app}><Onboarding /></div>;
  }

  return (
    <div style={styles.app}>   
      {renderContent()}
      <Navigation />
      
      {/* 🔧 ИНТЕГРАЦИЯ: Рендерим PostDetail поверх всего, если есть ID */}
      {viewPostId && <PostDetail />}

      {/* МОДАЛКА СОЗДАНИЯ */}
      {showCreateModal && (
        <CreateContentModal 
          onClose={() => setShowCreateModal(false)} 
        />
      )}

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ */}
      {editingContent && (
        <EditContentModal
          key={editingContent?.id || Date.now()} 
          contentType={editingType}
          initialData={editingContent}
          onClose={closeEditing}
          onSuccess={(updatedData) => {
             closeEditing();
          }}
        />
      )}

      {/* MARKET MODAL */}
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

      <AuthModal />
      {showEditModal && <EditProfile />} 
      
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    paddingBottom: '80px',
  }
};

export default App;