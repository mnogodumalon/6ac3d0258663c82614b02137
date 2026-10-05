import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Kunden {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde_vorname?: string;
    kunde_nachname?: string;
    handynummer?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
  };
}

export interface Fahrraeder {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    fahrradtyp?: LookupValue;
    marke?: string;
    rahmengroesse?: string;
    farbe?: string;
    tagespreis?: number;
    zustand?: LookupValue;
    verfuegbar?: boolean;
  };
}

export interface Ausleihen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde?: RecordUrl; // applookup -> URL zu 'Kunden' Record
    fahrrad?: RecordUrl; // applookup -> URL zu 'Fahrraeder' Record
    ausleihzeitpunkt?: string; // Format: YYYY-MM-DD oder ISO String
    rueckgabezeitpunkt?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    rechnungsbetrag?: number;
    bemerkung?: string;
  };
}

export const APP_IDS = {
  KUNDEN: '6ac3d00f18762d675a683835',
  FAHRRAEDER: '6ac3d0141a66eed5d70d9828',
  AUSLEIHEN: '6ac3d01592ea60b706611821',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'fahrraeder': {
    fahrradtyp: [{ key: "mountainbike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "mountainbike") ?? "Mountainbike"; } }, { key: "ebike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "ebike") ?? "E-Bike"; } }, { key: "rennrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "rennrad") ?? "Rennrad"; } }, { key: "kinderrad", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "kinderrad") ?? "Kinderrad"; } }, { key: "citybike", get label() { return lookupLabel('fahrraeder', 'fahrradtyp', "citybike") ?? "Citybike"; } }],
    zustand: [{ key: "sehr_gut", get label() { return lookupLabel('fahrraeder', 'zustand', "sehr_gut") ?? "Sehr gut"; } }, { key: "gut", get label() { return lookupLabel('fahrraeder', 'zustand', "gut") ?? "Gut"; } }, { key: "reparaturbeduerftig", get label() { return lookupLabel('fahrraeder', 'zustand', "reparaturbeduerftig") ?? "Reparaturbedürftig"; } }],
  },
  'ausleihen': {
    status: [{ key: "ausgeliehen", get label() { return lookupLabel('ausleihen', 'status', "ausgeliehen") ?? "Ausgeliehen"; } }, { key: "zurueckgegeben", get label() { return lookupLabel('ausleihen', 'status', "zurueckgegeben") ?? "Zurückgegeben"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'kunden': {
    'kunde_vorname': 'string/text',
    'kunde_nachname': 'string/text',
    'handynummer': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
  },
  'fahrraeder': {
    'bezeichnung': 'string/text',
    'fahrradtyp': 'lookup/select',
    'marke': 'string/text',
    'rahmengroesse': 'string/text',
    'farbe': 'string/text',
    'tagespreis': 'number',
    'zustand': 'lookup/radio',
    'verfuegbar': 'bool',
  },
  'ausleihen': {
    'kunde': 'applookup/select',
    'fahrrad': 'applookup/select',
    'ausleihzeitpunkt': 'date/datetimeminute',
    'rueckgabezeitpunkt': 'date/datetimeminute',
    'status': 'lookup/radio',
    'rechnungsbetrag': 'number',
    'bemerkung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateKunden = StripLookup<Kunden['fields']>;
export type CreateFahrraeder = StripLookup<Fahrraeder['fields']>;
export type CreateAusleihen = StripLookup<Ausleihen['fields']>;