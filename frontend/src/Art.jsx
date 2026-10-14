export function DeathStar({ charged }) {
  return (
    <svg viewBox="0 0 200 200" className={`deathstar ${charged ? "charged" : ""}`}>
      <defs>
        <radialGradient id="dsg" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#c3cad3" />
          <stop offset="0.6" stopColor="#6b7480" />
          <stop offset="1" stopColor="#14171c" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#dsg)" />
      <path d="M6 104 Q100 122 194 104" fill="none" stroke="#1b1f25" strokeWidth="3" />
      <path d="M6 111 Q100 129 194 111" fill="none" stroke="#2b313a" strokeWidth="1" />
      <circle cx="135" cy="64" r="24" fill="#2a3038" stroke="#12151a" strokeWidth="3" />
      <circle cx="135" cy="64" r="14" fill="#1a1e24" />
      <circle className="dish-core" cx="135" cy="64" r="6" />
    </svg>
  );
}

export function ATAT({ className = "" }) {
  return (
    <svg viewBox="0 0 220 150" className={`atat ${className}`}>
      <g fill="currentColor">
        <rect className="leg a dark" x="62" y="78" width="11" height="60" rx="3" />
        <rect className="leg b dark" x="140" y="78" width="11" height="60" rx="3" />
        <rect x="40" y="48" width="112" height="34" rx="8" />
        <rect x="48" y="40" width="96" height="10" rx="4" />
        <path d="M142 56 L168 44 L176 56 L150 76 Z" />
        <rect x="164" y="26" width="42" height="24" rx="5" />
        <rect x="204" y="34" width="12" height="5" />
        <rect x="172" y="50" width="28" height="7" rx="2" />
        <rect className="leg b" x="50" y="78" width="11" height="60" rx="3" />
        <rect className="leg a" x="128" y="78" width="11" height="60" rx="3" />
      </g>
      <rect className="atat-eye" x="192" y="32" width="10" height="4" fill="#ff3b3b" />
    </svg>
  );
}

export function XWing({ className = "" }) {
  return (
    <svg viewBox="0 0 120 60" className={`ship ${className}`}>
      <g fill="currentColor">
        <path d="M4 30 L40 26 L112 29 L119 30 L112 31 L40 34 Z" />
        <path d="M44 27 L62 4 L92 3 L78 27 Z" />
        <path d="M44 33 L62 56 L92 57 L78 33 Z" />
        <rect x="48" y="9" width="32" height="5" rx="2" />
        <rect x="48" y="46" width="32" height="5" rx="2" />
      </g>
      <circle cx="5" cy="30" r="3" fill="#ff9e1f" />
    </svg>
  );
}

export function TIE({ className = "" }) {
  return (
    <svg viewBox="0 0 80 80" className={`ship ${className}`}>
      <g fill="currentColor">
        <polygon points="14,4 22,12 22,68 14,76 6,68 6,12" />
        <polygon points="66,4 74,12 74,68 66,76 58,68 58,12" />
        <rect x="22" y="38" width="36" height="4" />
        <circle cx="40" cy="40" r="13" />
      </g>
      <circle cx="40" cy="40" r="6" fill="#0a0d12" stroke="#666" />
    </svg>
  );
}

export function StarDestroyer({ className = "" }) {
  return (
    <svg viewBox="0 0 260 60" className={`destroyer ${className}`}>
      <g fill="currentColor">
        <polygon points="2,8 2,52 258,30" />
        <rect x="14" y="22" width="44" height="8" />
        <rect x="26" y="15" width="16" height="7" />
      </g>
      <circle cx="3" cy="20" r="2.5" fill="#7fd6ff" />
      <circle cx="3" cy="30" r="2.5" fill="#7fd6ff" />
      <circle cx="3" cy="40" r="2.5" fill="#7fd6ff" />
    </svg>
  );
}
