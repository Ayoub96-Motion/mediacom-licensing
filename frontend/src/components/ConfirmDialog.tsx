interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <h3>{title}</h3>
        <p style={{ fontSize: 13, color: "#4b5563" }}>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
