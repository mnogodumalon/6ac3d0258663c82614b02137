import type { Fahrraeder, Ausleihen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface FahrraederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Fahrraeder;
  /** 1:N „Ausleihen" (fahrrad): VOLLE Liste — der Block filtert auf diesen Record. */
  ausleihenList: Ausleihen[];
  /** Zeilen-Klick → overlay.push auf das Ausleihen-Detail (nie der Edit-Dialog). */
  onOpenAusleihen: (record: Ausleihen) => void;
  /** Kontextuelles „+": öffnet den Ausleihen-Dialog mit diesem Record vorgesetzt. */
  onAddAusleihen?: () => void;
}

export function FahrraederDetails({
  record,
  ausleihenList,
  onOpenAusleihen,
  onAddAusleihen,
}: FahrraederDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('fahrraeder', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'fahrradtyp')} value={record.fields.fahrradtyp} format="pill" />
        <RecordField label={fieldLabel('fahrraeder', 'marke')} value={record.fields.marke} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'rahmengroesse')} value={record.fields.rahmengroesse} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'farbe')} value={record.fields.farbe} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'tagespreis')} value={record.fields.tagespreis} format="text" />
        <RecordField label={fieldLabel('fahrraeder', 'zustand')} value={record.fields.zustand} format="pill" />
        <RecordField label={fieldLabel('fahrraeder', 'verfuegbar')} value={record.fields.verfuegbar} format="bool" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('ausleihen')}
        items={ausleihenList.filter(r => extractRecordId(r.fields.fahrrad) === record.record_id)}
        map={r => ({ name: appLabel('ausleihen'), meta: r.fields.ausleihzeitpunkt })}
        onOpen={onOpenAusleihen}
        onAdd={onAddAusleihen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.FAHRRAEDER} recordId={record.record_id} readOnly={!perms.canWrite('fahrraeder')} />
    </>
  );
}
