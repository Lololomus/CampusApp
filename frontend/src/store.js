// ===== 📄 ФАЙЛ: src/store.js =====

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUser } from './api';

const API_URL = 'http://localhost:8000';

export const useStore = create(
  persist(
    (set, get) => ({
      // ===== AUTH STATE =====
      isRegistered: false,
      user: {},
      setUser: (user) => set({ user, isRegistered: true }),
      logout: () => set({ user: {}, isRegistered: false }),

      // ===== NAVIGATION STATE =====
      activeTab: 'feed', // 'feed' | 'search' | 'people' | 'profile' | 'market'
      feedMode: 'global', // 'global' | 'my-university' | 'my-institute'
      feedSubTab: 'posts', // 'posts' | 'requests' (ДЛЯ ТАБОВ В ГЛАВНОЙ)
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFeedMode: (mode) => set({ feedMode: mode }),
      setFeedSubTab: (tab) => set({ feedSubTab: tab }),

      // ===== MODAL STATES =====
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

      // My posts screen
      showUserPosts: false,
      setShowUserPosts: (show) => set({ showUserPosts: show }),

      // ===== ONBOARDING STATE =====
      onboardingStep: 0,
      onboardingData: {},
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setOnboardingData: (data) => set((state) => ({
        onboardingData: { ...state.onboardingData, ...data }
      })),

      // ===== POSTS STATE (НЕ СОХРАНЯЕМ В LOCALSTORAGE!) =====
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

      // ===== REQUESTS STATE (ОБНОВЛЕНО) =====
      requests: [], // Лента запросов (текущая категория)
      myRequests: [], // Мои запросы
      currentRequest: null, // Текущий открытый запрос (для модалки)
      requestDraft: {}, // Черновик запроса (автосохранение)
      
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

      // ===== DATING STATE (БЕЗ ДУБЛЕЙ) =====
      
      // Dating Profile
      datingProfile: null, // null = не зарегистрирован в знакомствах
      setDatingProfile: (profile) => set({ datingProfile: profile }),
      
      // Профили (карточки для свайпа)
      currentProfile: null,
      profilesQueue: [],
      isLoadingProfiles: false, // ✅ NEW: флаг загрузки
      hasMoreProfiles: true, // ✅ NEW: есть ли ещё анкеты
      
      setCurrentProfile: (profile) => set({ currentProfile: profile }),
      
      setIsLoadingProfiles: (isLoading) => set({ isLoadingProfiles: isLoading }),
      
      setHasMoreProfiles: (hasMore) => set({ hasMoreProfiles: hasMore }),
      
      addProfilesToQueue: (profiles) => set((state) => ({
        profilesQueue: [...state.profilesQueue, ...profiles],
      })),
      
      // ✅ УЛУЧШЕНО: removeCurrentProfile с prefetch логикой
      removeCurrentProfile: () => set((state) => {
        console.log('🔄 removeCurrentProfile вызван');
        console.log('📊 До: currentProfile =', state.currentProfile?.id, ', queue length =', state.profilesQueue.length);
        
        const newCurrent = state.profilesQueue[0] || null;
        const newQueue = state.profilesQueue.slice(1);
        
        console.log('📊 После: newCurrent =', newCurrent?.id, ', newQueue length =', newQueue.length);
        
        // ✅ PREFETCH: если осталось < 3 анкет и не идёт загрузка
        if (newQueue.length < 3 && !state.isLoadingProfiles && state.hasMoreProfiles) {
          console.log('⚡ PREFETCH TRIGGERED: осталось', newQueue.length, 'анкет');
          // Вызываем loadMore через callback (будет реализовано в DatingFeed.js)
          // Здесь только устанавливаем флаг
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
      
      // ✅ NEW: Callback для prefetch (устанавливается в DatingFeed.js)
      onPrefetchNeeded: null,
      setOnPrefetchNeeded: (callback) => set({ onPrefetchNeeded: callback }),

      // Likes & Matches
      whoLikedMe: [],
      setWhoLikedMe: (users) => set({ whoLikedMe: users }),
      
      myMatches: [],
      setMyMatches: (matches) => set({ myMatches: matches }),

      // Dating Modal states
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

      // ===== LIKES STATE =====
      likedPosts: {},  // { 1: true, 5: true, 10: false }
      
      setPostLiked: (postId, isLiked) => set((state) => ({
        likedPosts: { ...state.likedPosts, [postId]: isLiked }
      })),
      
      isPostLikedInStore: (postId) => {
        const state = get();
        return state.likedPosts[postId];
      },

      // ===== MARKET STATE =====
      marketItems: [], // Текущая лента товаров
      myMarketItems: [], // Мои объявления
      marketFavorites: [], // Избранные товары
      currentMarketItem: null, // Открытый товар (детальная модалка)
      editingMarketItem: null, // Товар, который редактируется
      
      marketFilters: {
        category: 'all',
        price_min: null,
        price_max: null,
        condition: null,
        university: 'all',
        institute: 'all',
        sort: 'newest'
      },
      
      // Market Actions
      setMarketItems: (items) => set({ marketItems: items }),
      
      setEditingMarketItem: (item) => set({ editingMarketItem: item }),

      addMarketItem: (newItem) => set((state) => ({
        marketItems: [newItem, ...state.marketItems],
        myMarketItems: [newItem, ...state.myMarketItems]
      })),
      
      updateMarketItem: (itemId, updates) => set((state) => ({
        marketItems: state.marketItems.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
        myMarketItems: state.myMarketItems.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
        marketFavorites: state.marketFavorites.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        )
      })),
      
      deleteMarketItem: (itemId) => set((state) => ({
        marketItems: state.marketItems.filter(item => item.id !== itemId),
        myMarketItems: state.myMarketItems.filter(item => item.id !== itemId),
        marketFavorites: state.marketFavorites.filter(item => item.id !== itemId)
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
      
      // Оптимистичное обновление избранного
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

      // ===== ACTIONS =====
      
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
        activeTab: state.activeTab,
        feedMode: state.feedMode,
        feedSubTab: state.feedSubTab,
        likedPosts: state.likedPosts,
        requestDraft: state.requestDraft,
        marketFilters: state.marketFilters,
      }),
    }
  )
);

export default useStore;