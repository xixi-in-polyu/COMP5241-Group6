import type { AnimationProject, ElementType, MotionCue, MotionPreset, Scene, SceneElement, SceneTemplate } from '../model/types';
import { useState } from 'react';
import { AMBIENT_PRESETS, BEAT_PRESETS, ENTER_PRESETS, EXIT_PRESETS } from '../model/motion';
import { SURFACE_STYLES, VISUAL_VARIANTS, defaultVisualForType } from '../model/visual';

interface Props {
  project: AnimationProject;
  scene: Scene;
  element?: SceneElement;
  selectedItemId?: string;
  onUpdateScene: (patch: Partial<Scene>) => void;
  onUpdateElement: (patch: Partial<SceneElement>) => void;
  onUpdateTheme: (key: keyof AnimationProject['theme'], value: string) => void;
}

const templates: SceneTemplate[] = ['opening', 'concept', 'process', 'comparison', 'incident', 'architecture', 'closing'];
const elementTypes: ElementType[] = ['title', 'text', 'cards', 'lifecycle', 'flow', 'comparison', 'timeline', 'metrics', 'topology', 'diagram', 'formula', 'badge', 'image', 'code'];

export function Inspector({ project, scene, element, selectedItemId, onUpdateScene, onUpdateElement, onUpdateTheme }: Props) {
  const selectedItem = element?.items?.find((item) => item.id === selectedItemId);
  return <aside className="inspector panel">
    <div className="panel-heading"><div><small>INSPECTOR</small><h2>{selectedItem ? 'Component item' : element ? 'Element' : 'Scene'}</h2></div><span>{selectedItem ? 'editable item' : element?.type ?? scene.template}</span></div>
    <div className="inspector-scroll">
      {!element ? <>
        <Field label="Scene title"><input value={scene.title} onChange={(event) => onUpdateScene({ title: event.target.value })} /></Field>
        <div className="field-row">
          <Field label="Duration"><input type="number" min="5" max="300" value={scene.duration} onChange={(event) => onUpdateScene({ duration: Number(event.target.value) })} /></Field>
          <Field label="Template"><select value={scene.template} onChange={(event) => onUpdateScene({ template: event.target.value as SceneTemplate })}>{templates.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Chapter"><select value={scene.chapterId} onChange={(event) => onUpdateScene({ chapterId: event.target.value })}>{project.chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
        <p className="inspector-help">The complete scene transcript appears outside the video frame. The word currently being narrated is highlighted automatically.</p>
        <div className="subheading"><small>SCENE TRANSITION</small><span>{scene.transitionOut ? `${scene.transitionOut.duration}s` : 'none'}</span></div>
        <div className="field-row">
          <Field label="Transition"><select value={scene.transitionOut?.preset ?? 'none'} onChange={(event) => onUpdateScene({ transitionOut: event.target.value === 'none' ? undefined : { preset: event.target.value as NonNullable<Scene['transitionOut']>['preset'], duration: scene.transitionOut?.duration ?? 0.6 } })}><option value="none">none</option><option value="fade">fade</option><option value="slide-left">slide-left</option><option value="slide-up">slide-up</option><option value="wipe">wipe</option></select></Field>
          <Field label="Duration"><input type="number" min=".1" max="3" step=".1" disabled={!scene.transitionOut} value={scene.transitionOut?.duration ?? 0.6} onChange={(event) => scene.transitionOut && onUpdateScene({ transitionOut: { ...scene.transitionOut, duration: Number(event.target.value) } })} /></Field>
        </div>
        <hr />
        <div className="subheading"><small>NARRATION SCRIPT</small><span>{scene.narration.length} segments</span></div>
        {scene.narration.map((segment, index) => <div className="narration-editor" key={segment.id}>
          <span>{String(index + 1).padStart(2, '0')} · {Math.round(segment.start)}–{Math.round(segment.end)}s</span>
          <textarea value={segment.text} rows={4} onChange={(event) => onUpdateScene({ narration: scene.narration.map((item) => item.id === segment.id ? { ...item, text: event.target.value } : item) })} />
        </div>)}
        <hr />
        <div className="subheading"><small>THEME</small><span>{project.theme.name}</span></div>
        <div className="color-grid">
          <ColorField label="Background" value={project.theme.background} onChange={(value) => onUpdateTheme('background', value)} />
          <ColorField label="Accent" value={project.theme.accent} onChange={(value) => onUpdateTheme('accent', value)} />
          <ColorField label="Text" value={project.theme.foreground} onChange={(value) => onUpdateTheme('foreground', value)} />
          <ColorField label="Muted" value={project.theme.muted} onChange={(value) => onUpdateTheme('muted', value)} />
        </div>
      </> : selectedItem ? <>
        <Field label="Item text"><textarea autoFocus rows={5} value={selectedItem.label} onChange={(event) => onUpdateElement({ items: element.items?.map((item) => item.id === selectedItem.id ? { ...item, label: event.target.value } : item) })} /></Field>
        <Field label="Stable item ID"><input value={selectedItem.id} readOnly /></Field>
        <p className="inspector-help">This visible item is stored independently, so generated content can be selected, validated and repaired without replacing the whole component.</p>
      </> : <>
        <div className="field-row">
          <Field label="Type"><select value={element.type} onChange={(event) => { const type = event.target.value as ElementType; onUpdateElement({ type, visual: defaultVisualForType(type), ...(type === 'diagram' && !element.diagram ? { diagram: { nodes: [{ id: 'start', label: 'Start', x: 5, y: 42, width: 25, height: 16 }, { id: 'end', label: 'End', x: 70, y: 42, width: 25, height: 16 }], edges: [{ id: 'link', from: 'start', to: 'end', kind: 'directed' as const }] } } : {}) }); }}>{elementTypes.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Ambient"><select value={element.motion.ambient ?? 'none'} onChange={(event) => onUpdateElement({ motion: { ...element.motion, ambient: event.target.value as NonNullable<SceneElement['motion']['ambient']> } })}>{AMBIENT_PRESETS.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <div className="field-row">
          <Field label="Visual grammar"><select value={element.visual.variant} onChange={(event) => onUpdateElement({ visual: { ...element.visual, variant: event.target.value as SceneElement['visual']['variant'] } })}>{VISUAL_VARIANTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Surface"><select value={element.visual.surface} onChange={(event) => onUpdateElement({ visual: { ...element.visual, surface: event.target.value as SceneElement['visual']['surface'] } })}>{SURFACE_STYLES.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Content"><textarea rows={5} value={element.content} onChange={(event) => onUpdateElement({ content: event.target.value })} /></Field>
        {element.type === 'image' && <>
          <Field label="Image asset"><select value={element.assetId ?? ''} onChange={(event) => onUpdateElement({ assetId: event.target.value })}><option value="">Select asset</option>{project.assets.filter((asset) => asset.kind === 'image').map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
          <div className="field-row"><Field label="Fit"><select value={element.fit ?? 'contain'} onChange={(event) => onUpdateElement({ fit: event.target.value as SceneElement['fit'] })}><option value="contain">contain</option><option value="cover">cover</option></select></Field><Field label="Alt text"><input value={element.alt ?? ''} onChange={(event) => onUpdateElement({ alt: event.target.value })} /></Field></div>
        </>}
        {element.type === 'code' && <>
          <div className="field-row"><Field label="Language"><input value={element.language ?? ''} onChange={(event) => onUpdateElement({ language: event.target.value })} /></Field><Field label="Highlight lines"><input value={(element.highlightLines ?? []).join(', ')} onChange={(event) => onUpdateElement({ highlightLines: event.target.value.split(',').map(Number).filter(Number.isInteger) })} /></Field></div>
          <Field label="Verification"><select value={element.codeVerification ?? 'syntax'} onChange={(event) => onUpdateElement({ codeVerification: event.target.value as SceneElement['codeVerification'] })}><option value="exact">exact repository lines</option><option value="syntax">syntax checked</option><option value="display-only">display only</option></select></Field>
          <Field label="Source file"><input value={element.codeSource?.file ?? ''} onChange={(event) => onUpdateElement({ codeSource: { extraction: 'repository', ...element.codeSource, file: event.target.value } })} /></Field>
          <div className="subheading"><small>CODE PRESENTATION</small><span>{element.codePresentation?.windowChrome ?? 'toolbar'}</span></div>
          <div className="field-row">
            <Field label="Theme"><select value={element.codePresentation?.theme ?? 'github-dark'} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, theme: event.target.value as NonNullable<SceneElement['codePresentation']>['theme'] } })}><option value="github-dark">github-dark</option><option value="carbon-dark">carbon-dark</option></select></Field>
            <Field label="Window"><select value={element.codePresentation?.windowChrome ?? 'toolbar'} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, windowChrome: event.target.value as NonNullable<SceneElement['codePresentation']>['windowChrome'] } })}><option value="toolbar">toolbar</option><option value="mac">mac</option><option value="none">none</option></select></Field>
          </div>
          <div className="field-row">
            <Field label="Backdrop"><select value={element.codePresentation?.backdrop ?? 'none'} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, backdrop: event.target.value as NonNullable<SceneElement['codePresentation']>['backdrop'] } })}><option value="none">none</option><option value="soft-gray">soft-gray</option><option value="soft-gray-gradient">soft-gray-gradient</option></select></Field>
            <Field label="Line numbers"><select value={String(element.codePresentation?.showLineNumbers ?? true)} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, showLineNumbers: event.target.value === 'true' } })}><option value="true">show</option><option value="false">hide</option></select></Field>
          </div>
          <div className="motion-number-grid">
            <Field label="Font px"><input type="number" min="12" max="36" value={element.codePresentation?.fontSize ?? 20} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, fontSize: Number(event.target.value) } })} /></Field>
            <Field label="Padding"><input type="number" min="0" max="72" value={element.codePresentation?.padding ?? 16} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, padding: Number(event.target.value) } })} /></Field>
            <Field label="Inset X"><input type="number" min="0" max="240" value={element.codePresentation?.frameInset ?? 0} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, frameInset: Number(event.target.value) } })} /></Field>
          </div>
          <Field label="Inset Y"><input type="number" min="0" max="300" value={element.codePresentation?.frameInsetY ?? element.codePresentation?.frameInset ?? 0} onChange={(event) => onUpdateElement({ codePresentation: { ...element.codePresentation, frameInsetY: Number(event.target.value) } })} /></Field>
        </>}
        {element.type === 'diagram' && <DiagramEditor key={element.id} element={element} onUpdate={onUpdateElement} />}
        {element.type !== 'diagram' && <Field label="Items — one per line"><textarea rows={6} value={(element.items ?? []).map((item) => item.label).join('\n')} onChange={(event) => {
          const labels = event.target.value.split('\n').filter((label) => label.trim());
          onUpdateElement({ items: labels.map((label, index) => element.items?.[index] ?? { id: `${element.id}-item-${Date.now()}-${index + 1}`, label }).map((item, index) => ({ ...item, label: labels[index] })) });
        }} /></Field>}
        <div className="geometry-grid">
          {(['x', 'y', 'width', 'height'] as const).map((key) => <Field key={key} label={`${key.toUpperCase()} %`}><input type="number" min="0" max="100" value={element[key]} onChange={(event) => onUpdateElement({ [key]: Number(event.target.value) })} /></Field>)}
        </div>
        <hr />
        <div className="subheading"><small>MOTION · ENTER</small><span>{element.motion.enter.preset}</span></div>
        <CueEditor cue={element.motion.enter} scene={scene} presets={ENTER_PRESETS} onChange={(enter) => onUpdateElement({ motion: { ...element.motion, enter } })} />
        <div className="subheading"><small>NARRATION BEATS</small><button className="mini-action" onClick={() => {
          const segment = scene.narration[element.motion.beats.length % Math.max(1, scene.narration.length)];
          const cue: MotionCue = { id: `${element.id}-beat-${Date.now()}`, preset: 'pulse', trigger: segment ? { type: 'narration', segmentId: segment.id } : { type: 'time', at: 0 }, duration: 1, stagger: 0.1, intensity: 0.75 };
          onUpdateElement({ motion: { ...element.motion, beats: [...element.motion.beats, cue] } });
        }}>+ Add beat</button></div>
        <div className="motion-cue-list">{element.motion.beats.map((cue, index) => <div className="motion-cue" key={cue.id}>
          <div className="motion-cue-heading"><span>{String(index + 1).padStart(2, '0')} · {cue.preset}</span><div><button disabled={index === 0} onClick={() => { const beats = [...element.motion.beats]; [beats[index - 1], beats[index]] = [beats[index], beats[index - 1]]; onUpdateElement({ motion: { ...element.motion, beats } }); }}>↑</button><button disabled={index === element.motion.beats.length - 1} onClick={() => { const beats = [...element.motion.beats]; [beats[index], beats[index + 1]] = [beats[index + 1], beats[index]]; onUpdateElement({ motion: { ...element.motion, beats } }); }}>↓</button><button onClick={() => onUpdateElement({ motion: { ...element.motion, beats: [...element.motion.beats.slice(0, index + 1), { ...cue, id: `${cue.id}-copy-${Date.now()}` }, ...element.motion.beats.slice(index + 1)] } })}>⧉</button><button onClick={() => onUpdateElement({ motion: { ...element.motion, beats: element.motion.beats.filter((item) => item.id !== cue.id) } })}>×</button></div></div>
          <CueEditor cue={cue} scene={scene} presets={BEAT_PRESETS} onChange={(next) => onUpdateElement({ motion: { ...element.motion, beats: element.motion.beats.map((item) => item.id === cue.id ? next : item) } })} />
        </div>)}</div>
        {element.motion.exit && <><div className="subheading"><small>MOTION · EXIT</small><span>{element.motion.exit.preset}</span></div><CueEditor cue={element.motion.exit} scene={scene} presets={EXIT_PRESETS} onChange={(exit) => onUpdateElement({ motion: { ...element.motion, exit } })} /></>}
        <ColorField label="Accent" value={element.style?.accent ?? project.theme.accent} onChange={(value) => onUpdateElement({ style: { ...element.style, accent: value } })} />
        <Field label="Source pages"><input value={(element.sourcePages ?? []).join(', ')} onChange={(event) => onUpdateElement({ sourcePages: event.target.value.split(',').map(Number).filter(Number.isFinite) })} /></Field>
      </>}
    </div>
  </aside>;
}

