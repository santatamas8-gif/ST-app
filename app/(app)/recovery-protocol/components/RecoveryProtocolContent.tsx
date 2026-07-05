import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bike,
  CircleAlert,
  Droplets,
  Flame,
  Footprints,
  Moon,
  Salad,
  Snowflake,
  Sparkles,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import { RecoveryPracticalGuide } from "./RecoveryPracticalGuide";
import {
  FOUNDATION_ITEMS,
  FOUNDATION_WARNING,
  PHASE_TIMELINE,
  PROTOCOL_DAYS,
  THERAPY_POINT_BANK,
  THERAPY_POINT_COLUMNS,
  getTherapyPointTier,
  type FoundationItem,
  type ProtocolDay,
  type TherapyPoint,
} from "../recoveryProtocolData";

const FOAM_ROLLER_SRC = "/recovery-protocol/foam-roller.png";
const MASSAGE_GUN_SRC = "/recovery-protocol/massage-gun.png";
const MASSAGE_SRC = "/recovery-protocol/massage.png";
const HYDRO_MASSAGE_SRC = "/recovery-protocol/hydro-massage.png";
const DRY_NEEDLING_SRC = "/recovery-protocol/dry-needling.png";
const CONTRAST_WATER_THERAPY_SRC = "/recovery-protocol/contrast-water-therapy.png";
const SAUNA_SRC = "/recovery-protocol/sauna.svg";
const GAME_READY_SRC = "/recovery-protocol/game-ready.png";
const STEAM_BATH_SRC = "/recovery-protocol/steam-bath.png";
const POOL_EXERCISE_SRC = "/recovery-protocol/pool-exercise.png";
const EASY_JOGGING_SRC = "/recovery-protocol/easy-jogging.png";
const COMPRESSION_BOOTS_SRC = "/recovery-protocol/recovery-equipment-icons.png";
const THERAPY_EQUIPMENT_SRC = "/recovery-protocol/recovery-equipment-icons.png";

type EquipmentVariant =
  | "foam"
  | "boots"
  | "sauna"
  | "steam"
  | "dry-needling"
  | "massage-gun"
  | "massage"
  | "hydro-massage"
  | "contrast-water"
  | "game-ready"
  | "pool-exercise"
  | "jogging";

const STANDALONE_EQUIPMENT_SRC = {
  foam: FOAM_ROLLER_SRC,
  "massage-gun": MASSAGE_GUN_SRC,
  massage: MASSAGE_SRC,
  "hydro-massage": HYDRO_MASSAGE_SRC,
  "dry-needling": DRY_NEEDLING_SRC,
  "contrast-water": CONTRAST_WATER_THERAPY_SRC,
  sauna: SAUNA_SRC,
  "game-ready": GAME_READY_SRC,
  steam: STEAM_BATH_SRC,
  "pool-exercise": POOL_EXERCISE_SRC,
  jogging: EASY_JOGGING_SRC,
} as const satisfies Partial<Record<EquipmentVariant, string>>;

type SpriteEquipmentVariant = Exclude<EquipmentVariant, keyof typeof STANDALONE_EQUIPMENT_SRC>;

const EQUIPMENT_SPRITES: Record<SpriteEquipmentVariant, { src: string; row: number; rows: number }> = {
  boots: { src: COMPRESSION_BOOTS_SRC, row: 1, rows: 2 },
};

const FOUNDATION_ICONS: Record<FoundationItem["icon"], LucideIcon> = {
  sleep: Moon,
  hydration: Droplets,
  nutrition: Salad,
  meal: UtensilsCrossed,
};

function FoundationPill({ item }: { item: FoundationItem }) {
  const Icon = FOUNDATION_ICONS[item.icon];

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 lg:h-8 lg:w-8">
        <Icon className="h-3.5 w-3.5 text-blue-700 lg:h-4 lg:w-4" aria-hidden />
      </span>
      <span className="text-[11px] font-semibold leading-snug text-slate-800 sm:text-xs lg:text-[13px]">
        {item.label}
      </span>
    </div>
  );
}

