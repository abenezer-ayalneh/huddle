import type { ReactNode } from "react";

// Full-bleed centered message used by the connecting / waiting / error screens.
export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </main>
  );
}
