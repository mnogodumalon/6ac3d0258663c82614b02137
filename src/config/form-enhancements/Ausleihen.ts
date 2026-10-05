// Auto-generated. Per-entity form-enhancements config for "Ausleihen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["kunde", "fahrrad"], "cols": "1fr 1fr"}, {"row": ["ausleihzeitpunkt", "rueckgabezeitpunkt"], "cols": "1fr 1fr"}, "status", "rechnungsbetrag", "bemerkung"],
  defaults: {
    'ausleihzeitpunkt': { kind: 'today', withTime: true },
    'status': { kind: 'lookup', key: 'ausgeliehen', label: 'Ausgeliehen' },
  },
  computed: {
    'rechnungsbetrag': { op: 'mul', left: { kind: 'dateDiff', from: 'ausleihzeitpunkt', to: 'rueckgabezeitpunkt', unit: 'days' }, right: { kind: 'applookup', ownKey: 'fahrrad', lookupKey: 'tagespreis' } },
    '_ausleihe_dauer_tage': { kind: 'dateDiff', from: 'ausleihzeitpunkt', to: 'rueckgabezeitpunkt', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
