import { createFileRoute } from "@tanstack/react-router";
import { SandboxGate } from "@/components/sandbox/sandbox-gate";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SandboxGate />;
}
