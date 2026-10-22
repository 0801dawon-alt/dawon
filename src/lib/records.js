// Answer history (attempts + trend analysis) and '나의 생각' notes for the viewer's own
// private space in the claude.ai artifact database: data/users/<id>/<attemptId>,
// .../analysis, .../note-<entryId> and .../myquestions (questions typed in by the viewer).
// Resolves null outside claude.ai or when this viewer cannot have one, and the
// app then keeps history in localStorage.
const ANALYSIS_ID = 'analysis';
const NOTE = 'note-';
const MYQ_ID = 'myquestions';
const VIEWED_ID = 'viewed';
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export async function connectRecords({ local, onAttempts, onAnalysis, onNotes, onMyQuestions, onViewed, onFail }) {
  const c = window.claude;
  if (!c?.use) return null;
  const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
  if (!db || !user) return null;
  const uid = await user.id();
  if (!uid) return null;
  const col = db.collection('data/users/' + uid);

  // A rejected write means this viewer may not save here (e.g. view-only access).
  const guard = p => p.catch(e => { if (e?.code === 'invalid_argument' || e?.code === 'not_granted' || e?.code === 'revoked') onFail(e); else console.warn('[Thought Library] save failed:', e); });

  let migrated = false;
  const unsubscribe = col.onSnapshot(snap => {
    const attempts = [], notes = {};
    let analysis = null, myQuestions = null, viewed = null;
    snap.docs.forEach(d => {
      if (d.id === ANALYSIS_ID) analysis = d.data();
      else if (d.id === MYQ_ID) myQuestions = d.data().items || [];
      else if (d.id === VIEWED_ID) viewed = d.data().ids || [];
      else if (d.id.startsWith(NOTE)) notes[d.id.slice(NOTE.length)] = d.data().text || '';
      else attempts.push(d.data());
    });
    // First definitive read: carry over this browser's earlier history and notes once.
    if (!migrated && !snap.metadata.fromCache) {
      migrated = true;
      let wrote = false;
      if (!attempts.length && !analysis && (local.attempts.length || local.analysis)) {
        local.attempts.slice(0, 200).forEach(a => guard(col.doc(a.id).set(a)));
        if (local.analysis) guard(col.doc(ANALYSIS_ID).set(local.analysis));
        wrote = true;
      }
      Object.entries(local.notes).forEach(([id, text]) => {
        if (text && !(id in notes)) { guard(col.doc(NOTE + id).set({ text })); wrote = true; }
      });
      if (!myQuestions && local.myQuestions.length) { guard(col.doc(MYQ_ID).set({ items: local.myQuestions })); wrote = true; }
      if (!viewed && local.viewed.length) { guard(col.doc(VIEWED_ID).set({ ids: local.viewed })); wrote = true; }
      if (wrote) return;
    }
    onAttempts(attempts.sort(byDateDesc));
    onAnalysis(analysis);
    onNotes(notes);
    onMyQuestions(myQuestions || []);
    onViewed(viewed || []);
  }, e => onFail(e));

  return {
    put: at => guard(col.doc(at.id).set(JSON.parse(JSON.stringify(at)))),
    remove: id => guard(col.doc(id).delete()),
    putAnalysis: an => guard(col.doc(ANALYSIS_ID).set(an)),
    putNote: (id, text) => guard(col.doc(NOTE + id).set({ text })),
    putMyQuestions: items => guard(col.doc(MYQ_ID).set({ items })),
    putViewed: ids => guard(col.doc(VIEWED_ID).set({ ids })),
    unsubscribe,
  };
}
