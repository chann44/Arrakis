interface StarMotifProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function StarMotif({ className = "", style }: StarMotifProps) {
  return (
    <svg
      className={`star-motif ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
