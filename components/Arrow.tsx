type ArrowProps = {
  direction?: "right" | "down" | "up-right";
  className?: string;
};

export function Arrow({ direction = "right", className = "" }: ArrowProps) {
  const rotations = { right: "", down: "rotate-90", "up-right": "-rotate-45" };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 ${rotations[direction]} ${className}`}
    >
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
