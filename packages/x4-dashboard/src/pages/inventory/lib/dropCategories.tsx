import { Rocket, Box, Diamond, Gem, Map as MapIcon, RadioTower, HelpCircle } from "lucide-react";

export const CATEGORY_META: Record<string, {
  label: string;
  icon: React.ElementType;
  activeClass: string;
  hoverClass: string;
  iconColorClass: string;
}> = {
  ship: {
    label: "Ship", icon: Rocket,
    activeClass: "bg-blue-500/20 border-blue-500/50 text-blue-400",
    hoverClass: "hover:bg-blue-500/10 hover:border-blue-500/40",
    iconColorClass: "text-blue-400/80 group-hover:text-blue-400",
  },
  lockbox: {
    label: "Lockbox", icon: Box,
    activeClass: "bg-amber-500/20 border-amber-500/50 text-amber-400",
    hoverClass: "hover:bg-amber-500/10 hover:border-amber-500/40",
    iconColorClass: "text-amber-400/80 group-hover:text-amber-400",
  },
  asteroid: {
    label: "Asteroid", icon: Diamond,
    activeClass: "bg-orange-500/20 border-orange-500/50 text-orange-400",
    hoverClass: "hover:bg-orange-500/10 hover:border-orange-500/40",
    iconColorClass: "text-orange-400/80 group-hover:text-orange-400",
  },
  crystal: {
    label: "Crystal", icon: Gem,
    activeClass: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
    hoverClass: "hover:bg-emerald-500/10 hover:border-emerald-500/40",
    iconColorClass: "text-emerald-400/80 group-hover:text-emerald-400",
  },
  story: {
    label: "Mission", icon: MapIcon,
    activeClass: "bg-purple-500/20 border-purple-500/50 text-purple-400",
    hoverClass: "hover:bg-purple-500/10 hover:border-purple-500/40",
    iconColorClass: "text-purple-400/80 group-hover:text-purple-400",
  },
  masstraffic: {
    label: "Traffic", icon: RadioTower,
    activeClass: "bg-zinc-500/20 border-zinc-500/50 text-zinc-400",
    hoverClass: "hover:bg-zinc-500/10 hover:border-zinc-500/40",
    iconColorClass: "text-zinc-400/80 group-hover:text-zinc-400",
  },
  other: {
    label: "Other", icon: HelpCircle,
    activeClass: "bg-primary/20 border-primary/50 text-primary",
    hoverClass: "hover:bg-primary/10 hover:border-primary/40",
    iconColorClass: "text-primary/80 group-hover:text-primary",
  },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META);
