import type { Ausleihen } from './app';

export type EnrichedAusleihen = Ausleihen & {
  kundeName: string;
  fahrradName: string;
};
