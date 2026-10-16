export const WINDOW_DRESSING_STYLES = ['sheer', 'blackout', 'layered', 'roller', 'roman', 'venetian'] as const;
export type WindowDressingStyle = typeof WINDOW_DRESSING_STYLES[number];
export interface WindowDressingConfig { style: WindowDressingStyle; openness?: number; color?: string; liningColor?: string; }

export function validateOpenness(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Opening amount must be between 0 and 1');
  return value;
}
export function validateWindowDressing(config: WindowDressingConfig): void {
  if (!WINDOW_DRESSING_STYLES.includes(config.style)) throw new Error('Invalid window dressing style');
  if (config.openness !== undefined) validateOpenness(config.openness);
  for (const color of [config.color, config.liningColor]) if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Fabric color must be a six-digit hex color');
}
export function windowDressingDefaults(style: WindowDressingStyle) {
  return { openness: ['roller', 'roman', 'venetian'].includes(style) ? .25 : .65,
    color: style === 'sheer' ? '#f2eee4' : style === 'blackout' ? '#b9ab94' : style === 'layered' ? '#59685e' : '#ddd6c8', liningColor: '#f2eee4' };
}
