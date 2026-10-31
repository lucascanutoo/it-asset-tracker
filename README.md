# IT Asset Tracker

An IT equipment inventory application that centralizes computer records, user assignments, replacement evaluations, and deliveries. It helps IT teams find assets, keep inventory records up to date, and plan equipment replacements.

This version was prepared for portfolio demonstrations. Its visual identity, accounts, and all records are fictional and were created from scratch. The application interface is in Brazilian Portuguese.

## Problems it solves

| Problem | How the application helps |
| --- | --- |
| Equipment information scattered across spreadsheets or separate records | Provides a central interface to add, edit, and look up assets. |
| Difficulty identifying who uses each computer and which department it belongs to | Links equipment to its user, department, operating system, and ownership type. |
| Limited visibility into equipment distribution | Displays metrics and charts with filters for department, equipment type, operating system, and ownership type. |
| Difficulty tracking owned and leased equipment | Filters assets by ownership type and provides a dedicated view of leased machines. |
| Replacement requests without clear priorities | Records evaluations and suggests a priority based on failure frequency and impact on work, with approval subject to technical review. |
| Gaps in tracking between replacement approval and delivery | Organizes approved requests in a delivery list with status, date, and recipient details. |
| Duplicate work when registering replacement equipment | Creates or updates the new equipment record when delivery details are saved. |
| Difficulty tracing inventory changes | Keeps an audit history of additions, edits, and deletions, including the responsible account and previous and new values. |

## Features

- Create, edit, delete, and look up equipment records.
- Search, filter, sort, and paginate the inventory.
- Explore an interactive dashboard and export the current selection to CSV.
- Register equipment replacement evaluations.
- Record technical reviews, approvals, and deliveries.
- View inventory audit history.
- Sign in with session-based authentication and demo administrator accounts.

## Typical workflow

1. Register equipment and assign its users.
2. Browse the inventory and analyze asset distribution on the dashboard.
3. Register an evaluation when equipment may need replacement.
4. Review the suggested priority, record a technical assessment, and decide whether to approve the request.
5. Track delivery and link the new equipment to the inventory.
6. Check the audit history to review inventory changes.

## Technology

- **Node.js and Express:** application API and web server.
- **SQLite:** local inventory and audit storage.
- **JSON:** local storage for replacement evaluations and deliveries.
- **HTML, CSS, JavaScript, and Bootstrap:** web interface with locally served assets.

## Run locally

Requires Node.js 24 or later and npm. From the project directory:

```powershell
npm ci --ignore-scripts
npm start
```

Open [the local application](http://127.0.0.1:4317).

Demo accounts: `demo.admin` or `demo.gestor`. The public password for both is `Demo-Portfolio-2026!`. Both accounts have administrator access to demonstrate the complete workflow. Do not reuse these credentials in other systems.

## Configuration and data

Optionally, copy `.env.example` to `.env` and change `DEMO_PORT`. No other configuration is accepted. Do not configure external servers or credentials.

On first startup, the application generates 72 synthetic equipment records and 12 synthetic evaluations in `data/demo.sqlite` and `data/evaluations.json`. The `data` directory and `.env` file are excluded from Git. To restore the initial scenario, stop the server and delete only this project's `data` directory; the files will be recreated on the next startup.

The server accepts direct local access only, without proxies or external origins, and refuses to start with `NODE_ENV=production`. The demo has no connections to corporate infrastructure. Its public accounts are intended for local use only; do not expose the application to the internet.

## Licensing and publication

Bootstrap's MIT license notice is included in `frontend/vendor/bootstrap/LICENSE`. Before publishing code, designs, or business rules reused from professional work, confirm that you have the company's authorization. No redistribution license has been assumed for the project's own code.
