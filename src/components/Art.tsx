import { ReactNode } from 'react'
import { Cog } from 'lucide-react'

// Illustrated commodity artwork (no external images needed).
const LOGS: [number, number][] = [[17, 76], [45, 76], [73, 76], [31, 52], [59, 52], [87, 52], [45, 28], [73, 28]]

function Log({ x, y, r = 14 }: { x: number; y: number; r?: number }) {
  const k = r / 14
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#6e4220" />
      <circle cx={x} cy={y} r={r * 0.9} fill="url(#gl)" />
      <circle cx={x} cy={y} r={r * 0.6} fill="none" stroke="#9a5f2e" strokeWidth={0.8 * k} />
      <circle cx={x} cy={y} r={r * 0.32} fill="none" stroke="#9a5f2e" strokeWidth={0.8 * k} />
      <circle cx={x} cy={y} r={1.2 * k} fill="#6e4220" />
    </g>
  )
}

const Defs = () => (
  <defs>
    <radialGradient id="gl"><stop offset="0" stopColor="#ecc088" /><stop offset="1" stopColor="#bf7d42" /></radialGradient>
  </defs>
)

const ART: Record<string, () => ReactNode> = {
  timber: () => (
    <>
      <Defs />
      <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efe1c6" /><stop offset="1" stopColor="#b98a52" /></linearGradient>
      <rect width="100" height="100" fill="url(#gt)" />
      {LOGS.map(([x, y], i) => <Log key={i} x={x} y={y} />)}
    </>
  ),
  oil: () => (
    <>
      <linearGradient id="go" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbe6bf" /><stop offset="1" stopColor="#e5a45a" /></linearGradient>
      <linearGradient id="gr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8f1409" /><stop offset=".5" stopColor="#e2431b" /><stop offset="1" stopColor="#8f1409" /></linearGradient>
      <rect width="100" height="100" fill="url(#go)" />
      <rect x="42" y="10" width="16" height="11" rx="2" fill="#2b1d12" />
      <path d="M44 21h12v11c0 4 12 8 12 18v34c0 4-3 6-6 6H38c-3 0-6-2-6-6V50c0-10 12-14 12-18z" fill="url(#gr)" />
      <rect x="38" y="54" width="24" height="22" rx="3" fill="#fff" opacity=".88" />
      <rect x="42" y="60" width="16" height="3" fill="#b3261e" /><rect x="42" y="67" width="11" height="2" fill="#888" />
      <path d="M39 48v34" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  rubber: () => (
    <>
      <linearGradient id="gk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d5dce2" /><stop offset="1" stopColor="#7f8b95" /></linearGradient>
      <rect width="100" height="100" fill="url(#gk)" />
      <path d="M12 74l9-28 42-8 25 22-9 26-52 5z" fill="#121417" />
      <path d="M21 46l42-8 25 22-34 6z" fill="#2f343a" />
      <path d="M28 62l34-5M63 38l-1 20" stroke="#4b525a" strokeWidth="1.6" />
    </>
  ),
  charcoal: () => (
    <>
      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4d50" /><stop offset="1" stopColor="#151617" /></linearGradient>
      <rect width="100" height="100" fill="url(#gc)" />
      {[
        '12,70 28,52 46,62 42,84 18,86', '40,58 58,40 76,52 72,76 48,78', '62,80 74,58 92,66 90,90 68,92', '8,44 22,30 36,38 30,56 12,56', '56,30 70,16 88,24 82,42 62,44',
      ].map((p, i) => <polygon key={i} points={p} fill={i % 2 ? '#1e1f21' : '#2b2d2f'} stroke="#5b5f63" strokeWidth="1" />)}
    </>
  ),
  cocoa: () => (
    <>
      <rect width="100" height="100" fill="#efe0c4" />
      {[[34, 46, -25], [62, 52, 20], [48, 74, 80]].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="22" ry="13" fill={i === 1 ? '#c8861f' : '#8a3b1b'} />
          <path d={`M${x - 20} ${y}h40M${x - 12} ${y - 9}q12 9 24 0M${x - 12} ${y + 9}q12 -9 24 0`} stroke="#fff" strokeOpacity=".3" strokeWidth="1.5" fill="none" />
        </g>
      ))}
    </>
  ),
  coffee: () => (
    <>
      <rect width="100" height="100" fill="#dcc7a8" />
      {[[28, 32], [60, 28], [44, 56], [76, 58], [26, 76], [58, 80]].map(([x, y], i) => (
        <g key={i} transform={`rotate(${i * 37} ${x} ${y})`}><ellipse cx={x} cy={y} rx="13" ry="9" fill="#4a2c17" /><path d={`M${x - 12} ${y}q12 -5 24 0`} stroke="#8a5a36" strokeWidth="1.6" fill="none" /></g>
      ))}
    </>
  ),
  grain: () => (
    <>
      <rect width="100" height="100" fill="#f4e3a3" />
      {Array.from({ length: 28 }).map((_, i) => {
        const x = 12 + (i % 7) * 12 + (Math.floor(i / 7) % 2) * 5
        const y = 14 + Math.floor(i / 7) * 22
        return <ellipse key={i} cx={x} cy={y} rx="4.2" ry="7.5" fill={i % 3 ? '#dba21c' : '#c88a0e'} transform={`rotate(${(i * 23) % 40 - 20} ${x} ${y})`} />
      })}
    </>
  ),
  machinery: () => (
    <>
      <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cfd5db" /><stop offset="1" stopColor="#8a949e" /></linearGradient>
      <rect width="100" height="100" fill="url(#gm)" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="#3f4954" strokeWidth="9" strokeDasharray="9 6.5" />
      <circle cx="50" cy="50" r="21" fill="#4b5560" /><circle cx="50" cy="50" r="8" fill="#cfd5db" />
    </>
  ),
  default: () => (
    <>
      <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e9e52" /><stop offset="1" stopColor="#0a3d24" /></linearGradient>
      <rect width="100" height="100" fill="url(#gd)" />
      <path d="M26 40l24-12 24 12v28L50 80 26 68z" fill="#fff" fillOpacity=".9" /><path d="M26 40l24 12 24-12M50 52v28" stroke="#0a3d24" strokeWidth="2" fill="none" />
    </>
  ),
}

