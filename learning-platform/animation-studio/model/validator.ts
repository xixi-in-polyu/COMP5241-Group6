import { CURRENT_SCHEMA_VERSION, type AnimationProject, type ProjectValidator, type ValidationIssue } from './types';
import { AMBIENT_PRESETS, BEAT_PRESETS, ENTER_PRESETS, EXIT_PRESETS, MOTION_PRESETS, resolveCueStart } from './motion';
import { CAPTION_MODES, SURFACE_STYLES, VISUAL_VARIANTS } from './visual';

const supportedElements = new Set([
  'title', 'text', 'cards', 'lifecycle', 'flow', 'comparison', 'timeline',
  'metrics', 'topology', 'diagram', 'formula', 'badge',
  'image', 'code',
]);

const isNormalizedBox = (value: unknown): value is { x: number; y: number; width: number; height: number } => {
  if (!value || typeof value !== 'object') return false;
  const box = value as { x?: number; y?: number; width?: number; height?: number };
  return [box.x, box.y, box.width, box.height].every(Number.isFinite)
    && box.x! >= 0 && box.y! >= 0 && box.width! > 0 && box.height! > 0
    && box.x! + box.width! <= 1.000001 && box.y! + box.height! <= 1.000001;
};

export const projectValidator: ProjectValidator = {
  validate(value: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!value || typeof value !== 'object') {
      return [{ path: '$', message: 'Project must be a JSON object.', severity: 'error' }];
    }
    const project = value as Partial<AnimationProject>;
    if (project.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      issues.push({ path: 'schemaVersion', message: `Expected schema version ${CURRENT_SCHEMA_VERSION}.`, severity: 'error' });
    }
    if (!project.title?.trim()) issues.push({ path: 'title', message: 'Project title is required.', severity: 'error' });
    if (!project.renderConfig || !Number.isInteger(project.renderConfig.fps) || project.renderConfig.fps <= 0) {
      issues.push({ path: 'renderConfig.fps', message: 'Render FPS must be a positive integer.', severity: 'error' });
    }
    if (!project.renderConfig || project.renderConfig.width <= 0 || project.renderConfig.height <= 0) {
      issues.push({ path: 'renderConfig', message: 'Render dimensions must be greater than zero.', severity: 'error' });
    }
    if (!Array.isArray(project.chapters) || project.chapters.length === 0) {
      issues.push({ path: 'chapters', message: 'At least one chapter is required.', severity: 'error' });
    }
    if (!Array.isArray(project.scenes) || project.scenes.length === 0) {
      issues.push({ path: 'scenes', message: 'At least one scene is required.', severity: 'error' });
      return issues;
    }
    const sourceDocumentIds = new Set(project.sourceDocuments?.map((document) => document.id) ?? []);
    const assetIds = new Set<string>();
    project.assets?.forEach((asset, assetIndex) => {
      const base = `assets[${assetIndex}]`;
      if (!asset.id?.trim() || assetIds.has(asset.id)) issues.push({ path: `${base}.id`, message: 'Asset IDs must be present and unique.', severity: 'error' });
      assetIds.add(asset.id);
      if (!asset.uri?.trim()) issues.push({ path: `${base}.uri`, message: 'Asset URI is required.', severity: 'error' });
      if (/^(?:file:\/\/|\/|[A-Za-z]:[\\/])/.test(asset.uri ?? '')) issues.push({ path: `${base}.uri`, message: 'Asset URI must be project-relative or embedded, not an absolute filesystem path.', severity: 'error' });
      if (/^https?:\/\//.test(asset.uri ?? '')) issues.push({ path: `${base}.uri`, message: 'Remote assets reduce deterministic rendering; embed or copy this asset into the project.', severity: 'warning' });
      if ((asset.uri ?? '').split(/[\\/]/).includes('..')) issues.push({ path: `${base}.uri`, message: 'Asset URI must stay inside the project package.', severity: 'error' });
      if (asset.source?.documentId && !sourceDocumentIds.has(asset.source.documentId)) issues.push({ path: `${base}.source.documentId`, message: 'Asset references an unknown source document.', severity: 'error' });
      if (asset.source?.bbox && !isNormalizedBox(asset.source.bbox)) issues.push({ path: `${base}.source.bbox`, message: 'Source crop must be a normalized box inside the page.', severity: 'error' });
      if (asset.sha256 && !/^[a-f\d]{64}$/i.test(asset.sha256)) issues.push({ path: `${base}.sha256`, message: 'Asset SHA-256 must contain 64 hexadecimal characters.', severity: 'error' });
    });
    const chapterIds = new Set(project.chapters?.map((chapter) => chapter.id));
    project.scenes.forEach((scene, sceneIndex) => {
      const base = `scenes[${sceneIndex}]`;
      if (!scene.id) issues.push({ path: `${base}.id`, message: 'Scene id is required.', severity: 'error' });
      if (!chapterIds.has(scene.chapterId)) issues.push({ path: `${base}.chapterId`, message: 'Scene references an unknown chapter.', severity: 'error' });
      if (!Number.isFinite(scene.duration) || scene.duration <= 0) issues.push({ path: `${base}.duration`, message: 'Duration must be greater than zero.', severity: 'error' });
      if (!CAPTION_MODES.includes(scene.captionMode)) issues.push({ path: `${base}.captionMode`, message: 'Unsupported caption layout.', severity: 'error' });
      if (scene.transitionOut) {
        if (!['fade', 'slide-left', 'slide-up', 'wipe'].includes(scene.transitionOut.preset)) issues.push({ path: `${base}.transitionOut.preset`, message: 'Unsupported scene transition preset.', severity: 'error' });
        if (!Number.isFinite(scene.transitionOut.duration) || scene.transitionOut.duration <= 0 || scene.transitionOut.duration >= scene.duration) issues.push({ path: `${base}.transitionOut.duration`, message: 'Transition duration must be positive and shorter than the scene.', severity: 'error' });
      }
      scene.elements?.forEach((element, elementIndex) => {
        const elementBase = `${base}.elements[${elementIndex}]`;
        if (!supportedElements.has(element.type)) issues.push({ path: `${base}.elements[${elementIndex}].type`, message: `Unsupported element type: ${element.type}.`, severity: 'error' });
        if (!element.id?.trim()) issues.push({ path: `${elementBase}.id`, message: 'Every visible element needs a stable id.', severity: 'error' });
        if (!element.content?.trim() && !element.items?.length && !(element.type === 'image' && element.assetId) && !(element.type === 'diagram' && element.diagram?.nodes?.length)) issues.push({ path: elementBase, message: 'Element has no editable content or asset reference.', severity: 'error' });
        if (element.type === 'diagram') {
          const graph = element.diagram;
          if (!graph || !Array.isArray(graph.nodes) || !graph.nodes.length || !Array.isArray(graph.edges)) issues.push({ path: `${elementBase}.diagram`, message: 'Diagram needs nodes and an edges array.', severity: 'error' });
          else {
            const ids = new Set<string>();
            graph.nodes.forEach((node, index) => {
              const path = `${elementBase}.diagram.nodes[${index}]`;
              if (!node.id?.trim() || ids.has(node.id)) issues.push({ path: `${path}.id`, message: 'Diagram node IDs must be unique and nonempty.', severity: 'error' });
              ids.add(node.id);
              if (!node.label?.trim()) issues.push({ path: `${path}.label`, message: 'Diagram node needs a label.', severity: 'error' });
              if (![node.x, node.y, node.width, node.height].every(Number.isFinite) || node.x < 0 || node.y < 0 || node.width <= 0 || node.height <= 0 || node.x + node.width > 100 || node.y + node.height > 100) issues.push({ path, message: 'Diagram node must fit inside its element in percent coordinates.', severity: 'error' });
              if (node.revealAt !== undefined && (!Number.isFinite(node.revealAt) || node.revealAt < 0 || node.revealAt >= scene.duration)) issues.push({ path: `${path}.revealAt`, message: 'Node reveal time must be inside the scene.', severity: 'error' });
              if (node.tone && !['primary', 'secondary', 'neutral'].includes(node.tone)) issues.push({ path: `${path}.tone`, message: 'Unsupported node tone.', severity: 'error' });
            });
            const edgeIds = new Set<string>();
            graph.edges.forEach((edge, index) => {
              const path = `${elementBase}.diagram.edges[${index}]`;
              if (!edge.id?.trim() || edgeIds.has(edge.id)) issues.push({ path: `${path}.id`, message: 'Diagram edge IDs must be unique and nonempty.', severity: 'error' });
              edgeIds.add(edge.id);
              if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) issues.push({ path, message: 'Diagram edge must connect two distinct existing nodes.', severity: 'error' });
              if (edge.revealAt !== undefined && (!Number.isFinite(edge.revealAt) || edge.revealAt < 0 || edge.revealAt >= scene.duration)) issues.push({ path: `${path}.revealAt`, message: 'Edge reveal time must be inside the scene.', severity: 'error' });
              if (edge.kind && !['directed', 'undirected'].includes(edge.kind)) issues.push({ path: `${path}.kind`, message: 'Unsupported edge kind.', severity: 'error' });
            });
          }
        }
        if (element.type === 'image') {
          const asset = project.assets?.find((candidate) => candidate.id === element.assetId);
          if (!element.assetId?.trim() || !asset) issues.push({ path: `${elementBase}.assetId`, message: 'Image element must reference an existing asset.', severity: 'error' });
          else if (asset.kind !== 'image') issues.push({ path: `${elementBase}.assetId`, message: 'Image element must reference an image asset.', severity: 'error' });
          if (!element.alt?.trim()) issues.push({ path: `${elementBase}.alt`, message: 'Image element requires concise alternative text.', severity: 'error' });
          if (element.fit && !['contain', 'cover'].includes(element.fit)) issues.push({ path: `${elementBase}.fit`, message: 'Image fit must be contain or cover.', severity: 'error' });
          if (element.crop && !isNormalizedBox(element.crop)) issues.push({ path: `${elementBase}.crop`, message: 'Image crop must be a normalized box inside the source image.', severity: 'error' });
        }
        if (element.type === 'code') {
          if (!element.language?.trim()) issues.push({ path: `${elementBase}.language`, message: 'Code element requires a language.', severity: 'error' });
          const lineCount = Math.max(1, element.content.split('\n').length);
          element.highlightLines?.forEach((line, lineIndex) => {
            if (!Number.isInteger(line) || line < 1 || line > lineCount) issues.push({ path: `${elementBase}.highlightLines[${lineIndex}]`, message: 'Highlighted line is outside the code block.', severity: 'error' });
          });
          if (!element.codeSource?.extraction) issues.push({ path: `${elementBase}.codeSource`, message: 'Code element requires an explicit source or generated-example provenance.', severity: 'error' });
          if (!element.codeVerification || !['exact', 'syntax', 'display-only'].includes(element.codeVerification)) issues.push({ path: `${elementBase}.codeVerification`, message: 'Code element must declare exact, syntax, or display-only verification.', severity: 'error' });
          if (element.codeSource?.documentId && !sourceDocumentIds.has(element.codeSource.documentId)) issues.push({ path: `${elementBase}.codeSource.documentId`, message: 'Code element references an unknown source document.', severity: 'error' });
          if (element.codeSource?.extraction === 'repository' && !element.codeSource.file) issues.push({ path: `${elementBase}.codeSource.file`, message: 'Repository code requires a file path.', severity: 'error' });
          if (element.codeSource?.file && (/^(?:file:\/\/|\/|[A-Za-z]:[\\/])/.test(element.codeSource.file) || element.codeSource.file.split(/[\\/]/).includes('..'))) issues.push({ path: `${elementBase}.codeSource.file`, message: 'Code source file must be a project-relative path inside the repository.', severity: 'error' });
          if (element.codeVerification === 'exact' && (element.codeSource?.extraction !== 'repository' || !element.codeSource.startLine || !element.codeSource.endLine)) issues.push({ path: `${elementBase}.codeVerification`, message: 'Exact code verification requires repository provenance and a line range.', severity: 'error' });
          if (element.codeSource?.startLine && element.codeSource?.endLine && element.codeSource.endLine < element.codeSource.startLine) issues.push({ path: `${elementBase}.codeSource.endLine`, message: 'Code source end line must not precede its start line.', severity: 'error' });
          const presentation = element.codePresentation;
          if (presentation) {
            if (presentation.theme && !['github-dark', 'carbon-dark'].includes(presentation.theme)) issues.push({ path: `${elementBase}.codePresentation.theme`, message: 'Unsupported code theme.', severity: 'error' });
            if (presentation.windowChrome && !['toolbar', 'mac', 'none'].includes(presentation.windowChrome)) issues.push({ path: `${elementBase}.codePresentation.windowChrome`, message: 'Unsupported code window chrome.', severity: 'error' });
            if (presentation.backdrop && !['none', 'soft-gray', 'soft-gray-gradient'].includes(presentation.backdrop)) issues.push({ path: `${elementBase}.codePresentation.backdrop`, message: 'Unsupported code backdrop.', severity: 'error' });
            if (presentation.showLineNumbers !== undefined && typeof presentation.showLineNumbers !== 'boolean') issues.push({ path: `${elementBase}.codePresentation.showLineNumbers`, message: 'showLineNumbers must be boolean.', severity: 'error' });
            if (presentation.fontSize !== undefined && (!Number.isFinite(presentation.fontSize) || presentation.fontSize < 12 || presentation.fontSize > 36)) issues.push({ path: `${elementBase}.codePresentation.fontSize`, message: 'Code font size must be from 12 to 36 pixels.', severity: 'error' });
            if (presentation.padding !== undefined && (!Number.isFinite(presentation.padding) || presentation.padding < 0 || presentation.padding > 72)) issues.push({ path: `${elementBase}.codePresentation.padding`, message: 'Code padding must be from 0 to 72 pixels.', severity: 'error' });
            if (presentation.frameInset !== undefined && (!Number.isFinite(presentation.frameInset) || presentation.frameInset < 0 || presentation.frameInset > 240)) issues.push({ path: `${elementBase}.codePresentation.frameInset`, message: 'Horizontal code frame inset must be from 0 to 240 pixels.', severity: 'error' });
            if (presentation.frameInsetY !== undefined && (!Number.isFinite(presentation.frameInsetY) || presentation.frameInsetY < 0 || presentation.frameInsetY > 300)) issues.push({ path: `${elementBase}.codePresentation.frameInsetY`, message: 'Vertical code frame inset must be from 0 to 300 pixels.', severity: 'error' });
          }
        }
        if (!element.visual || !VISUAL_VARIANTS.includes(element.visual.variant)) issues.push({ path: `${elementBase}.visual.variant`, message: 'Unsupported visual variant.', severity: 'error' });
        if (!element.visual || !SURFACE_STYLES.includes(element.visual.surface)) issues.push({ path: `${elementBase}.visual.surface`, message: 'Unsupported surface style.', severity: 'error' });
        const itemIds = new Set<string>();
        element.items?.forEach((item, itemIndex) => {
          if (!item.id?.trim()) issues.push({ path: `${elementBase}.items[${itemIndex}].id`, message: 'Every visible item needs a stable id.', severity: 'error' });
          if (!item.label?.trim()) issues.push({ path: `${elementBase}.items[${itemIndex}].label`, message: 'Visible item text cannot be empty.', severity: 'error' });
          if (itemIds.has(item.id)) issues.push({ path: `${elementBase}.items[${itemIndex}].id`, message: 'Item ids must be unique inside an element.', severity: 'error' });
          itemIds.add(item.id);
        });
        if (element.type === 'flow' && (element.items?.length ?? 0) > 9) {
          issues.push({ path: `${elementBase}.items`, message: 'Flow supports at most 9 readable steps; split this content into multiple scenes.', severity: 'warning' });
        }
        if (!element.motion?.enter || !Array.isArray(element.motion?.beats)) {
          issues.push({ path: `${elementBase}.motion`, message: 'Element motion configuration is required.', severity: 'error' });
        } else {
          const cues = [element.motion.enter, ...element.motion.beats, ...(element.motion.exit ? [element.motion.exit] : [])];
          const cueIds = new Set<string>();
          cues.forEach((cue, cueIndex) => {
            const cuePath = `${elementBase}.motion.cues[${cueIndex}]`;
            if (!cue.id?.trim() || cueIds.has(cue.id)) issues.push({ path: `${cuePath}.id`, message: 'Motion cue IDs must be present and unique.', severity: 'error' });
            cueIds.add(cue.id);
            if (!MOTION_PRESETS.includes(cue.preset)) issues.push({ path: `${cuePath}.preset`, message: `Unsupported motion preset: ${cue.preset}.`, severity: 'error' });
            if (!Number.isFinite(cue.duration) || cue.duration <= 0) issues.push({ path: `${cuePath}.duration`, message: 'Motion duration must be greater than zero.', severity: 'error' });
            const start = resolveCueStart(cue, scene);
            if (start === undefined) issues.push({ path: `${cuePath}.trigger`, message: 'Motion references an unknown narration segment.', severity: 'error' });
            else if (start < 0 || start + cue.duration > scene.duration + 0.001) issues.push({ path: cuePath, message: 'Motion cue extends outside the scene.', severity: 'error' });
          });
          if (!ENTER_PRESETS.includes(element.motion.enter.preset as typeof ENTER_PRESETS[number])) issues.push({ path: `${elementBase}.motion.enter.preset`, message: 'Enter cue must use an enter preset.', severity: 'error' });
          element.motion.beats.forEach((cue, cueIndex) => {
            if (!BEAT_PRESETS.includes(cue.preset as typeof BEAT_PRESETS[number])) issues.push({ path: `${elementBase}.motion.beats[${cueIndex}].preset`, message: 'Beat cue must use an emphasis preset.', severity: 'error' });
          });
          if (element.motion.exit && !EXIT_PRESETS.includes(element.motion.exit.preset as typeof EXIT_PRESETS[number])) issues.push({ path: `${elementBase}.motion.exit.preset`, message: 'Exit cue must use an exit preset.', severity: 'error' });
          if (!AMBIENT_PRESETS.includes(element.motion.ambient ?? 'none')) issues.push({ path: `${elementBase}.motion.ambient`, message: 'Unsupported ambient motion.', severity: 'error' });
        }
        if (element.x < 0 || element.y < 0 || element.x + element.width > 100 || element.y + element.height > 100) {
          issues.push({ path: `${base}.elements[${elementIndex}]`, message: 'Element extends outside the 16:9 canvas.', severity: 'warning' });
        }
      });
      scene.narration?.forEach((segment, segmentIndex) => {
        if (segment.start < 0 || segment.end > scene.duration || segment.end <= segment.start) {
          issues.push({ path: `${base}.narration[${segmentIndex}]`, message: 'Narration timing is outside the scene.', severity: 'error' });
        }
      });
    });
    return issues;
  },
};

export function assertValidProject(project: unknown): asserts project is AnimationProject {
  const errors = projectValidator.validate(project).filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}
