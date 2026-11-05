// Turns an uploaded recording or video into text in the browser with Whisper (transformers.js).
// The model (about 250MB) downloads once from Hugging Face and the browser keeps it cached.
const MODEL = 'onnx-community/whisper-small';

let asrPromise = null;
function getAsr(onStatus) {
  if (!asrPromise) {
    asrPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      const seen = {};
      return pipeline('automatic-speech-recognition', MODEL, {
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        device: typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm',
        progress_callback: p => {
          if (p.status !== 'progress' || !p.total) return;
          seen[p.file] = [p.loaded, p.total];
          const [l, t] = Object.values(seen).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
          onStatus && onStatus(`인식 모델 받는 중… ${Math.round((l / t) * 100)}% (처음 한 번만 받아요)`);
        },
      });
    })().catch(e => { asrPromise = null; throw e; });
  }
  return asrPromise;
}

// Audio of any file the browser can play, as 16kHz mono samples.
async function decode(file) {
  const buf = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(buf);
    const n = audio.numberOfChannels, out = new Float32Array(audio.length);
    for (let c = 0; c < n; c++) { const d = audio.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / n; }
    return { samples: out, seconds: Math.round(audio.duration) };
  } finally { ctx.close && ctx.close(); }
}

export async function transcribeFile(file, onStatus) {
  onStatus && onStatus('파일에서 소리를 읽는 중…');
  const { samples, seconds } = await decode(file);
  const asr = await getAsr(onStatus);
  onStatus && onStatus('답변을 글로 옮기는 중… (답변 길이에 따라 1~3분)');
  const out = await asr(samples, { language: 'korean', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  return { text: ((out && out.text) || '').trim(), seconds };
}
