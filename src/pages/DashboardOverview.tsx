import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IconAlertTriangle, IconBike, IconCash, IconPlus, IconRoad } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCardRow, StatCard } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { CalendarWidget, type CalendarEvent } from '@/components/widgets/CalendarWidget';
import { lookupOption } from '@/types/app';
import type { Ausleihen } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale } from '@/i18n';

type Filter = 'all' | 'open' | 'today';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { kunden, fahrraeder, ausleihen, kundenMap, fahrraederMap, setAusleihen, setFahrraeder, fetchAll } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  const todayKey = format(clock, 'yyyy-MM-dd');
  const nowStr = format(clock, "yyyy-MM-dd'T'HH:mm");

  const isOpen = (r: Ausleihen) => lookupKey(r.fields.status) === 'ausgeliehen' || (!r.fields.status && !r.fields.rueckgabezeitpunkt);

  const kundeName = (r: Ausleihen) => {
    const k = kundenMap.get(extractRecordId(r.fields.kunde) ?? '');
    return k ? `${k.fields.kunde_vorname ?? ''} ${k.fields.kunde_nachname ?? ''}`.trim() : '';
  };
  const radName = (r: Ausleihen) => fahrraederMap.get(extractRecordId(r.fields.fahrrad) ?? '')?.fields.bezeichnung ?? '';

  // One shared write path: hero, work list and overlay footer all return a bike through this.
  const returnBike = (r: Ausleihen) => {
    const rad = fahrraederMap.get(extractRecordId(r.fields.fahrrad) ?? '');
    const start = r.fields.ausleihzeitpunkt ? parseISO(r.fields.ausleihzeitpunkt) : clock;
    const days = Math.max(1, Math.ceil((clock.getTime() - start.getTime()) / 86400000));
    const betrag = Math.round(days * (rad?.fields.tagespreis ?? 0) * 100) / 100;
    const freeBike = !!rad && rad.fields.verfuegbar === false;
    setAusleihen(list => list.map(x => x.record_id === r.record_id ? {
      ...x, fields: { ...x.fields, status: lookupOption('ausleihen', 'status', 'zurueckgegeben'), rueckgabezeitpunkt: nowStr, rechnungsbetrag: betrag },
    } : x));
    if (freeBike && rad) setFahrraeder(list => list.map(x => x.record_id === rad.record_id ? { ...x, fields: { ...x.fields, verfuegbar: true } } : x));
    const undo = () => {
      setAusleihen(list => list.map(x => x.record_id === r.record_id ? { ...x, fields: r.fields } : x));
      if (freeBike && rad) setFahrraeder(list => list.map(x => x.record_id === rad.record_id ? rad : x));
      LivingAppsService.updateAusleihenEntry(r.record_id, {
        status: 'ausgeliehen',
        rueckgabezeitpunkt: null as unknown as string,
        rechnungsbetrag: null as unknown as number,
      }).catch(fetchAll);
      if (freeBike && rad) LivingAppsService.updateFahrraederEntry(rad.record_id, { verfuegbar: false }).catch(fetchAll);
    };
    LivingAppsService.updateAusleihenEntry(r.record_id, { status: 'zurueckgegeben', rueckgabezeitpunkt: nowStr, rechnungsbetrag: betrag }).catch(fetchAll);
    if (freeBike && rad) LivingAppsService.updateFahrraederEntry(rad.record_id, { verfuegbar: true }).catch(fetchAll);
    undoToast(tx`${radName(r)} zurückgegeben — Rechnungsbetrag ${formatCurrency(betrag)}`, undo);
  };

  const crud = useEntityCrud(data, {
    footer: (top) => top.type === 'ausleihen' && isOpen(top.record)
      ? { label: tx('Rückgabe buchen'), onClick: () => returnBike(top.record) }
      : undefined,
  });

  const open = useMemo(
    () => ausleihen.filter(isOpen).sort((a, b) => (a.fields.ausleihzeitpunkt ?? '').localeCompare(b.fields.ausleihzeitpunkt ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ausleihen],
  );
  const isLate = (r: Ausleihen) => (r.fields.ausleihzeitpunkt ?? '').slice(0, 10) < todayKey;
  const late = open.filter(isLate);
  const returnedToday = ausleihen.filter(r => !isOpen(r) && (r.fields.rueckgabezeitpunkt ?? '').slice(0, 10) === todayKey);
  const revenueToday = returnedToday.reduce((s, r) => s + (r.fields.rechnungsbetrag ?? 0), 0);

  const outIds = new Set(open.map(r => extractRecordId(r.fields.fahrrad)));
  const available = fahrraeder.filter(f => f.fields.verfuegbar !== false && lookupKey(f.fields.zustand) !== 'reparaturbeduerftig' && !outIds.has(f.record_id));

  const events: CalendarEvent[] = ausleihen
    .filter(r => r.fields.ausleihzeitpunkt)
    .filter(r => filter === 'all' || (filter === 'open' ? isOpen(r) : returnedToday.includes(r)))
    .map(r => {
      const start = r.fields.ausleihzeitpunkt!.slice(0, 16);
      let end = (r.fields.rueckgabezeitpunkt ?? nowStr).slice(0, 16);
      if (end < start) end = start;
      const o = isOpen(r);
      return {
        id: r.record_id,
        start,
        end,
        title: `${radName(r)} · ${kundeName(r)}`,
        subtitle: o ? tx('unterwegs') : formatCurrency(r.fields.rechnungsbetrag ?? 0),
        tone: o ? (isLate(r) ? 'warning' : 'primary') : 'default',
      } as CalendarEvent;
    });

  const names = namen(open.map(r => kundeName(r).split(' ')[0]));
  const context = open.length > 0
    ? tx`${names} ${open.length === 1 ? 'ist' : 'sind'} gerade mit einem Rad unterwegs.`
    : available.length > 0
      ? tx`Alle Räder sind da — ${available[0].fields.bezeichnung ?? ''} wartet auf den nächsten Kunden.`
      : tx('Noch keine Räder angelegt — lege dein erstes Rad an.');

  const openDetailById = (list: Ausleihen[], id: string) => {
    const rec = list.find(r => r.record_id === id);
    if (rec) crud.ausleihen.openDetail(rec);
  };

  const empty = ausleihen.length === 0 && fahrraeder.length === 0 && kunden.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.ausleihen.canWrite && (
          <Button onClick={() => crud.ausleihen.openCreate({ ausleihzeitpunkt: nowStr, status: 'ausgeliehen' })}>
            <IconPlus size={16} className="shrink-0" />
            {tx('Neue Ausleihe')}
          </Button>
        )}
      </div>

      {empty ? (
        <div className="rounded-[27px] bg-card shadow-lg p-8 flex flex-col items-center gap-3 text-center">
          <IconBike size={48} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tx('Richte deinen Verleih ein: lege zuerst dein erstes Fahrrad an.')}</p>
          {crud.fahrraeder.canWrite && (
            <Button onClick={() => crud.fahrraeder.openCreate({ verfuegbar: true })}>{tx('Erstes Fahrrad anlegen')}</Button>
          )}
        </div>
      ) : (
        <DashboardGrid
          variant="split"
          hero={late.length > 0 && (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{ label: tx('Rückgabe buchen'), onClick: () => returnBike(late[0]) }}
            >
              <b>{namen(late.map(r => kundeName(r).split(' ')[0]))}</b>{' '}
              {tx`— ${radName(late[0])} ist seit ${formatDate(late[0].fields.ausleihzeitpunkt)} nicht zurück.`}
            </HeroBanner>
          )}
          kpis={
            <StatCardRow>
              <StatCard
                title={tx('Unterwegs')}
                value={open.length}
                description={open.length > 0 ? tx('Räder aktuell ausgeliehen') : tx('Alle Räder sind zurück')}
                icon={<IconRoad size={18} className="text-muted-foreground" />}
                onClick={() => setFilter(f => f === 'open' ? 'all' : 'open')}
                active={filter === 'open'}
              />
              <StatCard
                title={tx('Verfügbar')}
                value={available.length}
                description={tx`von ${fahrraeder.length} Rädern`}
                icon={<IconBike size={18} className="text-muted-foreground" />}
                tone={available.length === 0 ? 'warning' : 'success'}
              />
              <StatCard
                title={tx('Heute zurück')}
                value={returnedToday.length}
                description={returnedToday.length > 0 ? tx`${formatCurrency(revenueToday)} berechnet` : tx('Noch keine Rückgabe heute')}
                icon={<IconCash size={18} className="text-muted-foreground" />}
                onClick={() => setFilter(f => f === 'today' ? 'all' : 'today')}
                active={filter === 'today'}
              />
            </StatCardRow>
          }
          aside={
            <>
              <WorkList
                title={tx('Offene Ausleihen')}
                max={5}
                items={open.map(r => ({
                  id: r.record_id,
                  title: `${radName(r)} · ${kundeName(r)}`,
                  secondLine: (
                    <>
                      <span className="font-medium">{isLate(r) ? tx('Über Nacht') : tx('Heute')}</span>
                      <span className="text-muted-foreground"> · {formatDate(r.fields.ausleihzeitpunkt)}</span>
                    </>
                  ),
                  action: { label: tx('Rückgabe'), onClick: () => returnBike(r) },
                }))}
                onItemClick={id => openDetailById(open, id)}
                empty={{
                  text: tx('Keine offenen Ausleihen.'),
                  action: crud.ausleihen.canWrite ? { label: tx('Neue Ausleihe'), onClick: () => crud.ausleihen.openCreate({ ausleihzeitpunkt: nowStr, status: 'ausgeliehen' }) } : undefined,
                }}
              />
              <WorkList
                title={tx('Verfügbare Räder')}
                max={5}
                items={available.map(f => ({
                  id: f.record_id,
                  title: f.fields.bezeichnung ?? '',
                  secondLine: (
                    <span className="text-muted-foreground">
                      {[f.fields.fahrradtyp?.label, f.fields.tagespreis != null ? tx`${formatCurrency(f.fields.tagespreis)} pro Tag` : ''].filter(Boolean).join(' · ')}
                    </span>
                  ),
                  action: crud.ausleihen.canWrite
                    ? { label: tx('Ausleihen'), onClick: () => crud.ausleihen.openCreate({ fahrrad: f.record_id, ausleihzeitpunkt: nowStr, status: 'ausgeliehen' }) }
                    : undefined,
                }))}
                onItemClick={id => {
                  const f = fahrraeder.find(x => x.record_id === id);
                  if (f) crud.fahrraeder.openDetail(f);
                }}
                empty={{ text: tx('Gerade ist kein Rad frei.') }}
              />
            </>
          }
          primary={
            <CalendarWidget
              events={events}
              locale={dateFnsLocale()}
              defaultView="month"
              onEventClick={ev => openDetailById(ausleihen, ev.id)}
              onEmptyClick={crud.ausleihen.canWrite ? (d => crud.ausleihen.openCreate({ ausleihzeitpunkt: format(d, "yyyy-MM-dd'T'HH:mm"), status: 'ausgeliehen' })) : undefined}
            />
          }
        />
      )}
      {crud.surfaces}
    </div>
  );
}
