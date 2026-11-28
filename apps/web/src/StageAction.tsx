import { ArrowRight, PauseCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  stageProgress,
  type ShipmentStatus,
} from '@zclear/shared';
import { api, messageOf, type ShipmentDetail } from './api';
import { Button, StatePanel } from './ui';

interface Props {
  token: string;
  shipment: ShipmentDetail;
  canUpdate: boolean;
  onUpdated: () => Promise<void>;
}

/** One-tap manual stage control. Never touches ASYCUDA or any ZRA service. */
export function StageAction({ token, shipment, canUpdate, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState('Awaiting importer documents');

  if (!canUpdate) {
    return (
      <section className="card" aria-labelledby="stage-action-heading">
        <span className="eyebrow">Agency action</span>
        <h2 id="stage-action-heading">Stage changes</h2>
        <p className="hint">
          Only agency staff can record a stage. Customs updates stay in ASYCUDA.
        </p>
      </section>
    );
  }

  const index = stageProgress(shipment.stage);
  const nextStage: ShipmentStatus =
    shipment.stage === 'on_hold'
      ? 'submitted'
      : (SHIPMENT_STAGES[Math.min(index + 1, SHIPMENT_STAGES.length - 1)] ?? 'delivered');
  const isFinal = index === SHIPMENT_STAGES.length - 1;

  async function record(stage: ShipmentStatus, hold?: string): Promise<void> {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateShipmentStage(token, shipment.id, {
        stage,
        ...(hold
          ? { holdReason: hold, note: hold }
          : { note: `Manual record: ${SHIPMENT_STATUS_LABELS[stage]}` }),
      });
      setSuccess(true);
      await onUpdated();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="stage-action-heading">
      <div className="current-case__header">
        <div>
          <span className="eyebrow">Agency action</span>
          <h2 id="stage-action-heading">Record a stage</h2>
        </div>
        <span className="badge">One tap</span>
      </div>
      <p className="hint">
        This saves the agency’s own manual record. It does not submit anything to ZRA.
      </p>

      {error && (
        <StatePanel
          variant="error"
          message={error}
          action={
            <Button onClick={() => setError(null)} variant="ghost">
              Dismiss
            </Button>
          }
        />
      )}

      {isFinal && shipment.stage !== 'on_hold' ? (
        <p className="empty">Final stage recorded. No further stage change is available.</p>
      ) : (
        <div className="stage-actions">
          <Button
            variant="primary"
            loading={busy}
            success={success}
            onClick={() => void record(nextStage)}
          >
            <ArrowRight size={20} aria-hidden="true" />
            {shipment.stage === 'on_hold'
              ? 'Resume manual record'
              : `Mark ${SHIPMENT_STATUS_LABELS[nextStage]}`}
          </Button>
          {shipment.stage !== 'on_hold' && (
            <div className="stage-actions__hold">
              <label htmlFor="hold-reason">Hold reason</label>
              <input
                id="hold-reason"
                value={holdReason}
                maxLength={500}
                onChange={(event) => setHoldReason(event.target.value)}
              />
              <Button loading={busy} onClick={() => void record('on_hold', holdReason.trim())}>
                <PauseCircle size={20} aria-hidden="true" /> Put on hold
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
