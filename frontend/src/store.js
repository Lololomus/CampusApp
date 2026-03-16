import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  registerUser,
  loginWithTelegram,
  refreshToken,
  ensureAccessToken,
  getCurrentUser,
  logoutUser,
  setAccessToken,
} from './api';

export const useStore = create(
  persist(
    (set, get) => ({
      // AUTH STATE
      isRegistered: false,
      user: {},
      authStatus: 'loading', // loading | ready | error
      
      setUser: (user) => {
        const state = get();
        
        if (!user) {
          // Logout — очистить всё
          set({ 
            user: {}, 
            datingProfile: null,
            currentProfile: null,
            profilesQueue: [],
            likedPosts: {},
            isRegistered: false,
            moderationRole: null,
            authStatus: 'ready',
          });
        } else {
          set({ user, isRegistered: true, authStatus: 'ready' });
          
          // Автозагрузка dating профиля при входе
          if (user.show_in_dating) {
            import('./api').then(({ getMyDatingProfile }) => {
              getMyDatingProfile()
                .then(profile => {
                  if (profile) {
                    state.setDatingProfile(profile);
                  }
                })
                .catch(() => {});
            });
          }

          // Автозагрузка роли модерации
          if (user.role && user.role !== 'user') {
            import('./api').then(({ getMyModerationRole }) => {
              getMyModerationRole()
                .then(roleData => {
                  set({ moderationRole: roleData });
                })
                .catch(() => {});
            });
          } else {
            set({ 
              moderationRole: { 
                role: 'user', 
                can_moderate: false, 
                can_admin: false, 
                scope: null 
              } 
            });
          }
        }
      },
      
      logout: async () => {
        await logoutUser();
        set({
          user: {},
          datingProfile: null,
          currentProfile: null,
          profilesQueue: [],
          likedPosts: {},
          isRegistered: false,
          moderationRole: null,
          authStatus: 'ready',
        });
      },

      // MODERATION STATE
      moderationRole: null, // { role, university, can_moderate, can_admin, scope, pending_reports }
      
      setModerationRole: (roleData) => set({ moderationRole: roleData }),
      
      /** Быстрая проверка: может ли юзер модерировать */
      canModerate: () => {
        const { moderationRole } = get();
        return moderationRole?.can_moderate === true;
      },
      
      /** Быстрая проверка: суперадмин ли юзер */
      isSuperAdmin: () => {
        const { moderationRole } = get();
        return moderationRole?.can_admin === true;
      },

      // NAVIGATION STATE
      activeTab: 'feed',
      feedMode: 'global',
      feedSubTab: 'posts',
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFeedMode: (mode) => set({ feedMode: mode }),
      setFeedSubTab: (tab) => set({ feedSubTab: tab }),

      // MODAL STATES
      showAuthModal: false,
      showCreateModal: false,
      showCreateRequestModal: false,
      showCreateMarketItem: false,
      viewPostId: null,
      showEditModal: false,
      setShowAuthModal: (show) => set({ showAuthModal: show }),
      setShowCreateModal: (show) => set({ showCreateModal: show }),
      setShowCreateRequestModal: (show) => set({ showCreateRequestModal: show }),
      setShowCreateMarketItem: (show) => set({ showCreateMarketItem: show }),
      setViewPostId: (id) => set({ viewPostId: id }),
      setEditPostId: (id) => set({ editPostId: id }),
      setShowEditModal: (show) => set({ showEditModal: show }),

      editingContent: null,
      editingType: null,
      
      setEditingContent: (content, type = 'post') => set({ 
        editingContent: content, 
        editingType: type 
      }),
      
      closeEditing: () => set({ 
        editingContent: null, 
        editingType: null 
      }),

      // Fullscreen модалки профиля
      showUserPosts: false,
      setShowUserPosts: (show) => set({ showUserPosts: show }),
      
      showUserMarketItems: false,
      setShowUserMarketItems: (show) => set({ showUserMarketItems: show }),

      showUserRequests: false,
      setShowUserRequests: (show) => set({ showUserRequests: show }),

      // ONBOARDING STATE
      onboardingStep: 0,
      onboardingData: {},
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setOnboardingData: (data) => set((state) => ({
        onboardingData: { ...state.onboardingData, ...data }
      })),

      // POSTS STATE
      posts: [],
      setPosts: (posts) => set({ posts }),
      addNewPost: (newPost) => set((state) => ({
        posts: [newPost, ...state.posts]
      })),
      updatePost: (postId, updates) => set((state) => ({
        posts: state.posts.map(p =>
          p.id === postId ? { ...p, ...updates } : p
        )
      })),

      // Синхронизация между PostDetail и Feed
      updatedPostId: null,
      updatedPostData: {},
      
      setUpdatedPost: (postId, updates) => {
        set({ 
          updatedPostId: postId,
          updatedPostData: updates 
        });
      },
      
      getUpdatedPost: (postId) => {
        const state = get();
        return state.updatedPostId === postId ? state.updatedPostData : null;
      },
      
      clearUpdatedPost: () => {
        set({ 
          updatedPostId: null,
          updatedPostData: {} 
        });
      },

      // FILTERS STATE
      postsFilters: {
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
        tags: [],
        dateRange: 'all',
        sort: 'newest',
      },
      
      requestsFilters: {
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
        status: 'active',
        hasReward: 'all',
        urgency: 'all',
        sort: 'newest',
      },
      
      setPostsFilters: (filters) => set((state) => ({
        postsFilters: { ...state.postsFilters, ...filters }
      })),
      
      clearPostsFilters: () => set({
        postsFilters: {
          location: 'all',
          university: 'all',
          institute: 'all',
          campus_id: null,
          city: null,
          tags: [],
          dateRange: 'all',
          sort: 'newest',
        }
      }),
      
      setRequestsFilters: (filters) => set((state) => ({
        requestsFilters: { ...state.requestsFilters, ...filters }
      })),
      
      clearRequestsFilters: () => set({
        requestsFilters: {
          location: 'all',
          university: 'all',
          institute: 'all',
          campus_id: null,
          city: null,
          status: 'active',
          hasReward: 'all',
          urgency: 'all',
          sort: 'newest',
        }
      }),

      // REQUESTS STATE
      requests: [],
      myRequests: [],
      currentRequest: null,
      requestDraft: {},
      
      setRequests: (requests) => set({ requests }),
      
      addNewRequest: (newRequest) => set((state) => ({
        requests: [newRequest, ...state.requests],
        myRequests: [newRequest, ...state.myRequests]
      })),
      
      updateRequest: (requestId, updates) => set((state) => ({
        requests: state.requests.map(r =>
          r.id === requestId ? { ...r, ...updates } : r
        ),
        myRequests: state.myRequests.map(r =>
          r.id === requestId ? { ...r, ...updates } : r
        )
      })),
      
      deleteRequest: (requestId) => set((state) => ({
        requests: state.requests.filter(r => r.id !== requestId),
        myRequests: state.myRequests.filter(r => r.id !== requestId)
      })),
      
      setMyRequests: (requests) => set({ myRequests: requests }),
      setCurrentRequest: (request) => set({ currentRequest: request }),
      setRequestDraft: (draft) => set({ requestDraft: draft }),
      clearRequestDraft: () => set({ requestDraft: {} }),

      // DATING STATE
      datingProfile: null,
      setDatingProfile: (profile) => set({ datingProfile: profile }),
      
      clearDatingProfile: () => set({ 
        datingProfile: null,
        currentProfile: null,
        profilesQueue: [],
        hasMoreProfiles: true,
      }),
      
      // Профили для свайпа
      currentProfile: null,
      profilesQueue: [],
      isLoadingProfiles: false,
      hasMoreProfiles: true,
      
      setCurrentProfile: (profile) => set({ currentProfile: profile }),
      setIsLoadingProfiles: (isLoading) => set({ isLoadingProfiles: isLoading }),
      setHasMoreProfiles: (hasMore) => set({ hasMoreProfiles: hasMore }),
      
      addProfilesToQueue: (profiles) => set((state) => ({
        profilesQueue: [...state.profilesQueue, ...profiles],
      })),
      
      removeCurrentProfile: () => set((state) => {
        const newCurrent = state.profilesQueue[0] || null;
        const newQueue = state.profilesQueue.slice(1);

        // PREFETCH: если осталось < 3 анкет
        if (newQueue.length < 3 && !state.isLoadingProfiles && state.hasMoreProfiles) {
          setTimeout(() => {
            const currentState = get();
            if (currentState.onPrefetchNeeded) {
              currentState.onPrefetchNeeded();
            }
          }, 0);
        }
        
        return {
          currentProfile: newCurrent,
          profilesQueue: newQueue,
        };
      }),
      
      clearProfilesQueue: () => set({ 
        profilesQueue: [], 
        currentProfile: null,
        hasMoreProfiles: true 
      }),
      
      onPrefetchNeeded: null,
      setOnPrefetchNeeded: (callback) => set({ onPrefetchNeeded: callback }),

      // Likes & Matches
      whoLikedMe: [],
      setWhoLikedMe: (usersOrUpdater) => set((state) => ({
        whoLikedMe: typeof usersOrUpdater === 'function' 
          ? usersOrUpdater(state.whoLikedMe) 
          : usersOrUpdater
      })),

      matches: [],
      setMatches: (matches) => set({ matches }),
      
      removeMatch: (userId) => set((state) => ({
        matches: state.matches.filter(m => m.user_id !== userId)
      })),

      // Dating модалки
      showLikesModal: false,
      showMatchModal: false,
      matchedUser: null,
      
      setShowLikesModal: (show) => set({ showLikesModal: show }),
      
      setShowMatchModal: (show, user = null) => set({
        showMatchModal: show,
        matchedUser: user,
      }),

      // Stats
      likesCount: 0,
      matchesCount: 0,
      
      updateDatingStats: (stats) => set({
        likesCount: stats.likes_count || 0,
        matchesCount: stats.matches_count || 0,
      }),

      // LIKES STATE
      likedPosts: {},
      
      setPostLiked: (postId, isLiked) => set((state) => ({
        likedPosts: { ...state.likedPosts, [postId]: isLiked }
      })),
      
      isPostLikedInStore: (postId) => {
        const state = get();
        return state.likedPosts[postId];
      },

      // MARKET STATE
      marketItems: [],
      myMarketItems: [],
      marketFavorites: [],
      currentMarketItem: null,
      editingMarketItem: null,
      
      marketFilters: {
        category: 'all',
        price_min: null,
        price_max: null,
        condition: null,
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
        sort: 'newest'
      },
      
      setMarketItems: (items) => set({ marketItems: items }),
      
      updateMarketItem: (updatedItem) => {
        set((state) => ({
          marketItems: state.marketItems.map(item => 
            item.id === updatedItem.id 
              ? { ...item, ...updatedItem }
              : item
          ),
          myMarketItems: state.myMarketItems.map(item =>
            item.id === updatedItem.id 
              ? { ...item, ...updatedItem }
              : item
          ),
          marketFavorites: state.marketFavorites.map(item =>
            item.id === updatedItem.id 
              ? { ...item, ...updatedItem }
              : item
          ),
          currentMarketItem: state.currentMarketItem?.id === updatedItem.id
            ? { ...state.currentMarketItem, ...updatedItem }
            : state.currentMarketItem
        }));
      },
      
      deleteMarketItem: (itemId) => set((state) => ({
        marketItems: state.marketItems.filter(item => item.id !== itemId),
        myMarketItems: state.myMarketItems.filter(item => item.id !== itemId),
        marketFavorites: state.marketFavorites.filter(item => item.id !== itemId)
      })),
      
      setEditingMarketItem: (item) => set({ editingMarketItem: item }),
      
      addMarketItem: (newItem) => set((state) => ({
        marketItems: [newItem, ...state.marketItems],
        myMarketItems: [newItem, ...state.myMarketItems]
      })),
      
      setMyMarketItems: (items) => set({ myMarketItems: items }),
      setMarketFavorites: (items) => set({ marketFavorites: items }),
      setCurrentMarketItem: (item) => set({ currentMarketItem: item }),
      
      setMarketFilters: (filters) => set((state) => ({
        marketFilters: { ...state.marketFilters, ...filters }
      })),
      
      clearMarketFilters: () => set({
        marketFilters: {
          category: 'all',
          price_min: null,
          price_max: null,
          condition: null,
          location: 'all',
          university: 'all',
          institute: 'all',
          campus_id: null,
          city: null,
          sort: 'newest'
        }
      }),
      
      toggleMarketFavoriteOptimistic: (itemId, isFavorited) => set((state) => ({
        marketItems: state.marketItems.map(item =>
          item.id === itemId 
            ? { 
                ...item, 
                is_favorited: isFavorited,
                favorites_count: item.favorites_count + (isFavorited ? 1 : -1)
              }
            : item
        ),
        myMarketItems: state.myMarketItems.map(item =>
          item.id === itemId 
            ? { 
                ...item, 
                is_favorited: isFavorited,
                favorites_count: item.favorites_count + (isFavorited ? 1 : -1)
              }
            : item
        ),
        currentMarketItem: state.currentMarketItem?.id === itemId
          ? {
              ...state.currentMarketItem,
              is_favorited: isFavorited,
              favorites_count: state.currentMarketItem.favorites_count + (isFavorited ? 1 : -1)
            }
          : state.currentMarketItem
      })),

      // TOASTS STATE
      toasts: [],

      // ADS STATE
      adPosts: [],          // список рекламных постов (для админки)
      feedAds: [],           // рекламные посты для подмешивания в ленту
      adOverviewStats: null, // сводная статистика
      
      setAdPosts: (ads) => set({ adPosts: ads }),
      setFeedAds: (ads) => set({ feedAds: ads }),
      setAdOverviewStats: (stats) => set({ adOverviewStats: stats }),

      // NOTIFICATION SETTINGS STATE
      showSettingsModal: false,
      setShowSettingsModal: (show) => set({ showSettingsModal: show }),

      // NOTIFICATIONS INBOX STATE
      showNotificationsScreen: false,
      unreadNotificationsCount: 0,
      setShowNotificationsScreen: (show) => set({ showNotificationsScreen: show }),
      setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),
      
      updateAdPost: (adId, updates) => set((state) => ({
        adPosts: state.adPosts.map(ad =>
          ad.id === adId ? { ...ad, ...updates } : ad
        )
      })),
      
      removeAdPost: (adId) => set((state) => ({
        adPosts: state.adPosts.filter(ad => ad.id !== adId)
      })),
      
      addAdPost: (newAd) => set((state) => ({
        adPosts: [newAd, ...state.adPosts]
      })),

      addToast: (toast) => set((state) => {
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        const newToast = {
          id,
          type: 'info',
          duration: 3000,
          ...toast,
        };
        
        const toasts = [...state.toasts, newToast];
        if (toasts.length > 3) {
          toasts.shift();
        }
        
        return { toasts };
      }),

      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),

      clearToasts: () => set({ toasts: [] }),

      // ACTIONS
      bootstrapAuth: async () => {
        set({ authStatus: 'loading' });
        const setRegisteredState = (user) => {
          set({
            user,
            isRegistered: true,
            authStatus: 'ready',
            showAuthModal: false,
          });
        };

        const setUnregisteredState = () => {
          set({
            user: {},
            likedPosts: {},
            isRegistered: false,
            authStatus: 'ready',
            showAuthModal: false,
          });
        };

        const loadUnreadCount = () => {
          import('./api').then(({ getUnreadNotificationsCount }) => {
            getUnreadNotificationsCount()
              .then(data => set({ unreadNotificationsCount: data.count || 0 }))
              .catch(() => {});
          });
        };

        const loadCurrentUserAfterToken = async () => {
          try {
            const me = await getCurrentUser();
            if (me) {
              setRegisteredState(me);
              loadUnreadCount();
            } else {
              setUnregisteredState();
            }
          } catch (error) {
            const status = error?.response?.status;
            const detail = String(error?.response?.data?.detail || '').toLowerCase();
            if (status === 404 && detail.includes('user not found')) {
              setUnregisteredState();
              return;
            }
            throw error;
          }
        };

        try {
          await refreshToken();
          await loadCurrentUserAfterToken();
          return;
        } catch (refreshError) {
          try {
            const loginData = await loginWithTelegram();
            setAccessToken(loginData.access_token);

            if (loginData.user) {
              setRegisteredState(loginData.user);
              loadUnreadCount();
            } else {
              setUnregisteredState();
            }
          } catch (loginError) {
            setAccessToken(null);
            set({
              user: {},
              likedPosts: {},
              isRegistered: false,
              authStatus: 'error',
              showAuthModal: false,
              activeTab: 'feed',
            });
          }
        }
      },

      startRegistration: () => set({
        showAuthModal: false,
        onboardingStep: 1,
        onboardingData: {}
      }),

      finishRegistration: async (data) => {
        try {
          await ensureAccessToken();

          const fullData = {
            ...useStore.getState().onboardingData,
            ...data
          };
          
          const user = await registerUser(fullData);

          set({
            user: user,
            isRegistered: true,
            authStatus: 'ready',
            showAuthModal: false,
            onboardingStep: 0,
            onboardingData: {}
          });
          
          get().addToast({
            type: 'success',
            message: 'Добро пожаловать! 🎉',
          });
        } catch (error) {
          console.error('❌ Ошибка регистрации:', error);
          const detail = String(error?.response?.data?.detail || '');
          const message = detail.toLowerCase().includes('telegram auth data expired')
            ? 'Сессия Telegram истекла. Закройте и заново откройте Mini App.'
            : (detail || error.message || 'Не удалось зарегистрироваться. Попробуйте снова.');
          get().addToast({
            type: 'error',
            message,
          });
        }
      },
    }),

    {
      name: 'campus-storage',
      partialize: (state) => ({
        isRegistered: state.isRegistered,
        user: state.user,
        datingProfile: state.datingProfile,
        activeTab: state.activeTab,
        feedMode: state.feedMode,
        feedSubTab: state.feedSubTab,
        likedPosts: state.likedPosts,
        requestDraft: state.requestDraft,
        marketFilters: state.marketFilters,
        postsFilters: state.postsFilters,
        requestsFilters: state.requestsFilters,
        // НЕ персистим moderationRole — запрашиваем с сервера при каждом входе
      }),
    }
  )
);

export default useStore;
