export const CURRENT_SCHEMA_VERSION = 5;

export type CaptionMode = 'bottom' | 'side' | 'keywords' | 'hidden';
export type VisualVariant = 'auto' | 'grid' | 'rail' | 'split' | 'orbital' | 'editorial' | 'diagram' | 'poster' | 'minimal';
export type SurfaceStyle = 'none' | 'soft' | 'outline';

export interface ElementVisual {
  variant: VisualVariant;
  surface: SurfaceStyle;
}

export interface CodePresentation {
  theme?: 'github-dark' | 'carbon-dark';
  windowChrome?: 'toolbar' | 'mac' | 'none';
  showLineNumbers?: boolean;
  backdrop?: 'none' | 'soft-gray' | 'soft-gray-gradient';
  fontSize?: number;
  padding?: number;
  frameInset?: number;
  frameInsetY?: number;
}

export type MotionPreset =
  | 'fade-rise'
  | 'spring-scale'
  | 'wipe-reveal'
  | 'draw'
  | 'pulse'
  | 'lift'
  | 'focus'
  | 'glow'
  | 'trace'
  | 'count-up'
  | 'fade'
  | 'slide'
  | 'shrink';

export type AmbientMotion = 'none' | 'drift' | 'breathe' | 'orbit';

export type MotionTrigger =
  | { type: 'time'; at: number }
  | { type: 'narration'; segmentId: string; offset?: number };

export interface MotionCue {
  id: string;
  preset: MotionPreset;
  trigger: MotionTrigger;
  duration: number;
  stagger?: number;
  intensity?: number;
}

export interface ElementMotion {
  enter: MotionCue;
  beats: MotionCue[];
  exit?: MotionCue;
  ambient?: AmbientMotion;
}

export interface SceneTransition {
  preset: 'fade' | 'slide-left' | 'slide-up' | 'wipe';
  duration: number;
}

export interface RenderConfig {
  fps: number;
  width: number;
  height: number;
}

export type ElementType =
  | 'title'
  | 'text'
  | 'cards'
  | 'lifecycle'
  | 'flow'
  | 'comparison'
  | 'timeline'
  | 'metrics'
  | 'topology'
  | 'diagram'
  | 'formula'
  | 'badge'
  | 'image'
  | 'code';

export type SceneTemplate =
  | 'opening'
  | 'concept'
  | 'process'
  | 'comparison'
  | 'incident'
  | 'architecture'
  | 'closing';

export interface SourceDocument {
  id: string;
  name: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  pageCount: number;
  importedAt: string;
  contentBlocks?: Array<{
    id: string;
    page: number;
    kind: 'heading' | 'paragraph' | 'image' | 'table' | 'formula' | 'code';
    text?: string;
    assetId?: string;
    bbox?: NormalizedBox;
  }>;
}

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AssetExtractionMethod = 'native' | 'rendered-page' | 'rendered-crop' | 'text-layer' | 'ocr' | 'repository' | 'generated';

export interface SourceReference {
  documentId?: string;
  page?: number;
  slide?: number;
  objectId?: string;
  bbox?: NormalizedBox;
  extraction: AssetExtractionMethod;
  file?: string;
  startLine?: number;
  endLine?: number;
  commit?: string;
}

export interface KnowledgeNode {
  id: string;
  kind: 'concept' | 'relationship' | 'example' | 'formula';
  title: string;
  summary: string;
  sourceDocumentId: string;
  sourcePages: number[];
  relatedNodeIds?: string[];
}

export interface NarrationSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  voice?: string;
  rate?: number;
}

export interface SceneElement {
  id: string;
  type: ElementType;
  content: string;
  items?: SceneElementItem[];
  diagram?: DiagramGraph;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: {
    accent?: string;
    tone?: 'light' | 'dark' | 'glass' | 'outline';
    align?: 'left' | 'center' | 'right';
  };
  motion: ElementMotion;
  visual: ElementVisual;
  sourcePages?: number[];
  assetId?: string;
  fit?: 'contain' | 'cover';
  crop?: NormalizedBox;
  alt?: string;
  language?: string;
  highlightLines?: number[];
  codeSource?: SourceReference;
  codeVerification?: 'exact' | 'syntax' | 'display-only';
  codePresentation?: CodePresentation;
}

export interface DiagramGraph {
  nodes: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; revealAt?: number; tone?: 'primary' | 'secondary' | 'neutral' }>;
  edges: Array<{ id: string; from: string; to: string; label?: string; revealAt?: number; kind?: 'directed' | 'undirected' }>;
}

export interface SceneElementItem {
  id: string;
  label: string;
}

export interface Scene {
  id: string;
  chapterId: string;
  title: string;
  template: SceneTemplate;
  duration: number;
  elements: SceneElement[];
  narration: NarrationSegment[];
  knowledgeNodeIds: string[];
  transitionOut?: SceneTransition;
  captionMode: CaptionMode;
}

export interface Chapter {
  id: string;
  title: string;
  shortTitle: string;
  color: string;
}

export interface ProjectTheme {
  name: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  accent: string;
  accentAlt: string;
  fontFamily: string;
}

export interface AssetManifestItem {
  id: string;
  name: string;
  kind: 'image' | 'audio' | 'font';
  uri: string;
  embedded: boolean;
  sha256?: string;
  width?: number;
  height?: number;
  source?: SourceReference;
}

export interface AnimationProject {
  schemaVersion: number;
  id: string;
  title: string;
  description: string;
  locale: string;
  renderConfig: RenderConfig;
  createdAt: string;
  updatedAt: string;
  sourceDocuments: SourceDocument[];
  knowledgeNodes: KnowledgeNode[];
  chapters: Chapter[];
  scenes: Scene[];
  assets: AssetManifestItem[];
  theme: ProjectTheme;
}

export interface GenerationInput {
  document: SourceDocument;
  knowledgeNodes: KnowledgeNode[];
  targetDuration: number;
  locale: string;
}

export interface GenerationAdapter {
  id: string;
  label: string;
  generate(input: GenerationInput): Promise<AnimationProject>;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ProjectValidator {
  validate(project: unknown): ValidationIssue[];
}
