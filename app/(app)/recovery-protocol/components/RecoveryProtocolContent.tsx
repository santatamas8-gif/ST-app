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

function FoundationPill({ item, enlarged = false }: { item: FoundationItem; enlarged?: boolean }) {
  const Icon = FOUNDATION_ICONS[item.icon];

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-blue-100 ${enlarged ? "h-9 w-9" : "h-8 w-8"}`}
      >
        <Icon className={`text-blue-700 ${enlarged ? "h-[18px] w-[18px]" : "h-4 w-4"}`} aria-hidden />
      </span>
      <span
        className={`font-semibold leading-snug text-slate-800 ${enlarged ? "text-sm sm:text-[15px]" : "text-xs sm:text-[13px]"}`}
      >
        {item.label}
      </span>
    </div>
  );
}

const RECOVERY_ICON_SIZE = 32;
const POINT_SYSTEM_ICON_SIZE = 36;
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

function ProtocolActionItem({ action, compact = false }: { action: string; compact?: boolean }) {
  if (compact) {
    return (
      <li className="flex items-center gap-1">
        <span className="shrink-0">
          <ActionIcon
            render={resolveRecoveryIcon(action)}
            size={FOOTER_ICON_SIZE}
            lucideClassName={footerNoteIconClass}
          />
        </span>
        <span className={footerNoteTextClass}>{action}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
      <span className="shrink-0">
        <RecoveryListIcon label={action} />
      </span>
      <span className="min-w-0 pt-1">{action}</span>
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

function ProtocolDayCard({ day }: { day: ProtocolDay }) {
  const mainActions = day.keyActions.filter((action) => !isAvoidRecoveryAction(action));
  const footerActions = day.keyActions.filter(isAvoidRecoveryAction);

  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${day.accent.cardBorder}`}
    >
      <div className={`flex flex-col ${day.accent.header}`}>
        <div className="px-3.5 py-2.5 text-center xl:px-4">
          <span className={`text-lg font-bold tracking-wide sm:text-xl ${day.accent.headerText}`}>{day.label}</span>
        </div>
        <div className="px-3.5 pb-2.5 text-center xl:px-4">
          <span className="inline-block rounded-md border-2 border-white bg-white px-2.5 py-0.5 text-sm font-bold tabular-nums text-slate-900 shadow-sm">
            {day.pointGoal} pts
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3.5 py-3 xl:px-4">
        <ul className="space-y-2">
          {mainActions.map((action) => (
            <ProtocolActionItem key={action} action={action} />
          ))}
        </ul>
        {footerActions.length > 0 && (
          <ul className="mt-auto space-y-2 border-t border-slate-100 pt-2.5">
            {footerActions.map((action) => (
              <ProtocolActionItem key={action} action={action} compact />
            ))}
          </ul>
        )}
        {day.id === "md" && day.focus && <ProtocolFooterNote text={day.focus} />}
      </div>
    </article>
  );
}

function PhaseTimelineStrip() {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-slate-200 lg:grid lg:grid-cols-7">
      {PHASE_TIMELINE.map((segment) => (
        <div
          key={segment.id}
          className={`flex items-center justify-center px-2 py-2.5 ${segment.bar}`}
          style={{ gridColumn: `span ${segment.span}` }}
        >
          <span className={`text-xs font-bold uppercase tracking-wider ${segment.barText}`}>{segment.label}</span>
        </div>
      ))}
    </div>
  );
}

function TherapyPointRow({ item }: { item: TherapyPoint }) {
  const tier = getTherapyPointTier(item.points);

  return (
    <div className={`flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0 sm:px-4 ${tier.rowBorder}`}>
      <RecoveryListIcon label={item.name} size={POINT_SYSTEM_ICON_SIZE} />
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800 sm:text-[15px]">
        {item.name}
      </span>
      <span
        className={`shrink-0 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums sm:text-[15px] ${tier.pointsBg} ${tier.pointsText}`}
      >
        {item.points}
      </span>
    </div>
  );
}

export function RecoveryProtocolContent({ teamLogoUrl }: { teamLogoUrl: string | null }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 rounded-2xl bg-white px-4 py-8 shadow-[0_4px_40px_rgba(0,0,0,0.25)] sm:px-5 sm:py-10 lg:px-6 lg:space-y-5 2xl:max-w-[1920px]">
      <header className="pb-1 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
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

      <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 shadow-sm ring-1 ring-slate-100">
        <section aria-labelledby="protocol-heading" className="space-y-3 overflow-x-auto px-3 pb-4 pt-3 sm:space-y-3 sm:px-4 sm:pt-4 sm:pb-5 lg:px-3 xl:px-4">
          <h2 id="protocol-heading" className="sr-only">
            Matchday protocol board
          </h2>

          <div className="hidden min-w-0 gap-2 lg:grid lg:grid-cols-7 lg:items-stretch xl:gap-3">
            {PROTOCOL_DAYS.map((day) => (
              <ProtocolDayCard key={day.id} day={day} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {PROTOCOL_DAYS.map((day) => (
              <ProtocolDayCard key={day.id} day={day} />
            ))}
          </div>

          <PhaseTimelineStrip />
        </section>

        <section
          aria-labelledby="point-system-heading"
          className="mx-4 mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 shadow-sm sm:mx-5 sm:mt-5"
        >
          <div className="bg-white px-4 py-4 text-center sm:px-5 sm:py-5">
            <h2
              id="point-system-heading"
              className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl"
            >
              Point System
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-3 lg:gap-4 lg:px-6 lg:py-6">
            {THERAPY_POINT_COLUMNS.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {column.map((item) => (
                  <TherapyPointRow key={item.name} item={item} />
                ))}
              </div>
            ))}
          </div>

          <div aria-labelledby="foundation-heading" className="border-t border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6">
            <h2 id="foundation-heading" className="sr-only">
              Foundation of recovery
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:gap-x-6">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100"
                title="Important"
              >
                <CircleAlert className="h-[18px] w-[18px] text-red-600" aria-hidden />
              </span>
              {FOUNDATION_ITEMS.map((item) => (
                <FoundationPill key={item.label} item={item} enlarged />
              ))}
            </div>
            <p className="mt-2.5 text-xs leading-snug text-slate-500 sm:text-[13px]">{FOUNDATION_WARNING}</p>
          </div>
        </section>
      </div>

      <RecoveryPracticalGuide />
    </div>
  );
}
