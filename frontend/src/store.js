import { create } from 'zustand';
import { MOCK_USER } from './types';

// Zustand store для управления состоянием приложения
export const useStore = create((set) => ({
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

  // НОВОЕ: Onboarding state
  onboardingStep: 0, // 0 = выключен, 1-4 = шаги
  onboardingData: {}, // Временные данные регистрации
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

  finishRegistration: (data) => set((state) => ({
    user: { ...MOCK_USER, ...state.onboardingData, ...data },
    isRegistered: true,
    showAuthModal: false,
    onboardingStep: 0,
    onboardingData: {}
  })),
}));