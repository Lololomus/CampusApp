// ===== FILE: frontend/src/App.js =====

import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { getStartParam, initTelegramApp, setClosingConfirmation } from './utils/telegram';
import {
  deepLinkNeedsModerationRole,
  executeDeepLink,
  parseDeepLink,
} from './utils/deepLinks';

import Navigation from './components/Navigation';
import AuthModal from './components/AuthModal';
import DevAuthPanel from './components/dev/DevAuthPanel';

import SplashScreen from './components/SplashScreen';
import ToastContainer from './components/shared/Toast';
import { TelegramScreenProvider } from './components/shared/telegram/TelegramScreenProvider';

import ErrorBoundary from './components/shared/ErrorBoundary';
import { useMainTabScrollMemory } from './hooks/useMainTabScrollMemory';

import './App.css';

const FEED_SCROLL_STALE_MS = 30 * 60 * 1000;
const FEED_LAST_BACKGROUND_AT_KEY = 'campus:last-background-at';

function isVeryWeakDevice() {
  if (typeof navigator === 'undefined') return false;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
  const effectiveType = connection?.effectiveType;

  return (
    connection?.saveData === true ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    (memory !== null && memory <= 2) ||
    (cores !== null && cores <= 2)
  );
}

const SHOULD_EAGER_PRELOAD_CHUNKS = !isVeryWeakDevice();

function preloadableLazy(loader) {
  let LoadedComponent = null;
  let loadPromise = null;
  let loadError = null;

  const load = () => {
    if (!loadPromise) {
      loadPromise = loader()
        .then((module) => {
          LoadedComponent = module.default || module;
          return module;
        })
        .catch((error) => {
          loadError = error;
          throw error;
        });
    }
    return loadPromise;
  };

  const LazyComponent = lazy(load);

  function PreloadableComponent(props) {
    if (loadError) throw loadError;
    if (LoadedComponent) return <LoadedComponent {...props} />;
    return <LazyComponent {...props} />;
  }

  PreloadableComponent.preload = load;
  return PreloadableComponent;
}

const loadPostFeed = () => import('./components/posts/PostFeed');
const loadMarket = () => import('./components/market/Market');
const loadProfile = () => import('./components/profile/Profile');
const loadDatingFeed = () => import('./components/dating/DatingFeed');
const loadCreatePostModal = () => import('./components/posts/CreatePostModal');
const loadEditPostModal = () => import('./components/posts/EditPostModal');
const loadCreateMarketItem = () => import('./components/market/CreateMarketItem');
const loadEditProfile = () => import('./components/profile/EditProfile');
const loadOnboarding = () => import('./components/Onboarding');
const loadUserPosts = () => import('./components/profile/UserPosts');
const loadUserRequests = () => import('./components/profile/UserRequests');
const loadUserMarketItems = () => import('./components/profile/UserMarketItems');
const loadPostDetail = () => import('./components/posts/PostDetail');
const loadPublicProfileSheet = () => import('./components/user/PublicProfileSheet');
const loadAmbassadorPanel = () => import('./components/moderation/AmbassadorPanel');
const loadAdminPanel = () => import('./components/moderation/AdminPanel');
const loadNotificationsScreen = () => import('./components/notifications/NotificationsScreen');

const PostFeed = preloadableLazy(loadPostFeed);
const Market = preloadableLazy(loadMarket);
const Profile = preloadableLazy(loadProfile);
const DatingFeed = preloadableLazy(loadDatingFeed);
const CreatePostModal = preloadableLazy(loadCreatePostModal);
const EditPostModal = preloadableLazy(loadEditPostModal);
const CreateMarketItem = preloadableLazy(loadCreateMarketItem);
const EditProfile = preloadableLazy(loadEditProfile);
const Onboarding = preloadableLazy(loadOnboarding);
const UserPosts = preloadableLazy(loadUserPosts);
const UserRequests = preloadableLazy(loadUserRequests);
const UserMarketItems = preloadableLazy(loadUserMarketItems);
const PostDetail = preloadableLazy(loadPostDetail);
const PublicProfileSheet = preloadableLazy(loadPublicProfileSheet);
const AmbassadorPanel = preloadableLazy(loadAmbassadorPanel);
const AdminPanel = preloadableLazy(loadAdminPanel);
const NotificationsScreen = preloadableLazy(loadNotificationsScreen);

