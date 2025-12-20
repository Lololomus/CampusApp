import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { useStore } from '../store';
import PostCard from './PostCard';
import { hapticFeedback } from '../utils/telegram';

function Search() {
  const { posts, setViewPostId } = useStore();
  
  // Состояние поиска
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedUni, setSelectedUni] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filteredPosts, setFilteredPosts] = useState([]);

  // Категории
  const categories = [
    { id: 'all', label: 'Все', color: '#666' },
    { id: 'study', label: 'Учёба', color: '#3b82f6' },
    { id: 'help', label: 'Помощь', color: '#10b981' },
    { id: 'hangout', label: 'Движ', color: '#f59e0b' },
    { id: 'dating', label: 'Знакомства', color: '#ec4899' }
  ];

  const universities = ['all', 'МГСУ', 'РУК'];
  const courses = ['all', 1, 2, 3, 4, 5, 6];

  // Фильтрация постов
  useEffect(() => {
    let results = [...posts];

    // Поиск по тексту
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(post => {
        // Безопасная проверка всех полей
        const title = post.title?.toLowerCase() || '';
        const body = post.body?.toLowerCase() || '';
        const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
        const authorName = typeof post.author === 'string' 
          ? post.author.toLowerCase() 
          : post.author?.name?.toLowerCase() || '';

        return title.includes(query) || 
              body.includes(query) || 
              tags.includes(query) || 
              authorName.includes(query);
      });
    }

    // Фильтр по категории
    if (selectedCategory !== 'all') {
      results = results.filter(post => post.category === selectedCategory);
    }

    // Фильтр по ВУЗу
    if (selectedUni !== 'all') {
      results = results.filter(post => 
        post.university === selectedUni || post.uni === selectedUni
      );
    }

    // Фильтр по курсу
    if (selectedCourse !== 'all') {
      results = results.filter(post => post.course === selectedCourse);
    }

    setFilteredPosts(results);
  }, [searchQuery, selectedCategory, selectedUni, selectedCourse, posts]);

  // Очистка поиска
  const handleClearSearch = () => {
    hapticFeedback('light');
    setSearchQuery('');
  };

  // Сброс всех фильтров
  const handleResetFilters = () => {
    hapticFeedback('medium');
    setSelectedCategory('all');
    setSelectedUni('all');
    setSelectedCourse('all');
    setSearchQuery('');
  };

  const handlePostClick = (postId) => {
    hapticFeedback('light');
    setViewPostId(postId);
  };

  const toggleFilters = () => {
    hapticFeedback('light');
    setShowFilters(!showFilters);
  };

  // Проверка активности фильтров
  const hasActiveFilters = 
    selectedCategory !== 'all' || 
    selectedUni !== 'all' || 
    selectedCourse !== 'all';

  return (
    <div style={styles.container}>
      
      {/* Поисковая строка */}
      <div style={styles.searchBar}>
        <div style={styles.searchInputWrapper}>
          <SearchIcon size={20} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Поиск постов, людей, тегов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={handleClearSearch} style={styles.clearButton}>
              <X size={18} />
            </button>
          )}
        </div>

        <button 
          onClick={toggleFilters} 
          style={{
            ...styles.filterButton,
            backgroundColor: hasActiveFilters ? '#8774e1' : '#1e1e1e'
          }}
        >
          <Filter size={20} />
        </button>
      </div>

      {/* Быстрые фильтры - категории */}
      <div style={styles.quickFilters}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              hapticFeedback('light');
              setSelectedCategory(cat.id);
            }}
            style={{
              ...styles.quickFilterButton,
              backgroundColor: selectedCategory === cat.id ? cat.color : '#1e1e1e',
              borderColor: selectedCategory === cat.id ? cat.color : '#333',
              color: selectedCategory === cat.id ? '#fff' : '#999'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Расширенные фильтры */}
      {showFilters && (
        <div style={styles.advancedFilters}>
          <div style={styles.filterRow}>
            <label style={styles.filterLabel}>ВУЗ</label>
            <select
              value={selectedUni}
              onChange={(e) => {
                hapticFeedback('light');
                setSelectedUni(e.target.value);
              }}
              style={styles.filterSelect}
            >
              <option value="all">Все вузы</option>
              {universities.slice(1).map(uni => (
                <option key={uni} value={uni}>{uni}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterRow}>
            <label style={styles.filterLabel}>Курс</label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                hapticFeedback('light');
                setSelectedCourse(e.target.value === 'all' ? 'all' : Number(e.target.value));
              }}
              style={styles.filterSelect}
            >
              <option value="all">Любой курс</option>
              {courses.slice(1).map(course => (
                <option key={course} value={course}>{course} курс</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button onClick={handleResetFilters} style={styles.resetButton}>
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}

      {/* Результаты поиска */}
      <div style={styles.results}>
        {/* Заголовок результатов */}
        {(searchQuery || hasActiveFilters) && (
          <div style={styles.resultsHeader}>
            <span style={styles.resultsCount}>
              {filteredPosts.length === 0 
                ? 'Ничего не найдено' 
                : `Найдено: ${filteredPosts.length}`}
            </span>
          </div>
        )}

        {/* Список постов */}
        {filteredPosts.length > 0 ? (
          <div style={styles.postsList}>
            {filteredPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onClick={() => handlePostClick(post.id)}
              />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            {searchQuery || hasActiveFilters ? (
              <>
                <div style={styles.emptyIcon}>🔍</div>
                <p style={styles.emptyText}>Ничего не найдено</p>
                <p style={styles.emptyHint}>
                  Попробуйте изменить запрос или сбросить фильтры
                </p>
              </>
            ) : (
              <>
                <div style={styles.emptyIcon}>💡</div>
                <p style={styles.emptyText}>Начните поиск</p>
                <p style={styles.emptyHint}>
                  Введите ключевые слова или выберите категорию
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#121212',
    minHeight: '100vh',
    paddingBottom: '80px'
  },
  
  // Search bar
  searchBar: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid #333',
    position: 'sticky',
    top: 0,
    backgroundColor: '#121212',
    zIndex: 10
  },
  searchInputWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: '#666',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 48px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  clearButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  filterButton: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    border: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 0.2s'
  },

  // Quick filters
  quickFilters: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    overflowX: 'auto',
    borderBottom: '1px solid #333'
  },
  quickFilterButton: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s'
  },

  // Advanced filters
  advancedFilters: {
    padding: '16px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333'
  },
  filterRow: {
    marginBottom: '12px'
  },
  filterLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  filterSelect: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer'
  },
  resetButton: {
    width: '100%',
    padding: '10px',
    marginTop: '12px',
    borderRadius: '8px',
    border: '1px solid #ff4444',
    backgroundColor: 'transparent',
    color: '#ff4444',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },

  // Results
  results: {
    padding: '16px'
  },
  resultsHeader: {
    marginBottom: '16px'
  },
  resultsCount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  postsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    textAlign: 'center',
    padding: '32px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
    maxWidth: '280px'
  }
};

export default Search;