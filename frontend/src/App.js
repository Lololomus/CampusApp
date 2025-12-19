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
import Search from './components/Search'; // НОВОЕ
import './App.css';

function App() {
  const { 
    activeTab, 
    viewPostId, 
    showCreateModal,
    onboardingStep 
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    // Если открыт детальный просмотр поста
    if (viewPostId) {
      return <PostDetail />;
    }

    // Рендер экранов по активному табу
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'search':
        return <Search />; // ИЗМЕНЕНО
      case 'messages':
        return <PlaceholderScreen title="Сообщения" />;
      case 'profile':
        return <Profile />;
      default:
        return <Feed />;
    }
  };

  return (
    <div style={styles.app}>
      {renderContent()}
      <Navigation />
      
      {/* Модальные окна */}
      {showCreateModal && <CreatePost />}
      {onboardingStep > 0 && <Onboarding />}
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