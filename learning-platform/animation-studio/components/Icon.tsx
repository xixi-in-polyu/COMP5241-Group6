import type { SVGProps } from 'react';

type IconName = 'play' | 'pause' | 'restart' | 'volume' | 'mute' | 'captions' | 'undo' | 'redo' | 'download' | 'upload' | 'edit' | 'preview' | 'plus' | 'copy' | 'trash' | 'chevron' | 'sun' | 'moon' | 'back';

const paths: Record<IconName, string> = {
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
  restart: 'M12 5a7 7 0 1 1-6.7 5H2l4-4 4 4H7.4A5 5 0 1 0 12 7z',
  volume: 'M4 10v4h4l5 4V6L8 10H4zm12.5 2a4.5 4.5 0 0 0-2-3.74v7.48a4.5 4.5 0 0 0 2-3.74z',
  mute: 'M4 10v4h4l5 4V6L8 10H4zm12-1 5 6m0-6-5 6',
  captions: 'M4 6h16v12H4zM7 11h4m2 0h4m-10 3h3m2 0h5',
  undo: 'M9 7 4 12l5 5v-3h4a5 5 0 0 1 5 5v-4a5 5 0 0 0-5-5H9z',
  redo: 'm15 7 5 5-5 5v-3h-4a5 5 0 0 0-5 5v-4a5 5 0 0 1 5-5h4z',
  download: 'M12 3v12m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 21V9m-5 5 5-5 5 5M5 4h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zm9-13 4 4',
  preview: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  plus: 'M12 5v14M5 12h14',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  trash: 'M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13',
  chevron: 'm9 6 6 6-6 6',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 15.2A8 8 0 0 1 8.8 4 8.2 8.2 0 1 0 20 15.2z',
  back: 'M19 12H5m7-7-7 7 7 7',
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
