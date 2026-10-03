import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ChevronUpIcon, LogOutIcon } from "./Icons";

/**
 * Pill button pinned to the sidebar bottom; opens a dropdown upward. Click
 * toggles it; an outside click or Escape closes it.
 */
export function ProfileMenu() {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const email = admin?.email ?? "admin";
  const initial = (admin?.name || email).charAt(0).toUpperCase();

  return (
    <div className="profile-menu" ref={rootRef}>
      {open && (
        <div className="profile-dropdown" role="menu">
          <div className="profile-dropdown-header">
            <div className="email">{email}</div>
            <div className="role">Administrator</div>
          </div>
          <button type="button" role="menuitem" className="profile-dropdown-row destructive" onClick={logout}>
            <LogOutIcon size={16} /> Log out
          </button>
        </div>
      )}
      <button
        type="button"
        className="profile-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar">{initial}</span>
        <span className="profile-email">{email}</span>
        <ChevronUpIcon size={16} className="chevron" />
      </button>
    </div>
  );
}
