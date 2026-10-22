// Answer history (attempts + trend analysis) for the viewer's own private space
// in the claude.ai artifact database: data/users/<id>/<attemptId> and .../analysis.
// Resolves null outside claude.ai or when this viewer cannot have one, and the
// app then keeps history in localStorage.
const ANALYSIS_ID = 'analysis';
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export async function connectRecords({ local, onAttempts, onAnalysis, onFail }) {
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
    const attempts = [], docs = snap.docs;
    let analysis = null;
    docs.forEach(d => { if (d.id === ANALYSIS_ID) analysis = d.data(); else attempts.push(d.data()); });
    // First definitive read of an empty space: carry over this browser's earlier history once.
    if (!migrated && !snap.metadata.fromCache) {
      migrated = true;
      if (snap.empty && (local.attempts.length || local.analysis)) {
        local.attempts.slice(0, 200).forEach(a => guard(col.doc(a.id).set(a)));
        if (local.analysis) guard(col.doc(ANALYSIS_ID).set(local.analysis));
        return;
      }
    }
    onAttempts(attempts.sort(byDateDesc));
    onAnalysis(analysis);
  }, e => onFail(e));

  return {
    put: at => guard(col.doc(at.id).set(JSON.parse(JSON.stringify(at)))),
    remove: id => guard(col.doc(id).delete()),
    putAnalysis: an => guard(col.doc(ANALYSIS_ID).set(an)),
    unsubscribe,
  };
}
