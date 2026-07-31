# PostgreSQL

Files in `migrations/` create and evolve the application
schema. Applied migrations must not be edited; later schema changes belong in
a new numbered migration.

Survey-response data is stored in PostgreSQL. Sanity remains the content
management source for gamification copy.

## Connection targets

Host development and Docker Compose use different PostgreSQL hostnames:

| Runtime | Configuration | Database host |
| :--- | :--- | :--- |
| `npm run dev:server`, `npm run db:migrate`, and other host commands | `DATABASE_URL` from `app/.env` | `127.0.0.1:5432` |
| Compose application and migration containers | `DATABASE_URL` override in `compose.yaml` | `postgres:5432` |

`postgres` is a service name on Compose's private network and cannot be
resolved by a command running directly on Windows. Conversely, a container
cannot use `127.0.0.1` to reach the PostgreSQL container because that address
refers to the container itself.

The checked-in `.env.example` therefore uses `127.0.0.1` for host development.
Compose replaces that value inside its application and migration containers,
so the same local `.env` can support both workflows.

## Applying migrations

Apply migrations to the host-development database configured in `app/.env`:

```powershell
npm run db:migrate
```

From `app/`, apply pending migrations to the private Compose database with:

```powershell
docker compose run --rm migrate
```

The runner executes each file once inside a transaction and records its SHA-256
checksum in `schema_migrations`. `npm run db:migrate` runs the same migration
code against the `DATABASE_URL` supplied to the host process.

`docker compose run --rm repository-test` uses a separate, tmpfs-backed
`butterfly_effect_test` database. The integration suite also checks the
database name before it can truncate fixtures, so it refuses to run against
the application database.

## Importing survey responses from Sanity

The survey importer accepts either Sanity's `data.ndjson` or the `.tar.gz`
dataset export containing it. It selects published `userResponseV4` documents;
gamification copy and older response schemas remain untouched.

Preview a local import:

```powershell
npm run db:import:sanity-survey -- ../sanity/data-backups/<export>.tar.gz --dry-run
```

Remove `--dry-run` to commit it. The import is transactional and safe to rerun:
existing Sanity IDs are updated only when their exported values changed. Before
commit, the importer reads every selected row back from PostgreSQL and compares
it with the export. It refuses to overwrite a row created natively through the
PostgreSQL-backed API.

For the Compose database, mount the backup directory into a one-off app
container:

```powershell
docker compose run --rm --build `
  --volume ../sanity/data-backups:/imports:ro `
  app node dist-server/server/upstreams/postgres/importSanitySurveyResponses.js `
  /imports/<export>.tar.gz --dry-run
```

Repeat without `--dry-run` after reviewing the insert/update counts. Take a
fresh Sanity export and rerun the importer immediately before the production
cutover so edits made after the first backup are included.
