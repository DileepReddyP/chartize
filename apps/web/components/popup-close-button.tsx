"use client";

export function PopupCloseButton({
  onClick,
  label,
  size = "default",
}: {
  onClick: () => void;
  label: string;
  size?: "default" | "compact";
}) {
  return (
    <button type="button" className={`popup-close-button ${size}`} title="Close" aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}
