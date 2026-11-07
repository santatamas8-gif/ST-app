"use client";

import { Fragment } from "react";
import { formatDrillNumber, formatDurationMinutes, reportHeadings } from "@/lib/drillAnalysis/format";
import { comparePrintMarks } from "@/lib/drillAnalysis/printMarks";
import { DRILL_METRICS, type DrillAnalysisModel, type DrillColumn, type DrillMetricKey } from "@/lib/drillAnalysis/types";

const PRINT_HEAD: { key: DrillMetricKey; label: string; unit: string }[] = [
  { key: "totalDistance", label: "TD", unit: "m" },
  { key: "tempoDistance", label: "Tempo", unit: "m" },
  { key: "hsr", label: "HSR", unit: "m" },
  { key: "sprintDistance", label: "Sprint", unit: "m" },
  { key: "distancePerMin", label: "m/min", unit: "" },
  { key: "accelerations", label: "Acc", unit: "" },
  { key: "decelerations", label: "Dec", unit: "" },
];

function blockWeight(setLabels: string[]): number {
  const single = setLabels.length === 1 && !setLabels[0];
  return setLabels.reduce((sum, label) => sum + (label ? 1 : 0) + DRILL_METRICS.length, 0) + (single ? 1 : 0);
}

function playerFigures(column: DrillColumn, player: string, values: DrillAnalysisModel["playerValues"]): { duration: string; numbers: string[] } {
  const slice = column.missing ? undefined : values[column.occurrenceKey]?.[player];
  return {
    duration: formatDurationMinutes(slice?.durationMinutes ?? null),
    numbers: DRILL_METRICS.map((metric) => formatDrillNumber(slice?.metrics[metric.key] ?? null)),
  };
}

function PlayerHead({ name, photo, duration }: { name: string; photo: string | null; duration: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="da-compare-photo h-11 w-11 rounded-full object-cover" />
      ) : (
        <span className="da-compare-photo h-11 w-11" />
      )}
      <p className="w-full truncate text-xs font-semibold text-[#11243B] sm:text-sm" title={name}>{name}</p>
      {duration ? <p className="text-[11px] font-medium text-zinc-500">{duration}</p> : null}
    </div>
  );
}

function MetricName({ label, unit }: { label: string; unit: string }) {
  return (
    <>
      {label}
      {unit ? <span className="da-cr-u">{unit}</span> : null}
    </>
  );
}

function PrintDuration({
  markA,
  markB,
  durationA,
  durationB,
}: {
  markA: string;
  markB: string;
  durationA: string;
  durationB: string;
}) {
  const blank = (value: string) => value === "" || value === "—";
  if (blank(durationA) && blank(durationB)) return null;
  if (durationA === durationB) return <span className="da-cr-mins"> {durationA}</span>;
  return (
    <>
      {" "}
      <span className="da-cr-a">{markA}</span>
      <span className="da-cr-mins"> {durationA} </span>
      <span className="da-cr-b">{markB}</span>
      <span className="da-cr-mins"> {durationB}</span>
    </>
  );
}

