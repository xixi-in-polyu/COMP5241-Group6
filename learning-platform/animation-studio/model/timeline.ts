import type { AnimationProject, Scene } from './types';

export interface SceneTiming {
  scene: Scene;
  start: number;
  end: number;
  index: number;
}

export function buildSceneTimeline(project: AnimationProject): SceneTiming[] {
  let cursor = 0;
  return project.scenes.map((scene, index) => {
    const timing = { scene, start: cursor, end: cursor + scene.duration, index };
    cursor += scene.duration;
    return timing;
  });
}

export function getProjectDuration(project: AnimationProject): number {
  return project.scenes.reduce((total, scene) => total + scene.duration, 0);
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function getProjectDurationInFrames(project: AnimationProject): number {
  return project.scenes.reduce((total, scene) => total + secondsToFrames(scene.duration, project.renderConfig.fps), 0);
}

export function findSceneAtTime(project: AnimationProject, time: number): SceneTiming {
  const timeline = buildSceneTimeline(project);
  const match = timeline.find((entry) => time >= entry.start && time < entry.end);
  return match ?? timeline[timeline.length - 1];
}

export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
