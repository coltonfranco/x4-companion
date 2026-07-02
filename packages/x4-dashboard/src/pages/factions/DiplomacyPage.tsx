import { useState } from "react";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { PageTabs, PageTab } from "../../components/ui/page-tabs";
import { DiplomacyActionsTab } from "./components/DiplomacyActionsTab";
import { DiplomacyGiftsTab } from "./components/DiplomacyGiftsTab";
import { DiplomacyRanksTab } from "./components/DiplomacyRanksTab";

const TABS = [
  { id: "actions", label: "Actions" },
  { id: "gifts", label: "Faction Gifts" },
  { id: "ranks", label: "Agent Ranks" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DiplomacyPage() {
  const [activeTab, setActiveTab] = useState<TabId>("actions");

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Diplomacy</h1>
        <PageSubtitle>Agent actions, faction gifts, and rank progression</PageSubtitle>
        <PageTabs>
          {TABS.map((t) => (
            <PageTab
              key={t.id}
              active={t.id === activeTab}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </PageTab>
          ))}
        </PageTabs>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4 flex flex-col">
        <HUDCard className="h-full overflow-hidden">
          {activeTab === "actions" && <DiplomacyActionsTab />}
          {activeTab === "gifts" && <DiplomacyGiftsTab />}
          {activeTab === "ranks" && <DiplomacyRanksTab />}
        </HUDCard>
      </div>
    </div>
  );
}
