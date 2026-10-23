import { cleanup, render, screen } from '@testing-library/react';
import { Mic } from 'lucide-react';
import { afterEach, expect, it, vi } from 'vitest';
import MergedControlButton from './MergedControlButton';
vi.mock('@livekit/components-react', () => ({ useMediaDeviceSelect: () => ({ devices: [] }), useLocalParticipant: () => ({}), useTrackVolume: () => 0.2 }));
afterEach(cleanup);
it('distinguishes device off from enabled and shows local speech only when enabled', () => {
  const { rerender } = render(<MergedControlButton icon={Mic} label="Microphone" menuLabel="Devices" active microphone speaking menu={() => null} />);
  expect(screen.getByLabelText('Microphone').closest('[data-device-state]')?.getAttribute('data-device-state')).toBe('on');
  expect(screen.getByLabelText('You are speaking')).toBeTruthy();
  expect(screen.getByLabelText('Microphone').querySelector('svg')).toBeNull();
  rerender(<MergedControlButton icon={Mic} label="Microphone" menuLabel="Devices" active microphone menu={() => null} />);
  expect(screen.getByLabelText('Microphone on')).toBeTruthy();
  expect(screen.getByLabelText('Microphone').querySelector('svg')).toBeNull();
  rerender(<MergedControlButton icon={Mic} label="Microphone" menuLabel="Devices" active={false} danger microphone speaking menu={() => null} />);
  expect(screen.getByLabelText('Microphone').closest('[data-device-state]')?.getAttribute('data-device-state')).toBe('off');
  expect(screen.queryByLabelText('You are speaking')).toBeNull();
  expect(screen.getByLabelText('Microphone').querySelector('svg')).toBeTruthy();
});
