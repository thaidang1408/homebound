/**
 * 3D material colors. The 3D counterpart of the UI design tokens: every mesh color comes from
 * here so the world keeps one cohesive warm low-poly palette.
 */
export const PALETTE = {
  sky: '#a9d4e8',
  grass: '#6d9a4f',
  hemiSky: '#fff4e0',
  // Lights downward-facing surfaces (ceilings): warm, so rooms don't look like caves.
  hemiGround: '#9c8a6a',
  sun: '#fff1d6',
  lamp: '#ffcf8a',

  floor: '#b98b5e',
  rug: '#c96f4a',
  wall: '#ead8b8',
  wallTrim: '#8a5a3b',
  ceiling: '#d9c4a0',
  roof: '#8c4a3a',

  wood: '#a06a42',
  woodDark: '#6e4429',
  iron: '#4a4f55',
  ironLight: '#6d737a',
  fabric: '#5f8f7e',
  mattress: '#f1e9dc',
  pillow: '#ffffff',

  rawMeat: '#d4566a',
  cookedMeat: '#7a4426',
  smoke: '#f2f2f2',
  progress: '#e8a54b',
  focus: '#ffe08a',
  // Name tags (canvas-drawn, so they need literal colors; match --color-surface / --color-text).
  labelBg: 'rgba(29, 36, 33, 0.82)',
  labelText: '#f6efe2',
} as const;
