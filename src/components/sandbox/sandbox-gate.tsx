import { lazy, Suspense, useEffect, useState } from "react";
import { HUD, StartOverlay } from "./overlay";

const SandboxApp = lazy(() => import("./sandbox-app"));

export function SandboxGate() {
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {client ? (
        <Suspense fallback={null}>
          <SandboxApp />
        </Suspense>
      ) : null}
      <StartOverlay />
      <HUD />
    </main>
  );
}
