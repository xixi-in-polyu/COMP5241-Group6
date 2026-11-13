import { createDefaultMotion } from '../model/motion';
import { defaultVisualForType } from '../model/visual';
import type { DiagramGraph, Scene, SceneElement } from '../model/types';
import { createSdlcIncidentProject } from './sdlcIncidentProject';

const diagramElement = (id: string, content: string, graph: DiagramGraph, sourcePages: number[]): SceneElement => ({
  id, type: 'diagram', content, diagram: graph, x: 5, y: 22, width: 90, height: 60,
  motion: { ...createDefaultMotion(id, 'diagram', []), exit: undefined, beats: [] },
  visual: defaultVisualForType('diagram'), sourcePages,
});

const titleElement = (id: string, content: string, sourcePages: number[]): SceneElement => ({
  id, type: 'title', content, x: 5, y: 8, width: 90, height: 13,
  motion: { ...createDefaultMotion(id, 'title', []), exit: undefined, beats: [] },
  visual: defaultVisualForType('title'), sourcePages,
});

const tree: DiagramGraph = {
  nodes: [
    { id: 'decision', label: 'Who sees the new version?', x: 35, y: 3, width: 30, height: 16, tone: 'primary', revealAt: 0 },
    { id: 'big-bang', label: 'Big Bang\nAll users at once', x: 1, y: 65, width: 22, height: 20, revealAt: 2 },
    { id: 'rolling', label: 'Rolling\nInstances gradually', x: 26, y: 65, width: 22, height: 20, revealAt: 4 },
    { id: 'blue-green', label: 'Blue–Green\nSwitch environments', x: 51, y: 65, width: 22, height: 20, revealAt: 6 },
    { id: 'canary', label: 'Canary\nSmall audience first', x: 76, y: 65, width: 22, height: 20, revealAt: 8 },
  ],
  edges: [
    { id: 'all', from: 'decision', to: 'big-bang', revealAt: 2 },
    { id: 'instances', from: 'decision', to: 'rolling', revealAt: 4 },
    { id: 'switch', from: 'decision', to: 'blue-green', revealAt: 6 },
    { id: 'small', from: 'decision', to: 'canary', revealAt: 8 },
  ],
};

const flow: DiagramGraph = {
  nodes: [
    { id: 'users', label: 'Users', x: 39, y: 0, width: 22, height: 14, tone: 'primary', revealAt: 0 },
    { id: 'router', label: 'Load balancer', x: 35, y: 33, width: 30, height: 16, revealAt: 2 },
    { id: 'v1', label: 'V1 · current', x: 7, y: 73, width: 26, height: 18, tone: 'secondary', revealAt: 4 },
    { id: 'v2', label: 'V2 · canary', x: 67, y: 73, width: 26, height: 18, tone: 'primary', revealAt: 6 },
  ],
  edges: [
    { id: 'request', from: 'users', to: 'router', label: 'requests', revealAt: 2 },
    { id: 'most', from: 'router', to: 'v1', label: 'most traffic', revealAt: 4 },
    { id: 'subset', from: 'router', to: 'v2', label: 'small subset', revealAt: 6 },
  ],
};

export function createDiagramDemoProject() {
  const base = createSdlcIncidentProject();
  const scenes: Scene[] = [
    { id: 'demo-tree', chapterId: 'ch-release', title: 'A decision tree for exposure', template: 'comparison', duration: 12, captionMode: 'hidden', knowledgeNodeIds: ['release'], narration: [], transitionOut: { preset: 'fade', duration: 0.5 }, elements: [titleElement('tree-title', 'FOUR WAYS TO EXPOSE A RELEASE', [52, 53, 54, 55]), diagramElement('tree-graph', 'Release strategy decision tree', tree, [52, 53, 54, 55])] },
    { id: 'demo-flow', chapterId: 'ch-release', title: 'Canary traffic path', template: 'architecture', duration: 10, captionMode: 'hidden', knowledgeNodeIds: ['release'], narration: [], elements: [titleElement('flow-title', 'CANARY · ROUTE A SMALL AUDIENCE FIRST', [55]), diagramElement('flow-graph', 'Traffic branches from users to current and canary versions', flow, [55])] },
  ];
  return { ...base, id: 'project-diagram-demo', title: 'Editable diagram component demo', description: 'Model-authored node and edge graphs based on lecture release strategies.', scenes, assets: [] };
}
