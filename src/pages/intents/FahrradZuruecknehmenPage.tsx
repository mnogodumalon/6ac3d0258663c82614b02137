/**
 * Fahrrad zurücknehmen — 3-Schritt-Wizard.
 * Steps: 1) Offene Ausleihe auswählen → 2) Rückgabe bestätigen → 3) Rechnungsbetrag prüfen & abschließen.
 * Reads: ausleihen (nur status ausgeliehen), fahrraeder, kunden (Namen). Writes: ausleihen (Rückgabe, Status, Rechnungsbetrag),
 * fahrraeder (wieder verfügbar) — alles über den Flow-Hook useFahrradZuruecknehmenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep, StatusBadge.
 */
import { useEffect, useRef, useState } from 'react';
import { differenceInMinutes, parseISO } from 'date-fns';
import { IconBike, IconClock, IconUser } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldNumber, fieldRef, fieldText, nowIso } from '@/lib/journey';
import { useFahrradZuruecknehmenFlow } from '@/lib/journey/flows/FahrradZuruecknehmen';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { tx } from '@/i18n';

/** Angefangene Leihtage zwischen zwei Zeitpunkten, mindestens 1. */
function leihtage(von: string | null | undefined, bis: string): number {
  if (!von) return 1;
  try {
    const minuten = differenceInMinutes(parseISO(bis), parseISO(von));
    return Math.max(1, Math.ceil(minuten / 1440));
  } catch {
    return 1;
  }
}

