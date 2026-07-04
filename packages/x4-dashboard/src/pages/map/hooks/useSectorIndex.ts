import { useMemo } from "react";
import { sectorDisplayName } from "../../../lib/map/names";
import type { ConflictEntry, SectorForceEntry } from "../../../lib/map/overlays/useAnalysisData";
import type { MapData } from "../../../lib/map/useMapData";
import type { MapStation } from "../../../lib/map/types";

type ConnectionEntry = { sectorId: string; name: string; kind: string };

/**
 * Consolidates the per-sector lookup maps the sector detail panel needs — each keyed
 * by lowercased sector_id — into one hook instead of five near-identical useMemo blocks.
 */
export function useSectorIndex(
  data: MapData,
  forcesData: SectorForceEntry[] | undefined,
  conflictsData: ConflictEntry[] | undefined,
) {
  // Zone count per sector.
  const zoneCountBySector = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of data.zones) {
      if (z.sector_id) {
        const k = z.sector_id.toLowerCase();
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [data.zones]);

  // Full station list per sector — the detail panel derives category counts from this
  // and lets you click through to an individual station's detail modal.
  const stationsBySector = useMemo(() => {
    const m = new Map<string, MapStation[]>();
    for (const st of data.stations) {
      if (st.sector_id) {
        const k = st.sector_id.toLowerCase();
        const list = m.get(k) ?? [];
        list.push(st);
        m.set(k, list);
      }
    }
    return m;
  }, [data.stations]);

  // Connected sectors per sector.
  const connectionsBySector = useMemo(() => {
    const m = new Map<string, ConnectionEntry[]>();
    const nameLookup = new Map(data.sectors.map((s) => [s.sector_id.toLowerCase(), sectorDisplayName(s)]));
    for (const conn of data.connections) {
      const a = conn.from_sector_id.toLowerCase();
      const b = conn.to_sector_id.toLowerCase();
      const kind = conn.kind ?? "gate";
      const entryA = { sectorId: conn.to_sector_id, name: nameLookup.get(b) ?? conn.to_sector_id, kind };
      const entryB = { sectorId: conn.from_sector_id, name: nameLookup.get(a) ?? conn.from_sector_id, kind };
      const listA = m.get(a) ?? [];
      listA.push(entryA);
      m.set(a, listA);
      const listB = m.get(b) ?? [];
      listB.push(entryB);
      m.set(b, listB);
    }
    return m;
  }, [data.connections, data.sectors]);

  // Forces per sector.
  const forcesBySector = useMemo(() => {
    const m = new Map<string, SectorForceEntry>();
    if (forcesData) {
      for (const f of forcesData) {
        m.set(f.sector_id.toLowerCase(), f);
      }
    }
    return m;
  }, [forcesData]);

  // Conflicts per sector.
  const conflictsBySector = useMemo(() => {
    const m = new Map<string, ConflictEntry>();
    if (conflictsData) {
      for (const c of conflictsData) {
        m.set(c.sector_id.toLowerCase(), c);
      }
    }
    return m;
  }, [conflictsData]);

  return { zoneCountBySector, stationsBySector, connectionsBySector, forcesBySector, conflictsBySector };
}
