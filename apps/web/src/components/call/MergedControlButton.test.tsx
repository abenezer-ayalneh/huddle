import { cleanup, render, screen } from '@testing-library/react';
import { Mic } from 'lucide-react';
import { afterEach, expect, it, vi } from 'vitest';
import MergedControlButton from './MergedControlButton';
vi.mock('@livekit/components-react', () => ({ useMediaDeviceSelect: () => ({ devices: [] }) }));
afterEach(cleanup);
it('distinguishes device off from enabled and shows local speech only when enabled', () => {
  const { rerender } = render(<MergedControlButton icon={Mic} label="Microphone" menuLabel="Devices" active speaking menu={() => null} />);
  expect(screen.getByLabelText('Microphone').closest('[data-device-state]')?.getAttribute('data-device-state')).toBe('on');
  expect(screen.getByLabelText('You are speaking')).toBeTruthy();
  rerender(<MergedControlButton icon={Mic} label="Microphone" menuLabel="Devices" active={false} danger speaking menu={() => null} />);
  expect(screen.getByLabelText('Microphone').closest('[data-device-state]')?.getAttribute('data-device-state')).toBe('off');
  expect(screen.queryByLabelText('You are speaking')).toBeNull();
});
