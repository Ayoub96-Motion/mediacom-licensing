import { Link } from "react-router-dom";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A3E635" />
          <stop offset="1" stopColor="#65A30D" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <g fill="#14171F">
        <rect x="8" y="12" width="3" height="8" rx="1.5" />
        <rect x="14.5" y="8" width="3" height="16" rx="1.5" />
        <rect x="21" y="11" width="3" height="10" rx="1.5" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="MediaCom home">
      <LogoMark />
      <span className="logo-wordmark">MediaCom</span>
    </Link>
  );
}
