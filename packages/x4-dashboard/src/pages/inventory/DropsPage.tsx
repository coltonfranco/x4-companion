import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { FilterBar } from "../../components/layout/FilterBar";
import { apiGet } from "../../lib/api";
import { prettyId } from "../../lib/wareFormat";
import type { DropList } from "./types";
import { ALL_CATEGORIES, CATEGORY_META } from "./lib/dropCategories";
import { DropDetailDialog } from "./components/DropDetailDialog";

export default function DropsPage() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleFilterCategory = (cat: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(cat)) return prev.filter(c => c !== cat);
      return [...prev, cat];
    });
  };

  const { data: lists = [], isLoading } = useQuery<DropList[]>({
    queryKey: ["drops", "lists"],
    queryFn: () => apiGet<DropList[]>("/api/v1/drops/lists"),
  });

  const filtered = lists.filter((l) => {
    const effectiveCategory = (!l.category || !ALL_CATEGORIES.includes(l.category)) ? "other" : l.category;
    if (selectedCategories.length > 0 && !selectedCategories.includes(effectiveCategory)) return false;
    if (search && !l.list_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category for display
  const byCategory = ALL_CATEGORIES.reduce<Record<string, DropList[]>>((acc, cat) => {
    const items = filtered.filter((l) => l.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  if (filtered.some((l) => !l.category || !ALL_CATEGORIES.includes(l.category))) {
    byCategory["other"] = filtered.filter((l) => !l.category || !ALL_CATEGORIES.includes(l.category));
  }

  const categoriesToShow = selectedCategories.length === 0 ? Object.keys(byCategory) : selectedCategories.filter(c => byCategory[c]?.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Drop Tables</h1>
        <PageSubtitle>{lists.length} drop tables · click any entry to see its loot</PageSubtitle>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-0 flex flex-col">
        <HUDCard className="h-full">

          <FilterBar className="gap-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 bg-muted/50 border-input focus-visible:ring-1 focus-visible:ring-primary/50"
          />
          {search && (
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-1">Types:</span>
          {ALL_CATEGORIES.map((c) => {
            const isActive = selectedCategories.includes(c);
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;

            return (
              <button
                key={c}
                onClick={() => {
                  if (selectedCategories.length === 1 && selectedCategories.includes(c)) {
                    setSelectedCategories([]);
                  } else if (selectedCategories.length === 0) {
                    setSelectedCategories([c]);
                  } else {
                    toggleFilterCategory(c);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? meta.activeClass
                    : "border-border/80 bg-muted/30 text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
          {selectedCategories.length > 0 && (
            <button className="text-xs text-muted-foreground hover:text-foreground ml-2" onClick={() => setSelectedCategories([])}>
              Clear filters
            </button>
          )}
        </div>
      </FilterBar>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <PageLoaderPreset preset="drops" />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No drop tables match your filters.</p>
        ) : (
          <div className="space-y-6">
            {categoriesToShow.filter((c) => byCategory[c]?.length).map((cat) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
              const Icon = meta.icon;

              return (
                <div key={cat} className="space-y-4">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-4 w-full group outline-none"
                  >
                    <Badge variant="outline" className="px-2.5 py-0.5 rounded-sm shadow-sm group-hover:scale-105 transition-transform duration-150 flex items-center gap-1.5 text-foreground bg-background border-border/80">
                      <Icon className={`h-3.5 w-3.5 ${meta.iconColorClass}`} />
                      {meta.label ?? cat} <span className="opacity-60 ml-1 font-normal">({byCategory[cat].length})</span>
                    </Badge>
                    <div className="h-px flex-1 bg-border/50 group-hover:bg-border transition-colors duration-150" />
                  </button>

                  {!collapsedCategories.has(cat) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {byCategory[cat].map((list) => (
                        <button
                          key={list.list_id}
                          onClick={() => setOpenListId(list.list_id)}
                          className={`flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] backdrop-blur-sm px-3.5 py-3 text-left transition-all duration-150 group hover:shadow-md hover:-translate-y-[1px] hover:border-white/10 ${meta.hoverClass}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${meta.iconColorClass}`} />
                          <span className="text-sm font-medium truncate transition-transform duration-150 group-hover:translate-x-0.5">{prettyId(list.list_id)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

        </HUDCard>
      </div>

      {openListId && <DropDetailDialog listId={openListId} onClose={() => setOpenListId(null)} />}
    </div>
  );
}
