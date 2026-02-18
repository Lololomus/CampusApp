// ===== 📄 ФАЙЛ: frontend/src/components/moderation/CampaignManager.js =====

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Eye, MousePointerClick, Pause, Play, Trash2,
  CheckCircle, XCircle, ChevronDown, ChevronUp, BarChart3,
  Globe, Building2, MapPin, ExternalLink
} from 'lucide-react';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import {
  getAdPosts, createAdPost, deleteAdPost, approveAdPost,
  rejectAdPost, pauseAdPost, resumeAdPost, getAdStats,
  getAdOverviewStats
} from '../../api';
import { toast } from '../shared/Toast';
import theme from '../../theme';

const STATUS_MAP = {
  draft:          { label: 'Черновик',    color: theme.colors.textTertiary, bg: theme.colors.bgSecondary },
  pending_review: { label: 'На проверке', color: '#f59e0b', bg: '#f59e0b15' },
  approved:       { label: 'Одобрено',    color: '#3b82f6', bg: '#3b82f610' },
  active:         { label: 'Активно',     color: '#22c55e', bg: '#22c55e15' },
  paused:         { label: 'Пауза',       color: '#f97316', bg: '#f9731615' },
  completed:      { label: 'Завершено',   color: theme.colors.textSecondary, bg: theme.colors.bgSecondary },
  rejected:       { label: 'Отклонено',   color: '#ef4444', bg: '#ef444415' },
};

const SCOPE_MAP = {
  university: { label: 'Вуз', icon: Building2 },
  city:       { label: 'Город', icon: MapPin },
  all:        { label: 'Все', icon: Globe },
};

