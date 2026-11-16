// 충남대 집단 면접 시뮬레이션 데이터: 회차(5문항씩), 면접위원 대사, 마지막 질문, 인성질문.
// 모든 대사는 scripts/cnu-audio.py가 미리 음원으로 만들고, 자막은 여기 적힌 글이 그대로 쓰인다.
import ROUNDS from './rounds.js';
const files = import.meta.glob('./r[0-9]*.js', { eager: true });
const BY = Object.fromEntries(Object.values(files).flatMap(f => f.default).map(q => [q.id, q]));
export const SETS = ROUNDS.map(ids => ids.map(id => BY[id]));
export { SEAT_VOICE, CYC2, CYC3, SCRIPTS, FINAL_TYPES, PERSONAL, CLOSING, PRACTICE, clips } from './meta.js';
