// 충남대 집단 면접 시뮬레이션 데이터: 회차(6문항씩), 면접위원 대사, 마지막 질문, 인성질문.
// 모든 대사는 scripts/cnu-audio.py가 미리 음원으로 만들고, 자막은 여기 적힌 글이 그대로 쓰인다.
const files = import.meta.glob('./r*.js', { eager: true });
export const SETS = Object.keys(files).sort().map(k => files[k].default);
export { SEAT_VOICE, CYC2, CYC3, OTHER_NO, SCRIPTS, FINAL_TYPES, PERSONAL, CLOSING, PRACTICE, clips } from './meta.js';
