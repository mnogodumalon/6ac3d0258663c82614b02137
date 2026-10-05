/**
 * Ausleihe erfassen — 4-Schritt-Wizard.
 * Steps: 1) Kunden auswählen → 2) Verfügbares Fahrrad auswählen → 3) Rückgabe & Bemerkung → 4) Prüfen & speichern.
 * Reads: kunden, fahrraeder. Writes: ausleihen (create), fahrraeder (update: verfuegbar=false) — via useAusleiheErfassenFlow.
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
import { useAusleiheErfassenFlow } from '@/lib/journey/flows/AusleiheErfassen';
import { formatCurrency } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function AusleiheErfassenPage() {
  const [step, setStep] = useState(1);
  const flow = useAusleiheErfassenFlow({
    steps: { kunde: 1, fahrraeder: 2, fahrrad: 2, rueckgabezeitpunkt: 3, bemerkung: 3 },
    items: {
      kunde: k => ({
        id: k.id,
        title: `${fieldText(k, 'kunde_vorname')} ${fieldText(k, 'kunde_nachname')}`.trim(),
        subtitle: fieldText(k, 'handynummer'),
      }),
      fahrraeder: r => {
        const preis = fieldNumber(r, 'tagespreis');
        const groesse = fieldText(r, 'rahmengroesse');
        return {
          id: r.id,
          title: fieldText(r, 'bezeichnung'),
          subtitle: [fieldLookup(r, 'fahrradtyp')?.label, groesse ? tx`Rahmen ${groesse}` : '', preis != null ? tx`${formatCurrency(preis)} pro Tag` : '']
            .filter(Boolean).join(' · '),
        };
      },
    },
  });

  const pickBike = flow.pick('fahrraeder');
  const onPickBike = (id: string) => {
    pickBike.onSelect(id);
    flow.forms.ausleihen.set('fahrrad', id, flow.picks.fahrraeder.labelOf(id) ?? id);
  };

  return (
    <IntentWizardShell
      title={tx('Ausleihe erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein verfügbares Fahrrad für einen Kunden ausleihen.'),
        needs: [tx('Name des Kunden'), tx('Gewünschtes Fahrrad'), tx('Geplante Rückgabe')],
      }}
    >
      <WizardStep label={tx('Kunde')} description={tx('Wer leiht das Fahrrad aus?')}>
        <EntitySelectStep
          {...flow.picks.kunde.select}
          {...flow.pick('kunde')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Handynummer …')}
        />
      </WizardStep>
      <WizardStep label={tx('Fahrrad')} description={tx('Welches verfügbare Fahrrad nimmt der Kunde mit?')} needs={['kunde']}>
        <EntitySelectStep
          {...flow.picks.fahrraeder.select}
          selectedId={pickBike.selectedId}
          onSelect={onPickBike}
          avatar="none"
          searchPlaceholder={tx('Bezeichnung suchen …')}
          emptyText={tx('Zurzeit ist kein Fahrrad verfügbar.')}
        />
        <StepNav
          onBack={() => setStep(1)}
          onNext={() => flow.validateStep(2)}
          nextStepLabel={tx('Rückgabe')}
        />
      </WizardStep>
      <WizardStep label={tx('Rückgabe')} description={tx('Wann bringt der Kunde das Fahrrad zurück?')} needs={['fahrrad']}>
        <div className="space-y-4">
          <Bound form={flow.forms.ausleihen} name="rueckgabezeitpunkt" />
          <Bound form={flow.forms.ausleihen} name="bemerkung" rows={3} />
        </div>
        <StepNav
          onBack={() => setStep(2)}
          onNext={() => flow.validateStep(3)}
          nextStepLabel={tx('Prüfen')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Ausleihe wird mit dem aktuellen Zeitpunkt angelegt und das Fahrrad als nicht verfügbar markiert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Rückgabe buchen'), href: '#/intents/rueckgabe-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Bei der Rückgabe berechnet der Ablauf „Rückgabe buchen“ den Rechnungsbetrag.')}
        />
      )}
    </IntentWizardShell>
  );
}
