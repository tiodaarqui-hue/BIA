"use client";

interface CustomerNameProps {
  name: string;
  noShowCount?: number;
  isMember?: boolean;
  className?: string;
}

const NO_SHOW_THRESHOLD = 3;

export function CustomerName({
  name,
  noShowCount = 0,
  isMember = false,
  className = "",
}: CustomerNameProps) {
  const isHighRisk = noShowCount > NO_SHOW_THRESHOLD;

  // Member styling takes precedence over high-risk styling for the name color
  // but we still show the warning icon if high-risk
  const nameClasses = isMember
    ? "member-shimmer"
    : isHighRisk
      ? "text-red-400"
      : "";

  return (
    <span
      className={`inline-flex items-center gap-1 ${nameClasses} ${className}`}
      title={
        isMember && isHighRisk
          ? `Assinante • ${noShowCount} faltas registradas`
          : isMember
            ? "Assinante"
            : isHighRisk
              ? `${noShowCount} faltas registradas`
              : undefined
      }
    >
      {isMember && (
        <svg
          className="w-3.5 h-3.5 text-amber-400 shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      )}
      <span>{name}</span>
      {isHighRisk && (
        <svg
          className="w-3 h-3 text-red-400 shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      )}
    </span>
  );
}
