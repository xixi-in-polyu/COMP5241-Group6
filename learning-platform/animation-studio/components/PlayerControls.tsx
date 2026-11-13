import type { CSSProperties } from 'react';
import type { AnimationProject, SceneElement } from '../model/types';
import { buildSceneTimeline, formatTime, getProjectDuration } from '../model/timeline';
import { resolveCueStart } from '../model/motion';
import { Icon } from './Icon';

interface Props {
  project: AnimationProject;
  currentTime: number;
  playing: boolean;
  narrationEnabled: boolean;
  captionsEnabled: boolean;
  rate: number;
  selectedSceneId?: string;
  selectedElement?: SceneElement;
  onSeek: (time: number) => void;
  onPlayingChange: (value: boolean) => void;
  onNarrationChange: (value: boolean) => void;
  onCaptionsChange: (value: boolean) => void;
  onRateChange: (value: number) => void;
}

export function PlayerControls(props: Props) {
  const total = getProjectDuration(props.project);
  const timeline = buildSceneTimeline(props.project);
  const selectedTiming = timeline.find((item) => item.scene.id === props.selectedSceneId);
  const cues = props.selectedElement && selectedTiming
    ? [props.selectedElement.motion.enter, ...props.selectedElement.motion.beats, ...(props.selectedElement.motion.exit ? [props.selectedElement.motion.exit] : [])].flatMap((cue) => {
      const local = resolveCueStart(cue, selectedTiming.scene);
      return local === undefined ? [] : [{ cue, time: selectedTiming.start + local }];
    })
    : [];
  return <div className="player-controls panel">
    <div className="timeline-wrap">
      <div className="timeline-chapters">{props.project.chapters.map((chapter) => {
        const first = timeline.find((item) => item.scene.chapterId === chapter.id);
        if (!first) return null;
        return <button key={chapter.id} style={{ left: `${(first.start / total) * 100}%`, '--marker-color': chapter.color } as CSSProperties} title={chapter.title} onClick={() => props.onSeek(first.start)}><i /><span>{chapter.shortTitle}</span></button>;
      })}</div>
      <div className="timeline-cues">{cues.map(({ cue, time }) => <button key={cue.id} title={`${cue.preset} · ${time.toFixed(1)}s`} style={{ left: `${(time / total) * 100}%` } as CSSProperties} onClick={() => props.onSeek(time)}><i /></button>)}</div>
      <input aria-label="Animation timeline" className="timeline-range" type="range" min="0" max={total} step=".1" value={Math.min(props.currentTime, total)} onChange={(event) => props.onSeek(Number(event.target.value))} style={{ '--progress': `${(props.currentTime / total) * 100}%` } as CSSProperties} />
    </div>
    <div className="transport">
      <div className="transport-left">
        <button title="Restart" onClick={() => props.onSeek(0)}><Icon name="restart" /></button>
        <button className="play-button" title={props.playing ? 'Pause' : 'Play'} onClick={() => props.onPlayingChange(!props.playing)}><Icon name={props.playing ? 'pause' : 'play'} /></button>
        <span className="timecode"><b>{formatTime(props.currentTime)}</b><i>/</i>{formatTime(total)}</span>
      </div>
      <div className="transport-right">
        <button className={props.narrationEnabled ? 'enabled' : ''} title="Narration" onClick={() => props.onNarrationChange(!props.narrationEnabled)}><Icon name={props.narrationEnabled ? 'volume' : 'mute'} /></button>
        <button className={props.captionsEnabled ? 'enabled' : ''} title="Page transcript" onClick={() => props.onCaptionsChange(!props.captionsEnabled)}><Icon name="captions" /></button>
        <label className="rate-select"><span>VOICE</span><select value={props.rate} onChange={(event) => props.onRateChange(Number(event.target.value))}><option value=".85">0.85×</option><option value="1">1.0×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select></label>
      </div>
    </div>
  </div>;
}
