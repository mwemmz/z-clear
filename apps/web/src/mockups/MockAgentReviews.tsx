import { MockScreen } from './MockScreen';
import type { ImporterReviewState } from '@zclear/shared';

const REVIEWS: {
  reference: string;
  client: string;
  revision: number;
  state: ImporterReviewState;
  action: string;
}[] = [
  { reference: 'DEMO-IMPORT-0001', client: 'Kafue Metals Ltd', revision: 3, state: 'in_review', action: 'Awaiting importer' },
  { reference: 'DEMO-IMPORT-0002', client: 'Sunshine Trading', revision: 1, state: 'queried', action: 'Answer query' },
  { reference: 'DEMO-EXPORT-0007', client: 'Copperbelt Foods', revision: 2, state: 'approved', action: 'Filed manually' },
];

const STATE_LABEL: Record<ImporterReviewState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  queried: 'Queried',
  approved: 'Approved',
};

/** Agent's review inbox (sample data). */
export function MockAgentReviews() {
  return (
    <MockScreen label="Agent reviews" note="The agent's queue of importer review revisions.">
      <ul className="mock-list">
        {REVIEWS.map((review) => (
          <li key={review.reference} className={`is-${review.state}`}>
            <div>
              <strong>{review.reference}</strong>
              <span className="mock-list__sub">
                {review.client} · rev {review.revision}
              </span>
            </div>
            <div className="mock-list__meta">
              <span className={`mock-pill mock-pill--${review.state}`}>{STATE_LABEL[review.state]}</span>
              <span className="mock-list__action">{review.action}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mock-hint">One tap opens the revision; approval binds to the exact revision shown.</p>
    </MockScreen>
  );
}
