import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// The full suite runs many jsdom workers in parallel; sample flows render
// several async panels and need longer than the 1s default to settle.
configure({ asyncUtilTimeout: 5000 });
