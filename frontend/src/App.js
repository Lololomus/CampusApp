// ===== FILE: frontend/src/App.js =====

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { getTelegramWebApp, initTelegramApp, setClosingConfirmation } from './utils/telegram';
import {
  deepLinkNeedsModerationRole,
  executeDeepLink,
  parseDeepLink,
} from './utils/deepLinks';

import Navigation from './components/Navigation';
import PostFeed from './components/posts/PostFeed';
import Market from './components/market/Market';
import Profile from './components/profile/Profile';
import DatingFeed from './components/dating/DatingFeed';

import CreatePostModal from './components/posts/CreatePostModal';
import EditPostModal from './components/posts/EditPostModal';
import CreateMarketItem from './components/market/CreateMarketItem';
import AuthModal from './components/AuthModal';
import EditProfile from './components/profile/EditProfile';
import DevAuthPanel from './components/dev/DevAuthPanel';

import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import UserPosts from './components/profile/UserPosts';
import UserRequests from './components/profile/UserRequests';
import UserMarketItems from './components/profile/UserMarketItems';
import PostDetail from './components/posts/PostDetail';
import ToastContainer from './components/shared/Toast';
import PublicProfileSheet from './components/user/PublicProfileSheet';

import AmbassadorPanel from './components/moderation/AmbassadorPanel';
import AdminPanel from './components/moderation/AdminPanel';
import NotificationsScreen from './components/notifications/NotificationsScreen';
import { TelegramScreenProvider } from './components/shared/telegram/TelegramScreenProvider';

import ErrorBoundary from './components/shared/ErrorBoundary';

import './App.css';

const FEED_SCROLL_STALE_MS = 30 * 60 * 1000;
const FEED_LAST_BACKGROUND_AT_KEY = 'campus:last-background-at';

// Вычисляем точный left-offset для fixed-элементов (без учёта скроллбара)
function updateFixedLayout() {
  const clientWidth = document.documentElement.clientWidth;
  const maxWidth = 680;
  const left = Math.max(0, (clientWidth - maxWidth) / 2);
  const width = Math.min(clientWidth, maxWidth);
  document.documentElement.style.setProperty('--app-fixed-left', `${left}px`);
  document.documentElement.style.setProperty('--app-fixed-width', `${width}px`);
}

// Запускаем до первого рендера — переменные уже правильные при монтировании
updateFixedLayout();

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashVariant, setSplashVariant] = useState('auto');
  const [splashInstanceKey, setSplashInstanceKey] = useState(0);
  const deepLinkExecutionRef = useRef(false);
  const appBackgroundedAtRef = useRef(null);
  const forceFeedTopOnNextVisibleRef = useRef(false);

  useEffect(() => {
    updateFixedLayout();
    window.addEventListener('resize', updateFixedLayout);
    return () => window.removeEventListener('resize', updateFixedLayout);
  }, []);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const {
    activeTab,
    pendingDeepLink,
    setPendingDeepLink,
    clearPendingDeepLink,
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
    isRegistered,
    moderationRole,
    showNotificationsScreen,
    publicProfilePreview,
    clearPublicProfilePreview,
  } = useStore();

  const resetFeedScrollAfterStaleResume = useCallback((now = Date.now()) => {
    let lastBackgroundAt = appBackgroundedAtRef.current;

    try {
      const stored = window.localStorage.getItem(FEED_LAST_BACKGROUND_AT_KEY);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        lastBackgroundAt = Math.max(lastBackgroundAt || 0, parsed);
      }
    } catch {}

    if (!lastBackgroundAt || now - lastBackgroundAt < FEED_SCROLL_STALE_MS) return;

    appBackgroundedAtRef.current = now;
    forceFeedTopOnNextVisibleRef.current = true;

    if (activeTab === 'feed' && !viewPostId) {
      window.scrollTo(0, 0);
      forceFeedTopOnNextVisibleRef.current = false;
    }
  }, [activeTab, viewPostId]);

  useLayoutEffect(() => {
    if (!forceFeedTopOnNextVisibleRef.current) return;
    if (activeTab !== 'feed' || viewPostId) return;

    window.scrollTo(0, 0);
    forceFeedTopOnNextVisibleRef.current = false;
  }, [activeTab, viewPostId]);

  useEffect(() => {
    initTelegramApp();
    bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    resetFeedScrollAfterStaleResume();

    const rememberBackgroundTime = () => {
      const now = Date.now();
      appBackgroundedAtRef.current = now;
      try {
        window.localStorage.setItem(FEED_LAST_BACKGROUND_AT_KEY, String(now));
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        rememberBackgroundTime();
        return;
      }
      resetFeedScrollAfterStaleResume();
    };

    const handleResume = () => resetFeedScrollAfterStaleResume();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', rememberBackgroundTime);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', rememberBackgroundTime);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [resetFeedScrollAfterStaleResume]);

  useEffect(() => {
    const startParam = getTelegramWebApp()?.initDataUnsafe?.start_param;
    const parsedLink = parseDeepLink(startParam);
    if (parsedLink) {
      setPendingDeepLink(parsedLink);
    }
  }, [setPendingDeepLink]);

  useEffect(() => {
    if (authStatus !== 'loading') {
      setAuthReady(true);
    }
  }, [authStatus]);

  useEffect(() => {
    if (!pendingDeepLink || deepLinkExecutionRef.current) return;
    if (authStatus === 'loading' || onboardingStep > 0 || showSplash) return;
    if (deepLinkNeedsModerationRole(pendingDeepLink) && isRegistered && moderationRole == null) return;

    let isCancelled = false;
    deepLinkExecutionRef.current = true;

    (async () => {
      try {
        const result = await executeDeepLink(pendingDeepLink, useStore);
        if (!isCancelled && (result?.status === 'completed' || result?.status === 'ignored')) {
          clearPendingDeepLink();
        }
      } finally {
        deepLinkExecutionRef.current = false;
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    pendingDeepLink,
    authStatus,
    onboardingStep,
    showSplash,
    isRegistered,
    moderationRole,
    clearPendingDeepLink,
  ]);

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
    switch (activeTab) {
      case 'feed':
        return <PostFeed />;
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
        return <PostFeed />;
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
        {showUserPosts && <UserPosts />}
        {showUserRequests && <UserRequests />}
        {showUserMarketItems && <UserMarketItems />}
        {publicProfilePreview && (
          <PublicProfileSheet
            user={publicProfilePreview}
            isOpen={Boolean(publicProfilePreview)}
            onClose={clearPublicProfilePreview}
          />
        )}

        {showCreateModal && (
          <CreatePostModal onClose={() => setShowCreateModal(false)} />
        )}

        {editingContent && (
          <EditPostModal
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
    maxWidth: 'var(--app-max-width)',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    position: 'relative',
    overflowX: 'hidden',
  },
  loading: {
    minHeight: 'var(--tg-app-viewport-stable-height, 100vh)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default App;