const RECOVERY_ICON_SIZE = 32;
const RECOVERY_ICON_SIZE_MOBILE = 24;
const POINT_SYSTEM_ICON_SIZE = 36;
const POINT_SYSTEM_ICON_SIZE_MOBILE = 24;
const FOOTER_ICON_SIZE = 28;
const footerNoteTextClass = "min-w-0 text-[10px] font-normal leading-none text-slate-400 sm:text-[11px] xl:text-xs";
const footerNoteIconClass = "text-slate-400";

const THERAPY_BANK_ICON_ALIASES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /foam roll/i, name: "Foam Roller + Mobility" },
  { pattern: /pool exercise/i, name: "Pool Exercise" },
  { pattern: /cold water/i, name: "Cold Water Immersion" },
  { pattern: /contrast water/i, name: "Contrast Water Therapy" },
  { pattern: /compression boots/i, name: "Compression Boots" },
  { pattern: /compression/i, name: "Compression Boots" },
  { pattern: /^bike$/i, name: "Easy Bike" },
  { pattern: /^easy bike$/i, name: "Easy Bike" },
  { pattern: /^bike \/ walk$/i, name: "Easy Bike" },
  { pattern: /^bike \/ jogging$/i, name: "Easy Bike" },
  { pattern: /^jogging$/i, name: "Easy Jogging" },
  { pattern: /easy jogging/i, name: "Easy Jogging" },
  { pattern: /^walk$/i, name: "Walk" },
  { pattern: /massage gun/i, name: "Massage Gun" },
  { pattern: /game ready/i, name: "Game Ready" },
  { pattern: /^sauna \/ hammam$/i, name: "Sauna / Hammam" },
  { pattern: /sauna|hammam/i, name: "Sauna / Hammam" },
  { pattern: /dry needling/i, name: "Dry Needling" },
  { pattern: /light massage/i, name: "Light Massage" },
  { pattern: /massage/i, name: "Light Massage" },
  { pattern: /pool/i, name: "Pool Exercise" },
];

type ActionIconRender =
  | { kind: "equipment"; variant: EquipmentVariant }
  | { kind: "lucide"; icon: LucideIcon };

const EQUIPMENT_ICON_SCALE: Partial<Record<EquipmentVariant, number>> = {
  "contrast-water": 1.35,
  steam: 1.35,
};

function EquipmentIcon({ variant, size = 20 }: { variant: EquipmentVariant; size?: number }) {
  const standaloneSrc = STANDALONE_EQUIPMENT_SRC[variant as keyof typeof STANDALONE_EQUIPMENT_SRC];
  const imageScale = EQUIPMENT_ICON_SCALE[variant] ?? 1;

  if (standaloneSrc) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md ${variant === "jogging" ? "bg-white" : "bg-transparent"} ${imageScale !== 1 ? "overflow-visible" : "overflow-hidden"}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <img
          src={standaloneSrc}
          alt=""
          className="h-full w-full object-contain"
          style={imageScale !== 1 ? { transform: `scale(${imageScale})` } : undefined}
        />
      </span>
    );
  }

  const sprite = EQUIPMENT_SPRITES[variant as SpriteEquipmentVariant];

  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-md bg-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={sprite.src}
        alt=""
        width={size}
        height={size * sprite.rows}
        className="max-w-none object-contain object-left"
        style={{ marginTop: -sprite.row * size }}
      />
    </span>
  );
}

function ActionIcon({
  render,
  size = 20,
  lucideClassName,
}: {
  render: ActionIconRender;
  size?: number;
  lucideClassName?: string;
}) {
  if (render.kind === "equipment") {
    return <EquipmentIcon variant={render.variant} size={size} />;
  }

  const Icon = render.icon;
  const lucidePixelSize = Math.round(size * (size >= 30 ? 0.75 : 0.6));

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon
        className={lucideClassName ?? "text-slate-600"}
        style={{ width: lucidePixelSize, height: lucidePixelSize }}
        strokeWidth={2}
      />
    </span>
  );
}

