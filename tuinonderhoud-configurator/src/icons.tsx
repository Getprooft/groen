const basis = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export const IconCheck = ({ size = 16, width = 2.5 }: { size?: number; width?: number }) => (
  <svg {...basis} width={size} height={size} strokeWidth={width}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconInfo = ({ size = 18 }: { size?: number }) => (
  <svg {...basis} width={size} height={size} strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export const IconPin = ({ size = 22 }: { size?: number }) => (
  <svg {...basis} width={size} height={size} strokeWidth={2}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const IconTerug = ({ size = 20 }: { size?: number }) => (
  <svg {...basis} width={size} height={size} strokeWidth={2}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
