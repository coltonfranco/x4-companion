import type { DropEntry } from "../../components/data-display/DropListContent";

export type DropList = { list_id: string; category: string | null };

export type DropListDetail = DropList & { wares: DropEntry[] };