function resolveRecoveryIcon(text: string): ActionIconRender {
  const normalized = text.toLowerCase();

  if (normalized.includes("foam roller") || normalized.includes("foam roll")) {
    return { kind: "equipment", variant: "foam" };
  }
  if (normalized.includes("compression boots") || normalized.includes("compression")) {
    return { kind: "equipment", variant: "boots" };
  }
  if (normalized.includes("cold water") || normalized.includes("immersion")) {
    return { kind: "lucide", icon: Snowflake };
  }
  if (normalized.includes("pool exercise")) {
    return { kind: "equipment", variant: "pool-exercise" };
  }
  if (normalized.includes("contrast")) {
    return { kind: "equipment", variant: "contrast-water" };
  }
  if (normalized.includes("game ready")) {
    return { kind: "equipment", variant: "game-ready" };
  }
  if (normalized.includes("massage gun")) {
    return { kind: "equipment", variant: "massage-gun" };
  }
  if (normalized.includes("hydro massage")) {
    return { kind: "equipment", variant: "hydro-massage" };
  }
  if (normalized.includes("light massage") || normalized.includes("massage")) {
    return { kind: "equipment", variant: "massage" };
  }
  if (normalized.includes("sauna") || normalized.includes("hammam")) {
    return { kind: "equipment", variant: "sauna" };
  }
  if (normalized.includes("steam bath")) {
    return { kind: "equipment", variant: "steam" };
  }
  if (normalized.includes("dry needling")) {
    return { kind: "equipment", variant: "dry-needling" };
  }
  if (normalized.includes("jogging") || normalized.includes("jog")) {
    return { kind: "equipment", variant: "jogging" };
  }
  if (normalized.includes("walk")) {
    return { kind: "lucide", icon: Footprints };
  }
  if (normalized.includes("bike")) {
    return { kind: "lucide", icon: Bike };
  }
  if (normalized.includes("pool")) {
    return { kind: "equipment", variant: "pool-exercise" };
  }
  if (normalized.includes("fluid") || normalized.includes("sodium")) {
    return { kind: "lucide", icon: Droplets };
  }
  if (normalized.includes("meal") || normalized.includes("sleep")) {
    return { kind: "lucide", icon: Moon };
  }
  if (normalized.includes("activation") || normalized.includes("freshest")) {
    return { kind: "lucide", icon: Sparkles };
  }
  if (normalized.includes("avoid") || normalized.includes("no heavy")) {
    return { kind: "lucide", icon: CircleAlert };
  }
  if (normalized.includes("targeted")) {
    return { kind: "lucide", icon: Target };
  }
  if (normalized.includes("non-starters")) {
    return { kind: "lucide", icon: Flame };
  }
  if (normalized.includes("normal training")) {
    return { kind: "lucide", icon: Footprints };
  }
  if (normalized.includes("mobility")) {
    return { kind: "lucide", icon: Activity };
  }
  return { kind: "lucide", icon: Sparkles };
}

function matchTherapyBankItem(action: string): TherapyPoint | null {
  for (const alias of THERAPY_BANK_ICON_ALIASES) {
    if (alias.pattern.test(action)) {
      const item = THERAPY_POINT_BANK.find((entry) => entry.name === alias.name);
      if (item) return item;
    }
  }

  return THERAPY_POINT_BANK.find((entry) => entry.name.toLowerCase() === action.toLowerCase()) ?? null;
}

function SingleRecoveryIcon({
  label,
  lucideClassName,
  size = RECOVERY_ICON_SIZE,
}: {
  label: string;
  lucideClassName?: string;
  size?: number;
}) {
  const therapyMatch = matchTherapyBankItem(label);
  const iconLabel = therapyMatch?.name ?? label;
  const tier = therapyMatch ? getTherapyPointTier(therapyMatch.points) : null;

  return (
    <ActionIcon
      render={resolveRecoveryIcon(iconLabel)}
      size={size}
      lucideClassName={tier?.pointsText ?? lucideClassName ?? "text-slate-600"}
    />
  );
}

function RecoveryListIcon({
  label,
  lucideClassName,
  size,
}: {
  label: string;
  lucideClassName?: string;
  size?: number;
}) {
  return <SingleRecoveryIcon label={label} lucideClassName={lucideClassName} size={size} />;
}

