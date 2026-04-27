// AURA. — speechUtils
// Helpers da Web Speech API. Re-exporta RecordingDot de ./RecordingDot
// pra preservar imports antigos (`from './speechUtils'`).
//
// Historia: ate 26/04/2026 esse arquivo continha o componente
// RecordingDot com JSX embutido. Como a extensao e .ts (nao .tsx),
// o bundler quebrava com SyntaxError quando algum modulo importava
// speechUtils. Split feito: JSX foi pra ./RecordingDot.tsx; aqui
// ficaram os helpers TS puros + re-export.

// ─── Web Speech API helpers ─────────────────────────────
export function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function createRecognition(): any {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  return rec;
}

// ─── Re-export pra retrocompat ────────────────────────
export { RecordingDot } from './RecordingDot';
