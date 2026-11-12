import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import type { AnimationProject } from '../model/types';
import { secondsToFrames } from '../model/timeline';
import { SceneRenderer } from './SceneRenderer';

export interface RemotionProjectProps extends Record<string, unknown> {
  project: AnimationProject;
  editable: boolean;
  selectedElementId?: string;
  selectedItemId?: string;
  previewState?: 'timeline' | 'final';
  onSelectElement?: (elementId: string, itemId?: string) => void;
}

function SceneClip({ project, sceneId, editable, selectedElementId, selectedItemId, previewState, onSelectElement }: RemotionProjectProps & { sceneId: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <SceneRenderer
    project={project}
    sceneId={sceneId}
    localTime={frame / fps}
    editable={editable}
    selectedElementId={selectedElementId}
    selectedItemId={selectedItemId}
    finalLayout={editable && previewState === 'final'}
    onSelectElement={onSelectElement}
  />;
}

export function RemotionProject(props: RemotionProjectProps) {
  const fps = props.project.renderConfig.fps;
  const transitionPresentation = (preset: NonNullable<AnimationProject['scenes'][number]['transitionOut']>['preset']): TransitionPresentation<Record<string, unknown>> => {
    if (preset === 'slide-left') return slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    if (preset === 'slide-up') return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    if (preset === 'wipe') return wipe({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    return fade({ shouldFadeOutExitingScene: true }) as TransitionPresentation<Record<string, unknown>>;
  };
  return <AbsoluteFill>
    <TransitionSeries>
      {props.project.scenes.flatMap((scene, index) => {
        const transitionFrames = scene.transitionOut ? secondsToFrames(scene.transitionOut.duration, fps) : 0;
        const nodes: ReactNode[] = [<TransitionSeries.Sequence key={`${scene.id}-sequence`} durationInFrames={secondsToFrames(scene.duration, fps) + transitionFrames} name={scene.title}>
            <SceneClip {...props} sceneId={scene.id} />
          </TransitionSeries.Sequence>];
        if (scene.transitionOut && index < props.project.scenes.length - 1) nodes.push(<TransitionSeries.Transition
            key={`${scene.id}-transition`}
            presentation={transitionPresentation(scene.transitionOut.preset)}
            timing={linearTiming({ durationInFrames: transitionFrames })}
          />);
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>;
}
