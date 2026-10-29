import { useState } from 'react';
import { getApiKey, hasApiKey, inArtifact, setApiKey } from '../lib/ai.js';

export default function Settings({ onClose, onSaved, recordsText }) {
  const [copied, setCopied] = useState(false);
  const copyRecords = () => navigator.clipboard?.writeText(recordsText()).then(() => setCopied(true), () => setCopied(false));
  const [key, setKey] = useState(getApiKey());
  const save = () => { setApiKey(key.trim()); onSaved(key.trim() ? 'AI를 연결했습니다' : 'AI 연결을 해제했습니다'); };
  return (
    <div className="overlay" style={{ zIndex: 60, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="overlay-dim" style={{ background: 'rgba(20,20,20,0.5)' }} onClick={onClose} />
      <div className="modal" style={{ width: 'min(520px,100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 24 }}>AI 설정</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: 'var(--body)' }}>
          질문·제시문 생성, 답변 피드백, 꼬리질문, 누적 분석, 항목 재구성은 Claude API로 동작합니다.
          Anthropic API 키를 넣으면 이 브라우저에만 저장되고, 요청은 브라우저에서 Anthropic으로 바로 전송됩니다.
          키가 없으면 미리 준비된 기본 문장과 규칙 기반 평가가 대신 나옵니다.
        </p>
        {inArtifact() && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, padding: '12px 14px', background: '#efede6' }}>
            {hasApiKey() ? 'claude.ai 안에서 열려 있어 키 없이 내 Claude 계정으로 AI 기능을 쓸 수 있어요. 처음 쓸 때 한 번 허용을 묻습니다.' : 'claude.ai 안에서는 키 없이 Claude를 쓸 수 있지만, 지금은 연결되지 않았어요. 아래에 키를 넣어도 됩니다.'}
          </div>
        )}
        {inArtifact() ? (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--body)' }}>
            읽은 주제, 나의 생각, 답변과 피드백, 직접 추가한 주제는 내 Claude 계정에 저장돼요. 휴대폰이든 노트북이든 이 Claude 링크로 열면 어디서나 똑같이 보여요.
          </div>
        ) : recordsText && (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, padding: '12px 14px', background: '#efede6', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>이 홈페이지의 기록은 이 브라우저에만 있어요. 아래 버튼으로 복사한 뒤 Claude 링크의 ‘답변 녹음 · 피드백’ 답변 칸에 붙여 넣으면 읽은 주제, 나의 생각, 답변·피드백, 직접 추가한 주제가 내 Claude 계정으로 옮겨져요.</span>
            <button className="btn-line" style={{ alignSelf: 'flex-start', padding: '8px 16px' }} onClick={copyRecords}>{copied ? '복사했어요 ✓' : '이 기기 기록 복사하기'}</button>
          </div>
        )}
        <label className="form-label">Anthropic API 키
          <input className="form-input" type="password" autoComplete="off" value={key} onChange={ev => setKey(ev.target.value)} placeholder="sk-ant-…" />
        </label>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>공용 컴퓨터에서는 사용 후 키를 지워주세요. 키는 console.anthropic.com에서 발급할 수 있습니다.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {getApiKey() && <button className="btn-line" style={{ padding: '12px 20px' }} onClick={() => { setApiKey(''); onSaved('AI 연결을 해제했습니다'); }}>키 지우기</button>}
          <button className="btn-solid" style={{ padding: '12px 24px', border: 'none' }} onClick={save}>저장</button>
        </div>
      </div>
    </div>
  );
}
