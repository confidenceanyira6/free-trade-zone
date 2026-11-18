export function Logo({ size = 36, dark = false, stacked = false }: { size?: number; dark?: boolean; stacked?: boolean }) {
  const text = dark ? 'text-white' : 'text-forest'
  return (
    <span className={`inline-flex items-center gap-2 ${stacked ? 'flex-col text-center' : ''}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1E9E52" /><stop offset="1" stopColor="#0A3D24" /></linearGradient>
        </defs>
        <circle cx="24" cy="24" r="19" fill="url(#lg)" />
        <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.3">
          <ellipse cx="24" cy="24" rx="8" ry="19" /><path d="M5 24h38M8 14h32M8 34h32" />
        </g>
        <path d="M4 30C8 12 30 2 44 14" fill="none" stroke="#F28A12" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <span className={`leading-tight ${text}`}>
        <span className={`block font-extrabold ${stacked ? 'text-3xl' : 'text-base'}`}>Saage</span>
        <span className={`block font-semibold ${stacked ? 'text-xl' : 'text-[11px] opacity-90'}`}>Free Trade Zone</span>
      </span>
    </span>
  )
}
