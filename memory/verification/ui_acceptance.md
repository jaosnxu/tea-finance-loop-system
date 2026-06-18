# UI Acceptance Standard

Every managed frontend project should define browser verification before production release.

Required checks:
- Login works for seeded accounts.
- Role-based menus match permissions.
- Primary dashboard renders without server error.
- Primary list page supports role/status filtering.
- Primary detail page shows current node, current handler, status, and ledger/payment state.
- Primary form minimizes manual input and uses configured defaults.
- Russian text fits in controls and table columns.
- Chinese testing locale remains available.
- No incoherent text overlap at desktop and mobile widths.

Tea finance V1 browser paths:
- `/login`
- `/dashboard`
- `/dashboard/approvals`
- `/dashboard/payments`
- `/dashboard/ledger`
- `/dashboard/reports`
- `/dashboard/settings/access`

