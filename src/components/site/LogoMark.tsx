/** Product mark: three states joined by transitions. Decorative; the name next to it is the label. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6.5 7.5 L17 6 M6.5 7.5 L11 17.5 M17 6 L11 17.5" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="6" cy="7.5" r="3" fill="currentColor" />
      <circle cx="17.5" cy="6" r="2.5" fill="var(--glow-cyan)" />
      <circle cx="11" cy="18" r="3.5" fill="var(--glow-blue)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
