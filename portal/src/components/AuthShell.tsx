import type { FormEvent, ReactNode } from "react";

const YEAR = new Date().getFullYear();

/**
 * Dark auth layout shared by /login and /login/verify — #14171F page with two
 * lime glow blobs, the MediaCom lockup above a white card, and a footer line.
 * Same treatment as the admin login and the landing page's auth screens.
 */
export function AuthShell({ children, as = "div", onSubmit }: {
  children: ReactNode;
  as?: "div" | "form";
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const card = as === "form"
    ? <form className="auth-dark-card" onSubmit={onSubmit}>{children}</form>
    : <div className="auth-dark-card">{children}</div>;
  return (
    <div className="auth-dark-shell">
      <div className="auth-dark-lockup">
        <span className="auth-dark-badge" aria-hidden="true">M</span>
        <span className="auth-dark-word">MediaCom</span>
      </div>
      {card}
      <div className="auth-dark-footer">© {YEAR} MediaCom · Customer Portal</div>
    </div>
  );
}
