// Auto-generated. Per-entity form-enhancements config for "Fahrräder".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["bezeichnung", {"row": ["fahrradtyp", "tagespreis"], "cols": "1fr 1fr"}, {"row": ["marke", "rahmengroesse"], "cols": "2fr 1fr"}, "farbe", "zustand", "verfuegbar"],
  defaults: {
    'verfuegbar': { kind: 'literal', value: true },
    'zustand': { kind: 'lookup', key: 'gut', label: 'Gut' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
