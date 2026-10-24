# 지식서재 매일 업데이트 절차

매일 한 번, 새 세션이 이 문서대로 지식서재를 보강한다. 모든 결과물은 한국어로 쓴다.

## 배포 대상
- 공개 홈페이지: https://0801dawon-alt.github.io/dawon/ (GitHub Pages, `deploy.yml` 워크플로)
- Claude 링크: https://claude.ai/artifact/Y9WdgjDnkGwq1eqap33XgE (사용자 본인만 보는 비공개 artifact)
- 브랜치: 작업은 `thought-library-app`에서 하고, 같은 커밋을 `main`에도 push한다.

## 지켜야 할 것
- 저장소는 **공개**다. `src/data/notion-notes.json`(사용자의 개인 노션 정리)은 절대 커밋하지 않는다. `.gitignore`에 들어 있다.
- 노션 정리는 Claude 링크 빌드에만 들어간다. artifact에 `data/notion-notes.json`으로 올려 두었으니, Artifact read(`path: "data/notion-notes.json"`)로 받아 `src/data/notion-notes.json`에 두고 빌드한다. 받지 못하면 Claude 링크는 게시하지 말고 홈페이지만 배포한 뒤 결과에 그 사실을 적는다.
- API 키 등 비밀값은 코드에 넣지 않는다.
- 사용자가 직접 쓴 내용(나의 생각, 스크랩, 기록)은 브라우저 저장소에 있으니 건드리지 않는다.

## 1. 새 소주제: 카테고리마다 5개
- 카테고리 9개: 사회, 법, 정치, 경제, 과학, 환경, 문화, 국제, 이론 → 하루 45개.
- 새 파일 `src/data/topics-add-YYYYMMDD.js` (형식은 `topics-add-20261024a.js` 참고). 너무 크면 a/b로 나눈다. `store.js`가 `topics-add-*.js`를 자동으로 읽는다.
- id는 `k` + 번호. `node scripts/bank-check.mjs`의 `nextTopicId`부터 이어 쓴다.
- 필드: id, category, title, summary, keywords(3), tags(4), background, issues(3), motion, pro(3), con(3), questions(3).
- 주제 고르기: 로스쿨 면접에 실제로 나왔거나 나올 법한 주제. 시사와 직결되지 않아도 되고, 식상한 고전 주제도 넣는다(예: 통일은 반드시 해야 하는가, 초등 저학년 숙제 폐지, 선의의 거짓말, 악법도 법인가). 기존 제목과 겹치지 않게 `node scripts/bank-check.mjs list 0 999`로 확인한다.
- 질문은 '~입니까?', '~생각합니까?', '~답변해보시오.', '~제시해보시오.'로 끝낸다. 한 질문에 대립 지점 하나. 맥락 1문장 + 질문.
- 실제 법령·판례·통계는 확실한 것만 쓰고, 불확실하면 쓰지 않는다. 실존 기관이 하지 않은 일을 했다고 쓰지 않는다.

## 2. 모범답안
- `node scripts/bank-check.mjs missing 25`로 답안이 없는 질문을 확인하고, 새 소주제 질문부터 채운 뒤 기존 질문을 이어서 채운다. 하루 최소 150개.
- 파일 `src/data/bank/q-NNN.js` (번호 이어서). 형식:
  ```js
  import { M } from '../../lib/bankModels.js';
  export default [
    ...M('k46', [
      ['질문의 첫 몇 단어', '모범답안 본문'],
      ...
    ]),
  ];
  ```
  배열 순서는 그 소주제 questions 순서와 같아야 한다. 첫 단어가 질문과 다르면 그 답은 버려진다.
- 답안: 말로 하는 문장, 약 2분(공백 포함 500~650자). 결론(입장) → 근거 2~3개 → 반대 입장 인정과 재반박 → 대안·정리. 법률 지식에 기대지 말고 상식과 논리로. 지어낸 통계 금지.
- 끝나면 `node scripts/bank-check.mjs`에서 mismatched가 0인지 확인한다.

## 3. 제시문 세트: 하루 6개 이상
- 파일 `src/data/bank/p-YYYYMMDD-NN.js`. 형식은 `p-20261024-01.js` 참고:
  `{ k:'p', id:'p고유번호', lt:'분석·비교형|분석+사례해결형|시사쟁점형', t:[관련 소주제 id], th:[가치 주제(constants.js VALUE_THEMES의 t)], title, ps:[{label:'가', source, text}], qs:[문항 3개], fu:[추가질문 3개], ms:[문항별 모범답안 3개] }`
- 제시문은 사례형 중심으로 구체적인 사례를 넣는다. 실제 사건이 아니어도 된다(갑·을·병, A국). 고전·문학·우화·신화에서 가져온 사례를 비유로 쓴다(예: 레 미제라블, 안티고네, 기게스의 반지, 흥부전, 심청전, 피리 부는 사나이, 오멜라스).
- 세트마다 성격이 다른 제시문 3개: 이론·고전 재구성 / 구체적 가상 사례 / A국 법조문·가상 통계·대립 논거 목록 중에서 조합. 제시문끼리 서로 적용·비판할 수 있게 연결한다.
- 서울대·고려대·강원대 로스쿨 기출 수준. 문항은 '~하시오.'로 끝낸다: 요약·비교 / 원리를 사례에 적용 / 당사자별 입장 서술 또는 해결책 선택 논증.
- 이미 있는 세트와 주제·고전이 겹치지 않게 한다(`grep -h "title:" src/data/bank/p-*.js`).

## 4. 소주제 내용 다듬기
- 사실이 바뀐 소주제(법 개정, 판결, 정책 변화)가 있으면 해당 데이터 파일의 summary/background/issues를 고친다. 저장된 라이브러리는 사용자가 편집하지 않은 소주제에 한해 새 내용으로 바뀐다.
- 질문을 고치면 그 질문의 모범답안도 다시 쓴다.

## 5. 빌드와 배포
1. `npm ci` (node_modules가 없을 때), `node scripts/bank-check.mjs`, `npx vite build`.
2. 커밋: `git add`는 파일을 지정해서 한다. notion-notes.json이 스테이징되지 않았는지 `git diff --cached --name-only`로 확인한다.
3. `git push origin HEAD:thought-library-app` 와 `git push origin HEAD:main`.
4. `gh workflow run deploy.yml --ref thought-library-app` 후 `gh run watch`로 성공을 확인한다.
5. Claude 링크 게시:
   - artifact를 먼저 read하고 `scope: "files"`로 현재 파일 목록을 본다.
   - 게시용 폴더를 만들어 `thought-library.html`(아래 내용)과 `assets/`(dist/assets 전체), `data/notion-notes.json`을 둔다.
     ```html
     <title>Thought Library</title>
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;500;700&family=Noto+Sans+KR:wght@200;300;400;500;600&family=IBM+Plex+Mono:wght@300;400;500&display=swap">
     <link rel="stylesheet" href="assets/index-해시.css">
     <div id="root"></div>
     <script type="module" src="assets/index-해시.js"></script>
     ```
   - Artifact publish: `url`은 위 Claude 링크, `root`는 그 폴더, `files`에는 새 assets 전부와 `data/notion-notes.json`, 목록에 있지만 새 빌드에 없는 옛 assets는 `null`.
6. 결과 요약(추가한 소주제 제목, 답안 수, 제시문 세트 수)을 마지막 답변에 짧게 적는다.
