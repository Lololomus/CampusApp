// ===== 📄 ФАЙЛ: frontend/src/components/moderation/CampusManager.js =====

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, MapPin, Building2, UserCheck, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { getUnboundUsers, bindUserToCampus } from '../../api';
import theme from '../../theme';
import { CAMPUSES, searchCampuses, getCampusById } from '../../constants/universityData';


function CampusManager({ isAdmin = false }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [bindingUserId, setBindingUserId] = useState(null); // какому юзеру выбираем кампус
  const [campusSearch, setCampusSearch] = useState('');
  const [processing, setProcessing] = useState(null);

  // Загрузка непривязанных
  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const data = await getUnboundUsers(query, 100, 0);
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('CampusManager load error:', err);
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Поиск с дебаунсом
  useEffect(() => {
    const timer = setTimeout(() => load(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, load]);

  // Фильтрованные кампусы для привязки
  const filteredCampuses = useMemo(
    () => searchCampuses(campusSearch),
    [campusSearch]
  );

  // Группировка по custom_university для удобства
  const grouped = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const key = (u.custom_university || u.university || 'Без ВУЗа').trim();
      if (!map[key]) map[key] = { label: key, city: u.custom_city || '', users: [] };
      map[key].users.push(u);
    });
    // Сортируем: больше юзеров — выше
    return Object.values(map).sort((a, b) => b.users.length - a.users.length);
  }, [users]);

  // Привязка юзера
  const handleBind = async (userId, campus) => {
    hapticFeedback('medium');
    setProcessing(userId);
    try {
      await bindUserToCampus(userId, campus.id, campus.university, campus.city);
      // Убираем из списка
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
      setBindingUserId(null);
      setCampusSearch('');
      toast.success('Привязан к кампусу');
    } catch (err) {
      console.error('Bind error:', err);
      toast.error('Ошибка привязки');
    } finally {
      setProcessing(null);
    }
  };

  // Привязка всей группы
  const handleBindGroup = async (group, campus) => {
    hapticFeedback('heavy');
    let success = 0;
    for (const u of group.users) {
      try {
        await bindUserToCampus(u.id, campus.id, campus.university, campus.city);
        success++;
      } catch (err) {
        console.error(`Bind error for user ${u.id}:`, err);
      }
    }
    toast.success(`Привязано ${success}/${group.users.length}`);
    load(searchQuery);
    setBindingUserId(null);
    setCampusSearch('');
  };

  return (
    <div style={styles.section}>
      {/* Заголовок + счётчик */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>
          Непривязанные ({total})
        </span>
        <button style={styles.refreshBtn} onClick={() => load(searchQuery)}>
          <RefreshCw size={14} color={theme.colors.textSecondary} />
        </button>
      </div>

      {/* Поиск */}
      <div style={styles.searchBar}>
        <Search size={16} color={theme.colors.textTertiary} />
        <input
          style={styles.searchInput}
          placeholder="Поиск по ВУЗу, имени, городу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button style={styles.clearBtn} onClick={() => setSearchQuery('')}>
            <X size={14} color={theme.colors.textTertiary} />
          </button>
        )}
      </div>

      {/* Список */}
      {loading ? (
        <div style={styles.loading}><div style={styles.spinner} /></div>
      ) : users.length === 0 ? (
        <div style={styles.empty}>
          {searchQuery ? 'Ничего не найдено' : 'Все пользователи привязаны 🎉'}
        </div>
      ) : (
        <div style={styles.groupList}>
          {grouped.map((group) => (
            <GroupCard
              key={group.label}
              group={group}
              isAdmin={isAdmin}
              bindingUserId={bindingUserId}
              setBindingUserId={setBindingUserId}
              campusSearch={campusSearch}
              setCampusSearch={setCampusSearch}
              filteredCampuses={filteredCampuses}
              processing={processing}
              onBind={handleBind}
              onBindGroup={handleBindGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ==============================
// Карточка группы (по ВУЗу)
// ==============================
function GroupCard({
  group, isAdmin, bindingUserId, setBindingUserId,
  campusSearch, setCampusSearch, filteredCampuses,
  processing, onBind, onBindGroup,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showGroupBind, setShowGroupBind] = useState(false);

  const displayUsers = expanded ? group.users : group.users.slice(0, 3);

  return (
    <div style={styles.groupCard}>
      {/* Заголовок группы */}
      <div
        style={styles.groupHeader}
        onClick={() => { hapticFeedback('light'); setExpanded(!expanded); }}
      >
        <div style={{ flex: 1 }}>
          <div style={styles.groupName}>
            <Building2 size={14} color={theme.colors.primary} />
            <span>{group.label}</span>
            <span style={styles.groupCount}>({group.users.length})</span>
          </div>
          {group.city && (
            <div style={styles.groupCity}>
              <MapPin size={11} color={theme.colors.textTertiary} />
              <span>{group.city}</span>
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={16} color={theme.colors.textTertiary} /> : <ChevronDown size={16} color={theme.colors.textTertiary} />}
      </div>

      {/* Кнопка "Привязать всех" */}
      {group.users.length > 1 && (
        <button
          style={styles.bindAllBtn}
          onClick={(e) => {
            e.stopPropagation();
            hapticFeedback('light');
            setShowGroupBind(!showGroupBind);
            setBindingUserId(null);
          }}
        >
          <UserCheck size={13} />
          <span>Привязать всех ({group.users.length})</span>
        </button>
      )}

      {/* Групповая привязка — выбор кампуса */}
      {showGroupBind && (
        <CampusPicker
          campusSearch={campusSearch}
          setCampusSearch={setCampusSearch}
          filteredCampuses={filteredCampuses}
          onSelect={(campus) => {
            setShowGroupBind(false);
            onBindGroup(group, campus);
          }}
          onCancel={() => setShowGroupBind(false)}
        />
      )}

      {/* Юзеры */}
      {displayUsers.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          isBinding={bindingUserId === user.id}
          isProcessing={processing === user.id}
          campusSearch={campusSearch}
          setCampusSearch={setCampusSearch}
          filteredCampuses={filteredCampuses}
          onStartBind={() => {
            hapticFeedback('light');
            setBindingUserId(user.id);
            setShowGroupBind(false);
          }}
          onBind={(campus) => onBind(user.id, campus)}
          onCancel={() => setBindingUserId(null)}
        />
      ))}

      {/* "Показать ещё" */}
      {!expanded && group.users.length > 3 && (
        <button
          style={styles.showMoreBtn}
          onClick={() => { hapticFeedback('light'); setExpanded(true); }}
        >
          + ещё {group.users.length - 3}
        </button>
      )}
    </div>
  );
}


// ==============================
// Строка юзера
// ==============================
function UserRow({
  user, isBinding, isProcessing,
  campusSearch, setCampusSearch, filteredCampuses,
  onStartBind, onBind, onCancel,
}) {
  return (
    <div style={styles.userRow}>
      <div style={styles.userInfo}>
        {user.avatar ? (
          <img src={user.avatar} style={styles.userAvatar} alt="" />
        ) : (
          <div style={styles.userAvatarPlaceholder}>
            {user.name?.charAt(0) || '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.userName}>{user.name || `#${user.telegram_id}`}</div>
          <div style={styles.userMeta}>
            {[
              user.institute,
              user.course ? `${user.course} курс` : null,
            ].filter(Boolean).join(' · ') || 'Без факультета'}
          </div>
        </div>

        {!isBinding && (
          <button
            style={styles.bindBtn}
            onClick={onStartBind}
            disabled={isProcessing}
          >
            {isProcessing ? '...' : <UserCheck size={15} />}
          </button>
        )}
      </div>

      {/* Выбор кампуса для привязки */}
      {isBinding && (
        <CampusPicker
          campusSearch={campusSearch}
          setCampusSearch={setCampusSearch}
          filteredCampuses={filteredCampuses}
          onSelect={onBind}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}


// ==============================
// Пикер кампуса (переиспользуемый)
// ==============================
function CampusPicker({ campusSearch, setCampusSearch, filteredCampuses, onSelect, onCancel }) {
  return (
    <div style={styles.pickerWrap}>
      <div style={styles.pickerSearch}>
        <Search size={14} color={theme.colors.textTertiary} />
        <input
          style={styles.pickerInput}
          placeholder="Найти кампус..."
          value={campusSearch}
          onChange={(e) => setCampusSearch(e.target.value)}
          autoFocus
        />
        <button style={styles.clearBtn} onClick={onCancel}>
          <X size={14} color={theme.colors.textTertiary} />
        </button>
      </div>

      <div style={styles.campusList}>
        {filteredCampuses.slice(0, 8).map((campus) => (
          <button
            key={campus.id}
            style={styles.campusOption}
            onClick={() => { hapticFeedback('medium'); onSelect(campus); }}
          >
            <div style={styles.campusOptionName}>{campus.short}</div>
            <div style={styles.campusOptionCity}>{campus.city}</div>
          </button>
        ))}
        {filteredCampuses.length === 0 && (
          <div style={styles.pickerEmpty}>Нет кампусов</div>
        )}
      </div>
    </div>
  );
}


// ==============================
// Стили
// ==============================
const styles = {
  section: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: theme.colors.text },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },

  searchBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 10,
    background: theme.colors.card, border: `1px solid ${theme.colors.border}`,
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: theme.colors.text, fontSize: 14, fontFamily: 'inherit',
  },
  clearBtn: {
    background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex',
  },

  loading: { display: 'flex', justifyContent: 'center', padding: '40px 0' },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    textAlign: 'center', padding: '30px', fontSize: 14,
    color: theme.colors.textSecondary,
  },

  groupList: { display: 'flex', flexDirection: 'column', gap: 8 },

  // Group card
  groupCard: {
    background: theme.colors.card, borderRadius: 14,
    border: `1px solid ${theme.colors.borderLight}`, overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', cursor: 'pointer',
  },
  groupName: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 14, fontWeight: 700, color: theme.colors.text,
  },
  groupCount: { fontSize: 12, fontWeight: 500, color: theme.colors.textTertiary },
  groupCity: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: theme.colors.textTertiary, marginTop: 2,
  },

  bindAllBtn: {
    display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
    margin: '0 14px 8px', padding: '7px 12px', borderRadius: 8,
    background: `${theme.colors.primary}15`, border: `1px solid ${theme.colors.primary}40`,
    color: theme.colors.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: 'calc(100% - 28px)',
  },

  showMoreBtn: {
    width: '100%', padding: '8px', border: 'none',
    background: theme.colors.bgSecondary, color: theme.colors.textSecondary,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },

  // User row
  userRow: {
    borderTop: `1px solid ${theme.colors.borderLight}`,
  },
  userInfo: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
  },
  userAvatar: {
    width: 34, height: 34, borderRadius: 10, objectFit: 'cover', flexShrink: 0,
  },
  userAvatarPlaceholder: {
    width: 34, height: 34, borderRadius: 10,
    background: theme.colors.bgSecondary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, color: theme.colors.textTertiary, flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: theme.colors.text },
  userMeta: {
    fontSize: 11, color: theme.colors.textTertiary,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  bindBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: `${theme.colors.primary}15`, border: `1px solid ${theme.colors.primary}40`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, color: theme.colors.primary,
  },

  // Campus picker
  pickerWrap: {
    padding: '0 14px 10px',
  },
  pickerSearch: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 8,
    background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.border}`,
    marginBottom: 6,
  },
  pickerInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: theme.colors.text, fontSize: 13, fontFamily: 'inherit',
  },
  campusList: {
    display: 'flex', flexDirection: 'column', gap: 4,
    maxHeight: 200, overflowY: 'auto',
  },
  campusOption: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
    background: theme.colors.bgSecondary, border: `1px solid ${theme.colors.borderLight}`,
    textAlign: 'left', width: '100%',
  },
  campusOptionName: { fontSize: 13, fontWeight: 600, color: theme.colors.text },
  campusOptionCity: { fontSize: 11, color: theme.colors.textTertiary },
  pickerEmpty: { textAlign: 'center', padding: 12, fontSize: 12, color: theme.colors.textTertiary },
};

export default CampusManager;