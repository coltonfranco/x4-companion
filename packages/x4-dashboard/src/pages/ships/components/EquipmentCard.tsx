import { Minus } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import { Currency } from "../../../components/game/Currency";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { StatBar } from "../../../components/data-display/StatBar";
import { SizeBadge } from "../../../components/game/ShipBadges";
import { getMkGradientClass, formatLicence } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import type { EquipmentEvalContext, EquipmentItem, SlotDef } from "../lib/builderTypes";
import { getEquipmentStats, playerHasLicence } from "../lib/builderHelpers";

export function EquipmentCard({
  item, slots, cart, onAdd, onRemove, factionMap, playerLicenceSet, shipFactionId, maxima, evalContext
}: {
  item: EquipmentItem; slots: SlotDef[]; cart: Record<string, EquipmentItem | null>;
  onAdd: (k: string, i: EquipmentItem) => void; onRemove: (k: string) => void;
  factionMap: Map<string, any>;
  playerLicenceSet: Set<string>;
  shipFactionId: string | null;
  maxima?: Record<string, number>;
  evalContext?: EquipmentEvalContext;
}) {
  const equippedSlots = slots.filter(s => cart[s.key]?.ware_id === item.ware_id);
  const isEquipped = equippedSlots.length > 0;
  const emptySlots = slots.filter(s => s.kind === item.kind && s.size === item.size && cart[s.key] === null);

  const isGeneral = item.restriction_licence === 'generaluseequipment' || item.restriction_licence === 'generaluseship';
  const isObtainable = !item.restriction_licence || isGeneral || playerHasLicence(playerLicenceSet, item.restriction_licence, shipFactionId);

  const canAdd = emptySlots.length > 0 && isObtainable;
  const { bars, texts } = getEquipmentStats(item, maxima, evalContext);

  return (
    <Card
      className={cn(
        "relative flex flex-col overflow-hidden transition-all text-left group select-none",
        isEquipped && !canAdd
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : isEquipped && canAdd
            ? "border-primary bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/10 cursor-pointer hover:shadow-md"
            : canAdd
              ? "hover:border-primary/40 hover:bg-accent/30 cursor-pointer hover:shadow-md"
              : "border-border/50 bg-muted/5 opacity-40 cursor-not-allowed"
      )}
      onClick={(e) => {
        if (canAdd) {
          if (e.shiftKey) {
            emptySlots.forEach(s => onAdd(s.key, item));
          } else {
            onAdd(emptySlots[0].key, item);
          }
        }
      }}
      title={
        !isObtainable
          ? `Requires ${formatLicence(item.restriction_licence)} Licence`
          : canAdd
            ? "Click to equip (Shift+Click to fill all)"
            : "No compatible slots remaining"
      }
    >
      {isEquipped && (
        <div className="absolute top-1.5 right-1.5 flex items-stretch rounded-md bg-primary text-primary-foreground shadow-sm z-10 overflow-hidden">
          <div className="px-1.5 py-0.5 text-xs font-bold border-r border-primary/60 flex items-center justify-center">
            {equippedSlots.length}x
          </div>
          <button
            className="px-1.5 py-0.5 hover:bg-primary/80 transition-colors flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(equippedSlots[equippedSlots.length - 1].key);
            }}
            title="Remove one"
          >
            <Minus className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="p-3 pb-2 flex flex-col items-center gap-2">
        {item.icon_url && (
          <div className={cn("w-14 h-14 flex items-center justify-center rounded-lg p-1 border group-hover:scale-105 transition-transform", getMkGradientClass(item.mk))}>
            <EntityIcon src={item.icon_url} alt={item.name} size={48} className="drop-shadow-[0_0_8px_rgba(0,0,0,0.4)]" />
          </div>
        )}
        <p className="text-sm font-medium text-center leading-tight line-clamp-2 h-8 flex items-center">
          {item.name}
          {item.compat_tags && (
            <span
              className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
              title={`Exclusive to ${item.compat_ship_name ?? "a specific ship hull"}`}
            >
              Exclusive
            </span>
          )}
        </p>

        <div className="flex items-center gap-2 flex-wrap justify-center w-full">
          {item.size && <SizeBadge size={item.size} className="text-[11px]" />}
          {item.owner_factions?.length > 0 && (
            (() => {
              // "player" is a real faction_id (drop/terraforming drones use it — no NPC
              // sells them), but it resolves to the player's own custom empire name, which
              // reads as "you manufacture this." Never show it as a manufacturer badge.
              const ownerId = item.owner_factions?.find((fid) => fid !== "player");
              const itemFaction = ownerId ? factionMap.get(ownerId) : undefined;
              if (!itemFaction) return null;
              return (
                <div className={cn("flex items-center gap-1", !isObtainable && "opacity-50")}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: itemFaction.color_hex ?? 'var(--muted-foreground)' }} />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {itemFaction.name}
                  </span>
                </div>
              );
            })()
          )}
          {!isObtainable && item.restriction_licence && (
            <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded border border-destructive/20 font-medium uppercase" title={`Requires ${formatLicence(item.restriction_licence)} Licence`}>
              Missing Required Licence
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-3 pt-0 flex flex-col gap-2 mt-auto">
        {bars.length > 0 && (
          <div className="w-full flex flex-col gap-2.5 items-center px-1">
            {bars.map((b, i) => (
              <StatBar key={i} value={b.isLog ? Math.log10(b.value + 1) : b.value}
                max={b.isLog ? Math.log10(b.max + 1) : b.max}
                labelLeft={b.label}
                labelRight={b.format(b.value)}
                width="100%" height={4} color={b.color} />
            ))}
          </div>
        )}
        {texts.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {texts.map((t, i) => <span key={i} className="text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{t}</span>)}
          </div>
        )}
        <div className="text-xs tabular-nums font-medium text-center mt-2 border-t border-border/50 pt-2 text-muted-foreground" title="Base price. Actual game prices fluctuate based on station resource supply.">
          {item.price_avg != null ? <Currency value={item.price_avg} /> : "—"}
        </div>
      </CardContent>
    </Card>
  );
}
