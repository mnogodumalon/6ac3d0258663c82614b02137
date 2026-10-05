// The orchestrator's plan, as far as the running app needs it
// (docs/orchestrator/SPEC.md). Generated — do not edit; regenerated on every
// build and update from the stored plan. Without a plan every map is empty.
//
//   SYSTEM_ASSIGNED entity → fields a tool fills when a record is CREATED — the
//                   value does not exist before; dialogs hide these on create and
//                   the form-polish sets no default on them. A scheduled or
//                   update-triggered tool owns its field but is NOT in here.
//   PLAN_SENTENCES  slug → the plan in the owner's words (flows' field page)
//
// The runtime write guard (FLOW_WRITES/OWNERSHIP, planGuard.ts) left on
// 23.09.2026: a flow page composes against its generated hook, whose submit
// plan IS the Schreibliste — there is no way to spell a write outside it.

export const SYSTEM_ASSIGNED: Record<string, string[]> = {};

export const PLAN_SENTENCES: Record<string, string[]> = {
  "ausleihe-erfassen": [
    "Legt an: ausleihen",
    "Ändert: fahrraeder",
    "Automatisch: ausleihzeitpunkt (aktueller Zeitpunkt, automatisch), status (fester Wert „ausgeliehen“), verfuegbar (fester Wert „false“)"
  ],
  "rueckgabe-buchen": [
    "Ändert: ausleihen, fahrraeder",
    "Automatisch: rueckgabezeitpunkt (aktueller Zeitpunkt, automatisch), status (fester Wert „zurueckgegeben“), rechnungsbetrag (Tagespreis des Fahrrads mal angefangene Leihtage zwischen Ausleihzeitpunkt und Rückgabe …), verfuegbar (fester Wert „true“)"
  ]
};

export const PLAN_SUMMARY = "Eine Verwaltung für einen kleinen Fahrradverleih: Kunden, Fahrräder und Ausleihen mit Rückgabe und Rechnungsbetrag. Die gewünschte SMS an Kunden kann die Plattform nicht versenden.";

/** slug → the lists a flow writes (the plan's Schreibliste). The nav leaves a
 *  flow out for a user who may not write one of them (lib/permissions.ts). */
export const FLOW_ENTITIES: Record<string, string[]> = {
  "ausleihe-erfassen": [
    "ausleihen",
    "fahrraeder"
  ],
  "rueckgabe-buchen": [
    "ausleihen",
    "fahrraeder"
  ]
};
