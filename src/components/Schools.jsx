import { Rail } from './Chrome.jsx';
import { SCHOOLS, READY } from '../data/schools/list.js';

// ── 학교 목록 ──────────────────────────────────────────────
export function SchoolList({ onPick }) {
  return (
    <section className="section" style={{ borderTop: '1px solid var(--line)' }}>
      <Rail no="05" label="SCHOOLS" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, minWidth: 0 }}>
        <div className="title-block">
          <h2 className="h2">학교별 모의면접.</h2>
          <div className="accent-bar" />
          <p className="sch-lead">지원할 학교를 고르면 그 학교의 면접 방식대로 연습할 수 있어요. 지금은 충남대가 열려 있고, 다른 학교는 차례로 준비하고 있어요.</p>
        </div>
        {SCHOOLS.map(([region, list]) => (
          <div key={region} className="sch-region">
            <span className="label" style={{ color: 'var(--muted)' }}>{region}</span>
            <div className="sch-grid">
              {list.map(([id, name]) => {
                const ready = !!READY[id];
                return (
                  <button key={id} className={'sch-card' + (ready ? ' ready' : '')} disabled={!ready} onClick={() => ready && onPick(id)}>
                    <b>{name}</b>
                    <small>{ready ? '집단 면접 시뮬레이션 →' : '준비 중'}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

