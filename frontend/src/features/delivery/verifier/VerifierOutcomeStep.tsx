import {
  ALLOWED_BY_RESULT,
  colourClass,
  dispositionMeta,
  type Disposition,
} from "@/features/workflow-ui/colour-codes";
import type { ColourMatrix } from "@/lib/backend-api/workflow";
import { humanize } from "../utils";
import { StepIntro } from "./verification-steps";
import { MIN_SUMMARY } from "./verification-readiness";
import type { VerifierResult } from "./verifier-draft";

type ScenarioItem = ColourMatrix["matrix"][string][number];

/** Step 3 UI: colour-matrix selection, result/disposition controls, and source summary. */
export function VerifierOutcomeStep({
  scenarios,
  scenarioId,
  scenario,
  matrix,
  result,
  chosenColour,
  sourceSummary,
  summaryDone,
  onSelectScenario,
  onChangeResult,
  onSelectColour,
  onChangeSummary,
}: {
  scenarios: ScenarioItem[];
  scenarioId: string;
  scenario: ScenarioItem | undefined;
  matrix: ColourMatrix | undefined;
  result: VerifierResult;
  chosenColour: Disposition | null;
  sourceSummary: string;
  summaryDone: boolean;
  onSelectScenario: (id: string, picked?: ScenarioItem, currentMatrix?: ColourMatrix) => void;
  onChangeResult: (value: VerifierResult) => void;
  onSelectColour: (value: Disposition) => void;
  onChangeSummary: (value: string) => void;
}) {
  const colourOptions = ALLOWED_BY_RESULT[result] ?? [];

  return (
    <>
      <StepIntro number={3} title="Choose the outcome and write the summary">
        Pick what you found from the colour matrix, confirm the colour and describe the source,
        method, date and response in your own words.
      </StepIntro>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Verification outcome</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Choose the defensible result supported by your source record.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
            Required
          </span>
        </div>
        {scenarios.length ? (
          <label className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-[12.5px]">
            <span className="font-semibold text-slate-800">
              What did you find?{" "}
              <small className="font-normal text-slate-500">(standard colour matrix)</small>
            </span>
            <select
              value={scenarioId}
              aria-label="What did you find"
              onChange={(event) => {
                const nextId = event.target.value;
                const picked = scenarios.find((item) => item.id === nextId);
                onSelectScenario(nextId, picked, matrix);
              }}
              className="h-10 w-full min-w-0 truncate rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] font-normal text-slate-800"
            >
              <option value="">Choose the situation…</option>
              {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((colour) =>
                scenarios.some((item) => item.colour === colour) ? (
                  <optgroup key={colour} label={dispositionMeta[colour].name}>
                    {scenarios
                      .filter((item) => item.colour === colour)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text}
                        </option>
                      ))}
                  </optgroup>
                ) : null,
              )}
            </select>
            {scenario ? (
              <span className="text-[12px] font-normal text-slate-500">
                Colour set to {dispositionMeta[scenario.colour as Disposition].name} as per the
                matrix. You can still adjust below.
              </span>
            ) : null}
          </label>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as VerifierResult[]).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => onChangeResult(value)}
              aria-pressed={result === value}
              className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${result === value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"}`}
            >
              {humanize(value)}
            </button>
          ))}
        </div>
        <div className="mt-3" role="radiogroup" aria-label="Outcome">
          <p className="text-[12.5px] font-semibold text-slate-800">Outcome for the report</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colourOptions.map((value) => (
              <button
                type="button"
                role="radio"
                key={value}
                aria-checked={chosenColour === value}
                onClick={() => onSelectColour(value)}
                className={`colour-option ${colourClass(value)} ${chosenColour === value ? "is-selected" : ""}`}
              >
                <i aria-hidden />
                {value === "CLIENT_REVIEW"
                  ? dispositionMeta[value].label
                  : `${dispositionMeta[value].name} · ${dispositionMeta[value].label}`}
              </button>
            ))}
          </div>
        </div>
      </section>
      <label className="block rounded-2xl border border-slate-200 bg-white p-4 text-[13px] font-semibold text-slate-900 shadow-sm">
        <span className="flex items-center justify-between gap-2">
          Source summary
          <span
            className={`text-[11.5px] font-medium ${summaryDone ? "text-emerald-700" : "text-slate-500"}`}
          >
            {sourceSummary.trim().length}/{MIN_SUMMARY} characters minimum
          </span>
        </span>
        <textarea
          value={sourceSummary}
          onChange={(event) => onChangeSummary(event.target.value)}
          rows={4}
          placeholder="Source, verification method, dates and response received"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[12.5px] font-normal leading-relaxed outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
        {scenario && !sourceSummary.trim() ? (
          <button
            type="button"
            onClick={() => onChangeSummary(`${scenario.text}. `)}
            className="mt-1 text-[12px] font-medium text-blue-700 hover:underline"
          >
            Start from “{scenario.text}”
          </button>
        ) : null}
      </label>
    </>
  );
}
