import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ChevronDownIcon, LogOutIcon, LogOutAllIcon } from "./Icons";

// A plan label isn't in the Customer/PortalLicense shapes as its own field —
// it's derived from the first license's planCode, same source the license
// card's own badge already uses.
function planLabel(planCode: string | null | undefined): string {
  return planCode ? `${planCode.toUpperCase()} PLAN` : "NO ACTIVE PLAN";
}

export function ProfileDropdown() {
  const { customer, licenses, logout, logoutAll } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingLogoutAll(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingLogoutAll(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!customer) return null;

  const initial = customer.email.charAt(0).toUpperCase();

  async function handleLogoutAll() {
    if (!confirmingLogoutAll) {
      setConfirmingLogoutAll(true);
      return;
    }
    await logoutAll();
  }

  return (
    <div className="profile-dropdown-root" ref={rootRef}>
      <button
        type="button"
        className="profile-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="profile-avatar">{initial}</span>
        <span className="profile-email">{customer.email}</span>
        <ChevronDownIcon className="profile-chevron" />
      </button>

      {open && (
        <div className="profile-dropdown-menu" role="menu">
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-email">{customer.email}</div>
            <div className="profile-dropdown-plan">{planLabel(licenses[0]?.planCode)}</div>
          </div>
          <div className="profile-dropdown-divider" />
          <button type="button" className="profile-dropdown-row" role="menuitem" onClick={() => logout()}>
            <LogOutIcon />
            <span>Log out</span>
          </button>
          <button
            type="button"
            className="profile-dropdown-row profile-dropdown-row-danger"
            role="menuitem"
            onClick={handleLogoutAll}
            onBlur={() => setConfirmingLogoutAll(false)}
          >
            <LogOutAllIcon />
            <span>{confirmingLogoutAll ? "Click again to confirm" : "Log out all devices"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