export function kindOf(name = '') {
  const n = name.toLowerCase()
  if (/timber|wood|teak|lumber/.test(n)) return 'timber'
  if (/oil|latex/.test(n)) return 'oil'
  if (/rubber/.test(n)) return 'rubber'
  if (/charcoal|coal/.test(n)) return 'charcoal'
  if (/cocoa/.test(n)) return 'cocoa'
  if (/coffee/.test(n)) return 'coffee'
  if (/rice|maize|garri|cassava|soy|ground|sesame|cashew|kernel|grain/.test(n)) return 'grain'
  if (/machine|equipment|press|mill/.test(n)) return 'machinery'
  return 'default'
}

export function Art({ kind = 'default', className = 'h-16 w-16 rounded-xl' }: { kind?: string; className?: string }) {
  const draw = ART[kind] ?? ART.default
  return (
    <span className={`block shrink-0 overflow-hidden ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={kind}>{draw()}</svg>
    </span>
  )
}

/** Logs pile + rubber + palm fruit, used on the splash screen. */
export function SplashArt({ className = '' }: { className?: string }) {
  const rows: [number, number[]][] = [[165, [30, 64, 98, 132, 166, 200]], [135, [47, 81, 115, 149, 183]], [105, [64, 98, 132, 166]], [75, [81, 115, 149]]]
  return (
    <svg viewBox="0 0 400 190" className={className} aria-hidden="true">
      <Defs />
      <ellipse cx="200" cy="186" rx="190" ry="6" fill="#000" opacity=".25" />
      {rows.map(([y, xs]) => xs.map((x) => <Log key={`${x}-${y}`} x={x} y={y} r={17} />))}
      <path d="M232 176l16-70 56-20 52 34-6 56z" fill="#0e0f11" /><path d="M248 106l56-20 52 34-70 14z" fill="#2d3136" />
      <path d="M262 140l60-12" stroke="#4b525a" strokeWidth="2" />
      {[[222, 176], [238, 182], [254, 178], [230, 164], [246, 168], [268, 184]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={i % 2 ? '#d9480f' : '#c92a2a'} stroke="#7a1a0a" strokeWidth="1" />)}
    </svg>
  )
}

/** Port scene with cargo ship and logs, used on the home hero card. */
export function HeroArt({ className = '' }: { className?: string }) {
  const boxes = ['#d9480f', '#1971c2', '#2f9e44', '#f59f00', '#c92a2a', '#1971c2', '#d9480f']
  return (
    <svg viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <Defs />
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd0e6" /><stop offset="1" stopColor="#e4f2f7" /></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7f9d" /><stop offset="1" stopColor="#164a62" /></linearGradient>
      <rect width="340" height="170" fill="url(#sky)" /><rect y="96" width="340" height="74" fill="url(#sea)" />
      {boxes.map((c, i) => <rect key={i} x={150 + i * 17} y={62} width="16" height="12" fill={c} />)}
      {boxes.slice(0, 5).map((c, i) => <rect key={`b${i}`} x={158 + i * 17} y={50} width="16" height="12" fill={c} opacity=".92" />)}
      <path d="M130 74h210l-14 26H146z" fill="#162a3a" /><path d="M146 100h180l-4 6H150z" fill="#c92a2a" />
      <rect x="262" y="30" width="22" height="20" fill="#f1f3f5" /><rect x="268" y="22" width="10" height="8" fill="#adb5bd" />
      {[[262, 150], [284, 150], [306, 150], [273, 131], [295, 131], [284, 112]].map(([x, y], i) => <Log key={i} x={x} y={y} r={11} />)}
    </svg>
  )
}
