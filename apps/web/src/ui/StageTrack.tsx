import { Check, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  stageProgress,
  type ShipmentStatus,
} from '@zclear/shared';

interface Props {
  stage: ShipmentStatus;
  updatedLabel?: string;
}

const ADVANCE_MS = 280;

/** The one orchestrated motion moment: progress advances when a stage changes. */
export function StageTrack({ stage, updatedLabel }: Props) {
  const stageIndex = stageProgress(stage);
  const progress = Math.max(stageIndex, 0);
  const ratio = stageIndex < 0 ? 0 : progress / (SHIPMENT_STAGES.length - 1);
  const previous = useRef(stage);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (previous.current === stage) return;
    previous.current = stage;
    setAnimate(true);
    const timer = window.setTimeout(() => setAnimate(false), ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  return (
    <div
      className="stage-track"
      data-animate={animate || undefined}
      data-held={stage === 'on_hold' || undefined}
      style={{ '--stage-ratio': ratio } as CSSProperties}
      aria-label={`Current stage: ${SHIPMENT_STATUS_LABELS[stage]}`}
    >
      <div className="stage-track__rail" aria-hidden="true">
        <span className="stage-track__progress" />
      </div>
      <ol className="stage-track__steps">
        {SHIPMENT_STAGES.map((step, index) => {
          const state =
            stageIndex < 0
              ? 'next'
              : index < stageIndex
                ? 'done'
                : index === stageIndex
                  ? 'current'
                  : 'next';
          return (
            <li
              key={step}
              className="stage-track__step"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="stage-track__node" aria-hidden="true">
                {state === 'done' ? <Check size={16} weight="bold" /> : null}
                {state === 'current' && stage === 'on_hold' ? (
                  <WarningCircle size={16} weight="bold" />
                ) : null}
              </span>
              <span className="stage-track__label">{SHIPMENT_STATUS_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>
      <p className="stage-track__caption">
        {stage === 'on_hold' ? (
          <>
            <WarningCircle size={16} aria-hidden="true" /> On hold · last recorded stage needs
            attention
          </>
        ) : (
          SHIPMENT_STATUS_LABELS[stage]
        )}
        {updatedLabel ? <span> · {updatedLabel}</span> : null}
      </p>
    </div>
  );
}
