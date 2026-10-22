import { forwardRef } from 'react';
import { catColor } from '../lib/constants.js';
import { pad } from '../lib/util.js';
import { Rail } from './Chrome.jsx';

// 8 per page fills every row at 4, 2 or 1 columns (see .card-grid).
const PER_PAGE = 8;
// Number backdrops: [border-radius, width, height, rotation]. Kept near-circular so
// the category label lines up across cards.
const SHAPES = [['50%', 56, 56, 0], ['28px 28px 0 0', 52, 56, 0], ['6px', 52, 52, 8], ['999px', 52, 58, 0], ['18px', 54, 54, 45], ['50% 0', 54, 54, 0], ['0 0 28px 28px', 56, 50, 0], ['50%', 56, 52, -6], ['16px 4px', 50, 58, 0]];

function NumberShape({ entry, index }) {
  const [radius, w, h, rot] = SHAPES[(entry.title.length * 7 + index * 5) % SHAPES.length];
  const col = catColor(entry.category), outline = (index + entry.title.length) % 3 === 0;
  return (
    <div className="card-num">
      <div className="card-shape" style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, borderRadius: radius, background: outline ? 'transparent' : col + '26', border: `1px solid ${outline ? col + '99' : 'transparent'}`, transform: `rotate(${rot}deg)` }} />
      <span>{pad(index + 1)}</span>
    </div>
  );
}

const Library = forwardRef(function Library({ entries, categories, cat, setCat, search, setSearch, page, setPage, onOpen, onNew }, ref) {
  const q = search.trim().toLowerCase();
  const filtered = entries.filter(e => (cat === '전체' || e.category === cat) && (!q || [e.title, e.summary, ...(e.keywords || [])].join(' ').toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const start = cur * PER_PAGE;
  const go = p => setPage(Math.max(0, Math.min(pages - 1, p)), true);
  let a = Math.max(0, cur - 2); const b = Math.min(pages, a + 5); a = Math.max(0, b - 5);
  const nums = []; for (let p = a; p < b; p++) nums.push(p);

  return (
    <section ref={ref} className="section">
      <Rail no="01" label="LIBRARY" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minWidth: 0 }}>
        <div className="lib-head">
          <div className="title-block">
            <h2 className="h2" data-reveal="1">지식 서재.</h2>
            <div className="accent-bar" />
          </div>
          <div className="lib-tools">
            <span className="add-link" onClick={onNew}>+ 새 항목</span>
            <input className="search" value={search} onChange={ev => setSearch(ev.target.value)} placeholder="주제·키워드 검색" />
          </div>
        </div>
        <div className="chip-row">
          {['전체', ...categories].map(c => {
            const on = c === cat, colored = on && c !== '전체';
            return (
              <button key={c} className="chip" onClick={() => setCat(c)}
                style={on ? { background: colored ? catColor(c) : '#151515', color: colored ? '#fff' : '#f3f1e8' } : undefined}>{c}</button>
            );
          })}
        </div>
        <div className="card-grid">
          {filtered.slice(start, start + PER_PAGE).map((e, i0) => (
            <article key={e.id} className="card" data-reveal="1" data-d={(i0 % 4) * 90} onClick={() => onOpen(e.id)}>
              <div className="card-top">
                <NumberShape entry={e} index={start + i0} />
                <span className="card-cat"><span style={{ width: 7, height: 7, background: catColor(e.category) }} />{e.category}</span>
              </div>
              <h3>{e.title}</h3>
              <p>{e.summary}</p>
              <div className="card-foot">
                <span className="kw">{(e.keywords || []).slice(0, 3).join(' · ')}</span>
                <span className="open">열기</span>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ padding: '40px 0', fontSize: 14, color: 'var(--muted)' }}>조건에 맞는 항목이 없습니다.</div>}
        {pages > 1 && (
          <div className="pager">
            <span className="pager-info">{`${filtered.length}개 중 ${filtered.length ? start + 1 : 0}–${Math.min(filtered.length, start + PER_PAGE)}`}</span>
            <div className="pager-btns">
              <button className="pager-step" style={{ opacity: cur === 0 ? 0.3 : 1 }} onClick={() => go(cur - 1)}>← 이전</button>
              {nums.map(p => <button key={p} className={'pager-num' + (p === cur ? ' on' : '')} onClick={() => go(p)}>{p + 1}</button>)}
              <button className="pager-step" style={{ opacity: cur >= pages - 1 ? 0.3 : 1 }} onClick={() => go(cur + 1)}>다음 →</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export default Library;
