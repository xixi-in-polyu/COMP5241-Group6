import type { CaptionMode, ElementType, ElementVisual, SceneTemplate } from './types';

export const VISUAL_VARIANTS: ElementVisual['variant'][] = ['auto', 'grid', 'rail', 'split', 'orbital', 'editorial', 'diagram', 'poster', 'minimal'];
export const SURFACE_STYLES: ElementVisual['surface'][] = ['none', 'soft', 'outline'];
export const CAPTION_MODES: CaptionMode[] = ['bottom', 'side', 'keywords', 'hidden'];

export function defaultVisualForType(type: ElementType): ElementVisual {
  switch (type) {
    case 'flow': return { variant: 'rail', surface: 'none' };
    case 'cards': return { variant: 'editorial', surface: 'soft' };
    case 'lifecycle': return { variant: 'orbital', surface: 'none' };
    case 'comparison': return { variant: 'split', surface: 'none' };
    case 'timeline': return { variant: 'rail', surface: 'none' };
    case 'metrics': return { variant: 'poster', surface: 'none' };
    case 'topology': return { variant: 'diagram', surface: 'none' };
    case 'diagram': return { variant: 'diagram', surface: 'none' };
    case 'formula': return { variant: 'poster', surface: 'none' };
    case 'badge': return { variant: 'minimal', surface: 'outline' };
    case 'image': return { variant: 'editorial', surface: 'none' };
    case 'code': return { variant: 'minimal', surface: 'outline' };
    default: return { variant: 'minimal', surface: 'none' };
  }
}

export function defaultCaptionForTemplate(template: SceneTemplate): CaptionMode {
  void template;
  return 'bottom';
}
