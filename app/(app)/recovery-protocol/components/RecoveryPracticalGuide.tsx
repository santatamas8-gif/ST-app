"use client";

import { useState } from "react";
import {
  ChevronRight,
  Droplets,
  Dumbbell,
  HeartPulse,
  LayoutGrid,
  Moon,
  Move,
  Pill,
  Plus,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  RECOVERY_GUIDE_CATEGORIES,
  RECOVERY_GUIDE_DEFAULT_CATEGORY_ID,
  RECOVERY_GUIDE_DISCLAIMER,
  RECOVERY_GUIDE_MIND_MAP_LEFT_IDS,
  RECOVERY_GUIDE_MIND_MAP_RIGHT_IDS,
  getRecoveryGuideCategory,
  type RecoveryGuideCategory,
} from "../recoveryProtocolData";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "sleep-rest": Moon,
  nutrition: Utensils,
  hydration: Droplets,
  supplementation: Pill,
  "training-pre-post": Dumbbell,
  "stretching-mobility": Move,
  regeneration: HeartPulse,
  other: LayoutGrid,
};

const CATEGORY_ICON_BADGE: Record<string, string> = {
  "sleep-rest": "bg-violet-100 text-violet-700",
  nutrition: "bg-blue-100 text-blue-700",
  hydration: "bg-purple-100 text-purple-700",
  supplementation: "bg-amber-100 text-amber-700",
  "training-pre-post": "bg-red-100 text-red-700",
  "stretching-mobility": "bg-orange-100 text-orange-700",
  regeneration: "bg-teal-100 text-teal-700",
  other: "bg-sky-100 text-sky-700",
};

