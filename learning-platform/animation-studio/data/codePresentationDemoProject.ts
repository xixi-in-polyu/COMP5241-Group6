import { createDefaultMotion } from '../model/motion';
import { defaultVisualForType } from '../model/visual';
import type { AnimationProject, SceneElement } from '../model/types';

const code = `const pluckDeep = key => obj => key.split('.').reduce((accum, key) => accum[key], obj)

const compose = (...fns) => res => fns.reduce((accum, next) => next(accum), res)

const unfold = (f, seed) => {
  const go = (f, seed, acc) => {
    const res = f(seed)
    return res ? go(f, res[1], acc.concat([res[0]])) : acc
  }
  return go(f, seed, [])
}`;

const codeElement: SceneElement = {
  id: 'carbon-code-card',
  type: 'code',
  content: code,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  language: 'javascript',
  codeSource: { extraction: 'generated' },
  codeVerification: 'syntax',
  codePresentation: {
    theme: 'carbon-dark',
    windowChrome: 'mac',
    showLineNumbers: false,
    backdrop: 'soft-gray-gradient',
    fontSize: 27,
    padding: 34,
    frameInset: 110,
    frameInsetY: 150,
  },
  motion: { ...createDefaultMotion('carbon-code-card', 'code', []), beats: [], exit: undefined, ambient: 'none' },
  visual: defaultVisualForType('code'),
};

export function createCodePresentationDemoProject(): AnimationProject {
  return {
    schemaVersion: 5,
    id: 'project-code-presentation-demo',
    title: 'Editable Carbon-style code presentation',
    description: 'A screenshot-like code frame rendered from editable verified code.',
    locale: 'en-US',
    createdAt: '2026-11-06T00:00:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
    renderConfig: { fps: 30, width: 1920, height: 1080 },
    sourceDocuments: [],
    knowledgeNodes: [],
    chapters: [{ id: 'chapter-code', title: 'Code', shortTitle: 'Code', color: '#48525A' }],
    scenes: [{
      id: 'scene-code-card',
      chapterId: 'chapter-code',
      title: 'Carbon-style editable code card',
      template: 'concept',
      duration: 8,
      elements: [codeElement],
      narration: [],
      knowledgeNodeIds: [],
      captionMode: 'hidden',
    }],
    assets: [],
    theme: {
      name: 'white-editorial',
      background: '#FFFFFF',
      surface: '#F4F4F2',
      foreground: '#1A1A18',
      muted: '#6D706E',
      accent: '#9FC13A',
      accentAlt: '#A08BCE',
      fontFamily: '"Times New Roman", Times, serif',
    },
  };
}
