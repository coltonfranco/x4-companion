/** Render 0–5 stars from a 0–15 skill value (3 points per star). */
export function SkillStars({ value }: { value: number | null }) {
  if (value == null) value = 0;
  // Floor to nearest 1/3 star (X4 game standard)
  const stars = Math.floor((value / 3) * 3) / 3;
  const els: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const fill = Math.min(1, Math.max(0, stars - i));

    // Visually map the fill to CSS widths that look correct for the ★ character
    let visualWidth = 0;
    if (fill >= 1) visualWidth = 100;
    else if (fill >= 0.66) visualWidth = 48; // Leaves right half noticeably empty
    else if (fill >= 0.33) visualWidth = 28; // Leaves most of the star empty

    els.push(
      <span key={i} className="relative inline-block w-[11px] text-center text-[11px] leading-none" style={{ color: "rgba(255,255,255,0.12)" }}>
        ★
        {visualWidth > 0 && (
          <span
            className="absolute inset-0 overflow-hidden text-[11px] leading-none"
            style={{ color: "#f59e0b", width: `${visualWidth}%` }}
          >
            ★
          </span>
        )}
      </span>,
    );
  }
  return <span className="inline-flex gap-px" title={`${value.toFixed(1)}/15 — ${(value/3).toFixed(2)} stars`}>{els}</span>;
}
