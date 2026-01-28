"use client";

interface CustomerNameProps {
  name: string;
  noShowCount?: number;
  className?: string;
}

const NO_SHOW_THRESHOLD = 3;

export function CustomerName({ name, noShowCount = 0, className = "" }: CustomerNameProps) {
  const isHighRisk = noShowCount > NO_SHOW_THRESHOLD;

  return (
    <span
      className={`${isHighRisk ? "text-red-400" : ""} ${className}`}
      title={isHighRisk ? `${noShowCount} faltas registradas` : undefined}
    >
      {name}
      {isHighRisk && (
        <svg
          className="inline-block w-3 h-3 ml-1 text-red-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      )}
    </span>
  );
}
