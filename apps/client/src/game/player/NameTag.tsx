import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from '../world/palette';

const FONT_PX = 48;
const PADDING_X = 22;
const HEIGHT_PX = 72;
/** On-screen size in world metres; readable across the house and the clearing. */
const WORLD_HEIGHT = 0.3;

function uiFont(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-family');
  return `800 ${FONT_PX}px ${family || 'system-ui, sans-serif'}`;
}

/**
 * A partner's name above their head, drawn once into a canvas texture. A sprite (not a DOM
 * overlay) so it costs no React roots or per-frame layout. Visible through walls on purpose:
 * you always know where your partner is.
 */
export function NameTag({ text, y }: { text: string; y: number }) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.font = uiFont();
    canvas.width = Math.ceil(ctx.measureText(text).width + PADDING_X * 2);
    canvas.height = HEIGHT_PX;

    ctx.fillStyle = PALETTE.labelBg;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, HEIGHT_PX / 2);
    ctx.fill();
    ctx.font = uiFont(); // resizing the canvas resets the context state
    ctx.fillStyle = PALETTE.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return { texture: map, aspect: canvas.width / canvas.height };
  }, [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, y, 0]} scale={[WORLD_HEIGHT * aspect, WORLD_HEIGHT, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
