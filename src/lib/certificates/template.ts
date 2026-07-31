export interface CertificateData {
  winnerName: string;
  categoryName: string;
  eventName: string;
  rankText: string;
  issueDate: string;
  certificateId: string;
  organizationName?: string;
  presenterTitle?: string;
}

export function generateCertificateSVG(data: CertificateData): string {
  const { winnerName, categoryName, eventName, rankText, issueDate, certificateId, organizationName = "AwardOS Honors Committee" } = data;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="100%" height="100%">
  <defs>
    <!-- Dark Gold Luxury Gradients -->
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="25%" stop-color="#d97706" />
      <stop offset="50%" stop-color="#fbbf24" />
      <stop offset="75%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="850" fill="url(#bgGradient)" />

  <!-- Outer Double Gold Border -->
  <rect x="30" y="30" width="1140" height="790" fill="none" stroke="url(#goldBorder)" stroke-width="4" rx="16" />
  <rect x="44" y="44" width="1112" height="762" fill="none" stroke="url(#goldBorder)" stroke-width="1.5" opacity="0.6" rx="12" />

  <!-- Decorative Corner Accents -->
  <path d="M 50 100 L 100 50 L 160 50" fill="none" stroke="url(#goldBorder)" stroke-width="3" />
  <path d="M 1150 100 L 1100 50 L 1040 50" fill="none" stroke="url(#goldBorder)" stroke-width="3" />
  <path d="M 50 750 L 100 800 L 160 800" fill="none" stroke="url(#goldBorder)" stroke-width="3" />
  <path d="M 1150 750 L 1100 800 L 1040 800" fill="none" stroke="url(#goldBorder)" stroke-width="3" />

  <!-- Trophy Icon Crest -->
  <g transform="translate(560, 95)" fill="url(#goldBorder)" filter="url(#glow)">
    <path d="M40 0 C18 0 0 18 0 40 C0 55 8 68 20 74 L20 90 L60 90 L60 74 C72 68 80 55 80 40 C80 18 62 0 40 0 Z M40 100 L20 120 L60 120 Z" opacity="0.9" />
  </g>

  <!-- Header Title -->
  <text x="600" y="240" font-family="'Inter', sans-serif" font-size="22" font-weight="700" fill="#fbbf24" letter-spacing="6" text-anchor="middle">
    CERTIFICATE OF EXCELLENCE
  </text>
  <text x="600" y="275" font-family="'Inter', sans-serif" font-size="15" fill="#9ca3af" letter-spacing="3" text-anchor="middle">
    PROUDLY PRESENTED TO
  </text>

  <!-- Winner Name (Hero Text) -->
  <text x="600" y="365" font-family="'Inter', sans-serif" font-size="46" font-weight="800" fill="#ffffff" letter-spacing="1" text-anchor="middle" filter="url(#glow)">
    ${winnerName}
  </text>

  <!-- Divider Line -->
  <line x1="350" y1="395" x2="850" y2="395" stroke="url(#goldBorder)" stroke-width="2" opacity="0.8" />

  <!-- Description Body -->
  <text x="600" y="445" font-family="'Inter', sans-serif" font-size="18" fill="#d1d5db" text-anchor="middle">
    In recognition of outstanding achievement as <tspan font-weight="700" fill="#fbbf24">${rankText}</tspan> in
  </text>
  
  <!-- Category Title -->
  <text x="600" y="495" font-family="'Inter', sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">
    "${categoryName}"
  </text>

  <!-- Event Title -->
  <text x="600" y="540" font-family="'Inter', sans-serif" font-size="18" font-style="italic" fill="#a7f3d0" text-anchor="middle">
    at the ${eventName}
  </text>

  <!-- Official Gold Seal Emblem -->
  <g transform="translate(940, 620)">
    <circle cx="50" cy="50" r="48" fill="url(#goldBorder)" opacity="0.2" />
    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#goldBorder)" stroke-width="2" />
    <circle cx="50" cy="50" r="36" fill="none" stroke="url(#goldBorder)" stroke-width="1" stroke-dasharray="4 2" />
    <text x="50" y="46" font-family="'Inter', sans-serif" font-size="10" font-weight="800" fill="#fbbf24" text-anchor="middle">OFFICIAL</text>
    <text x="50" y="62" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle">VERIFIED</text>
  </g>

  <!-- Signatures & Verification Footer -->
  <g transform="translate(180, 680)">
    <line x1="0" y1="0" x2="220" y2="0" stroke="#4b5563" stroke-width="1.5" />
    <text x="110" y="22" font-family="'Inter', sans-serif" font-size="13" font-weight="600" fill="#e5e7eb" text-anchor="middle">${organizationName}</text>
    <text x="110" y="40" font-family="'Inter', sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Awarding Body Committee</text>
  </g>

  <g transform="translate(500, 680)">
    <line x1="0" y1="0" x2="200" y2="0" stroke="#4b5563" stroke-width="1.5" />
    <text x="100" y="22" font-family="'Inter', sans-serif" font-size="13" font-weight="600" fill="#e5e7eb" text-anchor="middle">${issueDate}</text>
    <text x="100" y="40" font-family="'Inter', sans-serif" font-size="11" fill="#9ca3af" text-anchor="middle">Date of Issuance</text>
  </g>

  <!-- Verification ID Barcode Placeholder -->
  <text x="600" y="790" font-family="'Courier New', monospace" font-size="11" fill="#6b7280" text-anchor="middle">
    VERIFICATION ID: ${certificateId} • AWARDOS COMPLIANCE AUTHENTICATED
  </text>
</svg>`;
}
