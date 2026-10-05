/**
 * useFahrradAusleihenFlow — the plumbing of the flow « Fahrrad ausleihen », generated from the plan.
 *
 * Writes `ausleihen`: asks `kunde`, `fahrrad`, `bemerkung`, `rueckgabezeitpunkt`; sets `ausleihzeitpunkt`, `status` itself.
Changes `fahrraeder`: the record to change is picked (`flow.pick('fahrraeder')`), the form is prefilled with its values; ; sets `verfuegbar` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 5)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useFahrradAusleihenFlow({
 *     steps: { fahrraeder: 1, kunde: 2, fahrrad: 3, bemerkung: 4, rueckgabezeitpunkt: 4 },
 *     items: { kunde: r => ({ id: r.id, title: fieldText(r, 'kunde_vorname') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.kunde.select} {...flow.pick('kunde')} />
 *     <EntitySelectStep {...flow.picks.fahrrad.select} {...flow.pick('fahrrad')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.fahrraeder.select} {...flow.pick('fahrraeder')} />
 *     <Bound form={flow.forms.ausleihen} name="bemerkung" />
 *     <Bound form={flow.forms.ausleihen} name="rueckgabezeitpunkt" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type FahrradAusleihenFieldKey = 'bemerkung' | 'fahrrad' | 'fahrraeder' | 'kunde' | 'rueckgabezeitpunkt';

export interface FahrradAusleihenForms {
  ausleihen: StepForm<'ausleihen'>;
  fahrraeder: StepForm<'fahrraeder'>;
}

// Alias so the option generics stay readable.
type Key = FahrradAusleihenFieldKey;

export interface FahrradAusleihenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    kunde?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    fahrrad?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    fahrraeder?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"bemerkung": 4, "fahrrad": 3, "fahrraeder": 1, "kunde": 2, "rueckgabezeitpunkt": 4};
export const FAHRRADAUSLEIHEN_REVIEW_STEP = 5;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useFahrradAusleihenFlow(options: FahrradAusleihenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [fahrraederTargetId, setFahrraederTargetId] = useState<string | null>(null);
  const ausleihen = useStepForm('ausleihen', {
    fields: ["kunde", "fahrrad", "bemerkung", "rueckgabezeitpunkt"],
    steps: only(steps, ["kunde", "fahrrad", "bemerkung", "rueckgabezeitpunkt"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { fahrrad: true, rueckgabezeitpunkt: true },
    initial: only(options.initial as FormValues | undefined, ["kunde", "fahrrad", "bemerkung", "rueckgabezeitpunkt"]),
    messages: only(options.messages as Record<string, string> | undefined, ["kunde", "fahrrad", "bemerkung", "rueckgabezeitpunkt"]),
  });
  const fahrraeder = useStepForm('fahrraeder', {
    fields: [],
    steps: only(steps, []) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, []),
    messages: only(options.messages as Record<string, string> | undefined, []),
  });
  const forms: FahrradAusleihenForms = { ausleihen, fahrraeder };
  const formList: StepForm[] = [ausleihen, fahrraeder];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    kunde: useRecordSearch(servicePort, 'kunden', withPickPolicy('kunde', {
      searchFields: ["kunde_vorname", "kunde_nachname", "handynummer"] as never,
      toItem: options.items?.kunde as never,
    })),
    fahrrad: useRecordSearch(servicePort, 'fahrraeder', withPickPolicy('fahrrad', {
      searchFields: ["bezeichnung"] as never,
      filter: "r.v_verfuegbar == True",
      where: (r: JourneyRecord) => r.fields["verfuegbar"] === true,
      toItem: options.items?.fahrrad as never,
    })),
    fahrraeder: useRecordSearch(servicePort, 'fahrraeder', withPickPolicy('fahrraeder', {
      searchFields: ["bezeichnung"] as never,
      filter: "r.v_verfuegbar == True",
      where: (r: JourneyRecord) => r.fields["verfuegbar"] === true,
      toItem: options.items?.fahrraeder as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:fahrrad-ausleihen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:fahrrad-ausleihen:write:${entity}.${field}`,
  });
  const picks = {
    kunde: { ...searches.kunde, select: { ...searches.kunde.select, create: false as boolean, hint: hintFor('kunde', 'kunden', null as PickWhere | null) } },
    fahrrad: { ...searches.fahrrad, select: { ...searches.fahrrad.select, create: false as boolean, hint: hintFor('fahrrad', 'fahrraeder', {"conditions": [{"field": "verfuegbar", "op": "eq", "value": "true"}], "mode": "all"} as PickWhere | null) } },
    fahrraeder: { ...searches.fahrraeder, select: { ...searches.fahrraeder.select, create: false as boolean, hint: hintFor('fahrraeder', 'fahrraeder', {"conditions": [{"field": "verfuegbar", "op": "eq", "value": "true"}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'ausleihen', entity: 'ausleihen', form: ausleihen, primary: true,
      values: (): FormValues => ({
        ausleihzeitpunkt: policyFixedValue('ausleihen', 'ausleihzeitpunkt') ?? nowIso(),
        status: policyFixedValue('ausleihen', 'status') ?? "ausgeliehen",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('ausleihen', 'status', policyFixedValue('ausleihen', 'status') ?? "ausgeliehen")],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "weiterhin", "id": "reparatur-ausleihe", "question": "D\u00fcrfen reparaturbed\u00fcrftige R\u00e4der verliehen werden?"}],
    },
    {
      key: 'fahrraeder', entity: 'fahrraeder', form: fahrraeder,
      updates: () => fahrraederTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => fahrraederTargetId
        ? { key: 'target:fahrraeder', label: entityLabel('fahrraeder'), value: picks.fahrraeder.labelOf(fahrraederTargetId) ?? fahrraederTargetId, step: steps.fahrraeder }
        : undefined,
      values: (): FormValues => ({
        verfuegbar: policyFixedValue('fahrraeder', 'verfuegbar') ?? false,
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('fahrraeder', 'verfuegbar', policyFixedValue('fahrraeder', 'verfuegbar') ?? false)],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'fahrrad-ausleihen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    fahrraeder: {
      selectedId: fahrraederTargetId,
      onSelect: (id: string) => {
        setFahrraederTargetId(id);
        const rec = picks.fahrraeder.recordOf(id);
        if (rec) fahrraeder.reset({ });
      },
      get record(): JourneyRecord | undefined { return fahrraederTargetId ? picks.fahrraeder.recordOf(fahrraederTargetId) : undefined; },
    },
  };
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: FahrradAusleihenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: FahrradAusleihenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setFahrraederTargetId(null); };

  return {
    slug: 'fahrrad-ausleihen' as const,
    draftKey: 'fahrrad-ausleihen' as const,
    entity: 'ausleihen' as const,
    form: ausleihen,
    forms, formList, picks, submit, steps, targets,    reviewStep: FAHRRADAUSLEIHEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type FahrradAusleihenFlow = ReturnType<typeof useFahrradAusleihenFlow>;
