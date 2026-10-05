/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'kunden'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.kunden.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.kunden.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.kunden.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.kunden              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   kunden: kunde_vorname, kunde_nachname, handynummer, email, strasse, hausnummer, plz, ort  ·  ← ausleihen (list + contextual +)
 *   fahrraeder: bezeichnung, fahrradtyp, marke, rahmengroesse, farbe, tagespreis, zustand, verfuegbar  ·  ← ausleihen (list + contextual +)
 *   ausleihen: kunde, fahrrad, ausleihzeitpunkt, rueckgabezeitpunkt, status, rechnungsbetrag, bemerkung  ·  → kunden · → fahrraeder
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Kunden, Fahrraeder, Ausleihen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichAusleihen } from '@/lib/enrich';
import type { EnrichedAusleihen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { KundenDialog, type KundenDialogDefaults } from '@/components/dialogs/KundenDialog';
import { KundenDetails } from '@/components/details/KundenDetails';
import { FahrraederDialog, type FahrraederDialogDefaults } from '@/components/dialogs/FahrraederDialog';
import { FahrraederDetails } from '@/components/details/FahrraederDetails';
import { AusleihenDialog, type AusleihenDialogDefaults } from '@/components/dialogs/AusleihenDialog';
import { AusleihenDetails } from '@/components/details/AusleihenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'kunden'; record: Kunden }
  | { type: 'fahrraeder'; record: Fahrraeder }
  | { type: 'ausleihen'; record: EnrichedAusleihen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  kunden: EntityCrudApi<Kunden, KundenDialogDefaults>;
  fahrraeder: EntityCrudApi<Fahrraeder, FahrraederDialogDefaults>;
  ausleihen: EntityCrudApi<Ausleihen, AusleihenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { kunden: Kunden[]; fahrraeder: Fahrraeder[]; ausleihen: EnrichedAusleihen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [kundenDialog, setKundenDialog] = useState<{ defaults?: KundenDialogDefaults; editing?: Kunden } | null>(null);
  const [fahrraederDialog, setFahrraederDialog] = useState<{ defaults?: FahrraederDialogDefaults; editing?: Fahrraeder } | null>(null);
  const [ausleihenDialog, setAusleihenDialog] = useState<{ defaults?: AusleihenDialogDefaults; editing?: Ausleihen } | null>(null);
  const enrichedAusleihen = useMemo(() => enrichAusleihen(data.ausleihen, { kundenMap: data.kundenMap, fahrraederMap: data.fahrraederMap }), [data.ausleihen, data.kundenMap, data.fahrraederMap]);

  function detailKunden(record: Kunden, push = false) {
    const item: OverlayItem = { type: 'kunden', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKunden(fields: Kunden['fields']) {
    const editing = kundenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKunden(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKundenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kunden')} — ${t('crud_updated')}`, async () => {
        data.setKunden(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKundenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKundenEntry(fields);
      undoToast(`${appLabel('kunden')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailFahrraeder(record: Fahrraeder, push = false) {
    const item: OverlayItem = { type: 'fahrraeder', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitFahrraeder(fields: Fahrraeder['fields']) {
    const editing = fahrraederDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setFahrraeder(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateFahrraederEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('fahrraeder')} — ${t('crud_updated')}`, async () => {
        data.setFahrraeder(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateFahrraederEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createFahrraederEntry(fields);
      undoToast(`${appLabel('fahrraeder')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAusleihen(record: Ausleihen, push = false) {
    const rec = enrichedAusleihen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'ausleihen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAusleihen(fields: Ausleihen['fields']) {
    const editing = ausleihenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAusleihen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAusleihenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('ausleihen')} — ${t('crud_updated')}`, async () => {
        data.setAusleihen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAusleihenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAusleihenEntry(fields);
      undoToast(`${appLabel('ausleihen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <KundenDialog
        open={kundenDialog !== null}
        onClose={() => setKundenDialog(null)}
        onSubmit={submitKunden}
        defaultValues={kundenDialog?.defaults}
        recordId={kundenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Kunden']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kunden']}
      />
      <FahrraederDialog
        open={fahrraederDialog !== null}
        onClose={() => setFahrraederDialog(null)}
        onSubmit={submitFahrraeder}
        defaultValues={fahrraederDialog?.defaults}
        recordId={fahrraederDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Fahrraeder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Fahrraeder']}
      />
      <AusleihenDialog
        open={ausleihenDialog !== null}
        onClose={() => setAusleihenDialog(null)}
        onSubmit={submitAusleihen}
        defaultValues={ausleihenDialog?.defaults}
        recordId={ausleihenDialog?.editing?.record_id}
        kundenList={data.kunden}
        fahrraederList={data.fahrraeder}
        enablePhotoScan={AI_PHOTO_SCAN['Ausleihen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Ausleihen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'kunden') {
            return (
              <>
                <RecordHeader title={top.record.fields.kunde_vorname ?? appLabel('kunden')} subtitle={undefined} />
                <KundenDetails
                  record={top.record}
                  ausleihenList={data.ausleihen}
                  onOpenAusleihen={(r) => detailAusleihen(r, true)}
                  onAddAusleihen={perms.canWrite('ausleihen') ? () => setAusleihenDialog({ defaults: { kunde: createRecordUrl(APP_IDS.KUNDEN, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'fahrraeder') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('fahrraeder')} subtitle={undefined} />
                <FahrraederDetails
                  record={top.record}
                  ausleihenList={data.ausleihen}
                  onOpenAusleihen={(r) => detailAusleihen(r, true)}
                  onAddAusleihen={perms.canWrite('ausleihen') ? () => setAusleihenDialog({ defaults: { fahrrad: createRecordUrl(APP_IDS.FAHRRAEDER, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'ausleihen') {
            return (
              <>
                <RecordHeader title={appLabel('ausleihen')} subtitle={top.record.fields.ausleihzeitpunkt ? formatDate(top.record.fields.ausleihzeitpunkt) : undefined} />
                <AusleihenDetails
                  record={top.record}
                  kundenList={data.kunden}
                  onOpenKunden={(r) => detailKunden(r, true)}
                  fahrraederList={data.fahrraeder}
                  onOpenFahrraeder={(r) => detailFahrraeder(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'kunden') return perms.canWrite('kunden');
          if (top.type === 'fahrraeder') return perms.canWrite('fahrraeder');
          if (top.type === 'ausleihen') return perms.canWrite('ausleihen');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'kunden') setKundenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'fahrraeder') setFahrraederDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'ausleihen') setAusleihenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    kunden: {
      openCreate: (defaults?: KundenDialogDefaults) => (perms.canWrite('kunden') ? setKundenDialog({ defaults }) : refuse()),
      openEdit: (record: Kunden) => (perms.canWrite('kunden') ? setKundenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Kunden) => detailKunden(record, false),
      canWrite: perms.canWrite('kunden'),
    },
    fahrraeder: {
      openCreate: (defaults?: FahrraederDialogDefaults) => (perms.canWrite('fahrraeder') ? setFahrraederDialog({ defaults }) : refuse()),
      openEdit: (record: Fahrraeder) => (perms.canWrite('fahrraeder') ? setFahrraederDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Fahrraeder) => detailFahrraeder(record, false),
      canWrite: perms.canWrite('fahrraeder'),
    },
    ausleihen: {
      openCreate: (defaults?: AusleihenDialogDefaults) => (perms.canWrite('ausleihen') ? setAusleihenDialog({ defaults }) : refuse()),
      openEdit: (record: Ausleihen) => (perms.canWrite('ausleihen') ? setAusleihenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Ausleihen) => detailAusleihen(record, false),
      canWrite: perms.canWrite('ausleihen'),
    },
    enriched: { kunden: data.kunden, fahrraeder: data.fahrraeder, ausleihen: enrichedAusleihen },
  };
}
