import { useMemo, useState } from 'react';
import type { AnimationProject, Scene } from '../model/types';
import { Icon } from './Icon';

interface Props {
  project: AnimationProject;
  selectedSceneId: string;
  onSelect: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onAdd: (chapterId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SceneList({ project, selectedSceneId, onSelect, onReorder, onAdd, onDuplicate, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<string>();
  const grouped = useMemo(() => project.chapters.map((chapter) => ({
    chapter,
    scenes: project.scenes.filter((scene) => scene.chapterId === chapter.id),
  })), [project]);

  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return <aside className="scene-list panel">
    <div className="panel-heading"><div><small>PROJECT</small><h2>Story map</h2></div><span>{project.scenes.length} scenes</span></div>
    <div className="chapter-stack">{grouped.map(({ chapter, scenes }, chapterIndex) => <section className="chapter-group" key={chapter.id}>
      <button className="chapter-heading" onClick={() => toggle(chapter.id)}>
        <span className="chapter-index" style={{ color: chapter.color }}>{String(chapterIndex + 1).padStart(2, '0')}</span>
        <span><b>{chapter.shortTitle}</b><small>{scenes.length} scenes</small></span>
        <Icon name="chevron" className={collapsed.has(chapter.id) ? 'rotated' : ''} />
      </button>
      {!collapsed.has(chapter.id) && <div className="scene-stack">{scenes.map((scene, index) => <article
        key={scene.id}
        className={`scene-row ${selectedSceneId === scene.id ? 'active' : ''}`}
        draggable
        onDragStart={() => setDragged(scene.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => dragged && dragged !== scene.id && onReorder(dragged, scene.id)}
        onClick={() => onSelect(scene.id)}
      >
        <span className="drag-handle">⠿</span>
        <span className="scene-number">{String(project.scenes.indexOf(scene) + 1).padStart(2, '0')}</span>
        <div><b>{scene.title}</b><small>{scene.duration}s · {scene.template}</small></div>
        <div className="row-actions">
          <button title="Duplicate" onClick={(event) => { event.stopPropagation(); onDuplicate(scene.id); }}><Icon name="copy" /></button>
          <button title="Delete" disabled={project.scenes.length === 1} onClick={(event) => { event.stopPropagation(); onDelete(scene.id); }}><Icon name="trash" /></button>
        </div>
      </article>)}
      <button className="add-scene" onClick={() => onAdd(chapter.id)}><Icon name="plus" /> Add scene</button>
      </div>}
    </section>)}</div>
  </aside>;
}

export function cloneScene(scene: Scene): Scene {
  const suffix = Math.random().toString(36).slice(2, 7);
  const narrationIds = new Map(scene.narration.map((item) => [item.id, `${item.id}-${suffix}`]));
  const cloneCue = (cue: Scene['elements'][number]['motion']['enter']) => ({
    ...cue,
    id: `${cue.id}-${suffix}`,
    trigger: cue.trigger.type === 'narration'
      ? { ...cue.trigger, segmentId: narrationIds.get(cue.trigger.segmentId) ?? cue.trigger.segmentId }
      : { ...cue.trigger },
  });
  return {
    ...structuredClone(scene),
    id: `${scene.id}-${suffix}`,
    title: `${scene.title} copy`,
    elements: scene.elements.map((item) => ({
      ...structuredClone(item),
      id: `${item.id}-${suffix}`,
      items: item.items?.map((subItem) => ({ ...subItem, id: `${subItem.id}-${suffix}` })),
      motion: {
        ...item.motion,
        enter: cloneCue(item.motion.enter),
        beats: item.motion.beats.map(cloneCue),
        exit: item.motion.exit ? cloneCue(item.motion.exit) : undefined,
      },
    })),
    narration: scene.narration.map((item) => ({ ...item, id: narrationIds.get(item.id)! })),
  };
}
