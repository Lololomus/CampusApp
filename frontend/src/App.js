import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import PostDetail from './components/PostDetail';
import CreatePost from './components/CreatePost';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import EditProfile from './components/EditProfile';
import Profile from './components/Profile';
import Search from './components/Search';
import UserPosts from './components/UserPosts';
import DatingFeed from './components/dating/DatingFeed';
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
    // Если открыт детальный просмотр поста
    if (viewPostId) {
      return <PostDetail />;
    }

    // Экран "Мои посты"
    if (showUserPosts) {
      return <UserPosts />;
    }

    // Остальные экраны
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'search':
        return <Search />;
      case 'people':
        return <DatingFeed />;
      case 'profile':
        return <Profile />;
      default:
        return <Feed />;
    }
  };
  
  // Если идёт онбординг - показываем только его
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
      <Navigation />
      
      {/* Модальные окна */}
      {showCreateModal && <CreatePost />}
      <AuthModal />
      <EditProfile />
    </div>
  );
}


const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
};


export default App;