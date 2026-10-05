import type { Ausleihen, Kunden, Fahrraeder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface AusleihenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Ausleihen;
  /** N:1-Ziel „Kunden": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kundenList: Kunden[];
  /** Klick auf die Kunden-Relation → overlay.push auf dessen Detail. */
  onOpenKunden?: (record: Kunden) => void;
  /** N:1-Ziel „Fahrraeder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  fahrraederList: Fahrraeder[];
  /** Klick auf die Fahrraeder-Relation → overlay.push auf dessen Detail. */
  onOpenFahrraeder?: (record: Fahrraeder) => void;
}

export function AusleihenDetails({
  record,
  kundenList,
  onOpenKunden,
  fahrraederList,
  onOpenFahrraeder,
}: AusleihenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const kundeTarget = kundenList.find(r => r.record_id === extractRecordId(record.fields.kunde));
  const fahrradTarget = fahrraederList.find(r => r.record_id === extractRecordId(record.fields.fahrrad));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('ausleihen', 'ausleihzeitpunkt')} value={record.fields.ausleihzeitpunkt} format="datetime" />
        <RecordField label={fieldLabel('ausleihen', 'rueckgabezeitpunkt')} value={record.fields.rueckgabezeitpunkt} format="datetime" />
        <RecordField label={fieldLabel('ausleihen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('ausleihen', 'rechnungsbetrag')} value={record.fields.rechnungsbetrag} format="text" />
        <RecordField label={fieldLabel('ausleihen', 'bemerkung')} value={record.fields.bemerkung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('ausleihen', 'kunde')}
          name={kundeTarget?.fields.kunde_vorname ?? '—'}
          meta={[kundeTarget?.fields.handynummer, kundeTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={kundeTarget && onOpenKunden ? () => onOpenKunden!(kundeTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('ausleihen', 'fahrrad')}
          name={fahrradTarget?.fields.bezeichnung ?? '—'}
          meta={[fahrradTarget?.fields.marke, fahrradTarget?.fields.rahmengroesse].filter(Boolean).join(' · ') || undefined}
          onClick={fahrradTarget && onOpenFahrraeder ? () => onOpenFahrraeder!(fahrradTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUSLEIHEN} recordId={record.record_id} readOnly={!perms.canWrite('ausleihen')} />
    </>
  );
}