function CueEditor({ cue, scene, presets, onChange }: { cue: MotionCue; scene: Scene; presets: readonly MotionPreset[]; onChange: (cue: MotionCue) => void }) {
  return <div className="cue-editor">
    <div className="field-row">
      <Field label="Preset"><select value={cue.preset} onChange={(event) => onChange({ ...cue, preset: event.target.value as MotionPreset })}>{presets.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Trigger"><select value={cue.trigger.type} onChange={(event) => onChange({ ...cue, trigger: event.target.value === 'time' ? { type: 'time', at: 0 } : { type: 'narration', segmentId: scene.narration[0]?.id ?? '' } })}><option value="time">time</option><option value="narration">narration</option></select></Field>
    </div>
    {cue.trigger.type === 'narration' ? <div className="field-row">
      <Field label="Narration"><select value={cue.trigger.segmentId} onChange={(event) => onChange({ ...cue, trigger: { type: 'narration', segmentId: event.target.value, offset: cue.trigger.type === 'narration' ? cue.trigger.offset : 0 } })}>{scene.narration.map((segment, index) => <option key={segment.id} value={segment.id}>{String(index + 1).padStart(2, '0')} · {segment.text.slice(0, 34)}</option>)}</select></Field>
      <Field label="Offset"><input type="number" step=".1" value={cue.trigger.offset ?? 0} onChange={(event) => onChange({ ...cue, trigger: { type: 'narration', segmentId: cue.trigger.type === 'narration' ? cue.trigger.segmentId : scene.narration[0]?.id ?? '', offset: Number(event.target.value) } })} /></Field>
    </div> : <Field label="Start time"><input type="number" min="0" max={scene.duration} step=".1" value={cue.trigger.at} onChange={(event) => onChange({ ...cue, trigger: { type: 'time', at: Number(event.target.value) } })} /></Field>}
    <div className="motion-number-grid">
      <Field label="Duration"><input type="number" min=".1" max="8" step=".1" value={cue.duration} onChange={(event) => onChange({ ...cue, duration: Number(event.target.value) })} /></Field>
      <Field label="Stagger"><input type="number" min="0" max="2" step=".05" value={cue.stagger ?? 0} onChange={(event) => onChange({ ...cue, stagger: Number(event.target.value) })} /></Field>
      <Field label="Intensity"><input type="number" min="0" max="2" step=".05" value={cue.intensity ?? 1} onChange={(event) => onChange({ ...cue, intensity: Number(event.target.value) })} /></Field>
    </div>
  </div>;
}

function DiagramEditor({ element, onUpdate }: { element: SceneElement; onUpdate: (patch: Partial<SceneElement>) => void }) {
  const [draft, setDraft] = useState(JSON.stringify(element.diagram ?? { nodes: [], edges: [] }, null, 2));
  const [error, setError] = useState('');
  return <Field label="Diagram nodes and edges (JSON)"><textarea rows={16} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => {
    try {
      const graph = JSON.parse(draft) as SceneElement['diagram'];
      if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Expected nodes and edges arrays.');
      onUpdate({ diagram: graph });
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid diagram JSON.'); }
  }} />{error && <small role="alert">{error}</small>}</Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><div><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} /></div></label>;
}
