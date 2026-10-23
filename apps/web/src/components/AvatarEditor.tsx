'use client';

import { useEffect, useRef, useState } from 'react';
import { avatarCrop } from '@/lib/avatar-crop';

const PREVIEW_SIZE = 240;

export default function AvatarEditor({
  file,
  busy,
  onWorkingChange,
  onApply,
  onCancel,
}: {
  file: File;
  busy: boolean;
  onWorkingChange: (working: boolean) => void;
  onApply: (file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [encoding, setEncoding] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const locked = busy || encoding;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const decoded = new Image();
    decoded.onload = () => {
      if (!decoded.naturalWidth || !decoded.naturalHeight || decoded.naturalWidth * decoded.naturalHeight > 20_000_000) {
        setError('Choose an image with no more than 20 million pixels.');
        return;
      }
      setImage(decoded);
      preview.current?.focus();
    };
    decoded.onerror = () => setError('This image could not be opened. Cancel and choose a valid JPEG, PNG, or WebP image.');
    decoded.src = url;
    return () => {
      decoded.onload = null;
      decoded.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const crop = image ? avatarCrop(image.naturalWidth, image.naturalHeight, zoom, position.x, position.y) : null;

  function move(x: number, y: number, nextZoom = zoom) {
    if (!image) return;
    const bounds = avatarCrop(image.naturalWidth, image.naturalHeight, nextZoom, 0, 0);
    const maxX = (image.naturalWidth * bounds.scale - PREVIEW_SIZE) / 2;
    const maxY = (image.naturalHeight * bounds.scale - PREVIEW_SIZE) / 2;
    setPosition({ x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) });
  }

  async function apply() {
    if (!image || !crop || locked) return;
    setEncoding(true);
    onWorkingChange(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image editing is unavailable in this browser. Try another browser.');
      context.drawImage(image, crop.left, crop.top, crop.side, crop.side, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Could not prepare the image. Try again.'))), 'image/png'),
      );
      await onApply(new File([blob], 'avatar.png', { type: 'image/png' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not prepare the image. Try again.');
    } finally {
      setEncoding(false);
      onWorkingChange(false);
    }
  }

  return (
    <div className="account-avatar-editor">
      <div
        ref={preview}
        className="account-avatar-crop"
        role="group"
        aria-label="Profile picture position"
        aria-describedby="avatar-position-help"
        aria-disabled={!image || locked}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!image || locked) return;
          const step = event.shiftKey ? 20 : 5;
          const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const delta = directions[event.key];
          if (delta) {
            event.preventDefault();
            move(position.x + delta[0], position.y + delta[1]);
          }
        }}
        onPointerDown={(event) => {
          if (!image || locked || (event.pointerType === 'mouse' && event.button !== 0)) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const previous = drag.current;
          if (!previous || previous.id !== event.pointerId || locked) return;
          move(position.x + event.clientX - previous.x, position.y + event.clientY - previous.y);
          drag.current = { id: previous.id, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {image && crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- local decoded upload; exact dimensions match the canvas crop.
          <img
            src={image.src}
            alt=""
            draggable={false}
            style={{
              width: image.naturalWidth * crop.scale,
              height: image.naturalHeight * crop.scale,
              left: -crop.left * crop.scale,
              top: -crop.top * crop.scale,
            }}
          />
        ) : (
          <span role="status">{error ? 'Preview unavailable' : 'Loading image…'}</span>
        )}
      </div>
      <p id="avatar-position-help" className="account-muted text-center text-sm">
        Drag to reposition, or use the arrow keys.
      </p>
      <div className="account-avatar-zoom">
        <label htmlFor="avatar-zoom">Zoom</label>
        <output htmlFor="avatar-zoom">{Math.round(zoom * 100)}%</output>
        <input
          id="avatar-zoom"
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          disabled={!image || locked}
          onChange={(event) => {
            const value = Number(event.target.value);
            move(position.x, position.y, value);
            setZoom(value);
          }}
        />
      </div>
      <div className="account-avatar-actions">
        <button
          className="account-button"
          disabled={!image || locked}
          onClick={() => {
            setZoom(1);
            setPosition({ x: 0, y: 0 });
          }}
        >
          Reset
        </button>
        <div className="flex flex-wrap gap-2">
          <button className="account-button" disabled={locked} onClick={onCancel}>
            Cancel
          </button>
          <button className="account-button account-button-primary" disabled={!image || locked} onClick={() => void apply()}>
            {locked ? 'Applying…' : 'Apply image'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="account-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
