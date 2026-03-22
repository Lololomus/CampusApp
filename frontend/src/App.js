// ===== FILE: frontend/src/App.js =====

import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import { initTelegramApp, setClosingConfirmation } from './utils/telegram';

import Navigation from './components/Navigation';
import Feed from './components/Feed';
import Market from './components/market/Market';
import Profile from './components/profile/Profile';
import DatingFeed from './components/dating/DatingFeed';

import CreateContentModal from './components/shared/CreateContentModal';
import EditContentModal from './components/shared/EditContentModal';
import CreateMarketItem from './components/market/CreateMarketItem';
import AuthModal from './components/AuthModal';
import EditProfile from './components/profile/EditProfile';
import DevAuthPanel from './components/shared/DevAuthPanel';

import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import UserPosts from './components/profile/UserPosts';
import UserRequests from './components/profile/UserRequests';
import UserMarketItems from './components/profile/UserMarketItems';
import PostDetail from './components/posts/PostDetail';
import ToastContainer from './components/shared/Toast';

import AmbassadorPanel from './components/moderation/AmbassadorPanel';
import AdminPanel from './components/moderation/AdminPanel';
import NotificationsScreen from './components/notifications/NotificationsScreen';
import { TelegramScreenProvider } from './components/shared/telegram/TelegramScreenProvider';

import ErrorBoundary from './components/shared/ErrorBoundary';

import './App.css';

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashVariant, setSplashVariant] = useState('auto');
  const [splashInstanceKey, setSplashInstanceKey] = useState(0);

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
  const isProd = import.meta.env.PROD;

  useEffect(() => {
    initTelegramApp();
    bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    if (authStatus !== 'loading') {
      setAuthReady(true);
    }
  }, [authStatus]);

  const handleRunSplashVariant = (variant) => {
    setSplashVariant(variant);
    setShowSplash(true);
    setSplashInstanceKey((current) => current + 1);
  };

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
        if (!isProd) return <DatingFeed />;
        return (
          <div style={{
            position: 'fixed', inset: 0,
            background: '#050505',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20,
            paddingBottom: 'var(--screen-bottom-offset, 80px)',
          }}>
            <div style={{
              width: 88, height: 88, borderRadius: 28,
              background: 'rgba(212,255,0,0.08)',
              border: '1.5px solid rgba(212,255,0,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40,
            }}>
              🛠️
            </div>
            <div style={{ textAlign: 'center', padding: '0 40px' }}>
              <p style={{
                margin: '0 0 8px',
                fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px',
              }}>
                Раздел в разработке
              </p>
              <p style={{
                margin: 0,
                fontSize: 15, color: '#8E8E93', lineHeight: 1.45,
              }}>
                Скоро здесь появятся знакомства с&nbsp;людьми из&nbsp;твоего&nbsp;вуза
              </p>
            </div>
            <div style={{
              height: 3, width: 48,
              borderRadius: 2, background: '#D4FF00', opacity: 0.7,
            }} />
          </div>
        );
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
        <DevAuthPanel onRunSplashVariant={handleRunSplashVariant} />
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
    <ErrorBoundary>
      <TelegramScreenProvider>
        {appContent}
        {showSplash && (
          <SplashScreen
            key={splashInstanceKey}
            variant={splashVariant}
            authReady={authReady}
            onFinished={() => {
              setShowSplash(false);
              if (splashVariant !== 'auto') setSplashVariant('auto');
            }}
          />
        )}
      </TelegramScreenProvider>
    </ErrorBoundary>
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
