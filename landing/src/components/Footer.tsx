import { ADMIN_URL, CONTACT_EMAIL, PORTAL_URL } from "../config";
import { Logo } from "./Logo";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>Push-to-talk intercom for broadcast teams.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          {/* Installers are license-gated — they live in the customer portal's Downloads section. */}
          <a href={PORTAL_URL}>Download Desktop</a>
          <a href={PORTAL_URL}>Download Mobile</a>
          <a href="#how-it-works">Docs</a>
          <a href={CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : "/signup"}>Contact</a>
          <a href={`${ADMIN_URL}/login`} className="footer-admin">Admin login</a>
        </nav>
      </div>
      <div className="container footer-legal">© {YEAR} MediaCom</div>
    </footer>
  );
}
