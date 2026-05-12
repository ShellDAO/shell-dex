'use client';

import type { Token } from '@/config/tokens';

interface TokenIconProps {
  token: Token;
  size?: number;
  className?: string;
}

export function TokenIcon({ token, size = 20, className = '' }: TokenIconProps) {
  if (token.logoUrl) {
    return (
      <img
        src={token.logoUrl}
        alt={`${token.symbol} icon`}
        width={size}
        height={size}
        className={`rounded-full bg-white object-cover ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {token.symbol.slice(0, 1)}
    </div>
  );
}
