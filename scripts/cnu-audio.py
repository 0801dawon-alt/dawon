# Builds the CNU simulator's Korean voice clips with the Supertonic 3 model (via sherpa-onnx).
# Usage: python3 scripts/cnu-audio.py MODEL_DIR [PART/PARTS]   (model files: duration_predictor.onnx … voice.bin)
# Several processes can share the work, e.g. 0/4 … 3/4, one CPU thread each.
# Every clip is normalised to the same speaking rate; 1차·2차 answers must land in 120–130 s and
# 1-minute answers under 60 s, measured on the generated audio. Unchanged clips are skipped.
import sys, os, json, hashlib, subprocess, tempfile
import sherpa_onnx as so, soundfile as sf, numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = sys.argv[1].rstrip('/') + '/'
OUT = os.path.join(ROOT, 'public', 'cnu-audio'); os.makedirs(OUT, exist_ok=True)
MAN = os.path.join(ROOT, 'src', 'data', 'cnu', 'audio.json')
VOICE = {'j1': 9, 'j2': 2, 'j3': 6, '1': 5, '3': 8, '4': 0, '5': 7}
RATE = json.load(open(os.path.join(ROOT, 'scripts', 'cnu-rates.json')))  # natural chars/s per speaker at speed 1
TARGET = 6.3  # chars per second (spaces included) every voice is brought to
PARTS = os.path.join(ROOT, 'scripts', '.cnu-audio-parts'); os.makedirs(PARTS, exist_ok=True)
part, parts = (map(int, sys.argv[2].split('/')) if len(sys.argv) > 2 else (0, 1))
def load_all():
    m = json.load(open(MAN)) if os.path.exists(MAN) else {}
    for f in sorted(os.listdir(PARTS)):
        try: m.update(json.load(open(os.path.join(PARTS, f))))
        except Exception: pass
    return m
man = load_all()
mine = {}
PART_FILE = os.path.join(PARTS, f'part-{part}.json')
if os.path.exists(PART_FILE): mine = json.load(open(PART_FILE))
def save_part():
    tmp = PART_FILE + '.tmp'; json.dump(mine, open(tmp, 'w'), ensure_ascii=False); os.replace(tmp, PART_FILE)
clips = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'scripts', 'cnu-clips.mjs')]))
mc = so.OfflineTtsModelConfig(); mc.num_threads = 1 if parts > 1 else 4
mc.supertonic = so.OfflineTtsSupertonicModelConfig(M + 'duration_predictor.onnx', M + 'text_encoder.onnx', M + 'vector_estimator.onnx', M + 'vocoder.onnx', M + 'tts.json', M + 'unicode_indexer.bin', M + 'voice.bin')
tts = so.OfflineTts(so.OfflineTtsConfig(model=mc))

import re
SINO = '영일이삼사오육칠팔구'
def sino(n):
    n = int(n)
    if n == 0: return '영'
    out = ''
    for unit, name in ((10**8, '억'), (10**4, '만'), (1, '')):
        q, n = divmod(n, unit)
        if not q: continue
        part = ''
        for u, nm in ((1000, '천'), (100, '백'), (10, '십'), (1, '')):
            d, q = divmod(q, u)
            if d: part += ('' if d == 1 and u > 1 else SINO[d]) + nm
        out += ('' if part == '일' and name == '만' else part) + name
    return out
NATIVE = {1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열', 20: '스무'}
def native(n):
    n = int(n)
    if n in NATIVE: return NATIVE[n]
    if 10 < n < 20: return '열' + NATIVE[n - 10]
    if 20 < n < 30: return '스물' + NATIVE[n - 20]
    return sino(n)
def norm(t):
    t = t.replace('·', ', ').replace('…', '.')
    t = re.sub(r'(\d+)(?=\s?(명|개|살|가지|곳|군데|번째|사람|시간|달|권))', lambda m: native(m.group(1)) if int(m.group(1)) < 30 else sino(m.group(1)), t)
    t = re.sub(r'(\d+)\s?%', lambda m: sino(m.group(1)) + ' 퍼센트', t)
    t = re.sub(r'\d+', lambda m: sino(m.group(0)), t)
    return t

def say(text, sid, speed):
    text = norm(text)
    g = so.GenerationConfig(); g.sid = sid; g.speed = speed; g.num_steps = 8; g.extra = {'lang': 'ko'}
    a = tts.generate(text, g); return np.array(a.samples, dtype=np.float32), a.sample_rate

def bounds(key):
    if key.endswith('-m1') or key.endswith('-m2'): return (120, 130)
    if key.endswith('-s') or key.startswith('pa-') or key.startswith('la-'): return (0, 59.5)
    return None

done = 0
for i, (key, seat, text) in enumerate(clips):
    if i % parts != part: continue
    seat = str(seat); sid = VOICE[seat]
    h = hashlib.sha1(f'{sid}|{norm(text)}|{TARGET}'.encode()).hexdigest()[:12]
    path = os.path.join(OUT, key + '.mp3')
    if man.get(key, {}).get('h') == h and os.path.exists(path): continue
    base = TARGET / RATE[str(sid)]; speed = base
    x, sr = say(text, sid, speed); d = len(x) / sr
    b = bounds(key)
    if b and not (b[0] <= d <= b[1]):
        want = (b[0] + b[1]) / 2 if b[0] else min(d, 57)
        speed = max(base * 0.92, min(base * 1.08, speed * d / want))
        x, sr = say(text, sid, speed); d = len(x) / sr
    x = x / max(1e-6, float(np.abs(x).max())) * 0.89
    with tempfile.NamedTemporaryFile(suffix='.wav') as w:
        sf.write(w.name, x, sr)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', w.name, '-ac', '1', '-ar', '24000', '-b:a', '32k', path], check=True)
    ok = (not b) or (b[0] <= d <= b[1])
    man[key] = mine[key] = {'d': round(d, 2), 'h': h, 'sp': round(speed / base, 3)}
    if not ok: man[key]['warn'] = 1
    done += 1
    print(f'{key:16} {d:6.1f}s  speed×{speed / base:.3f} {"" if ok else "  ← 길이 기준 밖"}', flush=True)
    save_part()
keys = {k for k, _, _ in clips}
man = {k: v for k, v in load_all().items() if k in keys}
tmp = MAN + '.tmp'; json.dump(man, open(tmp, 'w'), ensure_ascii=False, indent=0, sort_keys=True); os.replace(tmp, MAN)
print('clips', len(man), 'generated', done, 'warnings', sum(1 for v in man.values() if v.get('warn')))
