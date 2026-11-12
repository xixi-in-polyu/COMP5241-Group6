import { interpolate, spring } from 'remotion';
import type { CSSProperties } from 'react';
import type { AmbientMotion, ElementMotion, ElementType, MotionCue, MotionPreset, NarrationSegment, Scene, SceneElement } from './types';

export const ENTER_PRESETS = ['fade-rise', 'spring-scale', 'wipe-reveal', 'draw'] as const;
export const BEAT_PRESETS = ['pulse', 'lift', 'focus', 'glow', 'trace', 'count-up'] as const;
export const EXIT_PRESETS = ['fade', 'slide', 'shrink'] as const;
export const AMBIENT_PRESETS: AmbientMotion[] = ['none', 'drift', 'breathe', 'orbit'];
export const MOTION_PRESETS: MotionPreset[] = [...ENTER_PRESETS, ...BEAT_PRESETS, ...EXIT_PRESETS];

const enterForType = (type: ElementType): MotionPreset => {
  if (type === 'flow' || type === 'timeline' || type === 'topology' || type === 'diagram') return 'draw';
  if (type === 'lifecycle' || type === 'metrics' || type === 'formula') return 'spring-scale';
  return 'fade-rise';
};

const beatForType = (type: ElementType): MotionPreset => {
  if (type === 'flow' || type === 'timeline' || type === 'topology' || type === 'diagram') return 'trace';
  if (type === 'metrics') return 'count-up';
  if (type === 'cards' || type === 'comparison') return 'lift';
  if (type === 'lifecycle') return 'glow';
  return 'pulse';
};

const ambientForType = (type: ElementType): AmbientMotion => {
  if (type === 'lifecycle') return 'orbit';
  if (type === 'metrics' || type === 'badge') return 'breathe';
  if (type === 'topology') return 'drift';
  return 'none';
};

export function createDefaultMotion(
  elementId: string,
  type: ElementType,
  narration: NarrationSegment[],
  legacy?: { enter: 'fade' | 'rise' | 'scale' | 'draw'; start: number; duration: number },
): ElementMotion {
  const legacyPreset: Record<string, MotionPreset> = { fade: 'fade-rise', rise: 'fade-rise', scale: 'spring-scale', draw: 'draw' };
  return {
    enter: {
      id: `${elementId}-enter`,
      preset: legacy ? legacyPreset[legacy.enter] : enterForType(type),
      trigger: { type: 'time', at: legacy?.start ?? 0 },
      duration: legacy?.duration ?? 0.9,
      stagger: type === 'title' || type === 'text' ? 0.08 : 0.12,
      intensity: 1,
    },
    beats: narration.map((segment, index) => ({
      id: `${elementId}-beat-${index + 1}`,
      preset: beatForType(type),
      trigger: { type: 'narration', segmentId: segment.id, offset: 0.15 },
      duration: Math.min(1.5, Math.max(0.65, (segment.end - segment.start) * 0.16)),
      stagger: 0.1,
      intensity: 0.75,
    })),
    exit: {
      id: `${elementId}-exit`,
      preset: 'fade',
      trigger: { type: 'time', at: Math.max(0, (narration.at(-1)?.end ?? 1) - 0.45) },
      duration: 0.45,
      intensity: 1,
    },
    ambient: ambientForType(type),
  };
}

export function resolveCueStart(cue: MotionCue, scene: Scene): number | undefined {
  const trigger = cue.trigger;
  if (trigger.type === 'time') return trigger.at;
  const segment = scene.narration.find((item) => item.id === trigger.segmentId);
  return segment ? segment.start + (trigger.offset ?? 0) : undefined;
}

