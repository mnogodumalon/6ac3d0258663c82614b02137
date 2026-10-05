import type { EnrichedAusleihen } from '@/types/enriched';
import type { Ausleihen, Fahrraeder, Kunden } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AusleihenMaps {
  kundenMap: Map<string, Kunden>;
  fahrraederMap: Map<string, Fahrraeder>;
}

export function enrichAusleihen(
  ausleihen: Ausleihen[],
  maps: AusleihenMaps
): EnrichedAusleihen[] {
  return ausleihen.map(r => ({
    ...r,
    kundeName: resolveDisplay(r.fields.kunde, maps.kundenMap, 'kunde_vorname'),
    fahrradName: resolveDisplay(r.fields.fahrrad, maps.fahrraederMap, 'bezeichnung'),
  }));
}
