import type { ReactNode } from "react";

type TextBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "details"; rows: DetailRow[] }
  | { kind: "list"; items: string[] }
  | { kind: "section"; title: string; items: string[] };

type DetailRow = {
  label: string;
  value: string;
  items?: string[];
};

const SECTION_TITLES = new Set([
  "Equipment",
  "Ammunition",
  "Wares",
  "Objectives",
  "Production",
  "Productions",
  "Required Constructs",
  "Required Skills",
]);

const DETAIL_LABELS = new Set([
  "Delivery Location",
  "Destination",
  "Management",
  "Minimum Plot Size",
  "Morale",
  "Required Constructs",
  "Required Skills",
  "Sector",
  "Seeking",
  "Station",
]);

export function decodeMissionText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/\[\\0?12\]/g, "\n")
    .replace(/\\0?12/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\[\\033\]/g, "")
    .replace(/\[menu_star_04\]/g, "★")
    .replace(/\[menu_star_01\]/g, "☆")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function missionTextPlain(value: string | null | undefined): string {
  return decodeMissionText(value).replace(/\s*\n+\s*/g, " ").trim();
}

export function parseMissionText(value: string | null | undefined): TextBlock[] {
  const text = decodeMissionText(value)
    .replace(/\b(Required constructs|Productions):\s*/gi, "\n$1\n")
    .replace(/\b(Minimum plot size):\s*/gi, "\n$1: ");

  if (!text) return [];

  const blocks: TextBlock[] = [];
  const groups = text.split(/\n\s*\n/).map((g) => g.trim()).filter(Boolean);

  for (const group of groups) {
    const lines = group.split("\n").filter((line) => line.trim());
    if (isStandaloneList(lines)) {
      blocks.push({ kind: "list", items: lines.map((line) => line.trim()) });
      continue;
    }

    let paragraph: string[] = [];
    let details: DetailRow[] = [];
    let section: { title: string; items: string[] } | null = null;

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        blocks.push({ kind: "paragraph", text: paragraph.map((line) => line.trim()).join(" ") });
        paragraph = [];
      }
    };
    const flushDetails = () => {
      if (details.length > 0) {
        blocks.push({ kind: "details", rows: details });
        details = [];
      }
    };
    const flushSection = () => {
      if (section) {
        blocks.push({
          kind: "section",
          title: section.title,
          items: normalizeSectionItems(section.title, section.items),
        });
        section = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      const detail = detailRow(trimmed);
      if (detail) {
        flushParagraph();
        flushSection();
        details.push(detail);
        continue;
      }

      const heading = sectionTitle(trimmed);
      if (heading) {
        flushParagraph();
        flushDetails();
        flushSection();
        section = { title: heading.title, items: heading.rest ? [heading.rest] : [] };
        continue;
      }

      if (section) {
        section.items.push(trimmed);
      } else {
        paragraph.push(line);
      }
    }

    flushParagraph();
    flushDetails();
    flushSection();
  }

  return blocks;
}

function isStandaloneList(lines: string[]): boolean {
  return (
    lines.length > 1 &&
    lines.every((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        trimmed.length <= 80 &&
        !trimmed.includes(":") &&
        !/[.!?]$/.test(trimmed) &&
        !sectionTitle(trimmed)
      );
    })
  );
}

function normalizeSectionItems(title: string, items: string[]): string[] {
  if (title === "Required Constructs" || title === "Productions") {
    return items.flatMap((item) => splitInlineItems(item) ?? [item]);
  }
  return items;
}

function detailRow(line: string): DetailRow | null {
  const match = line.match(/^([^:]{2,40}):\s*(.*)$/);
  if (!match) return null;

  const label = normalizeTitle(match[1]);
  if (!DETAIL_LABELS.has(label)) return null;

  const value = match[2].trim();
  if (!value && SECTION_TITLES.has(label)) return null;
  const items =
    label === "Required Constructs" || label === "Productions"
      ? splitInlineItems(value)
      : undefined;
  return { label, value, items };
}

function splitInlineItems(value: string): string[] | undefined {
  const items = value
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 1 ? items : undefined;
}

function sectionTitle(line: string): { title: string; rest: string | null } | null {
  const withColon = line.match(/^([A-Za-z ]+):\s*(.*)$/);
  const title = normalizeTitle(withColon ? withColon[1] : line);
  if (!SECTION_TITLES.has(title)) return null;
  return { title, rest: withColon?.[2]?.trim() || null };
}

function normalizeTitle(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MissionBriefingText({
  text,
  empty = "No briefing available.",
}: {
  text: string | null | undefined;
  empty?: ReactNode;
}) {
  const blocks = parseMissionText(text);
  if (blocks.length === 0) return <>{empty}</>;

  return (
    <div className="space-y-3">
      {blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index} className="leading-relaxed">
            {block.text}
          </p>
        ) : block.kind === "details" ? (
          <dl key={index} className="grid gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            {block.rows.map((row) => (
              <div key={row.label} className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[1.3px] text-[#7fb9d6]">
                  {row.label}
                </dt>
                <dd className="min-w-0">
                  {row.items ? (
                    <ul className="space-y-1">
                      {row.items.map((item) => (
                        <li key={item} className="flex gap-2 leading-snug">
                          <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5cc8ec]/70" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>{row.value || "—"}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : block.kind === "list" ? (
          <ul key={index} className="space-y-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2 leading-snug">
                <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5cc8ec]/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div key={index} className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-[#7fb9d6]">
              {block.title}
            </div>
            <ul className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2 leading-snug">
                  <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5cc8ec]/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
