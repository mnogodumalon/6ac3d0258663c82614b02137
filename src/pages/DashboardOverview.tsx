import { useMemo, useState } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { IconAlertTriangle, IconBike, IconPlus, IconTool } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { Ausleihen, Fahrraeder } from '@/types/app';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatCurrency, formatDateTime, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn } from '@/components/widgets/KanbanWidget';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    kunden, fahrraeder, ausleihen,
    kundenMap, fahrraederMap,
    setAusleihen, setFahrraeder, fetchAll,
  } = data;
  const clock = useClock();
  const todayKey = format(clock, 'yyyy-MM-dd');
  const [dueOnly, setDueOnly] = useState(false);

  const nameOf = (a: Ausleihen) => {
    const k = kundenMap.get(extractRecordId(a.fields.kunde) ?? '');
    return k?.fields.kunde_vorname ?? '';
  };
  const bikeOf = (a: Ausleihen) => fahrraederMap.get(extractRecordId(a.fields.fahrrad) ?? '');

  // Shared write path: hero, work list, board drag and overlay footer.
  const returnBike = (a: Ausleihen) => {
    if (lookupKey(a.fields.status) !== 'ausgeliehen') return;
    const bike = bikeOf(a);
    const start = a.fields.ausleihzeitpunkt ? parseISO(a.fields.ausleihzeitpunkt) : clock;
    const days = Math.max(1, Math.ceil(differenceInMinutes(clock, start) / 1440));
    const amount = Math.round(days * (bike?.fields.tagespreis ?? 0) * 100) / 100;
    const nowStr = format(clock, "yyyy-MM-dd'T'HH:mm");
    const prev = a.fields;
    const prevAvail = bike?.fields.verfuegbar;
    const id = a.record_id;
    setAusleihen(list => list.map(r => r.record_id === id ? {
      ...r,
      fields: { ...r.fields, status: lookupOption('ausleihen', 'status', 'zurueckgegeben'), rueckgabezeitpunkt: nowStr, rechnungsbetrag: amount },
    } : r));
    if (bike) setFahrraeder(list => list.map(f => f.record_id === bike.record_id ? { ...f, fields: { ...f.fields, verfuegbar: true } } : f));
    const writes: Promise<unknown>[] = [
      LivingAppsService.updateAusleihenEntry(id, { status: 'zurueckgegeben', rueckgabezeitpunkt: nowStr, rechnungsbetrag: amount }),
    ];
    if (bike) writes.push(LivingAppsService.updateFahrraederEntry(bike.record_id, { verfuegbar: true }));
    Promise.all(writes).catch(() => { void fetchAll(); });
    const who = nameOf(a);
    undoToast(tx`${who} — zurückgenommen, Rechnungsbetrag ${formatCurrency(amount)}`, () => {
      setAusleihen(list => list.map(r => r.record_id === id ? { ...r, fields: prev } : r));
      if (bike) setFahrraeder(list => list.map(f => f.record_id === bike.record_id ? { ...f, fields: { ...f.fields, verfuegbar: prevAvail } } : f));
      void LivingAppsService.updateAusleihenEntry(id, {
        status: 'ausgeliehen',
        rueckgabezeitpunkt: (prev.rueckgabezeitpunkt ?? null) as unknown as string,
        rechnungsbetrag: (prev.rechnungsbetrag ?? null) as unknown as number,
      }).catch(() => { void fetchAll(); });
      if (bike) void LivingAppsService.updateFahrraederEntry(bike.record_id, { verfuegbar: prevAvail ?? false }).catch(() => { void fetchAll(); });
    });
  };

  const markRepaired = (f: Fahrraeder) => {
    const prev = f.fields.zustand;
    const id = f.record_id;
    setFahrraeder(list => list.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, zustand: lookupOption('fahrraeder', 'zustand', 'gut') } } : r));
    LivingAppsService.updateFahrraederEntry(id, { zustand: 'gut' }).catch(() => { void fetchAll(); });
    const name = f.fields.bezeichnung ?? '';
    undoToast(tx`${name} — als repariert markiert`, () => {
      setFahrraeder(list => list.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, zustand: prev } } : r));
      void LivingAppsService.updateFahrraederEntry(id, { zustand: lookupKey(prev) ?? 'reparaturbeduerftig' }).catch(() => { void fetchAll(); });
    });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => top.type === 'ausleihen' && lookupKey(top.record.fields.status) === 'ausgeliehen'
      ? { label: tx('Zurücknehmen & abrechnen'), onClick: () => returnBike(top.record) }
      : undefined,
  });
  const enrichedAusleihen = crud.enriched.ausleihen;

  const open = useMemo(
    () => enrichedAusleihen
      .filter(a => lookupKey(a.fields.status) === 'ausgeliehen')
      .sort((a, b) => (a.fields.ausleihzeitpunkt ?? '').localeCompare(b.fields.ausleihzeitpunkt ?? '')),
    [enrichedAusleihen],
  );
  const dayOf = (s?: string) => (s ? s.slice(0, 10) : '');
  const overdue = open.filter(a => a.fields.rueckgabezeitpunkt && dayOf(a.fields.rueckgabezeitpunkt) < todayKey);
  const dueToday = open.filter(a => dayOf(a.fields.rueckgabezeitpunkt) === todayKey);

  const returned = enrichedAusleihen.filter(a => lookupKey(a.fields.status) === 'zurueckgegeben');
  const revenue = returned.reduce((s, a) => s + (a.fields.rechnungsbetrag ?? 0), 0);
  const revenueToday = returned
    .filter(a => dayOf(a.fields.rueckgabezeitpunkt) === todayKey)
    .reduce((s, a) => s + (a.fields.rechnungsbetrag ?? 0), 0);

  const openBikeIds = new Set(open.map(a => extractRecordId(a.fields.fahrrad)).filter(Boolean));
  const available = fahrraeder.filter(f =>
    f.fields.verfuegbar !== false && !openBikeIds.has(f.record_id) && lookupKey(f.fields.zustand) !== 'reparaturbeduerftig');
  const broken = fahrraeder.filter(f => lookupKey(f.fields.zustand) === 'reparaturbeduerftig');

  const columns = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['ausleihen']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );
  const dueIds = new Set([...overdue, ...dueToday].map(a => a.record_id));
  const cards: KanbanCard[] = [...enrichedAusleihen]
    .filter(a => !dueOnly || dueIds.has(a.record_id))
    .sort((a, b) => (b.fields.ausleihzeitpunkt ?? '').localeCompare(a.fields.ausleihzeitpunkt ?? ''))
    .map(a => {
      const isOpen = lookupKey(a.fields.status) === 'ausgeliehen';
      return {
        id: `ausleihe:${a.record_id}`,
        column: lookupKey(a.fields.status) ?? columns[0]?.key ?? '',
        title: `${a.kundeName || '—'} · ${a.fahrradName || '—'}`,
        subtitle: isOpen
          ? (a.fields.rueckgabezeitpunkt ? tx`zurück bis ${formatDateTime(a.fields.rueckgabezeitpunkt)}` : tx`seit ${formatDateTime(a.fields.ausleihzeitpunkt)}`)
          : formatCurrency(a.fields.rechnungsbetrag),
        tone: isOpen ? 'primary' : 'default',
      };
    });

  const moveCard = (cardId: string, newColumn: string) => {
    const rec = ausleihen.find(a => a.record_id === cardId.split(':')[1]);
    if (!rec) return;
    if (newColumn === 'zurueckgegeben') { returnBike(rec); return; }
    return tx('Eine Rückgabe lässt sich nicht per Ziehen zurücknehmen — bitte im Detail bearbeiten.');
  };

  const contextLine = (() => {
    if (overdue.length > 0) return tx`${namen(overdue.map(a => a.kundeName))} ${overdue.length === 1 ? 'hat' : 'haben'} das Rad noch nicht zurückgebracht.`;
    if (dueToday.length > 0) return tx`Heute erwartet: ${namen(dueToday.map(a => a.kundeName))} bringen ihr Rad zurück.`;
    if (open.length > 0) return tx`Unterwegs sind ${namen(open.map(a => a.kundeName))} — heute ist keine Rückgabe fällig.`;
    if (available.length > 0) return tx`Alle Räder sind da, zum Beispiel ${namen(available.map(f => f.fields.bezeichnung ?? ''))} warten auf Kundschaft.`;
    return tx`Noch keine Räder im Verleih.`;
  })();

  const isEmpty = fahrraeder.length === 0 && ausleihen.length === 0 && kunden.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{contextLine}</p>
        </div>
        {crud.ausleihen.canWrite && (
          <Button onClick={() => crud.ausleihen.openCreate({ status: 'ausgeliehen', ausleihzeitpunkt: format(clock, "yyyy-MM-dd'T'HH:mm") })}>
            <IconPlus size={16} className="shrink-0" />
            <span>{tx('Neue Ausleihe')}</span>
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={isEmpty ? (
          <div className="rounded-[27px] bg-card shadow-sm p-8 flex flex-col items-center text-center gap-3 overflow-hidden">
            <IconBike size={48} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{tx('Richte deinen Verleih ein: lege dein erstes Fahrrad an.')}</p>
            {crud.fahrraeder.canWrite && (
              <Button onClick={() => crud.fahrraeder.openCreate({ verfuegbar: true })}>{tx('Erstes Fahrrad aufnehmen')}</Button>
            )}
          </div>
        ) : overdue.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Zurücknehmen & abrechnen'), onClick: () => returnBike(overdue[0]) }}
          >
            <b>{namen(overdue.map(a => a.kundeName))}</b>{' '}
            {tx`überfällig — ${overdue[0].fahrradName} sollte am ${formatDateTime(overdue[0].fields.rueckgabezeitpunkt)} zurück sein.`}
          </HeroBanner>
        ) : undefined}
        kpis={isEmpty ? undefined : (
          <StatStrip>
            <StatStripItem
              title={tx('Heute fällig')}
              value={dueToday.length}
              tone={dueToday.length > 0 ? 'primary' : 'default'}
              onClick={() => setDueOnly(v => !v)}
              active={dueOnly}
            />
            <StatStripItem title={tx('Verfügbar')} value={`${available.length} / ${fahrraeder.length}`} tone={available.length === 0 && fahrraeder.length > 0 ? 'warning' : 'default'} />
            <StatStripItem title={tx('Umsatz')} value={formatCurrency(revenue)} tone="success" />
          </StatStrip>
        )}
        primary={
          <KanbanWidget
            cards={cards}
            columns={columns}
            onCardClick={card => {
              const rec = ausleihen.find(a => a.record_id === card.id.split(':')[1]);
              if (rec) crud.ausleihen.openDetail(rec);
            }}
            onCardMove={moveCard}
            onAddCard={crud.ausleihen.canWrite ? (column => crud.ausleihen.openCreate({ status: column })) : undefined}
          />
        }
        aside={isEmpty ? undefined : (
          <>
            <WorkList
              title={tx('Am längsten unterwegs')}
              items={open.map(a => ({
                id: a.record_id,
                title: a.kundeName || '—',
                secondLine: <span className="text-muted-foreground">{a.fahrradName} · {tx`seit ${formatDateTime(a.fields.ausleihzeitpunkt)}`}</span>,
                action: { label: tx('Zurücknehmen'), onClick: () => returnBike(a) },
              }))}
              onItemClick={id => { const r = ausleihen.find(a => a.record_id === id); if (r) crud.ausleihen.openDetail(r); }}
              empty={{ text: tx('Kein Rad unterwegs — alle sind zurück.') }}
              max={5}
            />
            <WorkList
              title={tx('Reparaturbedürftig')}
              items={broken.map(f => ({
                id: f.record_id,
                title: f.fields.bezeichnung ?? '—',
                secondLine: <span className="inline-flex items-center gap-1 font-medium text-destructive"><IconTool size={12} className="shrink-0" />{f.fields.zustand?.label}{f.fields.marke ? <span className="font-normal text-muted-foreground"> · {f.fields.marke}</span> : null}</span>,
                action: { label: tx('Repariert'), onClick: () => markRepaired(f) },
              }))}
              onItemClick={id => { const f = fahrraeder.find(x => x.record_id === id); if (f) crud.fahrraeder.openDetail(f); }}
              empty={{ text: tx('Alle Räder sind fahrbereit.') }}
              max={5}
            />
          </>
        )}
      />
      {crud.surfaces}
    </div>
  );
}
