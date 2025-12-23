import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUser } from './api';

const API_URL = 'http://localhost:8000';

export const useStore = create(
  persist(
    (set) => ({
      // Auth state
      isRegistered: false,
      user: {},
      setUser: (user) => set({ user, isRegistered: true }),
      logout: () => set({ user: {}, isRegistered: false }),


      // Navigation state
      activeTab: 'feed',
      feedMode: 'global',
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFeedMode: (mode) => set({ feedMode: mode }),


      // Modal states
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


      // Onboarding state
      onboardingStep: 0,
      onboardingData: {},
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setOnboardingData: (data) => set((state) => ({
        onboardingData: { ...state.onboardingData, ...data }
      })),


      // Posts state (НЕ СОХРАНЯЕМ В LOCALSTORAGE!)
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


      // ===== DATING STATE =====
      datingMode: 'dating', // 'dating' | 'study' | 'help' | 'hangout'
      setDatingMode: (mode) => set({ datingMode: mode }),

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

      // Modal states
      showLikesModal: false,
      showMatchModal: false,
      matchedUser: null,
      showResponseModal: false,
      setShowLikesModal: (show) => set({ showLikesModal: show }),
      setShowMatchModal: (show, user = null) => set({
        showMatchModal: show,
        matchedUser: user,
      }),
      setShowResponseModal: (show) => set({ showResponseModal: show }),

      // Stats
      likesCount: 0,
      responsesCount: 0,
      updateDatingStats: (stats) => set({
        likesCount: stats.likes_count || 0,
        responsesCount: stats.responses_count || 0,
      }),


      // Actions
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
        datingMode: state.datingMode, // ← сохраняем выбранный режим
      }),
    }
  )
);

export default useStore;