/** @param {{ isAdmin: boolean }} props */
function CampaignManager({ isAdmin = false }) {
  const { user } = useStore();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [statsCache, setStatsCache] = useState({});
  const [overview, setOverview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdPosts({ status: filter === 'all' ? null : filter, limit: 50 });
      setAds(data.items || []);
      if (isAdmin) {
        const ov = await getAdOverviewStats().catch(() => null);
        if (ov) setOverview(ov);
      }
    } catch (err) {
      console.error('CampaignManager load:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // === Actions ===
  const act = async (fn, adId, successMsg, ...args) => {
    try {
      const updated = await fn(adId, ...args);
      setAds(prev => prev.map(a => a.id === adId ? updated : a));
      toast.success(successMsg);
    } catch { toast.error('Ошибка'); }
  };

  const handleApprove = (id) => { hapticFeedback('success'); act(approveAdPost, id, 'Одобрено'); };
  const handleReject = (id) => {
    hapticFeedback('heavy');
    const reason = prompt('Причина отклонения:');
    if (!reason) return;
    act(rejectAdPost, id, 'Отклонено', reason);
  };
  const handlePause = (id) => { hapticFeedback('medium'); act(pauseAdPost, id, 'На паузе'); };
  const handleResume = (id) => { hapticFeedback('medium'); act(resumeAdPost, id, 'Возобновлено'); };
  const handleDelete = async (id) => {
    hapticFeedback('heavy');
    if (!window.confirm('Удалить рекламный пост?')) return;
    try {
      await deleteAdPost(id);
      setAds(prev => prev.filter(a => a.id !== id));
      toast.success('Удалено');
    } catch { toast.error('Ошибка'); }
  };

  const toggleStats = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!statsCache[id]) {
      try {
        const s = await getAdStats(id);
        setStatsCache(prev => ({ ...prev, [id]: s }));
      } catch { /* тихо */ }
    }
  };

  const handleCreated = (newAd) => {
    setAds(prev => [newAd, ...prev]);
    setShowCreate(false);
    toast.success(isAdmin ? 'Реклама опубликована' : 'Отправлено на модерацию');
  };

  const filters = [
    { id: 'all', label: 'Все' },
    ...(isAdmin ? [{ id: 'pending_review', label: 'Ожидают' }] : []),
    { id: 'active', label: 'Активные' },
    { id: 'paused', label: 'Пауза' },
    { id: 'completed', label: 'Завершённые' },
  ];

  const pendingCount = isAdmin ? ads.filter(a => a.status === 'pending_review').length : 0;

  return (
    <div style={s.wrap}>
      {/* Сводка (админ) */}
      {isAdmin && overview && (
        <div style={s.ovGrid}>
          {[
            { v: overview.total_active, l: 'Активных', c: '#22c55e' },
            { v: overview.total_pending, l: 'Ожидают', c: '#f59e0b' },
            { v: overview.total_impressions, l: 'Показы', c: '#3b82f6' },
            { v: `${overview.avg_ctr}%`, l: 'CTR', c: '#8b5cf6' },
          ].map((x, i) => (
            <div key={i} style={s.ovCard}>
              <div style={{ ...s.ovVal, color: x.c }}>{x.v}</div>
              <div style={s.ovLbl}>{x.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Хедер */}
      <div style={s.hdr}>
        <span style={s.hdrTitle}>
          Рекламные посты
          {pendingCount > 0 && <span style={s.badge}>{pendingCount}</span>}
        </span>
        <button style={s.createBtn} onClick={() => { hapticFeedback('light'); setShowCreate(!showCreate); }}>
          <Plus size={16} /> Создать
        </button>
      </div>

      {showCreate && <CreateAdForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />}

      {/* Фильтры */}
      <div style={s.chips}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => { hapticFeedback('selection'); setFilter(f.id); }}
            style={{
              ...s.chip,
              background: filter === f.id ? theme.colors.primary : theme.colors.bgSecondary,
              color: filter === f.id ? '#fff' : theme.colors.textSecondary,
              border: `1px solid ${filter === f.id ? theme.colors.primary : theme.colors.border}`,
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : ads.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📢</div>
          <div style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
            {filter === 'all' ? 'Нет рекламных постов' : 'Ничего не найдено'}
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {ads.map(ad => (
            <AdCard
              key={ad.id} ad={ad} isAdmin={isAdmin}
              expanded={expandedId === ad.id} stats={statsCache[ad.id]}
              onToggleStats={() => toggleStats(ad.id)}
              onApprove={() => handleApprove(ad.id)}
              onReject={() => handleReject(ad.id)}
              onPause={() => handlePause(ad.id)}
              onResume={() => handleResume(ad.id)}
              onDelete={() => handleDelete(ad.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================
// Ad Card
// ==============================
function AdCard({ ad, isAdmin, expanded, stats, onToggleStats, onApprove, onReject, onPause, onResume, onDelete }) {
  const st = STATUS_MAP[ad.status] || STATUS_MAP.draft;
  const ScopeIcon = SCOPE_MAP[ad.scope]?.icon || Globe;
  const ctr = ad.impressions_count > 0 ? (ad.clicks_count / ad.impressions_count * 100).toFixed(1) : '0.0';

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTitle}>{ad.post_title || ad.advertiser_name}</div>
          <div style={s.cardMeta}>
            <ScopeIcon size={12} />
            <span>{SCOPE_MAP[ad.scope]?.label}</span>
            {ad.target_university && <span> · {ad.target_university}</span>}
            {ad.creator && <span> · {ad.creator.name}</span>}
          </div>
        </div>
        <div style={{ ...s.statusBadge, background: st.bg, color: st.color }}>{st.label}</div>
      </div>

      {ad.post_body && (
        <div style={s.cardBody}>{ad.post_body.length > 100 ? ad.post_body.slice(0, 100) + '…' : ad.post_body}</div>
      )}

      {/* Счётчики */}
      <div style={s.counters}>
        <span style={s.cnt}><Eye size={13} /> {ad.impressions_count}</span>
        <span style={s.cnt}><MousePointerClick size={13} /> {ad.clicks_count}</span>
        {ad.impressions_count > 0 && <span style={{ ...s.cnt, color: theme.colors.primary }}>CTR {ctr}%</span>}
        {ad.impression_limit && <span style={s.cnt}>{ad.impressions_count}/{ad.impression_limit}</span>}
        {ad.cta_url && <span style={{ ...s.cnt, color: theme.colors.primary }}><ExternalLink size={12} /> {ad.cta_text || 'CTA'}</span>}
      </div>

      {/* Действия */}
      <div style={s.actions}>
        {isAdmin && ad.status === 'pending_review' && (
          <>
            <button style={s.btnGreen} onClick={onApprove}><CheckCircle size={14} /> Да</button>
            <button style={s.btnRed} onClick={onReject}><XCircle size={14} /> Нет</button>
          </>
        )}
        {isAdmin && ad.status === 'active' && <button style={s.btnOrange} onClick={onPause}><Pause size={14} /> Пауза</button>}
        {isAdmin && ad.status === 'paused' && <button style={s.btnGreen} onClick={onResume}><Play size={14} /> Возобн.</button>}
        <button style={s.btnNeutral} onClick={onToggleStats}>
          <BarChart3 size={14} />{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
        <button style={s.btnDelSm} onClick={onDelete}><Trash2 size={14} /></button>
      </div>

      {expanded && (
        <div style={s.statsBox}>
          {!stats ? (
            <div style={{ textAlign: 'center', padding: 12, color: theme.colors.textTertiary, fontSize: 13 }}>Загрузка…</div>
          ) : (
            <div style={s.statsGrid}>
              {[
                { n: stats.impressions_count, l: 'Показы' },
                { n: stats.unique_views_count, l: 'Уник.' },
                { n: stats.clicks_count, l: 'Клики' },
                { n: `${stats.ctr}%`, l: 'CTR', color: theme.colors.primary },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: x.color || theme.colors.text }}>{x.n}</div>
                  <div style={{ fontSize: 10, color: theme.colors.textTertiary, fontWeight: 600 }}>{x.l}</div>
                </div>
              ))}
            </div>
          )}
          {ad.reject_reason && (
            <div style={s.rejectBox}>❌ {ad.reject_reason}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================
// Create Form
// ==============================
function CreateAdForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '', body: '', advertiser_name: '', scope: 'university',
    cta_text: '', cta_url: '', impression_limit: '', ends_at: '', priority: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (form.title.trim().length < 3) { toast.error('Заголовок мин. 3 символа'); return; }
    if (form.body.trim().length < 10) { toast.error('Текст мин. 10 символов'); return; }
    if (!form.advertiser_name.trim()) { toast.error('Укажите рекламодателя'); return; }
    setSubmitting(true);
    try {
      const p = { title: form.title.trim(), body: form.body.trim(), advertiser_name: form.advertiser_name.trim(), scope: form.scope, priority: form.priority };
      if (form.cta_text.trim()) p.cta_text = form.cta_text.trim();
      if (form.cta_url.trim()) p.cta_url = form.cta_url.trim();
      if (form.impression_limit) p.impression_limit = parseInt(form.impression_limit);
      if (form.ends_at) p.ends_at = new Date(form.ends_at).toISOString();
      onCreated(await createAdPost(p));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка создания');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={s.form}>
      <input style={s.input} placeholder="Заголовок *" value={form.title} onChange={e => set('title', e.target.value)} maxLength={200} />
      <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} placeholder="Текст рекламы *" value={form.body} onChange={e => set('body', e.target.value)} maxLength={2000} />
      <input style={s.input} placeholder="Рекламодатель *" value={form.advertiser_name} onChange={e => set('advertiser_name', e.target.value)} maxLength={200} />

      <div style={s.scopeRow}>
        {Object.entries(SCOPE_MAP).map(([k, { label, icon: I }]) => (
          <button key={k} onClick={() => set('scope', k)} style={{
            ...s.scopeBtn,
            background: form.scope === k ? theme.colors.primary : theme.colors.bgSecondary,
            color: form.scope === k ? '#fff' : theme.colors.textSecondary,
            border: `1px solid ${form.scope === k ? theme.colors.primary : theme.colors.border}`,
          }}><I size={14} /> {label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Текст кнопки" value={form.cta_text} onChange={e => set('cta_text', e.target.value)} />
        <input style={{ ...s.input, flex: 2 }} placeholder="https://..." value={form.cta_url} onChange={e => set('cta_url', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Лимит показов" type="number" value={form.impression_limit} onChange={e => set('impression_limit', e.target.value)} />
        <input style={{ ...s.input, flex: 1 }} type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} />
      </div>
      <div style={s.prioRow}>
        <span style={{ fontSize: 13, color: theme.colors.textSecondary }}>Приоритет: {form.priority}</span>
        <input type="range" min={1} max={10} value={form.priority} onChange={e => set('priority', +e.target.value)} style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={s.cancelBtn} onClick={onCancel}>Отмена</button>
        <button style={{ ...s.submitBtn, opacity: submitting ? 0.5 : 1 }} onClick={submit} disabled={submitting}>
          {submitting ? 'Создание…' : 'Создать'}
        </button>
      </div>
    </div>
  );
}

// ==============================
// Styles
// ==============================
const s = {
  wrap: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },

  ovGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 4 },
  ovCard: { background: theme.colors.card, borderRadius: 12, padding: '10px 6px', border: `1px solid ${theme.colors.borderLight}`, textAlign: 'center' },
  ovVal: { fontSize: 18, fontWeight: 800, lineHeight: 1, marginBottom: 2 },
  ovLbl: { fontSize: 10, fontWeight: 600, color: theme.colors.textSecondary },

  hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  hdrTitle: { fontSize: 15, fontWeight: 700, color: theme.colors.text, display: 'flex', alignItems: 'center', gap: 6 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, background: '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },
  createBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 10, background: theme.colors.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  chips: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' },
  chip: { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },

  card: { background: theme.colors.card, borderRadius: 14, padding: 14, border: `1px solid ${theme.colors.border}` },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: theme.colors.text, marginBottom: 2 },
  cardMeta: { fontSize: 12, color: theme.colors.textTertiary, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cardBody: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 1.4, marginTop: 8 },
  statusBadge: { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },

  counters: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.colors.borderLight}` },
  cnt: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: theme.colors.textTertiary, fontWeight: 600 },

  actions: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  btnGreen:  { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid #22c55e40', background: '#22c55e10', color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnRed:    { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid #ef444440', background: '#ef444410', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnOrange: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: '1px solid #f9731640', background: '#f9731610', color: '#f97316', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnNeutral:{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, background: theme.colors.bgSecondary, color: theme.colors.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnDelSm:  { display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 8, border: '1px solid #ef444430', background: 'transparent', color: '#ef4444', cursor: 'pointer', marginLeft: 'auto' },

  statsBox: { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.colors.borderLight}` },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 },
  rejectBox: { marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#ef444410', fontSize: 12, color: '#ef4444' },

  form: { background: theme.colors.card, borderRadius: 14, padding: 14, border: `1px solid ${theme.colors.border}`, display: 'flex', flexDirection: 'column', gap: 8 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, background: theme.colors.bgSecondary, color: theme.colors.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  scopeRow: { display: 'flex', gap: 6 },
  scopeBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  prioRow: { display: 'flex', alignItems: 'center', gap: 10 },
  cancelBtn: { flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${theme.colors.border}`, background: theme.colors.bgSecondary, color: theme.colors.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  submitBtn: { flex: 2, padding: 10, borderRadius: 10, border: 'none', background: theme.colors.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  empty: { textAlign: 'center', padding: '40px 20px' },
  center: { display: 'flex', justifyContent: 'center', padding: '40px 0' },
  spinner: { width: 28, height: 28, borderRadius: '50%', border: `3px solid ${theme.colors.border}`, borderTopColor: theme.colors.primary, animation: 'spin 0.8s linear infinite' },
};

export default CampaignManager;


