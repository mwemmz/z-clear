# UI redesign: API notes

The three-theme, phone-first UI redesign changes no API contract.

- Routes, DTOs, request/response shapes and `apps/api/src/openapi.ts` are
  unchanged. The generated spec at `/api/docs` remains the source of truth.
- `apps/web/src/screens` consumes the existing client data shapes. New state
  variants (`loading`, `empty`, `error`, `denied`, `stale`) are presentation
  only; they do not add endpoints or fields.
- `apps/web/src/mockups` is static, labelled sample data and makes no network
  calls. It must never be shown as a ZRA figure or live status feed.
- The dev-only gallery at `/design` accepts `?screen=` and `?state=` for
  screenshots. These are local UI parameters, never API parameters.
