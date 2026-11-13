import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationProject } from '../model/types';
import { findSceneAtTime } from '../model/timeline';

export function useNarration(
  project: AnimationProject,
  currentTime: number,
  playing: boolean,
  enabled: boolean,
  rate: number,
  onSegmentEnd?: (nextTime: number) => void,
) {
  const spokenRef = useRef<string>('');
  const [boundary, setBoundary] = useState<{ key: string; charIndex: number }>();
  const onSegmentEndRef = useRef(onSegmentEnd);
  useEffect(() => {
    onSegmentEndRef.current = onSegmentEnd;
  }, [onSegmentEnd]);
  const active = useMemo(() => {
    const timing = findSceneAtTime(project, currentTime);
    const localTime = currentTime - timing.start;
    const segment = timing.scene.narration.find((item) => localTime >= item.start && localTime < item.end);
    return segment ? { ...segment, key: `${timing.scene.id}:${segment.id}`, globalEnd: timing.start + segment.end } : undefined;
  }, [project, currentTime]);

  /* eslint-disable react-hooks/set-state-in-effect -- speech playback clears the read-along boundary. */
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    if (!enabled || !playing || !active) {
      window.speechSynthesis.cancel();
      spokenRef.current = '';
      setBoundary(undefined);
      return;
    }
    if (spokenRef.current === `${active.key}:${rate}`) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(active.text);
    utterance.lang = project.locale;
    utterance.rate = active.rate ?? rate;
    const voices = window.speechSynthesis.getVoices();
    const requested = active.voice && voices.find((voice) => voice.name === active.voice);
    const fallback = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (requested || fallback) utterance.voice = requested || fallback || null;
    let disposed = false;
    let advanceTimer: number | undefined;
    setBoundary({ key: active.key, charIndex: 0 });
    utterance.onboundary = (event) => {
      if (!disposed && event.name === 'word') setBoundary({ key: active.key, charIndex: event.charIndex });
    };
    utterance.onend = () => {
      if (disposed || !onSegmentEndRef.current) return;
      advanceTimer = window.setTimeout(() => {
        if (!disposed) onSegmentEndRef.current?.(active.globalEnd);
      }, 200);
    };
    spokenRef.current = `${active.key}:${rate}`;
    window.speechSynthesis.speak(utterance);
    return () => {
      disposed = true;
      if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
      window.speechSynthesis.cancel();
    };
  }, [active?.key, enabled, playing, project.locale, rate]);

  return active ? { ...active, spokenCharIndex: boundary?.key === active.key ? boundary.charIndex : undefined } : undefined;
}
