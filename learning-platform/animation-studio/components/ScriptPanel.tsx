import type { Scene } from '../model/types';

export interface TranscriptToken {
  text: string;
  start: number;
  isWord: boolean;
  wordIndex?: number;
}

export function tokenizeTranscript(text: string, locale: string): TranscriptToken[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    let wordIndex = 0;
    return [...segmenter.segment(text)].map((part) => ({
      text: part.segment,
      start: part.index,
      isWord: part.isWordLike ?? false,
      wordIndex: part.isWordLike ? wordIndex++ : undefined,
    }));
  }
  let wordIndex = 0;
  let cursor = 0;
  return text.split(/([\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*)/gu).filter(Boolean).map((part) => {
    const token = { text: part, start: cursor, isWord: /^[\p{L}\p{N}]/u.test(part), wordIndex: undefined as number | undefined };
    cursor += part.length;
    if (token.isWord) token.wordIndex = wordIndex++;
    return token;
  });
}

export function getActiveWordIndex(text: string, locale: string, progress: number, spokenCharIndex?: number): number {
  const words = tokenizeTranscript(text, locale).filter((token) => token.isWord);
  if (!words.length) return -1;
  if (spokenCharIndex !== undefined) {
    const exact = words.find((token, index) => spokenCharIndex >= token.start && spokenCharIndex < (words[index + 1]?.start ?? text.length));
    if (exact?.wordIndex !== undefined) return exact.wordIndex;
  }
  const weights = words.map((word) => Math.max(1, [...word.text].length));
  const target = Math.max(0, Math.min(0.999999, progress));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  for (let index = 0; index < words.length; index += 1) {
    cumulative += weights[index] / total;
    if (target < cumulative) return index;
  }
  return words.length - 1;
}

export function ScriptPanel({ scene, localTime, locale, visible, spokenCharIndex }: { scene: Scene; localTime: number; locale: string; visible: boolean; spokenCharIndex?: number }) {
  if (!visible) return null;
  const active = scene.narration.find((item) => localTime >= item.start && localTime < item.end);
  const activeProgress = active ? (localTime - active.start) / Math.max(0.001, active.end - active.start) : 0;
  const activeWordIndex = active ? getActiveWordIndex(active.text, locale, activeProgress, spokenCharIndex) : -1;
  const pages = [...new Set(scene.elements.flatMap((element) => element.sourcePages ?? []))].sort((a, b) => a - b);
  return <div className="script-panel panel">
    <div className="script-meta"><small>PAGE TRANSCRIPT</small><b>{scene.title}</b><span>{pages.length ? `Source ${pages.join(', ')}` : 'No source page'}</span></div>
    <div className="script-lines">{scene.narration.map((item, index) => {
      const isActive = active?.id === item.id;
      return <p className={`script-segment ${isActive ? 'active' : ''}`} key={item.id}><span className="script-index">{String(index + 1).padStart(2, '0')}</span>{tokenizeTranscript(item.text, locale).map((token, tokenIndex) => token.isWord
        ? <span className={`script-word ${isActive && token.wordIndex === activeWordIndex ? 'is-speaking' : ''}`} key={`${token.start}-${tokenIndex}`}>{token.text}</span>
        : token.text)}</p>;
    })}</div>
  </div>;
}
