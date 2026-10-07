import type { WebGLRenderer } from 'three';

/**
 * Dev-only: the renderer, so devtools/e2e can read draw calls and triangles. Plain module (no
 * three/R3F runtime imports) so the devtools stay tiny and load before the 3D chunk.
 */
export const devRenderer: { gl: WebGLRenderer | null } = { gl: null };
