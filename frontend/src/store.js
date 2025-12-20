import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUser } from './api';

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
      setShowAuthModal: (show) => set({ showAuthModal: show }),
      setShowCreateModal: (show) => set({ showCreateModal: show }),
      setViewPostId: (id) => set({ viewPostId: id }),

      // Onboarding state
      onboardingStep: 0,
      onboardingData: {},
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setOnboardingData: (data) => set((state) => ({
        onboardingData: { ...state.onboardingData, ...data }
      })),

      // Posts state
      posts: [],
      setPosts: (posts) => set({ posts }),
      addNewPost: (newPost) => set((state) => ({
        posts: [newPost, ...state.posts]
      })),

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
      name: 'campus-storage', // ← Имя в localStorage
      partialPersist: (state) => ({
        // Сохраняем только важные поля
        isRegistered: state.isRegistered,
        user: state.user,
        activeTab: state.activeTab,
        feedMode: state.feedMode,
      }),
    }
  )
);