/**
 * Tab Switcher — Upload vs Record
 * =================================
 * Generic tab component. Takes an array of tabs and renders them
 * as a segmented control with a sliding active indicator.
 * Fully controlled — parent manages which tab is active.
 */

"use client";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-2 px-5 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-250 ease-out
              ${isActive
                ? "text-cyan-300 bg-cyan-500/10 shadow-sm shadow-cyan-500/5"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              }
            `}
          >
            {/* icon if provided */}
            {tab.icon && (
              <span className={`transition-colors ${isActive ? "text-cyan-400" : ""}`}>
                {tab.icon}
              </span>
            )}
            {tab.label}

            {/* active indicator line at the bottom */}
            {isActive && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5
                rounded-full bg-cyan-400 animate-fade-in" />
            )}
          </button>
        );
      })}
    </div>
  );
}
