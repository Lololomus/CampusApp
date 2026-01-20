// ===== 📄 ФАЙЛ: src/App.js =====

import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import PostDetail from './components/posts/PostDetail';
import CreatePost from './components/posts/CreatePost';
import CreateRequestModal from './components/requests/CreateRequestModal';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import EditProfile from './components/EditProfile';
import Profile from './components/Profile';
import UserPosts from './components/UserPosts';
import DatingFeed from './components/dating/DatingFeed';
import Market from './components/market/Market';
import CreateMarketItem from './components/market/CreateMarketItem';
import './App.css';

function App() {
  const { 
    activeTab, 
    viewPostId, 
    showCreateModal,
    showCreateRequestModal,
    showCreateMarketItem,
    editingMarketItem,
    setEditingMarketItem,
    setShowCreateMarketItem,
    onboardingStep,
    showUserPosts,
    showEditModal
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    if (viewPostId) return <PostDetail />;
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
      
      {showCreateModal && <CreatePost />}
      
      {showCreateRequestModal && (
        <CreateRequestModal 
          onClose={() => useStore.getState().setShowCreateRequestModal(false)} 
        />
      )}

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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
};

export default App;