const linearProgress = (time: number, start: number, duration: number) => interpolate(
  time,
  [start, start + Math.max(0.01, duration)],
  [0, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
);

const springProgress = (time: number, start: number, fps: number) => spring({
  fps,
  frame: Math.max(0, Math.round((time - start) * fps)),
  config: { damping: 18, stiffness: 130, mass: 0.9 },
});

export interface CompiledMotion {
  style: CSSProperties;
  enterProgress: number;
  exitProgress: number;
  activeBeatIndex: number;
  activeBeatProgress: number;
  activeBeatPreset?: MotionPreset;
  itemStyle: (index: number, count: number) => CSSProperties;
  lineProgress: number;
  countProgress: number;
  orbitDegrees: number;
}

export function compileElementMotion(element: SceneElement, scene: Scene, time: number, fps: number, finalLayout = false): CompiledMotion {
  const enterStart = resolveCueStart(element.motion.enter, scene) ?? 0;
  const enterProgress = finalLayout ? 1 : element.motion.enter.preset === 'spring-scale'
    ? springProgress(time, enterStart, fps)
    : linearProgress(time, enterStart, element.motion.enter.duration);
  const exitStart = element.motion.exit ? resolveCueStart(element.motion.exit, scene) : undefined;
  const exitProgress = finalLayout || exitStart === undefined || !element.motion.exit
    ? 0
    : linearProgress(time, exitStart, element.motion.exit.duration);

  let activeBeatIndex = -1;
  let activeBeatProgress = 0;
  let activeBeatPreset: MotionPreset | undefined;
  let activeBeatCue: MotionCue | undefined;
  let activeBeatStart: number | undefined;
  if (!finalLayout) {
    element.motion.beats.forEach((cue, index) => {
      const start = resolveCueStart(cue, scene);
      if (start === undefined || time < start || time > start + cue.duration) return;
      const raw = linearProgress(time, start, cue.duration);
      activeBeatIndex = index;
      activeBeatProgress = Math.sin(raw * Math.PI) * (cue.intensity ?? 1);
      activeBeatPreset = cue.preset;
      activeBeatCue = cue;
      activeBeatStart = start;
    });
  }

  const ambientTime = finalLayout ? 0 : time;
  const ambientIntensity = element.motion.ambient === 'breathe'
    ? Math.sin(ambientTime * Math.PI * 0.65) * 0.012
    : element.motion.ambient === 'drift'
      ? Math.sin(ambientTime * Math.PI * 0.22) * 3
      : 0;
  const beatY = activeBeatPreset === 'lift' ? -8 * activeBeatProgress : 0;
  const beatScale = activeBeatPreset === 'pulse' || activeBeatPreset === 'glow' ? 1 + 0.035 * activeBeatProgress : 1;
  const enterIntensity = element.motion.enter.intensity ?? 1;
  const exitIntensity = element.motion.exit?.intensity ?? 1;
  const baseY = element.motion.enter.preset === 'fade-rise' ? (1 - enterProgress) * 34 * enterIntensity : 0;
  const baseScale = element.motion.enter.preset === 'spring-scale' ? 1 - (1 - enterProgress) * 0.18 * enterIntensity : 1;
  const exitX = element.motion.exit?.preset === 'slide' ? exitProgress * 45 * exitIntensity : 0;
  const exitScale = element.motion.exit?.preset === 'shrink' ? 1 - exitProgress * 0.12 * exitIntensity : 1;
  const clipProgress = element.motion.enter.preset === 'draw' || element.motion.enter.preset === 'wipe-reveal' ? enterProgress : 1;

  const itemStyle = (index: number, count: number): CSSProperties => {
    const stagger = element.motion.enter.stagger ?? 0;
    const itemStart = enterStart + index * stagger;
    const itemEnter = finalLayout ? 1 : linearProgress(time, itemStart, element.motion.enter.duration);
    const focusedIndex = activeBeatIndex < 0 || count === 0 ? -1 : activeBeatIndex % count;
    const isFocused = focusedIndex === index;
    const focusDim = activeBeatPreset === 'focus' || activeBeatPreset === 'trace';
    const isFocusPreset = activeBeatPreset === 'focus' || activeBeatPreset === 'trace';
    const staggerDelay = (activeBeatCue?.stagger ?? 0) * index;
    const staggeredElapsed = activeBeatStart === undefined ? -1 : time - activeBeatStart - staggerDelay;
    const staggeredRaw = activeBeatCue && staggeredElapsed >= 0 && staggeredElapsed <= activeBeatCue.duration
      ? staggeredElapsed / activeBeatCue.duration
      : -1;
    const staggeredEmphasis = staggeredRaw < 0 ? 0 : Math.sin(staggeredRaw * Math.PI) * (activeBeatCue?.intensity ?? 1);
    const emphasis = isFocusPreset ? (isFocused ? activeBeatProgress : 0) : staggeredEmphasis;
    return {
      opacity: itemEnter * (focusDim && focusedIndex >= 0 && !isFocused ? 0.42 + (1 - activeBeatProgress) * 0.58 : 1),
      transform: `translateY(${(1 - itemEnter) * 18 - emphasis * 7}px) scale(${1 + emphasis * 0.035})`,
      filter: isFocused && (activeBeatPreset === 'glow' || activeBeatPreset === 'trace') ? `drop-shadow(0 0 ${8 + emphasis * 16}px var(--element-accent))` : undefined,
    };
  };

  return {
    enterProgress,
    exitProgress,
    activeBeatIndex,
    activeBeatProgress,
    activeBeatPreset,
    itemStyle,
    lineProgress: Math.max(enterProgress, activeBeatPreset === 'trace' ? activeBeatProgress : 0),
    countProgress: activeBeatPreset === 'count-up' ? Math.max(enterProgress, activeBeatProgress) : enterProgress,
    orbitDegrees: element.motion.ambient === 'orbit' && !finalLayout ? (time * 2.2) % 360 : 0,
    style: {
      opacity: Math.max(0, enterProgress * (1 - exitProgress * Math.min(1, exitIntensity))),
      transform: `translate(${exitX}px, ${baseY + beatY + ambientIntensity}px) scale(${baseScale * beatScale * exitScale * (element.motion.ambient === 'breathe' ? 1 + ambientIntensity : 1)})`,
      clipPath: clipProgress < 1 ? `inset(0 ${100 - clipProgress * 100}% 0 0)` : undefined,
      filter: activeBeatPreset === 'glow' ? `drop-shadow(0 0 ${activeBeatProgress * 18}px var(--element-accent))` : undefined,
    },
  };
}
