import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import CreateContentModal from './components/shared/CreateContentModal';
import EditContentModal from './components/shared/EditContentModal';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import EditProfile from './components/profile/EditProfile'; 
import Profile from './components/profile/Profile';
import UserPosts from './components/profile/UserPosts';
import UserRequests from './components/profile/UserRequests';
import UserMarketItems from './components/profile/UserMarketItems';
import DatingFeed from './components/dating/DatingFeed';
import Market from './components/market/Market';
import CreateMarketItem from './components/market/CreateMarketItem';
import PostDetail from './components/posts/PostDetail';
import ToastContainer from './components/shared/Toast';
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
    viewPostId 
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    if (showUserMarketItems) return <UserMarketItems />;
    if (showUserPosts) return <UserPosts />;
    if (showUserRequests) return <UserRequests />;

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
      
      {viewPostId && <PostDetail />}

      {showCreateModal && (
        <CreateContentModal 
          onClose={() => setShowCreateModal(false)} 
        />
      )}

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
      
      <ToastContainer />
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