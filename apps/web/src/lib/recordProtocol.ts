import type { LocalParticipant } from 'livekit-client';

// Request to Record signaling (docs/adr/0011). Mirrors the present:* protocol:
// reliable LiveKit data messages carry the request/approve/deny UX, while the
// actual authority (the grant) is written server-side on approval.
//
// The request is *broadcast* (no destination) rather than targeted at the host:
// a requester doesn't track the host's identity, and only the host's UI acts on
// it. Approve/deny are targeted back at the requester.

export const RECORD_TOPIC = 'huddle:record';

export type RecordMessage = { type: 'record:request'; requesterId: string; requesterName: string } | { type: 'record:approve' } | { type: 'record:deny' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encode(msg: RecordMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

export function decode(data: Uint8Array): RecordMessage | null {
  try {
    return JSON.parse(decoder.decode(data)) as RecordMessage;
  } catch {
    return null;
  }
}

// Broadcast to the whole room (the host filters for it).
export function broadcastRecordMessage(localParticipant: LocalParticipant, msg: RecordMessage): Promise<void> {
  return localParticipant.publishData(encode(msg), { reliable: true, topic: RECORD_TOPIC });
}

// Send to a specific participant (used for approve/deny back to the requester).
export function sendRecordMessage(localParticipant: LocalParticipant, target: string, msg: RecordMessage): Promise<void> {
  return localParticipant.publishData(encode(msg), {
    reliable: true,
    topic: RECORD_TOPIC,
    destinationIdentities: [target],
  });
}
