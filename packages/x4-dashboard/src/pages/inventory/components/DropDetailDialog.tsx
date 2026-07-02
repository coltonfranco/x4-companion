import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { DropListContent, buildDropGroups } from "../../../components/data-display/DropListContent";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { apiGet } from "../../../lib/api";
import { prettyId } from "../../../lib/wareFormat";
import type { DropListDetail } from "../types";
import { CATEGORY_META } from "../lib/dropCategories";

export function DropDetailDialog({ listId, onClose }: { listId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<DropListDetail>({
    queryKey: ["drops", "list", listId],
    queryFn: () => apiGet<DropListDetail>(`/api/v1/drops/lists/${listId}`),
  });

  // Group entries by (spawn_chance, source_basket) — each group is one independent drop event
  const groups = data ? buildDropGroups(data.wares) : [];

  const totalWares = data?.wares.length ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4 border-b border-border/40">
          <div className="flex flex-col gap-3">
            <DialogTitle className="flex items-center gap-2.5 text-xl tracking-tight">
              <Package className="h-5 w-5 text-muted-foreground" />
              {prettyId(listId)}
            </DialogTitle>
            {data && (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-foreground bg-background flex items-center gap-1.5 border-border/80 px-2.5 py-0.5">
                  {(() => {
                    const cat = data.category ?? "other";
                    const Icon = CATEGORY_META[cat]?.icon ?? Package;
                    const iconColor = CATEGORY_META[cat]?.iconColorClass ?? CATEGORY_META.other.iconColorClass;
                    return <Icon className={`h-3.5 w-3.5 ${iconColor}`} />;
                  })()}
                  {CATEGORY_META[data.category ?? ""]?.label ?? data.category}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {totalWares} possible {totalWares === 1 ? "item" : "items"} across {groups.length} drop {groups.length === 1 ? "event" : "events"}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2">
          {isLoading && <PageLoaderPreset preset="drops" />}
          {!isLoading && <DropListContent groups={groups} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
