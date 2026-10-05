/**
 * Fahrrad ausleihen — 3-Schritt-Wizard.
 * Steps: 1) Kunden auswählen → 2) Verfügbares Fahrrad wählen + Rückgabe festlegen → 3) Ausleihe bestätigen.
 * Reads: kunden, fahrraeder. Writes: ausleihen (create), fahrraeder (update: verfuegbar = false).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldNumber } from '@/lib/journey';
import { useFahrradAusleihenFlow } from '@/lib/journey/flows/FahrradAusleihen';
import { formatCurrency } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function FahrradAusleihenPage() {
  const [step, setStep] = useState(1);
  const bikeItem = (r: Parameters<typeof fieldText>[0]) => ({
    id: r.id,
    title: fieldText(r, 'bezeichnung'),
    subtitle: fieldLookup(r, 'fahrradtyp')?.label,
    status: fieldLookup(r, 'zustand') ?? undefined,
    stats: [{ label: tx('Tagespreis'), value: formatCurrency(fieldNumber(r, 'tagespreis') ?? 0) }],
  });
  const flow = useFahrradAusleihenFlow({
    steps: { kunde: 1, fahrrad: 2, fahrraeder: 2, bemerkung: 2, rueckgabezeitpunkt: 2 },
    items: {
      kunde: r => ({
        id: r.id,
        title: `${fieldText(r, 'kunde_vorname')} ${fieldText(r, 'kunde_nachname')}`.trim(),
        subtitle: fieldText(r, 'handynummer'),
      }),
      fahrrad: bikeItem,
      fahrraeder: bikeItem,
    },
  });

  const bikeId = flow.forms.ausleihen.get('fahrrad') as string | null;
  const bikePick = flow.pick('fahrrad');

  const selectBike = (id: string) => {
    bikePick.onSelect(id);
    flow.pick('fahrraeder').onSelect(id);
  };

  const checkBike = () => {
    if (!flow.validateStep(2)) return false;
    const rec = bikeId ? flow.picks.fahrrad.recordOf(bikeId) : undefined;
    if (rec && rec.fields['verfuegbar'] !== true) return tx('Dieses Fahrrad ist derzeit nicht verfügbar.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Fahrrad ausleihen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Kunde und freies Fahrrad wählen und die Ausleihe starten.'),
        needs: [tx('Name des Kunden'), tx('Gewünschtes Fahrrad'), tx('Geplante Rückgabe')],
      }}
    >
      <WizardStep label={tx('Kunde')} heading={tx('Kunden auswählen')} description={tx('Wer leiht das Fahrrad aus?')}>
        <EntitySelectStep
          {...flow.picks.kunde.select}
          {...flow.pick('kunde')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Handynummer …')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Fahrrad')}
        heading={tx('Verfügbares Fahrrad auswählen')}
        description={tx('Nur freie Fahrräder werden angezeigt. Lege außerdem die geplante Rückgabe fest.')}
        needs={['kunde']}
      >
        <div className="space-y-4">
          <EntitySelectStep
            {...flow.picks.fahrrad.select}
            selectedId={bikeId}
            onSelect={selectBike}
            avatar="none"
            searchPlaceholder={tx('Fahrrad suchen …')}
            emptyText={tx('Zurzeit ist kein Fahrrad verfügbar.')}
          />
          <Bound form={flow.forms.ausleihen} name="rueckgabezeitpunkt" />
          <Bound form={flow.forms.ausleihen} name="bemerkung" rows={2} />
          <StepNav onBack={() => setStep(1)} onNext={checkBike} nextStepLabel={tx('Bestätigen')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Bestätigen')} heading={tx('Ausleihe bestätigen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Ausleihe startet jetzt und das Fahrrad wird als nicht verfügbar markiert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Bei der Rückgabe berechnet der Ablauf „Fahrrad zurücknehmen“ den Rechnungsbetrag.')}
          next={[
            { label: tx('Fahrrad zurücknehmen'), href: '#/intents/fahrrad-zuruecknehmen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
