"use client";
import type { UsageDaily } from "@/lib/api";

/** UsageChart — bog'liqliksiz oddiy SVG ustunli diagramma (kutubxonasiz). */
export function UsageChart({ data }: { data: UsageDaily[] }) {
  const w = 720;
  const h = 220;
  const padL = 40;
  const padB = 24;
  const max = Math.max(1, ...data.map((d) => d.requests));
  const barW = data.length ? (w - padL - 8) / data.length : 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" role="img" aria-label="Kunlik so'rovlar diagrammasi">
      {[0, 0.5, 1].map((f) => {
        const y = h - padB - f * (h - padB - 10);
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={w} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={0} y={y + 4} fontSize={10} fill="currentColor" opacity={0.6}>
              {Math.round(max * f).toLocaleString("uz-UZ")}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.requests / max) * (h - padB - 10);
        const errH = (d.errors / max) * (h - padB - 10);
        const x = padL + i * barW;
        return (
          <g key={d.day}>
            <rect x={x + 1} y={h - padB - barH} width={Math.max(1, barW - 2)} height={barH} fill="var(--brand)" opacity={0.85} rx={1} />
            {d.errors > 0 && (
              <rect x={x + 1} y={h - padB - barH - errH} width={Math.max(1, barW - 2)} height={errH} fill="var(--danger)" rx={1} />
            )}
            {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6 || 1) === 0) && (
              <text x={x + barW / 2} y={h - 6} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
