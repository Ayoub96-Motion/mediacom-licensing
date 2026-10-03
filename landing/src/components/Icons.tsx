import type { ReactNode, SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}
    >
      {children}
    </svg>
  );
}

export const LayersIcon = () => (
  <Icon><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></Icon>
);
export const MicIcon = () => (
  <Icon><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /></Icon>
);
export const ServerIcon = () => (
  <Icon><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01" /></Icon>
);
export const ShieldIcon = () => (
  <Icon><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><path d="m9 12 2 2 4-4" /></Icon>
);
export const DevicesIcon = () => (
  <Icon><rect x="2" y="4" width="14" height="10" rx="2" /><path d="M6 18h6" /><rect x="17" y="8" width="5" height="12" rx="1.5" /></Icon>
);
export const GlobeIcon = () => (
  <Icon><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></Icon>
);
export const CheckIcon = () => (
  <Icon width={16} height={16}><path d="m5 12 5 5 9-10" /></Icon>
);
