import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const clampTimePart = (value, max) => {
  const numeric = String(value || '').replace(/\D/g, '').slice(0, 2);
  if (!numeric) return '';
  const parsed = Number(numeric);
  if (Number.isNaN(parsed)) return '';
  return String(Math.min(parsed, max));
};

function SmartDatePicker({ initialDate, onSave, onCancel }) {
  const initial = useMemo(() => {
    const parsed = new Date(initialDate || Date.now());
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [initialDate]);

  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date(initial));
  const [hh, setHh] = useState(String(initial.getHours()).padStart(2, '0'));
  const [mm, setMm] = useState(String(initial.getMinutes()).padStart(2, '0'));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const today = new Date();
  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const handleSave = () => {
    let safeHh = Number.parseInt(hh, 10);
    let safeMm = Number.parseInt(mm, 10);
    if (Number.isNaN(safeHh)) safeHh = 0;
    if (Number.isNaN(safeMm)) safeMm = 0;
    safeHh = Math.max(0, Math.min(safeHh, 23));
    safeMm = Math.max(0, Math.min(safeMm, 59));

    const result = new Date(selectedDate);
    result.setHours(safeHh, safeMm, 0, 0);
    onSave(result.toISOString());
  };

  return (
    <div style={styles.root}>
      <div style={styles.monthRow}>
        <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="create-spring-btn" style={styles.navBtn}>
          <ChevronLeft size={18} />
        </button>
        <div style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</div>
        <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="create-spring-btn" style={styles.navBtn}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={styles.weekHeader}>
        {WEEK_DAYS.map((day) => (
          <div key={day} style={styles.weekDay}>{day}</div>
        ))}
      </div>

      <div style={styles.daysGrid}>
        {Array.from({ length: startOffset }).map((_, idx) => <div key={`offset-${idx}`} />)}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const current = new Date(year, month, dayNum);
          const selected = isSameDay(current, selectedDate);
          const now = isSameDay(current, today);
          return (
            <button
              key={dayNum}
              type="button"
              onClick={() => setSelectedDate(current)}
              className="create-spring-btn"
              style={{
                ...styles.dayBtn,
                ...(selected ? styles.dayBtnActive : null),
                ...(now && !selected ? styles.dayBtnToday : null),
              }}
            >
              {dayNum}
              {now && !selected ? <span style={styles.todayDot} /> : null}
            </button>
          );
        })}
      </div>

      <div style={styles.timeCard}>
        <Clock size={20} color="var(--create-text-muted)" style={{ marginRight: 8 }} />
        <input
          type="text"
          value={hh}
          onChange={(e) => setHh(clampTimePart(e.target.value, 23))}
          onBlur={() => setHh(String(Number.parseInt(hh || '0', 10)).padStart(2, '0'))}
          placeholder="12"
          style={styles.timeInput}
        />
        <span style={styles.timeSeparator}>:</span>
        <input
          type="text"
          value={mm}
          onChange={(e) => setMm(clampTimePart(e.target.value, 59))}
          onBlur={() => setMm(String(Number.parseInt(mm || '0', 10)).padStart(2, '0'))}
          placeholder="00"
          style={styles.timeInput}
        />
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={onCancel} className="create-spring-btn" style={styles.cancelBtn}>
          Отмена
        </button>
        <button type="button" onClick={handleSave} className="create-spring-btn" style={styles.saveBtn}>
          <Check size={18} strokeWidth={2.4} /> Сохранить
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    width: '100%',
  },
  monthRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    border: 'none',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  monthLabel: {
    fontWeight: 700,
    fontSize: 15,
    color: '#fff',
  },
  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    marginBottom: 8,
  },
  weekDay: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--create-text-muted)',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    marginBottom: 20,
  },
  dayBtn: {
    aspectRatio: '1',
    borderRadius: 12,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    cursor: 'pointer',
  },
  dayBtnActive: {
    background: 'var(--create-primary)',
    color: '#000',
    boxShadow: '0 4px 12px rgba(212,255,0,0.4)',
  },
  dayBtnToday: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    background: 'var(--create-primary)',
  },
  timeCard: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
  },
  timeInput: {
    width: 48,
    height: 48,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.4)',
    color: '#fff',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 700,
    outline: 'none',
  },
  timeSeparator: {
    color: 'var(--create-text-muted)',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 4,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    border: 'none',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 2,
    border: 'none',
    borderRadius: 14,
    background: 'var(--create-primary)',
    color: '#000',
    padding: 12,
    fontSize: 15,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
  },
};

export default SmartDatePicker;
