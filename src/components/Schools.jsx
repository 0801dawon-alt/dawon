import { Rail } from './Chrome.jsx';
import { SCHOOLS, READY } from '../data/schools/list.js';
import { HOLD } from '../data/schools/formats.js';

// ── 학교 목록 ──────────────────────────────────────────────
export function SchoolList({ onPick }) {
  return (
    <section className="section" style={{ borderTop: '1px solid var(--line)' }}>
      <Rail no="05" label="SCHOOLS" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, minWidth: 0 }}>
        <div className="title-block">
          <h2 className="h2">학교별 모의면접.</h2>
          <div className="accent-bar" />
          <p className="sch-lead">지원할 학교를 고르면 그 학교의 면접 방식대로 연습할 수 있어요. 학교 공지·모집요강으로 면접 방식을 확인한 충남대·원광대·전북대·강원대가 열려 있어요. 방식을 확인하지 못한 학교는 확인될 때까지 보류합니다.</p>
        </div>
        {SCHOOLS.map(([region, list]) => (
          <div key={region} className="sch-region">
            <span className="label" style={{ color: 'var(--muted)' }}>{region}</span>
            <div className="sch-grid">
              {list.map(([id, name]) => {
                const ready = !!READY[id];
                return (
                  <button key={id} className={'sch-card' + (ready ? ' ready' : '')} disabled={!ready} title={ready ? '' : HOLD[id] || ''} onClick={() => ready && onPick(id)}>
                    <b>{name}</b>
                    <small>{ready ? READY[id] + ' →' : '보류 · ' + (HOLD[id] || '방식 미확인')}</small>
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

