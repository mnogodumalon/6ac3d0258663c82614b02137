/**
 * Rückgabe buchen — 3-Schritt-Wizard.
 * Steps: 1) Offene Ausleihe auswählen → 2) Rückgabezeitpunkt bestätigen (Zustand, Bemerkung) → 3) Rechnungsbetrag prüfen und buchen.
 * Reads: ausleihen (nur Status „ausgeliehen"), fahrraeder. Writes: ausleihen (Rückgabe, Status, Rechnungsbetrag, Bemerkung), fahrraeder (verfügbar, Zustand).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useState } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup, fieldNumber, fieldRef, nowIso, type JourneyRecord } from '@/lib/journey';
import { useRueckgabeBuchenFlow, type RueckgabeBuchenFlow } from '@/lib/journey/flows/RueckgabeBuchen';
import { formatCurrency } from '@/lib/formatters';
import { tx } from '@/i18n';

/** Angefangene Leihtage (mindestens 1) zwischen Ausleihe und jetzt. */
function leihtage(ausleihe: JourneyRecord | undefined): number {
  const start = ausleihe ? fieldDate(ausleihe, 'ausleihzeitpunkt') : null;
  if (!start) return 1;
  const minutes = differenceInMinutes(new Date(), parseISO(start));
  return Math.max(1, Math.ceil(minutes / 1440));
}

function betrag(ausleihe: JourneyRecord | undefined, fahrrad: JourneyRecord | null | undefined): number | null {
  const preis = fahrrad ? fieldNumber(fahrrad, 'tagespreis') : null;
  if (preis == null) return null;
  return Math.round(preis * leihtage(ausleihe) * 100) / 100;
}

