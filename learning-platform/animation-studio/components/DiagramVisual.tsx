import type { CSSProperties } from 'react';
import type { DiagramGraph } from '../model/types';

interface Props {
  graph: DiagramGraph;
  localTime: number;
  finalLayout?: boolean;
  title: string;
  id: string;
}

const progress = (time: number, start = 0) => Math.max(0, Math.min(1, (time - start) / 0.7));

function edgeGeometry(from: DiagramGraph['nodes'][number], to: DiagramGraph['nodes'][number]) {
  const a = { x: (from.x + from.width / 2) * 10, y: (from.y + from.height / 2) * 6 };
  const b = { x: (to.x + to.width / 2) * 10, y: (to.y + to.height / 2) * 6 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const side = Math.sign(dx) || 1;
    const x1 = a.x + side * from.width * 5;
    const x2 = b.x - side * to.width * 5;
    const curve = Math.min(80, Math.abs(x2 - x1) * 0.35);
    return { path: `M ${x1} ${a.y} C ${x1 + side * curve} ${a.y}, ${x2 - side * curve} ${b.y}, ${x2} ${b.y}`, midX: (x1 + x2) / 2, midY: (a.y + b.y) / 2 };
  }
  const side = Math.sign(dy) || 1;
  const y1 = a.y + side * from.height * 3;
  const y2 = b.y - side * to.height * 3;
  const curve = Math.min(70, Math.abs(y2 - y1) * 0.35);
  return { path: `M ${a.x} ${y1} C ${a.x} ${y1 + side * curve}, ${b.x} ${y2 - side * curve}, ${b.x} ${y2}`, midX: (a.x + b.x) / 2, midY: (y1 + y2) / 2 };
}

export function DiagramVisual({ graph, localTime, finalLayout, title, id }: Props) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return <div className="visual-diagram" role="img" aria-label={title}>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <defs><marker id={`${id}-arrow`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 L8 5 L1 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
      {graph.edges.map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return null;
        const geometry = edgeGeometry(from, to);
        const amount = finalLayout ? 1 : progress(localTime, edge.revealAt);
        return <path key={edge.id} data-edge={edge.id} d={geometry.path} className="diagram-link" strokeDasharray={amount < 1 ? `${Math.round(amount * 1000)} 1000` : undefined} markerEnd={edge.kind === 'undirected' || amount < 0.99 ? undefined : `url(#${id}-arrow)`} />;
      })}
    </svg>
    {graph.edges.map((edge) => {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!edge.label || !from || !to) return null;
      const geometry = edgeGeometry(from, to);
      return <span key={`${edge.id}-label`} className="diagram-edge-label" style={{ left: `${geometry.midX / 10}%`, top: `${geometry.midY / 6}%`, opacity: finalLayout ? 1 : progress(localTime, edge.revealAt) }}>{edge.label}</span>;
    })}
    {graph.nodes.map((node) => <div
      key={node.id}
      data-node={node.id}
      className={`diagram-node tone-${node.tone ?? 'neutral'}`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%`, height: `${node.height}%`, opacity: finalLayout ? 1 : progress(localTime, node.revealAt) } as CSSProperties}
    >{node.label}</div>)}
  </div>;
}
