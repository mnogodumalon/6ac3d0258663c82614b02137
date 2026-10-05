import type { Kunden, Ausleihen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface KundenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kunden;
  /** 1:N „Ausleihen" (kunde): VOLLE Liste — der Block filtert auf diesen Record. */
  ausleihenList: Ausleihen[];
  /** Zeilen-Klick → overlay.push auf das Ausleihen-Detail (nie der Edit-Dialog). */
  onOpenAusleihen: (record: Ausleihen) => void;
  /** Kontextuelles „+": öffnet den Ausleihen-Dialog mit diesem Record vorgesetzt. */
  onAddAusleihen?: () => void;
}

export function KundenDetails({
  record,
  ausleihenList,
  onOpenAusleihen,
  onAddAusleihen,
}: KundenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('kunden', 'kunde_vorname')} value={record.fields.kunde_vorname} format="text" />
        <RecordField label={fieldLabel('kunden', 'kunde_nachname')} value={record.fields.kunde_nachname} format="text" />
        <RecordField label={fieldLabel('kunden', 'handynummer')} value={record.fields.handynummer} format="text" />
        <RecordField label={fieldLabel('kunden', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('kunden', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('kunden', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('kunden', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('kunden', 'ort')} value={record.fields.ort} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('ausleihen')}
        items={ausleihenList.filter(r => extractRecordId(r.fields.kunde) === record.record_id)}
        map={r => ({ name: appLabel('ausleihen'), meta: r.fields.ausleihzeitpunkt })}
        onOpen={onOpenAusleihen}
        onAdd={onAddAusleihen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KUNDEN} recordId={record.record_id} readOnly={!perms.canWrite('kunden')} />
    </>
  );
}