export default function RueckgabeBuchenPage() {
  const [step, setStep] = useState(1);
  const [bike, setBike] = useState<JourneyRecord | null>(null);

  const flow: RueckgabeBuchenFlow = useRueckgabeBuchenFlow({
    steps: { ausleihen: 1, fahrraeder: 2, bemerkung: 2, zustand: 2 },
    items: {
      ausleihen: (r, ctx) => {
        const von = fieldDate(r, 'ausleihzeitpunkt');
        return {
          id: r.id,
          title: tx`${ctx.ref('kunde') ?? tx('Unbekannter Kunde')} · ${ctx.ref('fahrrad') ?? tx('Fahrrad')}`,
          subtitle: von ? tx`Ausgeliehen am ${format(parseISO(von), 'dd.MM.yyyy HH:mm')}` : undefined,
        };
      },
    },
    compute: {
      rechnungsbetrag: _forms => betrag(flow.targets.ausleihen.record, bike ?? flow.targets.fahrraeder.record),
    },
  });

  const ausleiheId = flow.targets.ausleihen.selectedId;
  const fahrradId = flow.targets.fahrraeder.selectedId;
  const ausleihe = flow.targets.ausleihen.record;

  // The bike of the rental: from the loaded search if present, else through the door.
  useEffect(() => {
    let alive = true;
    if (!fahrradId) { setBike(null); return; }
    const known = flow.picks.fahrraeder.recordOf(fahrradId);
    if (known) { setBike(known); return; }
    flow.port.get('fahrraeder', fahrradId).then(r => { if (alive) setBike(r); }).catch(() => { if (alive) setBike(null); });
    return () => { alive = false; };
  }, [fahrradId, flow.picks.fahrraeder.select.loading]);

  const pickAusleihe = (id: string) => {
    flow.targets.ausleihen.onSelect(id);
    const rec = flow.picks.ausleihen.recordOf(id);
    const bikeId = rec ? fieldRef(rec, 'fahrrad') : null;
    if (!bikeId) return;
    // only a bike that exists can be updated — otherwise the person picks it below
    flow.port.get('fahrraeder', bikeId).then(r => { if (r && r.id.toLowerCase() === bikeId.toLowerCase()) flow.targets.fahrraeder.onSelect(bikeId); }).catch(() => undefined);
  };

  const tage = leihtage(ausleihe);
  const summe = betrag(ausleihe, bike);
  const rueckgabe = format(new Date(), 'dd.MM.yyyy HH:mm');
  const fahrradName = fahrradId ? flow.picks.fahrraeder.labelOf(fahrradId) ?? bike?.id : undefined;

  const pruefeStatus = (): boolean | string => {
    if (ausleihe && fieldLookup(ausleihe, 'status')?.key !== 'ausgeliehen') {
      return tx('Diese Ausleihe ist bereits zurückgegeben.');
    }
    return flow.validateStep(2);
  };

  const result = flow.submit.result;
  const resultAusleihe = result?.records['ausleihen'];

  return (
    <IntentWizardShell
      title={tx('Rückgabe buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein Fahrrad zurücknehmen und den Rechnungsbetrag berechnen.'),
        needs: [tx('Name des Kunden oder das Fahrrad')],
      }}
    >
      <WizardStep label={tx('Ausleihe')} description={tx('Welche offene Ausleihe wird zurückgegeben?')}>
        <EntitySelectStep
          {...flow.picks.ausleihen.select}
          {...flow.pick('ausleihen')}
          onSelect={pickAusleihe}
          avatar="initials"
          searchPlaceholder={tx('Bemerkung suchen …')}
          emptyText={tx('Zurzeit ist kein Fahrrad ausgeliehen.')}
        />
      </WizardStep>

      <WizardStep label={tx('Rückgabe')} description={tx('Zustand des Fahrrads festhalten — der Rückgabezeitpunkt ist jetzt.')}>
        {!ausleiheId ? (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        ) : !fahrradId ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">{tx('Das Fahrrad dieser Ausleihe wurde nicht gefunden — wähle es bitte aus.')}</p>
            <EntitySelectStep
              {...flow.picks.fahrraeder.select}
              {...flow.pick('fahrraeder')}
              searchPlaceholder={tx('Fahrrad suchen …')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary p-4 text-sm space-y-1">
              <p className="font-medium">{flow.picks.ausleihen.labelOf(ausleiheId)}</p>
              {fahrradName && <p className="text-muted-foreground">{tx`Fahrrad: ${fahrradName}`}</p>}
              <p className="text-muted-foreground">{tx`Rückgabezeitpunkt: ${rueckgabe}`}</p>
            </div>
            <Bound form={flow.forms.fahrraeder} name="zustand" allowClear />
            <Bound form={flow.forms.ausleihen} name="bemerkung" rows={3} />
            <StepNav onBack={() => setStep(1)} onNext={pruefeStatus} nextStepLabel={tx('Prüfen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')} description={tx('Rechnungsbetrag kontrollieren und die Rückgabe buchen.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'rueckgabezeitpunkt', label: tx('Rückgabezeitpunkt'), value: rueckgabe },
              { key: 'leihdauer', label: tx('Angefangene Leihtage'), value: String(tage) },
              { key: 'rechnungsbetrag', label: tx('Rechnungsbetrag'), value: formatCurrency(summe ?? undefined) },
            ]}
            whatHappensNext={tx('Die Ausleihe gilt als zurückgegeben und das Fahrrad ist wieder frei.')}
          />
        )}
      </WizardStep>

      {result && (
        <SuccessStep
          result={result}
          forms={flow.formList}
          facts={[
            {
              label: tx('Rechnungsbetrag'),
              value: formatCurrency((resultAusleihe ? fieldNumber(resultAusleihe, 'rechnungsbetrag') : null) ?? summe ?? undefined),
            },
            {
              label: tx('Rückgabezeitpunkt'),
              value: (() => {
                const z = resultAusleihe ? fieldDate(resultAusleihe, 'rueckgabezeitpunkt') : null;
                return z ? format(parseISO(z), 'dd.MM.yyyy HH:mm') : format(parseISO(nowIso()), 'dd.MM.yyyy HH:mm');
              })(),
            },
          ]}
          next={[
            { label: tx('Weitere Rückgabe'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Ausleihe erfassen'), href: '#/intents/ausleihe-erfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Fahrrad ist wieder verfügbar und kann neu ausgeliehen werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
