import { RecordingsLoadingState, RecordingsPageShell } from './RecordingsPageShell';

export default function Loading() {
  return (
    <RecordingsPageShell>
      <RecordingsLoadingState />
    </RecordingsPageShell>
  );
}
