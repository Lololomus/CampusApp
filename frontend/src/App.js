// ===== FILE: frontend/src/App.js =====

import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp, setClosingConfirmation } from './utils/telegram';

import Navigation from './components/Navigation';
import Feed from './components/Feed';
import Market from './components/market/Market';
import DatingFeed from './components/dating/DatingFeed';
import Profile from './components/profile/Profile';

import CreateContentModal from './components/shared/CreateContentModal';
import EditContentModal from './components/shared/EditContentModal';
import CreateMarketItem from './components/market/CreateMarketItem';
import AuthModal from './components/AuthModal';
import EditProfile from './components/profile/EditProfile';
import DevAuthPanel from './components/shared/DevAuthPanel';

import Onboarding from './components/Onboarding';
import UserPosts from './components/profile/UserPosts';
import UserRequests from './components/profile/UserRequests';
import UserMarketItems from './components/profile/UserMarketItems';
import PostDetail from './components/posts/PostDetail';
import ToastContainer from './components/shared/Toast';

import AmbassadorPanel from './components/moderation/AmbassadorPanel';
import AdminPanel from './components/moderation/AdminPanel';
import NotificationsScreen from './components/notifications/NotificationsScreen';
import { TelegramScreenProvider } from './components/shared/telegram/TelegramScreenProvider';

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
    bootstrapAuth,
    showNotificationsScreen,
  } = useStore();

  useEffect(() => {
    initTelegramApp();
    bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    const hasUnsavedFlowOpen = Boolean(
      showCreateModal ||
      showCreateMarketItem ||
      showEditModal ||
      editingContent
    );

    setClosingConfirmation(hasUnsavedFlowOpen);
    return () => setClosingConfirmation(false);
  }, [showCreateModal, showCreateMarketItem, showEditModal, editingContent]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const shouldUseCustomScroll = activeTab === 'feed' || activeTab === 'market';

    if (shouldUseCustomScroll) {
      html.classList.add('custom-scroll');
      body.classList.add('custom-scroll');
    } else {
      html.classList.remove('custom-scroll');
      body.classList.remove('custom-scroll');
    }

    return () => {
      html.classList.remove('custom-scroll');
      body.classList.remove('custom-scroll');
    };
  }, [activeTab]);

  const renderContent = () => {
    if (showUserMarketItems) return <UserMarketItems />;
    if (showUserPosts) return <UserPosts />;
    if (showUserRequests) return <UserRequests />;

    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'market':
        return <Market />;
      case 'people':
        return <DatingFeed />;
      case 'profile':
        return <Profile />;
      case 'ambassador':
        return <AmbassadorPanel />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <Feed />;
    }
  };

  const hideNavigation = activeTab === 'ambassador' || activeTab === 'admin';

  let appContent;

  if (onboardingStep > 0) {
    appContent = (
      <div style={styles.app}>
        <Onboarding />
      </div>
    );
  } else if (authStatus === 'loading') {
    appContent = (
      <div style={styles.app}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  } else {
    appContent = (
      <div style={styles.app}>
        {renderContent()}

        {!hideNavigation && <Navigation />}
        {viewPostId && <PostDetail />}

        {showCreateModal && (
          <CreateContentModal onClose={() => setShowCreateModal(false)} />
        )}

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
        <DevAuthPanel />
        {showEditModal && <EditProfile />}
        {showNotificationsScreen && <NotificationsScreen />}
        <ToastContainer />

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <TelegramScreenProvider>
      {appContent}
    </TelegramScreenProvider>
  );
}

const styles = {
  app: {
    minHeight: 'var(--tg-app-viewport-stable-height, 100vh)',
    backgroundColor: '#000000',
    color: '#fff',
    paddingBottom: 'calc(80px + var(--screen-bottom-offset))',
  },
  loading: {
    minHeight: 'var(--tg-app-viewport-stable-height, 100vh)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default App;