function isAvoidRecoveryAction(action: string): boolean {
  return /^avoid\b/i.test(action) || /^no heavy recovery$/i.test(action);
}

function ProtocolActionItem({
  action,
  compact = false,
  iconSize = RECOVERY_ICON_SIZE,
}: {
  action: string;
  compact?: boolean;
  iconSize?: number;
}) {
  if (compact) {
    return (
      <li className="flex items-center gap-1.5 lg:gap-2">
        <span className="shrink-0">
          <ActionIcon
            render={resolveRecoveryIcon(action)}
            size={iconSize}
            lucideClassName={footerNoteIconClass}
          />
        </span>
        <span className={footerNoteTextClass}>{action}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 text-xs leading-snug text-slate-700 lg:gap-2.5 lg:text-sm">
      <span className="shrink-0">
        <RecoveryListIcon label={action} size={iconSize} />
      </span>
      <span className="min-w-0 pt-0.5 lg:pt-1">{action}</span>
    </li>
  );
}

function ProtocolFooterNote({ text }: { text: string }) {
  return (
    <div className="mt-auto flex items-center gap-1 border-t border-slate-100 pt-2.5">
      <span className="shrink-0">
        <ActionIcon
          render={{ kind: "lucide", icon: CircleAlert }}
          size={FOOTER_ICON_SIZE}
          lucideClassName={footerNoteIconClass}
        />
      </span>
      <span className={footerNoteTextClass}>{text}</span>
    </div>
  );
}

function ProtocolDayCard({ day, compact = false }: { day: ProtocolDay; compact?: boolean }) {
  const mainActions = day.keyActions.filter((action) => !isAvoidRecoveryAction(action));
  const footerActions = day.keyActions.filter(isAvoidRecoveryAction);
  const iconSize = compact ? RECOVERY_ICON_SIZE_MOBILE : RECOVERY_ICON_SIZE;

  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${day.accent.cardBorder}`}
    >
      <div className={`flex flex-col ${day.accent.header}`}>
        <div
          className={`text-center ${compact ? "px-2 py-2" : "px-3 py-2.5 lg:px-3.5 xl:px-4"}`}
        >
          <span
            className={`font-bold tracking-wide ${day.accent.headerText} ${
              compact ? "text-sm" : "text-base lg:text-lg xl:text-xl"
            }`}
          >
            {day.label}
          </span>
        </div>
        <div className={`text-center ${compact ? "px-2 pb-2" : "px-3 pb-2.5 lg:px-3.5 xl:px-4"}`}>
          <span
            className={`inline-block rounded-md border-2 border-white bg-white font-bold tabular-nums text-slate-900 shadow-sm ${
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs lg:text-sm"
            }`}
          >
            {day.pointGoal} pts
          </span>
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${compact ? "px-2 py-2" : "px-3 py-3 lg:px-3.5 xl:px-4"}`}>
        <ul className={compact ? "space-y-1.5" : "space-y-2"}>
          {mainActions.map((action) => (
            <ProtocolActionItem key={action} action={action} iconSize={iconSize} />
          ))}
        </ul>
        {footerActions.length > 0 && (
          <ul className={`mt-auto border-t border-slate-100 ${compact ? "space-y-1.5 pt-2" : "space-y-2 pt-2.5"}`}>
            {footerActions.map((action) => (
              <ProtocolActionItem
                key={action}
                action={action}
                compact
                iconSize={compact ? 22 : FOOTER_ICON_SIZE}
              />
            ))}
          </ul>
        )}
        {day.id === "md" && day.focus && <ProtocolFooterNote text={day.focus} />}
      </div>
    </article>
  );
}

// 2 cards visible: viewport minus horizontal scroll padding only.
const MOBILE_CARD_COLUMN_WIDTH =
  "auto-cols-[calc((100vw-1rem-0.375rem)/2)] sm:auto-cols-[calc((100vw-1rem-0.75rem)/3)]";
