/** Radians of look per pixel of mouse movement. Exposed in Settings later. */
export const MOUSE_SENSITIVITY = 0.0022;

export const CAMERA_FOV = 75;

/** Caps a frame's dt so a background tab doesn't teleport the player on return. */
export const MAX_FRAME_DT = 0.1; // s

/** Exponential smoothing rate for remote players (higher = snappier). */
export const REMOTE_SMOOTHING = 12;

/** Ignore sub-millimetre jitter when deciding whether to send a move. */
export const MOVE_EPSILON = 0.001;
