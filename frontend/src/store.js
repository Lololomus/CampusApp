import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUser } from './api';

const API_URL = 'http://localhost:8000';

export const useStore = create(
  persist(
    (set, get) => ({
      // AUTH STATE
      isRegistered: false,
      user: {},
      
      setUser: (user) => {
        const state = get();
        
        if (!user) {
          // Logout — очистить всё
          set({ 
            user: {}, 
            datingProfile: null,
            currentProfile: null,
            profilesQueue: [],
            isRegistered: false 
          });
        } else {
          set({ user, isRegistered: true });
          
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
        }
      },
      
      logout: () => set({ 
        user: {}, 
        datingProfile: null,
        currentProfile: null,
        profilesQueue: [],
        isRegistered: false 
      }),

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
        tags: [],
        dateRange: 'all',
        sort: 'newest',
      },
      
      requestsFilters: {
        location: 'all',
        university: 'all',
        institute: 'all',
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
        console.log('🔄 removeCurrentProfile вызван');
        console.log('📊 До: currentProfile =', state.currentProfile?.id, ', queue length =', state.profilesQueue.length);
        
        const newCurrent = state.profilesQueue[0] || null;
        const newQueue = state.profilesQueue.slice(1);
        
        console.log('📊 После: newCurrent =', newCurrent?.id, ', newQueue length =', newQueue.length);
        
        // PREFETCH: если осталось < 3 анкет
        if (newQueue.length < 3 && !state.isLoadingProfiles && state.hasMoreProfiles) {
          console.log('⚡ PREFETCH TRIGGERED: осталось', newQueue.length, 'анкет');
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
        university: 'all',
        institute: 'all',
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
          university: 'all',
          institute: 'all',
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
      startRegistration: () => set({
        showAuthModal: false,
        onboardingStep: 1,
        onboardingData: {}
      }),

      finishRegistration: async (data) => {
        try {
          const fullData = {
            ...useStore.getState().onboardingData,
            ...data
          };
          
          console.log('📤 Отправляем данные:', fullData);
          const user = await registerUser(fullData);
          console.log('✅ Регистрация успешна:', user);

          set({
            user: user,
            isRegistered: true,
            showAuthModal: false,
            onboardingStep: 0,
            onboardingData: {}
          });
        } catch (error) {
          console.error('❌ Ошибка регистрации:', error);
          alert('Не удалось зарегистрироваться. Попробуйте снова.');
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
      }),
    }
  )
);

export default useStore;