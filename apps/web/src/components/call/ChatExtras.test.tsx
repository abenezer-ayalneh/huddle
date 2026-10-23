import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatExtras from './ChatExtras';
import { uploadChatFile } from './chatFiles';
vi.mock('./chatFiles', () => ({ uploadChatFile: vi.fn(), fileMessage: (id: string) => `huddle-file:${id}` }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('ChatExtras', () => {
  it('inserts emoji into the draft instead of sending it immediately', () => {
    const onEmoji = vi.fn();
    const onSend = vi.fn();
    render(<ChatExtras onEmoji={onEmoji} onSend={onSend} />);
    fireEvent.click(screen.getByLabelText('Insert 👍'));
    expect(onEmoji).toHaveBeenCalledWith('👍');
    expect(onSend).not.toHaveBeenCalled();
  });
  it('retries the message without re-uploading a successfully stored file', async () => {
    vi.mocked(uploadChatFile).mockResolvedValue('file-id');
    const onSend = vi.fn().mockRejectedValueOnce(new Error('Data channel down')).mockResolvedValueOnce(undefined);
    render(<ChatExtras room="room" token="token" onEmoji={() => {}} onSend={onSend} />);
    fireEvent.change(screen.getByLabelText('Choose chat attachment'), { target: { files: [new File(['abc'], 'notes.txt')] } });
    await waitFor(() => expect(screen.getByText('Retry sharing file')).toBeTruthy());
    fireEvent.click(screen.getByText('Retry sharing file'));
    await waitFor(() => expect(screen.queryByText('Retry sharing file')).toBeNull());
    expect(uploadChatFile).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenLastCalledWith('huddle-file:file-id');
  });
});