function CategoryIcon({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const Icon = CATEGORY_ICONS[categoryId] ?? LayoutGrid;
  const badge = CATEGORY_ICON_BADGE[categoryId] ?? "bg-slate-100 text-slate-600";

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isActive ? "bg-white/25 text-white" : badge
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function GuideItemList({ items, bulletClass }: { items: string[]; bulletClass: string }) {
  return (
    <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-xs font-semibold leading-snug text-slate-800 sm:text-[13px]"
        >
          <span className={`mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full ${bulletClass}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CategoryContentPanel({ category }: { category: RecoveryGuideCategory }) {
  const Icon = CATEGORY_ICONS[category.id] ?? LayoutGrid;
  const badge = CATEGORY_ICON_BADGE[category.id] ?? "bg-slate-100 text-slate-600";
  const bulletClass = category.mindMap.line;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div
          className={`inline-flex max-w-full items-center gap-2.5 rounded-lg border px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5 ${category.mindMap.detailAccent}`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm ${badge}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">{category.title}</h3>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5 sm:py-3.5">
        {category.items && <GuideItemList items={category.items} bulletClass={bulletClass} />}
        {category.note && (
          <p className="mt-3 text-xs font-medium italic leading-relaxed text-slate-600 sm:text-sm">{category.note}</p>
        )}
        {category.subgroups?.map((group, index) => (
          <div key={group.title} className={index === 0 ? "mt-3 border-t border-slate-200 pt-3" : "mt-3"}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">{group.title}</p>
            <GuideItemList items={group.items} bulletClass={bulletClass} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MindMapCategoryButton({
  category,
  isActive,
  side,
  onSelect,
}: {
  category: RecoveryGuideCategory;
  isActive: boolean;
  side: "left" | "right";
  onSelect: (id: string) => void;
}) {
  const { mindMap } = category;
  const pillClass = isActive ? mindMap.pillActive : `${mindMap.pill} ${mindMap.pillText}`;

  return (
    <div className={`flex items-center gap-0 ${side === "left" ? "flex-row" : "flex-row-reverse"}`}>
      <button
        type="button"
        onClick={() => onSelect(category.id)}
        aria-pressed={isActive}
        className={`flex max-w-[13.5rem] shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left text-xs leading-snug transition-all sm:max-w-[15.5rem] sm:px-3.5 sm:py-2.5 sm:text-sm ${
          isActive
            ? `z-10 scale-[1.03] border-2 font-bold shadow-lg ring-2 ring-white ${pillClass}`
            : `border font-semibold hover:shadow-sm ${pillClass}`
        }`}
      >
        <CategoryIcon categoryId={category.id} isActive={isActive} />
        <span className="min-w-0 flex-1">{category.title}</span>
        {isActive ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90" aria-hidden />
        ) : (
          <Plus className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        )}
      </button>
      <div
        className={`min-w-[1.25rem] flex-1 rounded-full transition-all ${mindMap.line} ${
          isActive ? "h-2 opacity-100" : "h-1 opacity-70"
        }`}
        aria-hidden
      />
    </div>
  );
}

function MobileCategoryButton({
  category,
  isActive,
  onSelect,
}: {
  category: RecoveryGuideCategory;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const { mindMap } = category;
  const pillClass = isActive ? mindMap.pillActive : `${mindMap.pill} ${mindMap.pillText}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={isActive}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all ${
        isActive
          ? `border-2 font-bold shadow-md ring-2 ring-white ${pillClass}`
          : `border font-semibold hover:shadow-sm ${pillClass}`
      }`}
    >
      <CategoryIcon categoryId={category.id} isActive={isActive} />
      <span className="flex-1">{category.title}</span>
      {isActive ? (
        <ChevronRight className="h-4 w-4 shrink-0 rotate-90" aria-hidden />
      ) : (
        <Plus className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      )}
    </button>
  );
}

export function RecoveryPracticalGuide() {
  const [activeId, setActiveId] = useState(RECOVERY_GUIDE_DEFAULT_CATEGORY_ID);
  const activeCategory = getRecoveryGuideCategory(activeId) ?? RECOVERY_GUIDE_CATEGORIES[0];

  const leftCategories = RECOVERY_GUIDE_MIND_MAP_LEFT_IDS.map((id) => getRecoveryGuideCategory(id)).filter(
    Boolean
  ) as RecoveryGuideCategory[];
  const rightCategories = RECOVERY_GUIDE_MIND_MAP_RIGHT_IDS.map((id) => getRecoveryGuideCategory(id)).filter(
    Boolean
  ) as RecoveryGuideCategory[];

  return (
    <section
      aria-labelledby="practical-guide-heading"
      className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 sm:mt-10 sm:px-6 sm:py-6"
    >
      <div className="mb-4 sm:mb-5">
        <header className="text-center">
          <h2
            id="practical-guide-heading"
            className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl"
          >
            Recovery Practical Guide
          </h2>
        </header>
      </div>

      <div className="space-y-4">
      <div className="hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-5 lg:block lg:px-5 lg:py-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <div className="flex flex-col justify-center gap-3.5">
            {leftCategories.map((category) => (
              <MindMapCategoryButton
                key={category.id}
                category={category}
                side="left"
                isActive={activeId === category.id}
                onSelect={setActiveId}
              />
            ))}
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center px-1">
            <div
              className="flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-full border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 text-center shadow-[0_2px_12px_rgba(15,23,42,0.08)] ring-4 ring-slate-100 sm:h-[4.75rem] sm:w-[4.75rem]"
              aria-label="Read only"
            >
              <span className="text-[9px] font-extrabold uppercase leading-tight tracking-wide text-slate-600 sm:text-[10px]">
                Read
                <br />
                only
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3.5">
            {rightCategories.map((category) => (
              <MindMapCategoryButton
                key={category.id}
                category={category}
                side="right"
                isActive={activeId === category.id}
                onSelect={setActiveId}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 lg:hidden">
        {RECOVERY_GUIDE_CATEGORIES.map((category) => (
          <MobileCategoryButton
            key={category.id}
            category={category}
            isActive={activeId === category.id}
            onSelect={setActiveId}
          />
        ))}
      </div>

      <CategoryContentPanel category={activeCategory} />

        <p className="text-center text-[10px] leading-snug text-slate-400">{RECOVERY_GUIDE_DISCLAIMER}</p>
      </div>
    </section>
  );
}
