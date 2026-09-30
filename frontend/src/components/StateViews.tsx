export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="state-box">{label}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>;
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-box">{label}</div>;
}
