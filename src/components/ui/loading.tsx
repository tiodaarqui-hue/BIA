"use client";

export function Loading() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative flex items-center justify-center">
        {/* Spinning ring */}
        <div
          className="absolute rounded-full border-2 border-transparent border-t-white/80 border-r-white/40 animate-spin-fast"
          style={{ width: '32px', height: '32px' }}
        />
        {/* Logo */}
        <div
          className="rounded-full bg-gray-600 flex items-center justify-center"
          style={{ width: '24px', height: '24px' }}
        >
          <svg width="14" height="14" viewBox="0 0 100 100">
            <polygon
              points="50,10 88,80 12,80"
              fill="#0a0a0a"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
