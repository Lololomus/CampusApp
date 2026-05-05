import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  Share2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { getCalendarEvents } from '../../api';
import { useStore } from '../../store';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { toast } from '../shared/Toast';
import { hapticFeedback } from '../../utils/telegram';
import { sharePostViaTelegram } from '../../utils/telegramShare';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Z_MODAL_USER_POSTS } from '../../constants/zIndex';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

const premium = theme.colors.premium;
const C = {
  bg: '#000000',
  surface: '#0B0B0D',
  surface2: '#111216',
  surface3: '#17181D',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  muted: '#8B8D96',
  body: '#D7D9DE',
  lime: premium.primary,
  limeSoft: 'rgba(212,255,0,0.14)',
  cyan: '#00C7BE',
  cyanSoft: 'rgba(0,199,190,0.16)',
  wine: 'rgba(94, 25, 39, 0.34)',
  rose: '#FF7C98',
};

const EVENT_TIME_ZONE = 'Europe/Moscow';
const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toEventDateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const parseApiDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};
const eventDateKey = (event) => {
  const date = parseApiDate(event?.event_date);
  return date ? toEventDateKey(date) : '';
};
const getEventTitle = (event) => {
  const fromBody = String(event?.body || '').split('\n').find(Boolean) || '';
  return String(event?.event_name || event?.title || fromBody || 'Событие').trim();
};
const getEventDescription = (event) => {
  const title = getEventTitle(event);
  const body = String(event?.body || '').trim();
  if (!body) return '';
  return body.startsWith(title) ? body.slice(title.length).trim() : body;
};
const formatTime = (value) => {
  const date = parseApiDate(value);
  if (!date) return '';
  return date.toLocaleTimeString('ru-RU', { timeZone: EVENT_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
};
const formatDateLong = (value) => {
  const date = parseApiDate(value);
  if (!date) return '';
  return date.toLocaleDateString('ru-RU', { timeZone: EVENT_TIME_ZONE, day: 'numeric', month: 'long', weekday: 'long' });
};
const formatSpotlightDate = (value) => {
  const date = parseApiDate(value);
  if (!date) return '';
  return date.toLocaleDateString('ru-RU', { timeZone: EVENT_TIME_ZONE, day: 'numeric', month: 'short', weekday: 'short' });
};
const getEventPlace = (event) => event?.event_location || event?.author?.university || 'Campus';
const isOfficialEvent = (event) => event?.event_type === 'official';
const countLabel = (count) => (count > 9 ? '+9' : String(count));

function buildMonthDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const days = [];

  for (let index = 0; index < startOffset; index += 1) days.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function sortEventsByDate(items) {
  return [...items].sort((a, b) => {
    const aDate = parseApiDate(a.event_date)?.getTime() || 0;
    const bDate = parseApiDate(b.event_date)?.getTime() || 0;
    if (aDate !== bDate) return aDate - bDate;
    if (isOfficialEvent(a) !== isOfficialEvent(b)) return isOfficialEvent(a) ? -1 : 1;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function pickSpotlightEvent(items, monthDate) {
  if (!items.length) return null;
  const today = new Date();
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const isCurrentMonth = monthDate.getFullYear() === today.getFullYear() && monthDate.getMonth() === today.getMonth();
  const anchor = isCurrentMonth ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : monthStart;
  const upcoming = items.filter((event) => {
    const date = parseApiDate(event.event_date);
    if (!date) return false;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() >= anchor.getTime();
  });
  const candidates = upcoming.length ? upcoming : items;
  return [...candidates].sort((a, b) => {
    const aDate = parseApiDate(a.event_date);
    const bDate = parseApiDate(b.event_date);
    const aDay = aDate ? new Date(aDate.getFullYear(), aDate.getMonth(), aDate.getDate()).getTime() : 0;
    const bDay = bDate ? new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate()).getTime() : 0;
    const dateDiff = Math.abs(aDay - anchor.getTime()) - Math.abs(bDay - anchor.getTime());
    if (dateDiff !== 0) return dateDiff;
    if (isOfficialEvent(a) !== isOfficialEvent(b)) return isOfficialEvent(a) ? -1 : 1;
    return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
  })[0];
}

function EventCalendarScreen() {
  useBodyScrollLock();
  const reduceMotion = useReducedMotion();
  const closeTimeoutRef = useRef(null);
  const loadSeqRef = useRef(0);

  const {
    setShowCalendarScreen,
    setViewPostId,
  } = useStore();

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthDirection, setMonthDirection] = useState(1);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isExiting, setIsExiting] = useState(false);

  const monthKey = `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1)}`;
  const monthDays = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const todayKey = toDateKey(new Date());

  const requestParams = useMemo(() => {
    const from = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    const to = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    return {
      from,
      to,
    };
  }, [monthDate]);

  const sortedEvents = useMemo(() => sortEventsByDate(events), [events]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    sortedEvents.forEach((event) => {
      const key = eventDateKey(event);
      if (!key) return;
      const bucket = map.get(key) || [];
      bucket.push(event);
      map.set(key, bucket);
    });
    return map;
  }, [sortedEvents]);

  const selectedEvents = useMemo(
    () => (selectedDateKey ? (eventsByDate.get(selectedDateKey) || []) : []),
    [eventsByDate, selectedDateKey]
  );

  const spotlightEvent = useMemo(
    () => pickSpotlightEvent(sortedEvents, monthDate),
    [monthDate, sortedEvents]
  );

  const loadEvents = useCallback(async () => {
    const loadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = loadSeq;
    setLoading(true);
    setError('');
    try {
      const data = await getCalendarEvents(requestParams);
      if (loadSeqRef.current !== loadSeq) return;
      setEvents(Array.isArray(data?.items) ? data.items : []);
    } catch {
      if (loadSeqRef.current !== loadSeq) return;
      setError('Не удалось загрузить календарь');
    } finally {
      if (loadSeqRef.current === loadSeq) setLoading(false);
    }
  }, [requestParams]);

  useEffect(() => {
    setSelectedDateKey('');
    loadEvents();
  }, [monthKey, loadEvents]);

  useEffect(() => {
    if (loading || selectedDateKey) return;
    const isCurrentMonth = monthDate.getFullYear() === new Date().getFullYear()
      && monthDate.getMonth() === new Date().getMonth();
    const sortedKeys = Array.from(eventsByDate.keys()).sort();
    setSelectedDateKey(isCurrentMonth ? todayKey : (sortedKeys[0] || toDateKey(monthDate)));
  }, [eventsByDate, loading, monthDate, selectedDateKey, todayKey]);

  const goMonth = (delta) => {
    hapticFeedback('selection');
    setMonthDirection(delta > 0 ? 1 : -1);
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = useCallback(() => {
    const now = new Date();
    hapticFeedback('light');
    const nextMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setMonthDirection(nextMonth.getTime() >= monthDate.getTime() ? 1 : -1);
    setMonthDate(nextMonth);
    setSelectedDateKey(toDateKey(now));
  }, [monthDate]);

  const selectDay = (key) => {
    hapticFeedback('selection');
    setSelectedDateKey(key);
  };

  const openEvent = (event) => {
    hapticFeedback('light');
    setSelectedEvent(event);
  };

  const openPost = () => {
    if (!selectedEvent?.id) {
      toast.error('Событие недоступно');
      return;
    }
    setSelectedEvent(null);
    setViewPostId(selectedEvent.id);
  };

  const shareEvent = () => {
    if (!selectedEvent) return;
    try {
      sharePostViaTelegram(selectedEvent);
    } catch {
      toast.error('Не удалось открыть шаринг');
    }
  };

  const closeImmediately = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExiting(false);
    setShowCalendarScreen(false);
  }, [setShowCalendarScreen]);

  const close = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setShowCalendarScreen(false);
    }, 340);
  }, [isExiting, setShowCalendarScreen]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  useTelegramScreen({
    id: 'event-calendar-screen',
    title: 'Календарь',
    priority: 108,
    back: {
      visible: true,
      onClick: selectedEvent ? () => setSelectedEvent(null) : close,
    },
  });

  const selectedTitle = selectedDateKey ? formatDateLong(`${selectedDateKey}T12:00:00+03:00`) : 'События';
  const motionEnabled = !reduceMotion;

  const screenStyle = {
    ...styles.screen,
    animation: motionEnabled
      ? `${isExiting ? 'eventCalendarSlideOut' : 'eventCalendarSlideIn'} ${isExiting ? '0.32s' : '0.38s'} cubic-bezier(0.32,0.72,0,1) forwards`
      : undefined,
    pointerEvents: isExiting ? 'none' : 'auto',
  };

  return (
    <EdgeSwipeBack
      onBack={closeImmediately}
      disabled={Boolean(selectedEvent) || isExiting}
      zIndex={Z_MODAL_USER_POSTS}
    >
    <motion.div className="event-calendar-screen" style={screenStyle}>
      <style>{`
        @keyframes eventCalendarSlideIn {
          from { transform: translate3d(100%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @keyframes eventCalendarSlideOut {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(100%, 0, 0); }
        }
        @keyframes calendarSkeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes officialShine {
          0% { transform: translateX(-120%); opacity: 0; }
          18% { opacity: 0.55; }
          62% { opacity: 0.18; }
          100% { transform: translateX(160%); opacity: 0; }
        }
        .event-calendar-shine::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 40%;
          left: 0;
          pointer-events: none;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: officialShine 1.45s ease-out 0.28s 1 both;
        }
        @media (prefers-reduced-motion: reduce) {
          .event-calendar-shine::after { animation: none; display: none; }
        }
        .event-calendar-screen,
        .event-calendar-screen * {
          box-sizing: border-box;
        }
        .event-calendar-screen button {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
          font: inherit;
        }
      `}</style>

      <div style={styles.topBar}>
        <LocalBackButton onClose={close} />
        <div style={styles.topTitleBlock}>
          <div style={styles.topTitle}>Календарь</div>
        </div>
        <div style={styles.topSidePlaceholder} />
      </div>

      <main style={styles.content}>
        {loading ? (
          <CalendarLoadingState />
        ) : error ? (
          <CalendarErrorState error={error} onRetry={loadEvents} />
        ) : (
          <>
            <SpotlightEvent event={spotlightEvent} onOpen={openEvent} />

            <section style={styles.monthCard}>
              <div style={styles.monthHeader}>
                <div>
                  <h1 style={styles.monthTitle}>{MONTHS[monthDate.getMonth()]}</h1>
                  <div style={styles.monthSubtitle}>{monthDate.getFullYear()} · афиша Campus</div>
                </div>
                <div style={styles.monthControls}>
                  <button type="button" onClick={goToday} style={styles.todayInlineButton}>
                    Сегодня
                  </button>
                  <button type="button" onClick={() => goMonth(-1)} style={styles.controlButton} aria-label="Предыдущий месяц">
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" onClick={() => goMonth(1)} style={styles.controlButton} aria-label="Следующий месяц">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div style={styles.weekdays}>
                {WEEKDAYS.map((day) => <div key={day} style={styles.weekday}>{day}</div>)}
              </div>

              <AnimatePresence mode="popLayout" custom={monthDirection}>
                <motion.div
                  key={monthKey}
                  custom={monthDirection}
                  style={styles.grid}
                  initial={motionEnabled ? { opacity: 0, x: monthDirection * 22 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={motionEnabled ? { opacity: 0, x: monthDirection * -22 } : { opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {monthDays.map((date, index) => {
                    if (!date) return <div key={`empty-${index}`} style={styles.emptyCell} />;
                    const key = toDateKey(date);
                    const dayEvents = eventsByDate.get(key) || [];
                    const officialCount = dayEvents.filter(isOfficialEvent).length;
                    const hasOfficial = officialCount > 0;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isSelected = selectedDateKey === key;
                    const isToday = todayKey === key;
                    return (
                      <DayCell
                        key={key}
                        date={date}
                        dayEvents={dayEvents}
                        hasOfficial={hasOfficial}
                        isWeekend={isWeekend}
                        isSelected={isSelected}
                        isToday={isToday}
                        onSelect={() => selectDay(key)}
                        motionEnabled={motionEnabled}
                      />
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </section>

            <section style={styles.daySection}>
              <div style={styles.daySectionHeader}>
                <div>
                  <div style={styles.daySectionTitle}>{selectedTitle}</div>
                  <div style={styles.daySectionMeta}>
                    {selectedEvents.length ? `${selectedEvents.length} событий` : 'На этот день событий нет'}
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedDateKey || 'empty'}
                  style={styles.eventList}
                  initial={motionEnabled ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionEnabled ? { opacity: 0, y: -6 } : { opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  {selectedEvents.length === 0 ? (
                    <div style={styles.emptyState}>
                      <CalendarDays size={24} />
                      <span>На этот день событий нет</span>
                    </div>
                  ) : selectedEvents.map((event, index) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      index={index}
                      onOpen={openEvent}
                      motionEnabled={motionEnabled}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </section>
          </>
        )}
      </main>

      <SwipeableModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        zIndex={Z_MODAL_USER_POSTS + 20}
        showHeaderDivider={false}
        footer={selectedEvent ? (
          <div style={styles.sheetFooter}>
            {selectedEvent.event_type !== 'official' && (
              <button type="button" onClick={openPost} style={styles.openPostButton}>
                <ExternalLink size={17} /> Открыть пост
              </button>
            )}
            <button type="button" onClick={shareEvent} style={styles.shareButton}>
              <Share2 size={17} /> Поделиться
            </button>
          </div>
        ) : null}
      >
        {selectedEvent && <EventSheetContent event={selectedEvent} />}
      </SwipeableModal>
    </motion.div>
    </EdgeSwipeBack>
  );
}

function LocalBackButton({ onClose }) {
  const isDev = import.meta.env.DEV;
  const isDesktop = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: fine)').matches;

  if (!isDev && !isDesktop) return <div style={styles.topSidePlaceholder} />;

  return (
    <button type="button" onClick={onClose} style={styles.backButton} aria-label="Закрыть календарь">
      <ArrowLeft size={21} />
    </button>
  );
}

function SpotlightEvent({ event, onOpen }) {
  if (!event) {
    return (
      <section style={styles.spotlightEmpty}>
        <div style={styles.spotlightEmptyIcon}><CalendarDays size={20} /></div>
        <div style={styles.spotlightText}>
          <div style={styles.spotlightKicker}>Ближайшее событие</div>
          <div style={styles.spotlightEmptyTitle}>В этом месяце пока тихо</div>
          <div style={styles.spotlightMeta}>Когда появятся события, они будут здесь.</div>
        </div>
      </section>
    );
  }

  const official = isOfficialEvent(event);
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={official ? 'event-calendar-shine' : undefined}
      style={official ? { ...styles.spotlight, ...styles.spotlightOfficial } : styles.spotlight}
    >
      <div style={official ? styles.spotlightAccentOfficial : styles.spotlightAccentCommunity} />
      <div style={styles.spotlightMain}>
        <div style={styles.spotlightTopRow}>
          <span style={official ? styles.officialBadge : styles.communityBadge}>
            {official ? 'Офиц.' : 'Неофиц.'}
          </span>
          <span style={styles.spotlightDate}>{formatSpotlightDate(event.event_date)} · {formatTime(event.event_date)}</span>
        </div>
        <div style={styles.spotlightTitle}>{getEventTitle(event)}</div>
        <div style={styles.spotlightMeta}>
          <MapPin size={13} style={styles.spotlightMetaIcon} />
          <span style={styles.spotlightMetaText}>{getEventPlace(event)}</span>
        </div>
      </div>
      <div style={official ? styles.spotlightIconOfficial : styles.spotlightIconCommunity}>
        {official ? <ShieldCheck size={22} strokeWidth={2.6} /> : <CalendarDays size={20} />}
      </div>
    </button>
  );
}

function DayCell({ date, dayEvents, hasOfficial, isWeekend, isSelected, isToday, onSelect, motionEnabled }) {
  const hasEvents = dayEvents.length > 0;
  const cellStyle = {
    ...styles.dayCell,
    ...(isWeekend ? styles.weekendCell : null),
    ...(hasOfficial ? styles.officialDayCell : null),
    ...(isSelected ? styles.selectedDayCell : null),
  };
  const numberStyle = {
    ...styles.dayNumber,
    ...(isWeekend ? styles.weekendText : null),
    ...(hasOfficial ? styles.officialText : null),
    ...(isSelected && !hasOfficial ? styles.selectedDayText : null),
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      style={cellStyle}
      whileTap={motionEnabled ? { scale: 0.93 } : undefined}
      animate={motionEnabled && isSelected ? { scale: 1.03 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      <span style={numberStyle}>{date.getDate()}</span>
      {isToday && <span style={hasOfficial ? styles.todayRingOfficial : styles.todayRing} />}
      {hasEvents && !hasOfficial && (
        <span style={styles.communityEventMarker}>
          {dayEvents.length > 1 ? countLabel(dayEvents.length) : ''}
        </span>
      )}
      {hasOfficial && dayEvents.length > 1 && (
        <span style={styles.officialEventMarker}>
          {dayEvents.length > 1 ? countLabel(dayEvents.length) : ''}
        </span>
      )}
    </motion.button>
  );
}

function EventRow({ event, index, onOpen, motionEnabled }) {
  const official = isOfficialEvent(event);
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(event)}
      style={official ? { ...styles.eventRow, ...styles.officialEventRow } : styles.eventRow}
      initial={motionEnabled ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.035, 0.18) }}
    >
      <div style={official ? styles.eventRailOfficial : styles.eventRailCommunity} />
      <div style={official ? styles.officialTime : styles.eventTime}>
        {formatTime(event.event_date)}
      </div>
      <div style={styles.eventInfo}>
        <div style={styles.eventTitle}>{getEventTitle(event)}</div>
        <div style={official ? styles.eventMetaOfficial : styles.eventMeta}>
          {getEventPlace(event)}
        </div>
      </div>
      <span style={official ? styles.officialBadge : styles.communityBadge}>
        {official ? 'Офиц.' : 'Неофиц.'}
      </span>
    </motion.button>
  );
}

function CalendarLoadingState() {
  return (
    <>
      <div style={{ ...styles.spotlight, ...styles.skeletonBlock, height: 122 }} />
      <section style={styles.monthCard}>
        <div style={styles.skeletonHeader}>
          <div style={{ ...styles.skeletonLine, width: 120, height: 34 }} />
          <div style={{ ...styles.skeletonLine, width: 82, height: 36, borderRadius: 14 }} />
        </div>
        <div style={styles.weekdays}>
          {WEEKDAYS.map((day) => <div key={day} style={styles.weekday}>{day}</div>)}
        </div>
        <div style={styles.grid}>
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} style={{ ...styles.dayCell, ...styles.skeletonBlock }} />
          ))}
        </div>
      </section>
      <div style={styles.eventList}>
        <div style={{ ...styles.eventRow, ...styles.skeletonBlock, height: 64 }} />
        <div style={{ ...styles.eventRow, ...styles.skeletonBlock, height: 64, opacity: 0.7 }} />
      </div>
    </>
  );
}

function CalendarErrorState({ error, onRetry }) {
  return (
    <div style={styles.errorBox}>
      <CalendarDays size={30} />
      <span>{error}</span>
      <button type="button" onClick={onRetry} style={styles.retryButton}>
        <RefreshCw size={15} /> Повторить
      </button>
    </div>
  );
}

function EventSheetContent({ event }) {
  const official = isOfficialEvent(event);
  const description = getEventDescription(event);
  return (
    <div style={styles.sheetContent}>
      <h3 style={styles.sheetModalTitle}>
        {official ? 'Официальное событие' : 'Событие'}
      </h3>
      <div
        className={official ? 'event-calendar-shine' : undefined}
        style={official ? styles.sheetHeroOfficial : styles.sheetHero}
      >
        <div style={official ? styles.officialBadgeLarge : styles.communityBadgeLarge}>
          {official ? 'Официальное' : 'Неофициальное'}
        </div>
        <h2 style={styles.sheetTitle}>{getEventTitle(event)}</h2>
        <div style={styles.sheetDate}>{formatDateLong(event.event_date)} · {formatTime(event.event_date)}</div>
      </div>

      <div style={styles.detailStack}>
        {event.event_location && (
          <DetailRow icon={<MapPin size={17} />} label="Место" value={event.event_location} tone={official ? 'official' : 'community'} />
        )}
        {event.event_contact && (
          <DetailRow icon={<UserRound size={17} />} label="Контакт" value={event.event_contact} tone={official ? 'official' : 'community'} />
        )}
        {event.author?.name && (
          <DetailRow icon={<UserRound size={17} />} label="Организатор" value={event.author.name} tone={official ? 'official' : 'community'} />
        )}
        <DetailRow icon={<Clock size={17} />} label="Когда" value={`${formatDateLong(event.event_date)}, ${formatTime(event.event_date)}`} tone={official ? 'official' : 'community'} />
      </div>

      {description && <p style={styles.sheetDescription}>{description}</p>}
    </div>
  );
}

function DetailRow({ icon, label, value, tone }) {
  return (
    <div style={styles.detailRow}>
      <div style={tone === 'official' ? styles.detailIconOfficial : styles.detailIconCommunity}>{icon}</div>
      <div style={styles.detailText}>
        <span style={styles.detailLabel}>{label}</span>
        <span style={styles.detailValue}>{value}</span>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    position: 'fixed',
    inset: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    background: C.bg,
    color: C.text,
    zIndex: Z_MODAL_USER_POSTS,
    overflow: 'hidden',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    padding: 'calc(var(--screen-top-offset, 0px) + 8px) 14px 8px',
    display: 'grid',
    gridTemplateColumns: '42px minmax(0, 1fr) 42px',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.92)',
    borderBottom: 'none',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: C.surface2,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  topTitleBlock: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: '28px',
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.5px',
    transform: 'translateY(2px)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  topSidePlaceholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '12px 14px calc(100px + var(--screen-bottom-offset, 0px))',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  spotlight: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    minHeight: 124,
    border: `1px solid ${C.borderStrong}`,
    borderRadius: 22,
    background: `linear-gradient(135deg, ${C.surface3}, ${C.surface} 72%)`,
    color: C.text,
    padding: 14,
    display: 'flex',
    alignItems: 'stretch',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 18px 44px rgba(0,0,0,0.44)',
    marginBottom: 12,
  },
  spotlightOfficial: {
    borderColor: 'rgba(212,255,0,0.42)',
    background: `linear-gradient(135deg, rgba(212,255,0,0.17), ${C.surface3} 44%, ${C.surface} 100%)`,
    boxShadow: '0 20px 54px rgba(0,0,0,0.5), 0 0 30px rgba(212,255,0,0.12)',
  },
  spotlightAccentOfficial: {
    width: 4,
    borderRadius: 999,
    background: C.lime,
    boxShadow: '0 0 18px rgba(212,255,0,0.55)',
    flexShrink: 0,
  },
  spotlightAccentCommunity: {
    width: 4,
    borderRadius: 999,
    background: C.cyan,
    boxShadow: '0 0 14px rgba(0,199,190,0.32)',
    flexShrink: 0,
  },
  spotlightMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  spotlightTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    marginBottom: 9,
  },
  spotlightDate: {
    color: C.muted,
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  spotlightTitle: {
    fontSize: 19,
    lineHeight: 1.14,
    fontWeight: 950,
    letterSpacing: 0,
    minWidth: 0,
    maxWidth: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  spotlightMeta: {
    marginTop: 9,
    color: C.muted,
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    lineHeight: 1.25,
  },
  spotlightMetaIcon: {
    flexShrink: 0,
  },
  spotlightMetaText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  spotlightIconOfficial: {
    width: 42,
    height: 42,
    borderRadius: 16,
    background: C.lime,
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
  },
  spotlightIconCommunity: {
    width: 42,
    height: 42,
    borderRadius: 16,
    background: C.cyanSoft,
    color: C.cyan,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
  },
  spotlightEmpty: {
    width: '100%',
    boxSizing: 'border-box',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: 108,
    border: `1px solid ${C.border}`,
    borderRadius: 22,
    background: `linear-gradient(135deg, ${C.surface2}, ${C.surface})`,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  spotlightEmptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.06)',
    color: C.muted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spotlightText: {
    minWidth: 0,
  },
  spotlightKicker: {
    color: C.cyan,
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  spotlightEmptyTitle: {
    marginTop: 4,
    color: C.text,
    fontSize: 17,
    fontWeight: 900,
  },
  monthCard: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: 22,
    padding: 13,
    background: C.surface,
    border: `1px solid ${C.border}`,
    boxShadow: '0 16px 42px rgba(0,0,0,0.38)',
    marginBottom: 14,
  },
  monthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    minWidth: 0,
  },
  monthTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: 0,
  },
  monthSubtitle: {
    marginTop: 5,
    color: C.muted,
    fontSize: 12,
    fontWeight: 800,
  },
  monthControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    border: `1px solid ${C.border}`,
    background: C.surface3,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  todayInlineButton: {
    height: 36,
    padding: '0 12px',
    borderRadius: 13,
    border: 'none',
    background: C.lime,
    color: '#000',
    fontSize: 12,
    fontWeight: 950,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  weekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 5,
    marginBottom: 7,
  },
  weekday: {
    height: 18,
    textAlign: 'center',
    color: C.muted,
    fontSize: 10,
    fontWeight: 900,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 5,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  emptyCell: {
    aspectRatio: '1 / 1',
  },
  dayCell: {
    boxSizing: 'border-box',
    aspectRatio: '1 / 1',
    minWidth: 0,
    borderRadius: 13,
    border: `1px solid ${C.border}`,
    background: C.surface3,
    color: '#AEB1BA',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease',
  },
  weekendCell: {
    background: C.wine,
    borderColor: 'rgba(255,124,152,0.22)',
  },
  officialDayCell: {
    borderColor: C.lime,
    boxShadow: '0 0 18px rgba(212,255,0,0.28)',
    background: C.lime,
    color: '#000',
  },
  selectedDayCell: {
    outline: '2px solid rgba(255,255,255,0.82)',
    outlineOffset: -2,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1,
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  weekendText: {
    color: C.rose,
  },
  officialText: {
    color: '#000000',
  },
  todayRing: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#FFFFFF',
    boxShadow: '0 0 8px rgba(255,255,255,0.46)',
  },
  todayRingOfficial: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#000000',
    boxShadow: '0 0 0 2px rgba(0,0,0,0.12)',
  },
  communityEventMarker: {
    position: 'absolute',
    top: -1,
    left: '50%',
    transform: 'translateX(-50%)',
    minWidth: 7,
    height: 7,
    padding: '0 4px',
    borderRadius: 999,
    background: C.cyan,
    color: '#001211',
    fontSize: 9,
    lineHeight: '14px',
    fontWeight: 950,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  officialEventMarker: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: -1,
    minWidth: 16,
    height: 14,
    padding: '0 4px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.82)',
    color: C.lime,
    fontSize: 9,
    fontWeight: 950,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  daySection: {
    marginTop: 2,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  daySectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    minWidth: 0,
  },
  daySectionTitle: {
    fontSize: 18,
    fontWeight: 950,
    textTransform: 'capitalize',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  daySectionMeta: {
    marginTop: 3,
    color: C.muted,
    fontSize: 13,
    fontWeight: 800,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventList: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 9,
    overflow: 'hidden',
  },
  eventRow: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    minHeight: 68,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    background: `linear-gradient(135deg, ${C.surface2}, ${C.surface})`,
    color: C.text,
    padding: '12px 12px 12px 13px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    textAlign: 'left',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  officialEventRow: {
    borderColor: 'rgba(212,255,0,0.34)',
    background: `linear-gradient(135deg, rgba(212,255,0,0.11), ${C.surface2} 54%, ${C.surface})`,
  },
  eventRailOfficial: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 999,
    background: C.lime,
  },
  eventRailCommunity: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 999,
    background: C.cyan,
  },
  eventTime: {
    width: 44,
    color: C.body,
    fontSize: 13,
    fontWeight: 950,
    flexShrink: 0,
  },
  officialTime: {
    width: 44,
    color: C.lime,
    fontSize: 13,
    fontWeight: 950,
    flexShrink: 0,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 950,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflowWrap: 'anywhere',
  },
  eventMeta: {
    marginTop: 5,
    color: C.muted,
    fontSize: 12,
    fontWeight: 800,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflowWrap: 'anywhere',
  },
  eventMetaOfficial: {
    marginTop: 5,
    color: '#DFFF69',
    fontSize: 12,
    fontWeight: 850,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflowWrap: 'anywhere',
  },
  officialBadge: {
    borderRadius: 999,
    background: C.lime,
    color: '#000',
    padding: '5px 8px',
    fontSize: 10,
    fontWeight: 950,
    flexShrink: 0,
    lineHeight: 1,
  },
  communityBadge: {
    borderRadius: 999,
    background: C.cyanSoft,
    color: '#85FFF8',
    padding: '5px 8px',
    fontSize: 10,
    fontWeight: 950,
    flexShrink: 0,
    lineHeight: 1,
  },
  emptyState: {
    minHeight: 96,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.035)',
    border: `1px solid ${C.border}`,
    color: C.muted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 8,
    fontSize: 14,
    fontWeight: 850,
  },
  errorBox: {
    minHeight: 280,
    borderRadius: 22,
    background: C.surface,
    border: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: C.muted,
    fontSize: 14,
    fontWeight: 800,
  },
  retryButton: {
    border: `1px solid ${C.lime}`,
    borderRadius: 14,
    background: C.limeSoft,
    color: C.lime,
    padding: '9px 13px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 900,
    cursor: 'pointer',
  },
  skeletonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  skeletonLine: {
    borderRadius: 999,
    background: 'linear-gradient(110deg, #15161B 8%, #202127 18%, #15161B 33%)',
    backgroundSize: '200% 100%',
    animation: 'calendarSkeleton 1.2s linear infinite',
  },
  skeletonBlock: {
    background: 'linear-gradient(110deg, #15161B 8%, #202127 18%, #15161B 33%)',
    backgroundSize: '200% 100%',
    animation: 'calendarSkeleton 1.2s linear infinite',
  },
  sheetContent: {
    paddingTop: 0,
    color: C.text,
  },
  sheetModalTitle: {
    margin: '0 0 14px',
    color: C.text,
    fontSize: 17,
    lineHeight: '22px',
    fontWeight: 800,
    textAlign: 'center',
  },
  sheetHero: {
    borderRadius: 20,
    padding: 16,
    background: `linear-gradient(135deg, ${C.surface3}, ${C.surface2})`,
    border: `1px solid ${C.border}`,
    color: C.text,
    marginBottom: 14,
    marginTop: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  sheetHeroOfficial: {
    borderRadius: 20,
    padding: 16,
    background: `radial-gradient(ellipse 72% 78% at 30% 54%, rgba(212,255,0,0.2) 0%, rgba(212,255,0,0.08) 34%, transparent 76%), linear-gradient(135deg, rgba(212,255,0,0.09), ${C.surface3} 66%)`,
    border: '1px solid rgba(212,255,0,0.42)',
    boxShadow: '0 0 0 1px rgba(212,255,0,0.03), 0 0 28px rgba(212,255,0,0.1)',
    color: C.text,
    marginBottom: 14,
    marginTop: 4,
    position: 'relative',
    overflow: 'visible',
  },
  sheetTitle: {
    margin: '10px 0 8px',
    fontSize: 22,
    lineHeight: 1.16,
    fontWeight: 950,
    letterSpacing: 0,
    color: C.text,
    overflowWrap: 'anywhere',
  },
  sheetDate: {
    color: C.muted,
    fontSize: 13,
    fontWeight: 850,
    textTransform: 'capitalize',
  },
  officialBadgeLarge: {
    display: 'inline-flex',
    borderRadius: 999,
    background: C.lime,
    color: '#000',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 950,
  },
  communityBadgeLarge: {
    display: 'inline-flex',
    borderRadius: 999,
    background: C.cyanSoft,
    color: '#85FFF8',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 950,
  },
  detailStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.045)',
    padding: '10px 12px',
  },
  detailIconOfficial: {
    width: 32,
    height: 32,
    borderRadius: 12,
    background: C.limeSoft,
    color: C.lime,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailIconCommunity: {
    width: 32,
    height: 32,
    borderRadius: 12,
    background: C.cyanSoft,
    color: C.cyan,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  detailLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: 850,
  },
  detailValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: 'anywhere',
  },
  sheetDescription: {
    margin: '0 0 4px',
    color: C.body,
    fontSize: 15,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  sheetFooter: {
    display: 'flex',
    gap: 8,
  },
  openPostButton: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    border: 'none',
    background: C.lime,
    color: '#000',
    fontSize: 14,
    fontWeight: 950,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    cursor: 'pointer',
  },
  shareButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    border: `1px solid ${C.borderStrong}`,
    background: C.surface3,
    color: C.text,
    fontSize: 14,
    fontWeight: 950,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    cursor: 'pointer',
  },
};

export default EventCalendarScreen;
