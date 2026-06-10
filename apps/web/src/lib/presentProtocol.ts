import type { LocalParticipant } from "livekit-client";

export const PRESENT_TOPIC = "huddle:present";

export type PresentMessage =
  | { type: "present:request"; requesterId: string; requesterName: string }
  | { type: "present:yield" }
  | { type: "present:decline" }
  | { type: "present:force-take" };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encode(msg: PresentMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

export function decode(data: Uint8Array): PresentMessage | null {
  try {
    return JSON.parse(decoder.decode(data)) as PresentMessage;
  } catch {
    return null;
  }
}

export function sendPresentMessage(localParticipant: LocalParticipant, target: string, msg: PresentMessage): Promise<void> {
  return localParticipant.publishData(encode(msg), {
    reliable: true,
    topic: PRESENT_TOPIC,
    destinationIdentities: [target],
  });
}