const EAGER_PRELOAD_COMPONENTS = [
  PostFeed,
  Market,
  Profile,
  DatingFeed,
  CreatePostModal,
  EditPostModal,
  CreateMarketItem,
  EditProfile,
  Onboarding,
  UserPosts,
  UserRequests,
  UserMarketItems,
  PostDetail,
  PublicProfileSheet,
  AmbassadorPanel,
  AdminPanel,
  NotificationsScreen,
];

const preloadComponents = (components) =>
  Promise.allSettled(components.map((Component) => Component.preload()));

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
  const [eagerChunksReady, setEagerChunksReady] = useState(!SHOULD_EAGER_PRELOAD_CHUNKS);
  const [splashVariant, setSplashVariant] = useState('auto');
  const [splashInstanceKey, setSplashInstanceKey] = useState(0);
  const deepLinkExecutionRef = useRef(false);
  const appBackgroundedAtRef = useRef(null);
  const forceFeedTopOnNextVisibleRef = useRef(false);

  useEffect(() => {
    updateFixedLayout();
    window.addEventListener('resize', updateFixedLayout);
    window.visualViewport?.addEventListener('resize', updateFixedLayout);
    window.visualViewport?.addEventListener('scroll', updateFixedLayout);
    return () => {
      window.removeEventListener('resize', updateFixedLayout);
      window.visualViewport?.removeEventListener('resize', updateFixedLayout);
      window.visualViewport?.removeEventListener('scroll', updateFixedLayout);
    };
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
  const { saveCurrentScroll, setSavedScroll } = useMainTabScrollMemory(activeTab);

  const resetFeedScrollAfterStaleResume = useCallback((now = Date.now()) => {
    let lastBackgroundAt = appBackgroundedAtRef.current;

    try {
      const stored = window.localStorage.getItem(FEED_LAST_BACKGROUND_AT_KEY);
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) {
        lastBackgroundAt = Math.max(lastBackgroundAt || 0, parsed);
      }
    } catch {
      // localStorage can be unavailable in restricted webviews.
    }

    if (!lastBackgroundAt || now - lastBackgroundAt < FEED_SCROLL_STALE_MS) return;

    appBackgroundedAtRef.current = now;
    setSavedScroll('feed', 0);
    forceFeedTopOnNextVisibleRef.current = true;

    if (activeTab === 'feed' && !viewPostId) {
      window.scrollTo(0, 0);
      forceFeedTopOnNextVisibleRef.current = false;
    }
  }, [activeTab, setSavedScroll, viewPostId]);

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
      saveCurrentScroll();
      try {
        window.localStorage.setItem(FEED_LAST_BACKGROUND_AT_KEY, String(now));
      } catch {
        // localStorage can be unavailable in restricted webviews.
      }
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
  }, [resetFeedScrollAfterStaleResume, saveCurrentScroll]);

  useEffect(() => {
    const startParam = getStartParam();
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
    if (!SHOULD_EAGER_PRELOAD_CHUNKS) return undefined;

    let cancelled = false;

    preloadComponents(EAGER_PRELOAD_COMPONENTS).finally(() => {
      if (!cancelled) setEagerChunksReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
    const shouldUseCustomScroll = activeTab === 'feed' || activeTab === 'market' || activeTab === 'profile';

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
        <Suspense fallback={<TabFallback />}>
          {renderContent()}
        </Suspense>

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
        <Suspense fallback={<ScreenFallback />}>
          {appContent}
        </Suspense>
        {showSplash && (
          <SplashScreen
            key={splashInstanceKey}
            variant={splashVariant}
            authReady={authReady && eagerChunksReady}
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
    backgroundColor: '#000000',
    color: '#fff',
    maxWidth: 'var(--app-max-width)',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFallback: {
    minHeight: 'calc(var(--tg-app-viewport-stable-height, 100vh) - 96px - var(--screen-bottom-offset))',
    backgroundColor: '#000000',
  },
};

const TabFallback = () => (
  <div style={styles.tabFallback} aria-label="Загрузка" />
);

const ScreenFallback = () => (
  <div style={styles.loading}>Загрузка...</div>
);

export default App;
