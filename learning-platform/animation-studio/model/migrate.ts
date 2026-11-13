import { CURRENT_SCHEMA_VERSION, type AnimationProject } from './types';
import { createDefaultMotion } from './motion';
import { assertValidProject } from './validator';
import { defaultCaptionForTemplate, defaultVisualForType } from './visual';

export function migrateProject(input: unknown): AnimationProject {
  if (!input || typeof input !== 'object') throw new Error('The selected file is not a project.');
  const candidate = structuredClone(input) as Record<string, unknown>;
  if (candidate.schemaVersion === undefined) candidate.schemaVersion = 1;
  if (typeof candidate.schemaVersion !== 'number' || candidate.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error('This project was created by a newer version of Storyline Studio.');
  }
  if (candidate.schemaVersion === 1) {
    candidate.renderConfig = { fps: 30, width: 1920, height: 1080 };
    const scenes = Array.isArray(candidate.scenes) ? candidate.scenes as Array<Record<string, unknown>> : [];
    scenes.forEach((scene) => {
      const elements = Array.isArray(scene.elements) ? scene.elements as Array<Record<string, unknown>> : [];
      elements.forEach((element) => {
        if (!Array.isArray(element.items)) return;
        element.items = element.items.map((item, index) => typeof item === 'string'
          ? { id: `${String(element.id)}-item-${index + 1}`, label: item }
          : item);
      });
    });
    candidate.schemaVersion = 2;
  }
  if (candidate.schemaVersion === 2) {
    const scenes = Array.isArray(candidate.scenes) ? candidate.scenes as Array<Record<string, unknown>> : [];
    scenes.forEach((scene, sceneIndex) => {
      const narration = Array.isArray(scene.narration) ? scene.narration as AnimationProject['scenes'][number]['narration'] : [];
      const elements = Array.isArray(scene.elements) ? scene.elements as Array<Record<string, unknown>> : [];
      elements.forEach((element) => {
        const legacy = element.animation as { enter: 'fade' | 'rise' | 'scale' | 'draw'; start: number; duration: number } | undefined;
        element.motion = createDefaultMotion(String(element.id), element.type as AnimationProject['scenes'][number]['elements'][number]['type'], narration, legacy);
        delete element.animation;
      });
      scene.transitionOut = sceneIndex < scenes.length - 1 ? { preset: 'fade', duration: 0.6 } : undefined;
    });
    candidate.schemaVersion = 3;
  }
  if (candidate.schemaVersion === 3) {
    const scenes = Array.isArray(candidate.scenes) ? candidate.scenes as Array<Record<string, unknown>> : [];
    scenes.forEach((scene) => {
      scene.captionMode = defaultCaptionForTemplate(scene.template as AnimationProject['scenes'][number]['template']);
      const elements = Array.isArray(scene.elements) ? scene.elements as Array<Record<string, unknown>> : [];
      elements.forEach((element) => {
        element.visual = defaultVisualForType(element.type as AnimationProject['scenes'][number]['elements'][number]['type']);
      });
    });
    candidate.schemaVersion = 4;
  }
  if (candidate.schemaVersion === 4) {
    const sourceDocuments = Array.isArray(candidate.sourceDocuments) ? candidate.sourceDocuments as Array<Record<string, unknown>> : [];
    sourceDocuments.forEach((document) => {
      if (document.mimeType === undefined) document.mimeType = 'application/pdf';
    });
    candidate.schemaVersion = 5;
  }
  assertValidProject(candidate);
  return candidate;
}
