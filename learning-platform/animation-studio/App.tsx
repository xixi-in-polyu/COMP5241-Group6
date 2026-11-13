'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { preparePublishedProject } from './prepare';
import { useHistory } from './hooks/useHistory';
import { useNarration } from './hooks/useNarration';
import type { AnimationProject, Scene, SceneElement } from './model/types';
import { createDefaultMotion } from './model/motion';
import { buildSceneTimeline, findSceneAtTime, framesToSeconds, getProjectDuration, getProjectDurationInFrames, secondsToFrames } from './model/timeline';
import { migrateProject } from './model/migrate';
import { projectValidator } from './model/validator';
import { defaultCaptionForTemplate, defaultVisualForType } from './model/visual';
import { Icon } from './components/Icon';
import { Inspector } from './components/Inspector';
import { PlayerControls } from './components/PlayerControls';
import { RemotionProject } from './components/RemotionProject';
import { SceneList, cloneScene } from './components/SceneList';
import { ScriptPanel } from './components/ScriptPanel';

function freshScene(chapterId: string): Scene {
  const id = `scene-${Date.now()}`;
  const narration = [{ id: `${id}-n1`, text: 'Write the narration for this scene.', start: 0, end: 30 }];
  return {
    id,
    chapterId,
    title: 'Untitled scene',
    template: 'concept',
    duration: 30,
    knowledgeNodeIds: [],
    narration,
    elements: [{
      id: `${id}-title`, type: 'title', content: 'NEW\nSCENE', x: 8, y: 12, width: 55, height: 28,
      motion: createDefaultMotion(`${id}-title`, 'title', narration), visual: defaultVisualForType('title'), sourcePages: [],
    }, {
      id: `${id}-text`, type: 'text', content: 'Select an element to edit its content and layout.', x: 8, y: 50, width: 56, height: 18,
      motion: createDefaultMotion(`${id}-text`, 'text', narration, { enter: 'fade', start: 2, duration: 1 }), visual: defaultVisualForType('text'), sourcePages: [],
    }],
    transitionOut: { preset: 'fade', duration: 0.6 },
    captionMode: defaultCaptionForTemplate('concept'),
  };
}

function normalizeTransitions(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    transitionOut: index < scenes.length - 1 ? scene.transitionOut ?? { preset: 'fade', duration: 0.6 } : undefined,
  }));
}

type AnimationStudioProps = {
  initialProject?: unknown;
  readOnly?: boolean;
  exitHref?: string;
  versionLabel?: string;
};

