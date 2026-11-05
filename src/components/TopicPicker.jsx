import { useMemo, useState } from 'react';
import { CAT_ORDER } from '../lib/constants.js';

// Topic choice in two steps: a category (or all), then a search that narrows the topic list.
export default function TopicPicker({ entries: all, value, onChange, dark = false, only = null, onlyLabel = '' }) {
  const [narrow, setNarrow] = useState(true);
  const entries = useMemo(() => (only && narrow ? all.filter(e => only.has(e.id)) : all), [all, only, narrow]);
  const cur = all.find(e => e.id === value);
  const [cat, setCat] = useState('전체');
  const [q, setQ] = useState('');
  const cats = useMemo(() => {
    const present = [...new Set(entries.map(e => e.category).filter(Boolean))];
    return ['전체', ...CAT_ORDER.filter(c => present.includes(c)), ...present.filter(c => !CAT_ORDER.includes(c))];
  }, [entries]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = entries.filter(e => (cat === '전체' || e.category === cat)
    && words.every(w => [e.title, e.summary, ...(e.keywords || []), ...(e.tags || [])].join(' ').toLowerCase().includes(w)));
  // Keep the chosen topic visible even when it falls outside the filter.
  const shown = cur && !list.includes(cur) ? [cur, ...list] : list;
  const pick = (c, text) => {
    const ws = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const first = entries.find(e => (c === '전체' || e.category === c) && ws.every(w => [e.title, e.summary, ...(e.keywords || []), ...(e.tags || [])].join(' ').toLowerCase().includes(w)));
    if (first && (!cur || (c !== '전체' && cur.category !== c) || ws.length)) onChange(first.id);
  };
  const field = dark ? 'select-dark' : 'underline-field';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select className={field} style={{ flex: '0 0 auto', minWidth: 0 }} value={cat} aria-label="카테고리" onChange={ev => { setCat(ev.target.value); pick(ev.target.value, q); }}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={field} style={{ flex: '1 1 160px', minWidth: 0 }} value={q} aria-label="주제 검색" placeholder="주제 검색 (예: 촉법, 기본소득)"
          onChange={ev => { setQ(ev.target.value); pick(cat, ev.target.value); }} />
      </div>
      <select className={field} style={{ minWidth: 0, width: '100%' }} value={value} aria-label="주제" onChange={ev => onChange(ev.target.value)}>
        {shown.map(e => <option key={e.id} value={e.id}>{(cat === '전체' ? '[' + e.category + '] ' : '') + e.title}</option>)}
      </select>
      <span style={{ fontSize: 11.5, color: dark ? 'var(--muted-3)' : '#8a8780', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {list.length ? `${list.length}개 주제` : '검색 결과가 없어요'}
        {only && (
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={narrow} onChange={ev => { setNarrow(ev.target.checked); if (ev.target.checked && !only.has(value)) { const f = all.find(e => only.has(e.id)); if (f) onChange(f.id); } }} />
            {onlyLabel}
          </label>
        )}
      </span>
    </div>
  );
}
