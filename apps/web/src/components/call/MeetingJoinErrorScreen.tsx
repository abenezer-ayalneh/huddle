'use client';

import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react';
import MeetingEntryShell from './MeetingEntryShell';

export default function MeetingJoinErrorScreen({ room, message, onRetry, onBack }: { room: string; message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <MeetingEntryShell
      room={room}
      kicker="Call entry"
      title="We couldn’t join."
      lede="The room did not finish connecting. Try the join again, or return to the lobby and check the meeting link."
      panelLabel="Connection failed"
      tone="denied"
      headingId="meeting-error-title"
      panelLabelId="meeting-error-panel-label"
      panelRole="alert"
      panelClassName="meeting-error-panel"
    >
      <div className="meeting-error-mark" aria-hidden="true">
        <AlertTriangle strokeWidth={1.7} />
      </div>

      <p className="meeting-loading-status">Couldn’t connect to the call</p>
      <p className="meeting-error-message">{message}</p>

      <div className="meeting-error-actions">
        <button type="button" className="meeting-error-primary" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </button>
        <button type="button" className="meeting-error-secondary" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Back to lobby
        </button>
      </div>
    </MeetingEntryShell>
  );
}
