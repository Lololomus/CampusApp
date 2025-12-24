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
      activeTab: 'feed', // 'feed' | 'search' | 'people' | 'profile'
      feedMode: 'global', // 'global' | 'my-university' | 'my-institute'
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFeedMode: (mode) => set({ feedMode: mode }),


      // ===== MODAL STATES =====
      showAuthModal: false,
      showCreateModal: false,
      viewPostId: null,
      showEditModal: false,
      setShowAuthModal: (show) => set({ showAuthModal: show }),
      setShowCreateModal: (show) => set({ showCreateModal: show }),
      setViewPostId: (id) => set({ viewPostId: id }),
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


      // ✅ НОВОЕ: Синхронизация между PostDetail и Feed
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


      // ===== REQUESTS STATE (НОВОЕ) =====
      myRequests: [],
      setMyRequests: (requests) => set({ myRequests: requests }),
      addNewRequest: (newRequest) => set((state) => ({
        myRequests: [newRequest, ...state.myRequests]
      })),
      removeRequest: (requestId) => set((state) => ({
        myRequests: state.myRequests.filter(r => r.id !== requestId)
      })),


      // ===== DATING STATE =====
      datingMode: 'dating', // 'dating' | 'study' | 'help' | 'hangout'
      setDatingMode: (mode) => set({ datingMode: mode }),


      // Профили (карточки)
      currentProfile: null,
      profilesQueue: [],
      setCurrentProfile: (profile) => set({ currentProfile: profile }),
      addProfilesToQueue: (profiles) => set((state) => ({
        profilesQueue: [...state.profilesQueue, ...profiles],
      })),
      removeCurrentProfile: () => set((state) => {
        console.log('🔄 removeCurrentProfile вызван');
        console.log('📊 До: currentProfile =', state.currentProfile?.id, ', queue length =', state.profilesQueue.length);
        
        const newCurrent = state.profilesQueue[0] || null;
        const newQueue = state.profilesQueue.slice(1);
        
        console.log('📊 После: newCurrent =', newCurrent?.id, ', newQueue length =', newQueue.length);
        
        return {
          currentProfile: newCurrent,
          profilesQueue: newQueue,
        };
      }),
      clearProfilesQueue: () => set({ profilesQueue: [], currentProfile: null }),


      // Likes & Matches
      whoLikedMe: [],
      setWhoLikedMe: (users) => set({ whoLikedMe: users }),
      myMatches: [],
      setMyMatches: (matches) => set({ myMatches: matches }),


      // Dating Modal states
      showLikesModal: false,
      showMatchModal: false,
      matchedUser: null,
      showResponseModal: false, // Модалка для отклика на request
      currentRequestForResponse: null, // Запрос на который откликаемся
      
      setShowLikesModal: (show) => set({ showLikesModal: show }),
      setShowMatchModal: (show, user = null) => set({
        showMatchModal: show,
        matchedUser: user,
      }),
      setShowResponseModal: (show, request = null) => set({ 
        showResponseModal: show,
        currentRequestForResponse: request 
      }),


      // Stats
      likesCount: 0,
      matchesCount: 0,
      responsesCount: 0,
      updateDatingStats: (stats) => set({
        likesCount: stats.likes_count || 0,
        matchesCount: stats.matches_count || 0,
        responsesCount: stats.responses_count || 0,
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
        datingMode: state.datingMode,
        likedPosts: state.likedPosts,
      }),
    }
  )
);


export default useStore;