function Studio({ initialProject, readOnly, exitHref, versionLabel }: { initialProject: AnimationProject; readOnly: boolean; exitHref?: string; versionLabel?: string }) {
  const original = useMemo(() => initialProject, [initialProject]);
  const history = useHistory<AnimationProject>(original);
  const project = history.present;
  const [mode, setMode] = useState<'edit' | 'preview'>(readOnly ? 'preview' : 'edit');
  const [previewState, setPreviewState] = useState<'timeline' | 'final'>('timeline');
  const [uiTheme, setUiTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('storyline-ui-theme') === 'dark' ? 'dark' : 'light');
  const [selectedSceneId, setSelectedSceneId] = useState(project.scenes[0].id);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [scriptVisible, setScriptVisible] = useState(true);
  const [rate, setRate] = useState(1);
  const [toast, setToast] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const total = getProjectDuration(project);
  const activeTiming = findSceneAtTime(project, Math.min(currentTime, Math.max(0, total - .001)));
  const activeScene = activeTiming.scene;
  const localTime = currentTime - activeTiming.start;
  const selectedScene = project.scenes.find((item) => item.id === selectedSceneId) ?? activeScene;
  const selectedElement = selectedScene.elements.find((item) => item.id === selectedElementId);
  const fps = project.renderConfig.fps;
  const durationInFrames = getProjectDurationInFrames(project);
  const seekToTime = useCallback((time: number) => {
    const next = Math.min(total, Math.max(0, time));
    playerRef.current?.seekTo(Math.min(durationInFrames - 1, secondsToFrames(next, fps)));
    setCurrentTime(next);
  }, [durationInFrames, fps, total]);
  const skipNarrationGap = useCallback((nextTime: number) => {
    const playerTime = playerRef.current ? framesToSeconds(playerRef.current.getCurrentFrame(), fps) : nextTime;
    seekToTime(Math.max(playerTime, nextTime + .02));
  }, [fps, seekToTime]);
  const activeNarration = useNarration(project, currentTime, playing, narrationEnabled, rate, skipNarrationGap);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(undefined), 2600);
  }, []);

  useEffect(() => {
    localStorage.setItem('storyline-ui-theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => setCurrentTime(framesToSeconds(event.detail.frame, fps));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrentTime(total); };
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [durationInFrames, fps, total]);

  const setPlayback = useCallback((value: boolean) => {
    if (value) playerRef.current?.play();
    else playerRef.current?.pause();
    setPlaying(value);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- playback drives the editor selection. */
  useEffect(() => {
    setSelectedSceneId(activeScene.id);
    if (selectedSceneId !== activeScene.id) { setSelectedElementId(''); setSelectedItemId(''); }
  }, [activeScene.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); setPlayback(!playerRef.current?.isPlaying()); }
      if (event.code === 'ArrowRight') seekToTime(currentTime + 5);
      if (event.code === 'ArrowLeft') seekToTime(currentTime - 5);
      if (!readOnly && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [currentTime, history.undo, history.redo, readOnly, seekToTime, setPlayback]);

  const commit = (updater: (current: AnimationProject) => AnimationProject) => history.commit((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));

  const selectScene = (id: string) => {
    const sceneTimeline = buildSceneTimeline(project);
    const timing = sceneTimeline.find((item) => item.scene.id === id);
    if (!timing) return;
    const incomingTransition = timing.index > 0 ? project.scenes[timing.index - 1].transitionOut?.duration ?? 0 : 0;
    setSelectedSceneId(id);
    setSelectedElementId('');
    setSelectedItemId('');
    seekToTime(timing.start + incomingTransition + .01);
    setPlayback(false);
  };

  const updateScene = (patch: Partial<Scene>) => commit((current) => ({ ...current, scenes: current.scenes.map((item) => item.id === selectedScene.id ? { ...item, ...patch } : item) }));
  const updateElement = (patch: Partial<SceneElement>) => commit((current) => ({ ...current, scenes: current.scenes.map((scene) => scene.id !== selectedScene.id ? scene : { ...scene, elements: scene.elements.map((item) => item.id === selectedElementId ? { ...item, ...patch } : item) }) }));

  const reorder = (fromId: string, toId: string) => commit((current) => {
    const scenes = [...current.scenes];
    const from = scenes.findIndex((item) => item.id === fromId);
    const to = scenes.findIndex((item) => item.id === toId);
    const [moved] = scenes.splice(from, 1);
    scenes.splice(to, 0, moved);
    return { ...current, scenes: normalizeTransitions(scenes) };
  });

  const addScene = (chapterId: string) => {
    const next = freshScene(chapterId);
    commit((current) => ({ ...current, scenes: normalizeTransitions([...current.scenes, next]) }));
    window.setTimeout(() => selectScene(next.id));
  };

  const duplicateScene = (id: string) => {
    const index = project.scenes.findIndex((item) => item.id === id);
    const copy = cloneScene(project.scenes[index]);
    commit((current) => ({ ...current, scenes: normalizeTransitions([...current.scenes.slice(0, index + 1), copy, ...current.scenes.slice(index + 1)]) }));
    window.setTimeout(() => selectScene(copy.id));
  };

  const deleteScene = (id: string) => {
    const index = project.scenes.findIndex((item) => item.id === id);
    const fallback = project.scenes[Math.max(0, index - 1)];
    commit((current) => ({ ...current, scenes: normalizeTransitions(current.scenes.filter((item) => item.id !== id)) }));
    window.setTimeout(() => selectScene(fallback.id));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sdlc-storyline-project.json';
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Project exported');
  };

  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const loaded = migrateProject(JSON.parse(await file.text()));
      history.replace(loaded);
      setSelectedSceneId(loaded.scenes[0].id);
      setSelectedElementId('');
      setSelectedItemId('');
      seekToTime(0);
      setPlayback(false);
      notify('Project imported');
    } catch (error) {
      notify(error instanceof Error ? error.message.split('\n')[0] : 'Import failed');
    }
  };

  const reset = () => {
    history.replace(original);
    setSelectedSceneId('scene-01');
    setSelectedElementId('');
    setSelectedItemId('');
    seekToTime(0);
    setPlayback(false);
    notify('Example restored');
  };

  const warnings = projectValidator.validate(project);

  return <div className={`app-shell mode-${mode} ui-${uiTheme}`}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><i /><i /><i /></div><div><b>Storyline</b><span>STUDIO</span></div></div>
      <div className="project-title"><span className="status-dot" /> <b>{project.title}</b><small>{versionLabel ? `${versionLabel} · ` : ''}{readOnly ? 'Published animation' : 'Edited just now'}</small></div>
      <div className="top-actions">
        {exitHref ? <a className="text-action" href={exitHref}><Icon name="back" />Back</a> : null}
        {!readOnly && <div className="undo-group"><button title="Undo" disabled={!history.canUndo} onClick={history.undo}><Icon name="undo" /></button><button title="Redo" disabled={!history.canRedo} onClick={history.redo}><Icon name="redo" /></button></div>}
        <button className="theme-toggle" title={`Switch to ${uiTheme === 'dark' ? 'light' : 'dark'} interface`} aria-label={`Switch to ${uiTheme === 'dark' ? 'light' : 'dark'} interface`} onClick={() => setUiTheme((value) => value === 'dark' ? 'light' : 'dark')}><Icon name={uiTheme === 'dark' ? 'sun' : 'moon'} /><span>{uiTheme === 'dark' ? 'Light' : 'Dark'}</span></button>
        {!readOnly && <div className="mode-switch"><button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}><Icon name="edit" />Edit</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => { setMode('preview'); setSelectedElementId(''); setSelectedItemId(''); }}><Icon name="preview" />Preview</button></div>}
        {!readOnly && <button className="text-action" onClick={() => fileInput.current?.click()}><Icon name="upload" />Import</button>}
        {!readOnly && <button className="primary-action" onClick={exportProject}><Icon name="download" />Export project</button>}
        {!readOnly && <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => importProject(event.target.files?.[0])} />}
      </div>
    </header>

    <main className="workspace">
      {mode === 'edit' && <SceneList project={project} selectedSceneId={selectedSceneId} onSelect={selectScene} onReorder={reorder} onAdd={addScene} onDuplicate={duplicateScene} onDelete={deleteScene} />}
      <section className="stage-area">
        <div className="stage-heading"><div><small>CANVAS · 16:9</small><b>{activeScene.title}</b></div><div className="stage-tools"><span className={warnings.some((item) => item.severity === 'error') ? 'has-errors' : ''}>{warnings.length ? `${warnings.length} project notes` : 'Project valid'}</span>{mode === 'edit' && <button className={previewState === 'final' ? 'active' : ''} onClick={() => setPreviewState((value) => value === 'timeline' ? 'final' : 'timeline')}>{previewState === 'timeline' ? 'Show final layout' : 'Follow timeline'}</button>}<button onClick={() => setScriptVisible((value) => !value)}>{scriptVisible ? 'Hide' : 'Show'} script</button>{!readOnly && <button onClick={reset}>Reset to published</button>}</div></div>
        <div className="canvas-frame">
          <Player
            key={`${fps}-${durationInFrames}`}
            ref={playerRef}
            className="remotion-player"
            component={RemotionProject}
            inputProps={{ project, editable: mode === 'edit', previewState, selectedElementId, selectedItemId, onSelectElement: (elementId: string, itemId?: string) => { setSelectedElementId(elementId); setSelectedItemId(itemId ?? ''); } }}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={project.renderConfig.width}
            compositionHeight={project.renderConfig.height}
            playbackRate={rate}
            controls={false}
            clickToPlay={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <ScriptPanel scene={activeScene} localTime={localTime} locale={project.locale} visible={scriptVisible && captionsEnabled} spokenCharIndex={activeNarration?.spokenCharIndex} />
      </section>
      {mode === 'edit' && <Inspector project={project} scene={selectedScene} element={selectedElement} selectedItemId={selectedItemId} onUpdateScene={updateScene} onUpdateElement={updateElement} onUpdateTheme={(key, value) => commit((current) => ({ ...current, theme: { ...current.theme, [key]: value } }))} />}
    </main>

    <PlayerControls project={project} currentTime={currentTime} playing={playing} narrationEnabled={narrationEnabled} captionsEnabled={captionsEnabled} rate={rate} selectedSceneId={selectedScene.id} selectedElement={selectedElement} onSeek={(time) => { seekToTime(time); setPlayback(false); }} onPlayingChange={setPlayback} onNarrationChange={setNarrationEnabled} onCaptionsChange={setCaptionsEnabled} onRateChange={setRate} />
    {toast && <div className="toast">{toast}</div>}
  </div>;
}


export default function App({ initialProject, readOnly = false, exitHref, versionLabel }: AnimationStudioProps) {
  const prepared = useMemo(() => preparePublishedProject(initialProject), [initialProject]);

  if (prepared.project === null) {
    return (
      <div className="animation-studio" style={{ alignItems: 'center', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <p style={{ color: '#eef0ea', fontSize: 14, fontWeight: 600 }}>This animation could not be loaded.</p>
          <p style={{ color: '#8a929e', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>{prepared.error}</p>
          {exitHref ? <a href={exitHref} style={{ color: '#e9ff66', display: 'inline-block', fontSize: 12, marginTop: 18 }}>Back</a> : null}
        </div>
      </div>
    );
  }

  return <Studio exitHref={exitHref} initialProject={prepared.project} readOnly={readOnly} versionLabel={versionLabel} />;
}
