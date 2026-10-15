/**
 * Shadow texture generators for the 3D studio.
 *
 * These produce small offscreen canvases with soft radial gradients that are
 * wrapped in THREE.CanvasTexture and mapped onto ground planes to fake a
 * grounded contact shadow under the ceramic piece.
 *
 * Both StudioScreen and CeramicCanvas3D rely on these; keeping them in one
 * shared util avoids the duplicated (and previously missing) definitions.
 */

/**
 * Wide, faint elliptical shadow spread across the floor under the piece.
 * @returns {HTMLCanvasElement}
 */
export function createRadialShadowCanvas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(40, 30, 24, 0.55)');
  gradient.addColorStop(0.45, 'rgba(40, 30, 24, 0.28)');
  gradient.addColorStop(1, 'rgba(40, 30, 24, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Tighter, darker occlusion shadow right at the base of the piece.
 * @returns {HTMLCanvasElement}
 */
export function createContactShadowCanvas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(20, 14, 10, 0.75)');
  gradient.addColorStop(0.5, 'rgba(20, 14, 10, 0.35)');
  gradient.addColorStop(1, 'rgba(20, 14, 10, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}
