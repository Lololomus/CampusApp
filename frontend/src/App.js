import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import PostDetail from './components/PostDetail';
import CreatePost from './components/CreatePost';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import Profile from './components/Profile';
import Search from './components/Search';
import UserPosts from './components/UserPosts';
import './App.css';

function App() {
  const { 
    activeTab, 
    viewPostId, 
    showCreateModal,
    onboardingStep,
    showUserPosts
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    // Если открыт детальный просмотр поста – он всегда главный
    if (viewPostId) {
      return <PostDetail />;
    }

    // Экран "Мои посты"
    if (showUserPosts) {
      return <UserPosts />;
    }

    // Остальные экраны...
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'search':
        return <Search />;
      case 'profile':
        return <Profile />;
      default:
        return <Feed />;
    }
  };
  
  // если идёт онбординг - показываем только его
  if (onboardingStep > 0) {
    return (
      <div style={styles.app}>
        <Onboarding />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {renderContent()}
      {!viewPostId && !showUserPosts && <Navigation />}
      
      {/* Модальные окна */}
      {showCreateModal && <CreatePost />}
      <AuthModal />
    </div>
  );
}

function PlaceholderScreen({ title }) {
  return (
    <div style={styles.placeholder}>
      <h2>{title}</h2>
      <p style={{ color: '#999' }}>В разработке...</p>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    paddingBottom: '80px'
  }
};

export default App;