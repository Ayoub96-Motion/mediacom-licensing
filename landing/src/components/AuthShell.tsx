import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Dark page + single glow blob + white card — shared by /signup and /login. */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="blob blob-auth" aria-hidden="true" />
      <div className="auth-top">
        <Logo />
      </div>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
        {footer && <div className="auth-footer">{footer}</div>}
      </main>
    </div>
  );
}
