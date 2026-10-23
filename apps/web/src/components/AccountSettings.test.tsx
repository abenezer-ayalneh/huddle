import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from './AccountSettings';

const mocks = vi.hoisted(() => ({ getProfile: vi.fn(), uploadAvatar: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks, isFaultError: () => false }));
vi.mock('@/lib/auth-client', () => ({ authClient: {}, authPost: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/faults', () => ({ emitFault: vi.fn() }));

beforeEach(() => {
  mocks.getProfile.mockResolvedValue({ name: 'Alex', email: 'alex@example.test', emailVerified: true, image: '/old-avatar.webp', hasPassword: true });
  mocks.uploadAvatar.mockReset().mockResolvedValue({ image: '/new-avatar.webp' });
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 1200;
      naturalHeight = 800;
      onload: (() => void) | null = null;
      onerror = null;
      private url = '';
      get src() {
        return this.url;
      }
      set src(value: string) {
        this.url = value;
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function chooseImage() {
  await screen.findByLabelText('Upload image');
  fireEvent.change(screen.getByLabelText('Upload image'), { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply image' }).hasAttribute('disabled')).toBe(false));
}

describe('account avatar adjustment', () => {
  it('previews without uploading, and Cancel keeps the previous avatar', async () => {
    render(<AccountSettings onClose={vi.fn()} />);
    await chooseImage();
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(screen.getByAltText('Profile').getAttribute('src')).toBe('/old-avatar.webp');
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('applies the adjusted crop and updates the avatar only after upload succeeds', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['crop'], { type: 'image/png' })));
    render(<AccountSettings onClose={vi.fn()} />);
    await chooseImage();
    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
    fireEvent.keyDown(screen.getByRole('group', { name: 'Profile picture position' }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply image' }));
    await screen.findByText('Profile picture updated.');
    expect(drawImage.mock.calls[0].slice(1)).toEqual([400 - (5 * 400) / 240, 200, 400, 400, 0, 0, 512, 512]);
    expect(mocks.uploadAvatar).toHaveBeenCalledOnce();
    expect(mocks.uploadAvatar.mock.calls[0][0]).toMatchObject({ name: 'avatar.png', type: 'image/png' });
    expect(screen.getByAltText('Profile').getAttribute('src')).toBe('/new-avatar.webp');
  });

  it('keeps adjustments on upload failure and can reset them before retrying', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['crop'], { type: 'image/png' })));
    mocks.uploadAvatar.mockRejectedValueOnce(new Error('Upload failed. Try again.'));
    render(<AccountSettings onClose={vi.fn()} />);
    await chooseImage();
    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply image' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Zoom').getAttribute('value')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('Zoom').getAttribute('value')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(screen.getByAltText('Profile').getAttribute('src')).toBe('/old-avatar.webp');
  });
});
