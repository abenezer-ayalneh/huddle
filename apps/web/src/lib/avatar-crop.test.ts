import { describe, expect, it } from 'vitest';
import { avatarCrop } from './avatar-crop';

describe('avatar crop', () => {
  it('starts centered for portrait and landscape photos', () => {
    expect(avatarCrop(1200, 800, 1, 0, 0)).toMatchObject({ left: 200, top: 0, side: 800 });
    expect(avatarCrop(800, 1200, 1, 0, 0)).toMatchObject({ left: 0, top: 200, side: 800 });
  });
  it('converts preview movement into the saved source crop', () => {
    expect(avatarCrop(1200, 800, 2, 60, -60)).toMatchObject({ left: 300, top: 300, side: 400 });
  });
  it('never exposes an empty edge when dragged past any boundary', () => {
    expect(avatarCrop(1200, 800, 2, 10000, 10000)).toMatchObject({ left: 0, top: 0, side: 400 });
    expect(avatarCrop(1200, 800, 2, -10000, -10000)).toMatchObject({ left: 800, top: 400, side: 400 });
  });
});