const MOBILE_COLUMN_GRID = `grid grid-flow-col gap-1.5 ${MOBILE_CARD_COLUMN_WIDTH} gap-y-2 sm:gap-2.5`;
const MOBILE_SCROLL_EDGE = "scroll-px-2 px-2";
const MOBILE_PHASE_LABEL_CLASS =
  "block max-w-full px-0.5 text-center text-[8px] font-bold uppercase leading-[1.1] tracking-tight sm:text-[10px]";

function MobilePhaseTimelineRow() {
  let phaseCol = 1;

  return (
    <div className="contents">
      {PHASE_TIMELINE.map((segment) => {
        const colStart = phaseCol;
        phaseCol += segment.span;

        return (
          <div
            key={segment.id}
            className={`flex items-center justify-center rounded-md px-1 py-1.5 ${segment.bar}`}
            style={{ gridColumn: `${colStart} / span ${segment.span}`, gridRow: 2 }}
          >
            <span className={`${MOBILE_PHASE_LABEL_CLASS} ${segment.barText}`}>
              {segment.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProtocolDaysBoard() {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        <p className="text-center text-[11px] font-medium text-slate-400 sm:text-xs">Swipe for more days</p>
        <div
          className={`overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory ${MOBILE_SCROLL_EDGE}`}
          aria-label="Matchday protocol days"
        >
          <div className={`${MOBILE_COLUMN_GRID} w-max`}>
            {PROTOCOL_DAYS.map((day, index) => (
              <div
                key={day.id}
                className="min-w-0 snap-start"
                style={{ gridColumn: index + 1, gridRow: 1 }}
              >
                <ProtocolDayCard day={day} compact />
              </div>
            ))}
            <MobilePhaseTimelineRow />
          </div>
        </div>
      </div>

      <div className="hidden space-y-3 lg:block">
        <div className="grid grid-cols-7 items-stretch gap-2 xl:gap-3">
          {PROTOCOL_DAYS.map((day) => (
            <ProtocolDayCard key={day.id} day={day} />
          ))}
        </div>
        <PhaseTimelineStrip />
      </div>
    </>
  );
}

function PhaseTimelineStrip() {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200">
      {PHASE_TIMELINE.map((segment) => (
        <div
          key={segment.id}
          className={`flex items-center justify-center px-1 py-2 lg:px-2 lg:py-2.5 ${segment.bar}`}
          style={{ gridColumn: `span ${segment.span}` }}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wide lg:text-xs lg:tracking-wider ${segment.barText}`}>
            {segment.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PointSystemFoundation({ layout = "desktop" }: { layout?: "mobile" | "desktop" }) {
  return (
    <>
      <h2 id="foundation-heading" className="sr-only">
        Foundation of recovery
      </h2>
      <div
        className={`flex items-center gap-x-3 sm:gap-x-4 ${
          layout === "mobile" ? "flex-nowrap" : "flex-wrap gap-y-2.5 lg:gap-x-6"
        }`}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100"
          title="Important"
        >
          <CircleAlert className="h-3.5 w-3.5 text-red-600" aria-hidden />
        </span>
        {FOUNDATION_ITEMS.map((item) => (
          <FoundationPill key={item.label} item={item} />
        ))}
      </div>
      <p className="mt-2 px-0.5 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">{FOUNDATION_WARNING}</p>
    </>
  );
}

function TherapyPointRow({ item, compact = false }: { item: TherapyPoint; compact?: boolean }) {
  const tier = getTherapyPointTier(item.points);
  const iconSize = compact ? POINT_SYSTEM_ICON_SIZE_MOBILE : POINT_SYSTEM_ICON_SIZE;

  return (
    <div
      className={`flex items-center border-b last:border-b-0 ${tier.rowBorder} ${
        compact ? "gap-2 px-2.5 py-2" : "gap-3 px-3.5 py-3 sm:px-4"
      }`}
    >
      <RecoveryListIcon label={item.name} size={iconSize} />
      <span
        className={`min-w-0 flex-1 font-medium leading-snug text-slate-800 ${
          compact ? "text-xs" : "text-sm sm:text-[15px]"
        }`}
      >
        {item.name}
      </span>
      <span
        className={`shrink-0 rounded-md font-bold tabular-nums ${
          compact ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm sm:text-[15px]"
        } ${tier.pointsBg} ${tier.pointsText}`}
      >
        {item.points}
      </span>
    </div>
  );
}

function PointSystemColumn({ column, compact = false }: { column: TherapyPoint[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {column.map((item) => (
        <TherapyPointRow key={item.name} item={item} compact={compact} />
      ))}
    </div>
  );
}

function PointSystemBoard() {
  return (
    <>
      <div className="space-y-3 pb-2 pt-1 lg:hidden">
        <p className="text-center text-[11px] font-medium text-slate-400 sm:text-xs">Swipe for more</p>
        <div
          className={`overflow-x-auto overscroll-x-contain pb-3 snap-x snap-mandatory ${MOBILE_SCROLL_EDGE}`}
          aria-label="Therapy point columns"
        >
          <div className={`${MOBILE_COLUMN_GRID} w-max`}>
            {THERAPY_POINT_COLUMNS.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className="min-w-0 snap-start"
                style={{ gridColumn: columnIndex + 1, gridRow: 1 }}
              >
                <PointSystemColumn column={column} compact />
              </div>
            ))}
            <div
              className="border-t border-slate-200 bg-slate-50/80 px-2 pb-2 pt-2.5"
              style={{ gridColumn: "1 / span 3", gridRow: 2 }}
            >
              <PointSystemFoundation layout="mobile" />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden gap-4 px-6 py-6 lg:grid lg:grid-cols-3">
        {THERAPY_POINT_COLUMNS.map((column, columnIndex) => (
          <PointSystemColumn key={columnIndex} column={column} />
        ))}
      </div>
    </>
  );
}

export function RecoveryProtocolContent({ teamLogoUrl }: { teamLogoUrl: string | null }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 overflow-hidden rounded-2xl bg-white px-0 py-6 shadow-[0_4px_40px_rgba(0,0,0,0.25)] sm:px-5 sm:py-8 lg:px-6 lg:space-y-5 lg:py-10 2xl:max-w-[1920px]">
      <header className="px-3 pb-1 text-center sm:px-0">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl lg:text-4xl">
          Matchday Recovery Protocol
        </h1>
        {teamLogoUrl && (
          <img
            src={teamLogoUrl}
            alt="Team logo"
            className="mx-auto mt-2 h-8 w-auto max-w-[120px] object-contain sm:h-9 sm:max-w-[140px]"
          />
        )}
      </header>

      <div className="overflow-hidden rounded-none border-0 border-slate-200 bg-gradient-to-b from-white to-slate-50/40 sm:rounded-xl sm:border sm:shadow-sm sm:ring-1 sm:ring-slate-100">
        <section aria-labelledby="protocol-heading" className="space-y-3 px-0 pb-4 pt-3 sm:px-4 sm:pt-4 sm:pb-5 lg:px-3 xl:px-4">
          <h2 id="protocol-heading" className="sr-only">
            Matchday protocol board
          </h2>

          <ProtocolDaysBoard />
        </section>

        <section
          aria-labelledby="point-system-heading"
          className="border-t border-slate-200 bg-slate-50/60 pb-1 lg:pb-0"
        >
          <div className="bg-white px-3 py-3 text-center sm:px-5 sm:py-4 lg:py-5">
            <h2
              id="point-system-heading"
              className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl lg:text-3xl"
            >
              Point System
            </h2>
          </div>

          <PointSystemBoard />

          <div
            aria-labelledby="foundation-heading"
            className="hidden border-t border-slate-200 px-6 py-4 lg:block"
          >
            <PointSystemFoundation />
          </div>
        </section>

        <section
          aria-labelledby="practical-guide-heading"
          className="mx-2 mt-5 rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 lg:mx-0 lg:mt-0 lg:rounded-none lg:border-0 lg:border-t lg:border-slate-200 lg:bg-transparent lg:shadow-none lg:ring-0"
        >
          <RecoveryPracticalGuide embedded />
        </section>
      </div>
    </div>
  );
}