export default function FahrradZuruecknehmenPage() {
  const [step, setStep] = useState(1);
  // compute läuft erst beim Absenden — die Regel liest dann die gewählten Datensätze.
  const betragRef = useRef<() => number | null>(() => null);

  const flow = useFahrradZuruecknehmenFlow({
    steps: { ausleihen: 1, fahrraeder: 2 },
    items: {
      ausleihen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('fahrrad') ?? tx('Fahrrad'),
        subtitle: tx`${ctx.ref('kunde') ?? tx('Unbekannt')} · seit ${formatDateTime(fieldDate(r, 'ausleihzeitpunkt') ?? undefined)}`,
      }),
      fahrraeder: r => ({ id: r.id, title: fieldText(r, 'bezeichnung') }),
    },
    compute: { rechnungsbetrag: () => betragRef.current() },
  });

  const ausleiheRec = flow.targets.ausleihen.record;
  const bikeId = ausleiheRec ? fieldRef(ausleiheRec, 'fahrrad') : null;
  const bikeRec = bikeId ? flow.picks.fahrraeder.recordOf(bikeId) : undefined;
  const bikeTarget = flow.targets.fahrraeder.selectedId;
  const selectBike = flow.targets.fahrraeder.onSelect;

  // Das Rad ergibt sich aus der Ausleihe — kein eigener Auswahlschritt.
  useEffect(() => {
    if (bikeId && bikeRec && bikeTarget !== bikeId) selectBike(bikeId);
  }, [bikeId, bikeRec, bikeTarget, selectBike]);

  const jetzt = nowIso();
  const von = ausleiheRec ? fieldDate(ausleiheRec, 'ausleihzeitpunkt') : null;
  const tage = leihtage(von, jetzt);
  const tagespreis = bikeRec ? fieldNumber(bikeRec, 'tagespreis') : null;
  const betrag = tagespreis != null ? Math.round(tagespreis * tage * 100) / 100 : null;
  betragRef.current = () => betrag;

  const kundeName = ausleiheRec ? flow.picks.ausleihen.refLabel(ausleiheRec, 'kunde') : undefined;
  const bikeName = bikeRec ? fieldText(bikeRec, 'bezeichnung') : undefined;

  const missingPick = (
    <StepNav onBack={() => setStep(1)} nextDisabled>
      {tx('Dieser Schritt braucht die Auswahl einer offenen Ausleihe aus Schritt 1.')}
    </StepNav>
  );

  const result = flow.submit.result;
  const doneAusleihe = result?.records.ausleihen;

  return (
    <IntentWizardShell
      title={tx('Fahrrad zurücknehmen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Rückgabe erfassen, Rechnungsbetrag berechnen und das Rad wieder freigeben.'),
        needs: [tx('Name des Kunden oder Bezeichnung des Rads')],
      }}
    >
      <WizardStep label={tx('Ausleihe')} heading={tx('Offene Ausleihe auswählen')} description={tx('Welches Rad kommt zurück? Nur offene Ausleihen werden angezeigt.')}>
        <EntitySelectStep
          {...flow.picks.ausleihen.select}
          {...flow.pick('ausleihen')}
          avatar="none"
          searchPlaceholder={tx('Bemerkung durchsuchen …')}
          emptyText={tx('Aktuell ist kein Fahrrad ausgeliehen.')}
        />
      </WizardStep>

      <WizardStep label={tx('Rückgabe')} heading={tx('Rückgabe bestätigen')} description={tx('Stimmen Kunde und Fahrrad? Die Rückgabe wird mit der aktuellen Uhrzeit erfasst.')}>
        {!ausleiheRec ? missingPick : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div data-key="kunde" className="rounded-2xl border bg-card p-4 min-w-0 overflow-hidden">
                <IconUser size={18} className="mb-2 shrink-0 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">{tx('Kunde')}</div>
                <div className="truncate font-medium">{kundeName ?? '—'}</div>
              </div>
              <div data-key="fahrrad" className="rounded-2xl border bg-card p-4 min-w-0 overflow-hidden">
                <IconBike size={18} className="mb-2 shrink-0 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">{tx('Fahrrad')}</div>
                <div className="truncate font-medium">{bikeName ?? '—'}</div>
              </div>
              <div data-key="ausleihzeitpunkt" className="rounded-2xl border bg-card p-4 min-w-0 overflow-hidden">
                <IconClock size={18} className="mb-2 shrink-0 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">{tx('Ausgeliehen seit')}</div>
                <div className="truncate font-medium">{formatDateTime(von ?? undefined)}</div>
              </div>
            </div>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => (bikeRec ? flow.validateStep(2) : tx('Das Fahrrad dieser Ausleihe wird noch geladen.'))}
              nextStepLabel={tx('Rechnungsbetrag')}
            />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (ausleiheRec ? (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'rueckgabe', label: tx('Rückgabezeitpunkt'), value: formatDateTime(jetzt) },
              { key: 'tage', label: tx('Angefangene Leihtage'), value: String(tage) },
              { key: 'tagespreis', label: tx('Tagespreis'), value: formatCurrency(tagespreis ?? undefined) },
              { key: 'rechnungsbetrag', label: tx('Rechnungsbetrag'), value: formatCurrency(betrag ?? undefined) },
            ]}
            whatHappensNext={tx('Die Ausleihe wird abgeschlossen und das Fahrrad ist sofort wieder verfügbar.')}
          />
        ) : missingPick)}
      </WizardStep>

      {result && (
        <SuccessStep
          result={result}
          forms={flow.formList}
          submit={flow.submit}
          facts={[
            { label: tx('Rückgabezeitpunkt'), value: formatDateTime((doneAusleihe ? fieldDate(doneAusleihe, 'rueckgabezeitpunkt') : null) ?? jetzt) },
            { label: tx('Rechnungsbetrag'), value: formatCurrency((doneAusleihe ? fieldNumber(doneAusleihe, 'rechnungsbetrag') : null) ?? betrag ?? undefined) },
          ]}
          actions={{ copy: false, print: true }}
          whatHappensNext={tx('Das Fahrrad steht wieder zum Ausleihen bereit.')}
          next={[
            { label: tx('Weiteres Rad zurücknehmen'), onClick: flow.reset },
            { label: tx('Fahrrad ausleihen'), href: '#/intents/fahrrad-ausleihen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
