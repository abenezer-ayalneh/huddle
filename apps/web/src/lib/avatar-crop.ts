/** Square source bounds shared by the circular preview and saved avatar. */
export function avatarCrop(width: number, height: number, zoom: number, x: number, y: number) {
  const side = Math.min(width, height) / zoom;
  const left = Math.max(0, Math.min(width - side, (width - side) / 2 - (x * side) / 240));
  const top = Math.max(0, Math.min(height - side, (height - side) / 2 - (y * side) / 240));
  return { left, top, side, scale: 240 / side };
}
