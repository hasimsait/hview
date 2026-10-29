import { useEffect, useRef } from 'react';
import { useRuntime } from '../context/RuntimeContext';

/** Use the same final-colour texture as the scene, including dark wood tones. */
export function WoodFinishSwatch({ variant, name, color, rotation }: { variant: string; name: string; color: string; rotation?: number }) {
  const { materials } = useRuntime(), canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const texture = materials.getWoodTexture(variant);
    const paint = () => {
      const target = canvas.current, image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
      if (target && image?.width && image.height) target.getContext('2d')!.drawImage(image, 0, 0, target.width, target.height);
    };
    paint(); return materials.textures.subscribe(paint);
    // The material service owns this shared texture; unmounting only removes the listener.
  }, [materials, variant]);
  return <canvas ref={canvas} width={128} height={128} aria-label={`${name} grain preview`} className="w-10 h-10 rounded-md border border-slate-700 shadow-inner shrink-0" style={{ backgroundColor: color, transform: rotation ? `rotate(${rotation}deg)` : undefined }} />;
}
