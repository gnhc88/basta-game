export default function LetterDice({ size = 24, className = '' }) {
  // Pentagon divided into 5 triangular faces — each face has a letter (B·A·S·T·A)
  // Mimics the real Basta letter die (icosahedron)
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Pentagon outline */}
      <polygon
        points="50,4 94,36 77,87 23,87 6,36"
        fill="white"
        stroke="#222"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Lines from center (50,50) to each vertex — creating 5 triangular faces */}
      <line x1="50" y1="50" x2="50" y2="4"  stroke="#222" strokeWidth="1.8"/>
      <line x1="50" y1="50" x2="94" y2="36" stroke="#222" strokeWidth="1.8"/>
      <line x1="50" y1="50" x2="77" y2="87" stroke="#222" strokeWidth="1.8"/>
      <line x1="50" y1="50" x2="23" y2="87" stroke="#222" strokeWidth="1.8"/>
      <line x1="50" y1="50" x2="6"  y2="36" stroke="#222" strokeWidth="1.8"/>
      {/* Letters on each triangular face — B·A·S·T·A */}
      <text x="65" y="33" textAnchor="middle" fontSize="17" fontWeight="bold" fontFamily="Arial,sans-serif" fill="#111">B</text>
      <text x="75" y="63" textAnchor="middle" fontSize="15" fontWeight="bold" fontFamily="Arial,sans-serif" fill="#111">A</text>
      <text x="50" y="79" textAnchor="middle" fontSize="15" fontWeight="bold" fontFamily="Arial,sans-serif" fill="#111">S</text>
      <text x="25" y="63" textAnchor="middle" fontSize="15" fontWeight="bold" fontFamily="Arial,sans-serif" fill="#111">T</text>
      <text x="35" y="33" textAnchor="middle" fontSize="15" fontWeight="bold" fontFamily="Arial,sans-serif" fill="#111">A</text>
    </svg>
  );
}
