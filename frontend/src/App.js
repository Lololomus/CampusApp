// ===== FILE: frontend/src/App.js =====

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { getTelegramWebApp, initTelegramApp, setClosingConfirmation } from './utils/telegram';
import {
  deepLinkNeedsModerationRole,
  executeDeepLink,
  parseDeepLink,
} from './utils/deepLinks';

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
import PublicProfileSheet from './components/shared/PublicProfileSheet';

import AmbassadorPanel from './components/moderation/AmbassadorPanel';
import AdminPanel from './components/moderation/AdminPanel';
import NotificationsScreen from './components/notifications/NotificationsScreen';
import { TelegramScreenProvider } from './components/shared/telegram/TelegramScreenProvider';

import ErrorBoundary from './components/shared/ErrorBoundary';

import './App.css';

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
  const prevActiveTabRef = useRef(null);
  const tabScrollMemoryRef = useRef({
    feed: 0,
    market: 0,
    people: 0,
    profile: 0,
    ambassador: 0,
    admin: 0,
  });
  const restoreFrameRef = useRef(null);

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

  useEffect(() => {
    initTelegramApp();
    bootstrapAuth();
  }, [bootstrapAuth]);

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

  useEffect(() => {
    const updateActiveTabScrollMemory = () => {
      if (viewPostId) return;
      tabScrollMemoryRef.current[activeTab] = window.scrollY || window.pageYOffset || 0;
    };

    updateActiveTabScrollMemory();
    window.addEventListener('scroll', updateActiveTabScrollMemory, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateActiveTabScrollMemory);
    };
  }, [activeTab, viewPostId]);

  useLayoutEffect(() => {
    if (restoreFrameRef.current) {
      window.cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = null;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlScrollBehavior = html.style.scrollBehavior;
    const previousBodyScrollBehavior = body.style.scrollBehavior;

    const targetY = tabScrollMemoryRef.current[activeTab] ?? 0;
    const maxRestoreAttempts = targetY <= 1 ? 1 : 90;
    let attempts = 0;
    let cancelled = false;

    html.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';

    const finishRestore = () => {
      html.style.scrollBehavior = previousHtmlScrollBehavior;
      body.style.scrollBehavior = previousBodyScrollBehavior;
      restoreFrameRef.current = null;
    };

    const restoreScroll = () => {
      if (cancelled) return;

      const maxScrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const clampedTargetY = Math.min(targetY, maxScrollable);
      const nextScrollY = window.scrollY || window.pageYOffset || 0;

      if (Math.abs(nextScrollY - clampedTargetY) > 1) {
        window.scrollTo(0, clampedTargetY);
      }

      attempts += 1;
      const updatedScrollY = window.scrollY || window.pageYOffset || 0;
      const updatedMaxScrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const finalTargetY = Math.min(targetY, updatedMaxScrollable);
      const targetIsReachable = updatedMaxScrollable >= (targetY - 1);
      const targetAligned = Math.abs(updatedScrollY - finalTargetY) <= 1;

      if ((targetIsReachable && targetAligned) || attempts >= maxRestoreAttempts) {
        if (!targetAligned) {
          window.scrollTo(0, finalTargetY);
        }
        finishRestore();
        return;
      }

      restoreFrameRef.current = window.requestAnimationFrame(restoreScroll);
    };

    restoreScroll();
    prevActiveTabRef.current = activeTab;

    return () => {
      cancelled = true;
      if (restoreFrameRef.current) {
        window.cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = null;
      }
      html.style.scrollBehavior = previousHtmlScrollBehavior;
      body.style.scrollBehavior = previousBodyScrollBehavior;
    };
  }, [activeTab]);

  const renderContent = () => {
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
