import type { ComponentPropsWithRef, ReactNode } from "react";

interface HeaderContentProps { icon: ReactNode; label: string; iconOnly?: boolean }

/** Shared icon and label layout for header buttons and disclosure controls. */
function HeaderContent({ icon, label, iconOnly }: HeaderContentProps) {
  return <>{icon}{!iconOnly && <span className="topbar-button-label">{label}</span>}</>;
}

/** A toolbar button with a shared hit area and icon scale. */
export function HeaderButton({ icon, label, iconOnly = false, className = "", ...props }: HeaderContentProps & Omit<ComponentPropsWithRef<"button">, "children">) {
  return <button type="button" aria-label={label} title={label} className={`header-control ${iconOnly ? "icon-only" : "responsive-label"} ${className}`} {...props}><HeaderContent icon={icon} label={label} iconOnly={iconOnly} /></button>;
}

/** A native disclosure trigger using the header button's layout. */
export function HeaderSummary({ icon, label, className = "", ...props }: Omit<HeaderContentProps, "iconOnly"> & Omit<ComponentPropsWithRef<"summary">, "children">) {
  return <summary aria-label={label} title={label} className={`header-control responsive-label ${className}`} {...props}><HeaderContent icon={icon} label={label} /></summary>;
}