function PrintSummary({
  title,
  columns,
  playerA,
  playerB,
  markA,
  markB,
  values,
}: {
  title: string;
  columns: DrillColumn[];
  playerA: string;
  playerB: string;
  markA: string;
  markB: string;
  values: DrillAnalysisModel["playerValues"];
}) {
  return (
    <>
      {columns.map((column) => {
        const a = playerFigures(column, playerA, values);
        const b = playerFigures(column, playerB, values);
        return (
          <section key={column.occurrenceKey} className="da-cr-ft">
            <h2>
              {columns.length > 1 ? `${title} · ${column.label}` : title}
              <PrintDuration markA={markA} markB={markB} durationA={a.duration} durationB={b.duration} />
            </h2>
            <table>
              <thead>
                <tr>
                  <th />
                  {PRINT_HEAD.map((metric) => (
                    <th key={metric.key}>
                      <MetricName label={metric.label} unit={metric.unit} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>{playerA}</th>
                  {a.numbers.map((value, index) => (
                    <td key={PRINT_HEAD[index]!.key}>{value}</td>
                  ))}
                </tr>
                <tr>
                  <th>{playerB}</th>
                  {b.numbers.map((value, index) => (
                    <td key={PRINT_HEAD[index]!.key}>{value}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

function PrintDrill({
  title,
  imageUrl,
  note,
  columns,
  setLabels,
  playerA,
  playerB,
  markA,
  markB,
  values,
}: {
  title: string;
  imageUrl: string | null;
  note: string | null;
  columns: DrillColumn[];
  setLabels: string[];
  playerA: string;
  playerB: string;
  markA: string;
  markB: string;
  values: DrillAnalysisModel["playerValues"];
}) {
  const sets = columns.map((column, index) => ({
    key: column.occurrenceKey,
    label: setLabels[index] ?? "",
    a: playerFigures(column, playerA, values),
    b: playerFigures(column, playerB, values),
  }));
  const namedSets = sets.some((set) => set.label);
  return (
    <article className="da-cr-card">
      <h2>
        {title}
        {!namedSets && sets[0] ? (
          <PrintDuration markA={markA} markB={markB} durationA={sets[0].a.duration} durationB={sets[0].b.duration} />
        ) : null}
      </h2>
      {note ? <p className="da-cr-note">{note}</p> : null}
      <div className="da-cr-body">
        <div className="da-cr-frame">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" />
          ) : null}
        </div>
        <table>
          <thead>
            {namedSets ? (
              <tr>
                <th />
                {sets.map((set, index) => (
                  <th key={set.key} colSpan={2} className={index > 0 ? "da-cr-split" : undefined}>
                    {set.label}
                    <PrintDuration markA={markA} markB={markB} durationA={set.a.duration} durationB={set.b.duration} />
                  </th>
                ))}
              </tr>
            ) : null}
            <tr>
              <th />
              {sets.map((set, index) => (
                <Fragment key={`${set.key}-who`}>
                  <th className={index > 0 ? "da-cr-a da-cr-split" : "da-cr-a"}>{markA}</th>
                  <th className="da-cr-b">{markB}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRINT_HEAD.map((metric, metricIndex) => (
              <tr key={metric.key}>
                <th>
                  <MetricName label={metric.label} unit={metric.unit} />
                </th>
                {sets.map((set, index) => (
                  <Fragment key={set.key}>
                    <td className={index > 0 ? "da-cr-split" : undefined}>{set.a.numbers[metricIndex]}</td>
                    <td>{set.b.numbers[metricIndex]}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ScreenDuration({
  markA,
  markB,
  durationA,
  durationB,
}: {
  markA: string;
  markB: string;
  durationA: string;
  durationB: string;
}) {
  const blank = (value: string) => value === "" || value === "—";
  if (blank(durationA) && blank(durationB)) return null;
  if (durationA === durationB) return <span className="da-cs-mins">{durationA}</span>;
  return (
    <>
      <span className="da-cs-a">{markA}</span>
      <span className="da-cs-mins"> {durationA} </span>
      <span className="da-cs-b">{markB}</span>
      <span className="da-cs-mins"> {durationB}</span>
    </>
  );
}

function ScreenSummary({
  columns,
  playerA,
  playerB,
  values,
}: {
  columns: DrillColumn[];
  playerA: string;
  playerB: string;
  values: DrillAnalysisModel["playerValues"];
}) {
  if (columns.length === 0) return null;
  return (
    <>
      {columns.map((column) => {
        const a = playerFigures(column, playerA, values);
        const b = playerFigures(column, playerB, values);
        const title = columns.length > 1 ? `Full Training · ${column.label}` : "Full Training";
        return (
          <section key={column.occurrenceKey} className="min-w-0 lg:col-span-2">
            <h2 className="mb-1 text-[15px] font-bold leading-tight text-[#11243B]">{title}</h2>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-[15px] leading-snug">
                <thead>
                  <tr className="bg-[#f4f7f8] text-[#11243B]">
                    <th className="sticky left-0 z-10 bg-[#f4f7f8] px-2 py-1.5 text-left text-sm font-semibold" />
                    {PRINT_HEAD.map((metric) => (
                      <th
                        key={metric.key}
                        className="px-2 py-1.5 text-right text-sm font-semibold"
                        title={DRILL_METRICS.find((item) => item.key === metric.key)?.label ?? metric.label}
                      >
                        {metric.label}
                        {metric.unit ? <span className="da-cs-mins"> {metric.unit}</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: playerA, figures: a },
                    { name: playerB, figures: b },
                  ].map((row, rowIndex) => (
                    <tr key={row.name} className={rowIndex === 1 ? "bg-[#f7f7f8]" : "bg-white"}>
                      <th className={`sticky left-0 z-10 whitespace-nowrap px-2 py-1.5 text-left text-[15px] font-semibold text-[#11243B] ${rowIndex === 1 ? "bg-[#f7f7f8]" : "bg-white"}`}>
                        {row.name}
                        {row.figures.duration !== "—" ? (
                          <span className="da-cs-mins ml-2 text-sm">{row.figures.duration}</span>
                        ) : null}
                      </th>
                      {row.figures.numbers.map((value, index) => (
                        <td key={PRINT_HEAD[index]!.key} className="px-2 py-1.5 text-right text-[15px] font-bold tabular-nums text-zinc-900">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

function ScreenDrill({
  title,
  imageUrl,
  note,
  columns,
  setLabels,
  playerA,
  playerB,
  markA,
  markB,
  values,
}: {
  title: string;
  imageUrl: string | null;
  note: string | null;
  columns: DrillColumn[];
  setLabels: string[];
  playerA: string;
  playerB: string;
  markA: string;
  markB: string;
  values: DrillAnalysisModel["playerValues"];
}) {
  const sets = columns.map((column, index) => ({
    key: column.occurrenceKey,
    label: setLabels[index] ?? "",
    a: playerFigures(column, playerA, values),
    b: playerFigures(column, playerB, values),
  }));
  const grouped = sets.length > 1;
  const titleDuration =
    !grouped && sets[0] ? (
      <ScreenDuration markA={markA} markB={markB} durationA={sets[0].a.duration} durationB={sets[0].b.duration} />
    ) : null;
  return (
    <article className="da-cs-card min-w-0 overflow-hidden rounded-md border border-[#d5dee6] bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 bg-[#e7eef3] px-2.5 py-1.5">
        <h2 className={`min-w-0 break-words text-[15px] font-bold leading-snug text-[#11243B] ${titleDuration ? "" : "col-span-2"}`}>
          {title}
        </h2>
        {titleDuration ? <div className="whitespace-nowrap text-right text-sm leading-snug">{titleDuration}</div> : null}
      </div>
      {note ? <p className="px-2.5 pt-1 text-sm leading-5 text-zinc-600">{note}</p> : null}
      <div className={imageUrl ? "grid grid-cols-1 items-start gap-2 p-2 lg:grid-cols-[30%_minmax(0,1fr)]" : "p-2"}>
        {imageUrl ? (
          <div className="flex items-start justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="mx-auto block h-auto max-w-full object-contain object-center max-lg:max-h-44 max-lg:w-auto lg:w-full"
            />
          </div>
        ) : null}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[15px] leading-snug">
            <thead>
              {grouped ? (
                <tr className="bg-[#f4f7f8] text-[#11243B]">
                  <th className="sticky left-0 z-10 bg-[#f4f7f8] px-2 py-1.5" />
                  {sets.map((set, index) => (
                    <th
                      key={set.key}
                      colSpan={2}
                      className={`px-2 py-1.5 text-center text-sm font-semibold ${index > 0 ? "border-l-2 border-[#c5d0da]" : ""}`}
                    >
                      {set.label ? <span>{set.label}</span> : null}
                      {set.label ? " " : null}
                      <ScreenDuration markA={markA} markB={markB} durationA={set.a.duration} durationB={set.b.duration} />
                    </th>
                  ))}
                </tr>
              ) : null}
              <tr className="bg-[#f4f7f8] text-sm">
                <th className="sticky left-0 z-10 bg-[#f4f7f8] px-2 py-1.5 text-left font-semibold text-[#11243B]">Metric</th>
                {sets.map((set, index) => (
                  <Fragment key={`${set.key}-who`}>
                    <th className={`da-cs-a px-2 py-1.5 text-center ${index > 0 ? "border-l-2 border-[#c5d0da]" : ""}`}>{markA}</th>
                    <th className="da-cs-b px-2 py-1.5 text-center">{markB}</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {DRILL_METRICS.map((metric, metricIndex) => {
                const shaded = metricIndex % 2 === 1;
                const rowBg = shaded ? "bg-[#f7f7f8]" : "bg-white";
                const unit = PRINT_HEAD[metricIndex]?.unit;
                return (
                  <tr key={metric.key} className={rowBg}>
                    <th className={`sticky left-0 z-10 ${rowBg} px-2 py-1.5 text-left text-[15px] font-medium text-zinc-800`}>
                      {metric.label}
                      {unit ? <span className="da-cs-mins"> {unit}</span> : null}
                    </th>
                    {sets.map((set, index) => (
                      <Fragment key={set.key}>
                        <td className={`px-2 py-1.5 text-center text-[15px] font-bold tabular-nums text-zinc-900 ${index > 0 ? "border-l-2 border-[#c5d0da]" : ""}`}>
                          {set.a.numbers[metricIndex]}
                        </td>
                        <td className="px-2 py-1.5 text-center text-[15px] font-bold tabular-nums text-zinc-900">{set.b.numbers[metricIndex]}</td>
                      </Fragment>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

export function DrillCompare({
  model,
  playerA,
  playerB,
  photos,
  ready,
}: {
  model: DrillAnalysisModel;
  playerA: string;
  playerB: string;
  photos: Record<string, string>;
  ready: boolean;
}) {
  if (!ready) return <p className="text-sm text-zinc-700">Loading the selected session…</p>;
  if (!playerA || !playerB || playerA === playerB) {
    return <p className="text-sm text-zinc-700">Choose two different players from this session.</p>;
  }

  const photoA = photos[playerA] ?? null;
  const photoB = photos[playerB] ?? null;
  const [markA, markB] = comparePrintMarks(playerA, playerB);
  const drills = model.cards.map((card) => {
    const headings = reportHeadings(card.displayName, card.columns.map((column) => column.label));
    const several = card.columns.length > 1;
    const note =
      card.missingCount > 0
        ? "A saved drill is no longer in the source."
        : card.columns.some((column) => column.hasPlayerConflict)
          ? "Repeated rows disagreed, so those values are blank."
          : null;
    return {
      key: card.id,
      title: headings.title,
      imageUrl: card.hasImage ? `/api/drill-analysis/image?cardId=${card.id}` : null,
      note,
      columns: card.columns,
      setLabels: several ? card.columns.map((column, index) => headings.columnLabels[index] || column.label) : card.columns.map(() => ""),
    };
  });

  const rows = model.fullTraining.columns.length + drills.length;
  const totalWeight =
    model.fullTraining.columns.reduce((sum) => sum + blockWeight([""]), 0) +
    drills.reduce((sum, drill) => sum + blockWeight(drill.setLabels), 0);

  return (
    <div className="da-compare-sheet min-w-0" style={{ ["--da-weight-total" as string]: String(Math.max(1, totalWeight)) }}>
    <div className="da-compare-print-head da-print-only">
      <div className="da-compare-drill-slot" />
      <div className="da-compare-table-wrap">
        <table className="da-compare-table w-full border-collapse border border-zinc-300 text-sm">
          <thead>
            <tr>
              <th className="border border-zinc-300 bg-white px-3 py-2" />
              <th className="w-28 border border-zinc-300 bg-white px-2 py-2 align-bottom">
                <PlayerHead name={playerA} photo={photoA} duration="" />
              </th>
              <th className="w-28 border border-zinc-300 bg-white px-2 py-2 align-bottom">
                <PlayerHead name={playerB} photo={photoB} duration="" />
              </th>
            </tr>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 px-3 py-1.5 text-left text-xs font-semibold text-[#11243B]">Metric</th>
              <th className="border border-zinc-300 px-2 py-1.5 text-right text-xs font-semibold text-[#11243B]">Value</th>
              <th className="border border-zinc-300 px-2 py-1.5 text-right text-xs font-semibold text-[#11243B]">Value</th>
            </tr>
          </thead>
        </table>
      </div>
    </div>
    <div
      className="da-compare-grid grid w-full min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-2"
      style={{ ["--da-compare-rows" as string]: String(Math.max(1, rows)) }}
    >
      {model.fullTraining.status === "missing" ? (
        <p className="text-sm text-zinc-700 lg:col-span-2">No Full Training row for this session.</p>
      ) : null}
      {model.fullTraining.status === "repeated" ? (
        <p className="text-sm text-zinc-600 lg:col-span-2">Full Training rows are shown separately and are not added together.</p>
      ) : null}
      <ScreenSummary
        columns={model.fullTraining.columns}
        playerA={playerA}
        playerB={playerB}
        values={model.playerValues}
      />
      {drills.map((drill) => (
        <ScreenDrill
          key={drill.key}
          title={drill.title}
          imageUrl={drill.imageUrl}
          note={drill.note}
          columns={drill.columns}
          setLabels={drill.setLabels}
          playerA={playerA}
          playerB={playerB}
          markA={markA}
          markB={markB}
          values={model.playerValues}
        />
      ))}
    </div>
    <div className="da-cr da-print-only">
      {model.fullTraining.status === "missing" ? <p className="da-cr-note">No Full Training row for this session.</p> : null}
      {model.fullTraining.status === "repeated" ? (
        <p className="da-cr-note">Full Training rows are shown separately and are not added together.</p>
      ) : null}
      <PrintSummary
        title="Full Training"
        columns={model.fullTraining.columns}
        playerA={playerA}
        playerB={playerB}
        markA={markA}
        markB={markB}
        values={model.playerValues}
      />
      <div className="da-cr-drills">
        {drills.map((drill) => (
          <PrintDrill
            key={drill.key}
            title={drill.title}
            imageUrl={drill.imageUrl}
            note={drill.note}
            columns={drill.columns}
            setLabels={drill.setLabels}
            playerA={playerA}
            playerB={playerB}
            markA={markA}
            markB={markB}
            values={model.playerValues}
          />
        ))}
      </div>
    </div>
    </div>
  );
}
