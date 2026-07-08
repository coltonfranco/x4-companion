import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "../components/app-shell/AppLayout";
import { FactionsLayout } from "../pages/factions/FactionsLayout";
import FactionsListPage from "../pages/factions/FactionsPage";
import DiplomacyPage from "../pages/factions/DiplomacyPage";
import { InventoryLayout } from "../pages/inventory/InventoryLayout";
import InventoryCatalogPage from "../pages/inventory/InventoryPage";
import DropsPage from "../pages/inventory/DropsPage";
import { EmpireLayout } from "../pages/empire/EmpireLayout";
import EmpireOverviewPage from "../pages/empire/EmpirePage";
import EmpireCrewPage from "../pages/empire/CrewPage";
import EmpireStatsPage from "../pages/empire/StatsPage";
import MissionsPage from "../pages/missions/MissionsPage";
import { MessagesLayout } from "../pages/messages/MessagesLayout";
import MessagesInboxPage from "../pages/messages/MessagesPage";
import MessagesLogbookPage from "../pages/messages/LogbookPage";
import EquipmentPage from "../pages/ships/EquipmentPage";
import MapPage from "../pages/map/MapPage";
import ShipsListPage from "../pages/ships/ShipsPage";
import { ShipsLayout } from "../pages/ships/ShipsLayout";
import FleetPage from "../pages/ships/FleetPage";
import BuilderPage from "../pages/ships/BuilderPage";
import PaintModsPage from "../pages/ships/PaintModsPage";

import TradeCatalogPage from "../pages/trade/CatalogPage";
import TradeOverviewPage from "../pages/trade/TradePage";
import { TradeLayout } from "../pages/trade/TradeLayout";
import ProductionChainsPage from "../pages/trade/ProductionPage";
import TransactionsPage from "../pages/trade/TransactionsPage";
import TradeRoutesPage from "../pages/trade/RoutesPage";
import SectorTestPage from "../pages/__dev__/SectorTestPage";
import StyleguidePage from "../pages/__dev__/StyleguidePage";
import CrashTestPage from "../pages/__dev__/CrashTestPage";
import { RouteErrorFallback } from "../components/error/RouteErrorFallback";
import { StationsLayout } from "../pages/stations/StationsLayout";
import ModulesPage from "../pages/stations/ModulesPage";
import MyStationsPage from "../pages/stations/StationsPage";
import StationBuilderPage from "../pages/stations/BuilderPage";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/empire" });
  },
});
const empireRoute = createRoute({ getParentRoute: () => rootRoute, path: "/empire", component: EmpireLayout });
const empireIndexRoute = createRoute({ getParentRoute: () => empireRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/empire/overview" }); } });
const empireOverviewRoute = createRoute({ getParentRoute: () => empireRoute, path: "overview", component: EmpireOverviewPage });
const empireCrewRoute = createRoute({ getParentRoute: () => empireRoute, path: "crew", component: EmpireCrewPage });
const empireStatsRoute = createRoute({ getParentRoute: () => empireRoute, path: "stats", component: EmpireStatsPage });

const crewRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/crew",
  beforeLoad: () => { throw redirect({ to: "/empire/crew" }); },
});
const statsRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  beforeLoad: () => { throw redirect({ to: "/empire/stats" }); },
});

// Trade hub — a tabbed layout over the commodity catalog, supply radar, and routes.
const tradeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/trade", component: TradeLayout });
const tradeIndexRoute = createRoute({ getParentRoute: () => tradeRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/trade/overview" }); } });
const tradeOverviewRoute = createRoute({ getParentRoute: () => tradeRoute, path: "overview", component: TradeOverviewPage });
const tradeCatalogRoute = createRoute({ getParentRoute: () => tradeRoute, path: "catalog", component: TradeCatalogPage });
const tradeProductionRoute = createRoute({ getParentRoute: () => tradeRoute, path: "production", component: ProductionChainsPage });
const tradeRoutesRoute = createRoute({ getParentRoute: () => tradeRoute, path: "routes", component: TradeRoutesPage });
const tradeTransactionsRoute = createRoute({
  getParentRoute: () => tradeRoute,
  path: "transactions",
  component: TransactionsPage,
  // Deep-link from AccountsPanel: pre-filter to one ship/station or commodity.
  validateSearch: (search: Record<string, unknown>): { owner?: string; ware?: string } => ({
    owner: typeof search.owner === "string" ? search.owner : undefined,
    ware: typeof search.ware === "string" ? search.ware : undefined,
  }),
});

// Legacy paths kept as redirects into the trade hub.
const routesRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/routes",
  beforeLoad: () => {
    throw redirect({ to: "/trade/routes" });
  },
});
const waresRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wares",
  beforeLoad: () => {
    throw redirect({ to: "/trade" });
  },
});

const equipmentRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/equipment",
  beforeLoad: () => {
    throw redirect({ to: "/ships/equipment" });
  },
});
const dropsRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/drops",
  beforeLoad: () => {
    throw redirect({ to: "/inventory/drops" });
  },
});
const diplomacyRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diplomacy",
  beforeLoad: () => {
    throw redirect({ to: "/factions/diplomacy" });
  },
});

const inventoryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/inventory", component: InventoryLayout });
const inventoryIndexRoute = createRoute({ getParentRoute: () => inventoryRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/inventory/catalog" }); } });
const inventoryCatalogRoute = createRoute({ getParentRoute: () => inventoryRoute, path: "catalog", component: InventoryCatalogPage });
const inventoryDropsRoute = createRoute({ getParentRoute: () => inventoryRoute, path: "drops", component: DropsPage });
const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  component: MapPage,
  // Deep-link from the trade pages: preset the ware overlay, route arrows, and nav path.
  validateSearch: (search: Record<string, unknown>): { ware?: string; routes?: boolean; from?: string; to?: string } => ({
    ware: typeof search.ware === "string" ? search.ware : undefined,
    routes: search.routes === true || search.routes === "1" || search.routes === "true" ? true : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
});
const shipsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/ships", component: ShipsLayout });
const shipsIndexRoute = createRoute({ getParentRoute: () => shipsRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/ships/list" }); } });
const shipsListRoute = createRoute({ getParentRoute: () => shipsRoute, path: "list", component: ShipsListPage });
const shipsFleetRoute = createRoute({ getParentRoute: () => shipsRoute, path: "fleet", component: FleetPage });
const shipsEquipmentRoute = createRoute({ getParentRoute: () => shipsRoute, path: "equipment", component: EquipmentPage });
const shipsBuilderRoute = createRoute({
  getParentRoute: () => shipsRoute,
  path: "/builder",
  component: BuilderPage,
  validateSearch: (search: Record<string, unknown>): { ship_id?: string } => ({
    ship_id: typeof search.ship_id === "string" ? search.ship_id : undefined,
  }),
});
const shipsPaintModsRoute = createRoute({ getParentRoute: () => shipsRoute, path: "paintmods", component: PaintModsPage });
const factionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/factions", component: FactionsLayout });
const factionsIndexRoute = createRoute({ getParentRoute: () => factionsRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/factions/list" }); } });
const factionsListRoute = createRoute({
  getParentRoute: () => factionsRoute,
  path: "list",
  component: FactionsListPage,
  validateSearch: (search: Record<string, unknown>): { faction?: string } => ({
    faction: typeof search.faction === "string" ? search.faction : undefined,
  }),
});
const factionsDiplomacyRoute = createRoute({ getParentRoute: () => factionsRoute, path: "diplomacy", component: DiplomacyPage });

const stationsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/stations", component: StationsLayout });
const stationsIndexRoute = createRoute({ getParentRoute: () => stationsRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/stations/overview" }); } });
const stationsOverviewRoute = createRoute({ getParentRoute: () => stationsRoute, path: "overview", component: MyStationsPage });
const stationsModulesRoute = createRoute({ getParentRoute: () => stationsRoute, path: "modules", component: ModulesPage });
const stationsBuilderRoute = createRoute({ getParentRoute: () => stationsRoute, path: "builder", component: StationBuilderPage });
const missionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/missions", component: MissionsPage });
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/messages", component: MessagesLayout });
const messagesIndexRoute = createRoute({ getParentRoute: () => messagesRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/messages/inbox" }); } });
const messagesInboxRoute = createRoute({ getParentRoute: () => messagesRoute, path: "inbox", component: MessagesInboxPage });
const messagesLogbookRoute = createRoute({ getParentRoute: () => messagesRoute, path: "logbook", component: MessagesLogbookPage });

const logbookRedirect = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logbook",
  beforeLoad: () => { throw redirect({ to: "/messages/logbook" }); },
});
const sectorTestRoute = createRoute({ getParentRoute: () => rootRoute, path: "/sector_test", component: SectorTestPage });
const styleguideRoute = createRoute({ getParentRoute: () => rootRoute, path: "/styleguide", component: StyleguidePage });
const crashTestRoute = createRoute({ getParentRoute: () => rootRoute, path: "/__dev__/crash", component: CrashTestPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  empireRoute.addChildren([empireIndexRoute, empireOverviewRoute, empireCrewRoute, empireStatsRoute]),
  tradeRoute.addChildren([tradeIndexRoute, tradeOverviewRoute, tradeCatalogRoute, tradeProductionRoute, tradeRoutesRoute, tradeTransactionsRoute]),
  routesRedirect,
  waresRedirect,
  equipmentRedirect,
  inventoryRoute.addChildren([inventoryIndexRoute, inventoryCatalogRoute, inventoryDropsRoute]),
  dropsRedirect,
  diplomacyRedirect,
  mapRoute,
  shipsRoute.addChildren([shipsIndexRoute, shipsListRoute, shipsFleetRoute, shipsEquipmentRoute, shipsBuilderRoute, shipsPaintModsRoute]),
  stationsRoute.addChildren([stationsIndexRoute, stationsOverviewRoute, stationsModulesRoute, stationsBuilderRoute]),
  factionsRoute.addChildren([factionsIndexRoute, factionsListRoute, factionsDiplomacyRoute]),
  missionsRoute,
  messagesRoute.addChildren([messagesIndexRoute, messagesInboxRoute, messagesLogbookRoute]),
  crewRedirect,
  statsRedirect,
  logbookRedirect,
  sectorTestRoute,
  styleguideRoute,
  crashTestRoute,
]);

export const router = createRouter({ routeTree, defaultErrorComponent: RouteErrorFallback });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
