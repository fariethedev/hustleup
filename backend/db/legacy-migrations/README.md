# Legacy migrations — kept for reference, never executed

These are `V1` through `V11` as they existed before the schema was put under Flyway.
They used to sit in `src/main/resources/db/migration` in **all five** database-backed
services, as five byte-identical copies (verified by hash before being consolidated here).

## Why they are not on the classpath any more

**They never ran, and they cannot run.** Flyway was neither a dependency nor configured
until August 2026, so nothing ever executed them. The live schema was built by Hibernate
under `ddl-auto: update`, growing column by column as entities changed. These files
describe a database that has never existed.

Flyway is now configured with `baseline-version: 11`, which records the live schema as
already being at version 11 — so everything here is below the baseline and is skipped by
definition. Real migrations start at `V12`, and live in
`hustleup-common/src/main/resources/db/migration` (one shared set, because all six
services share one database).

## Why they were dangerous where they were

They are completely unguarded — `V1` opens with a bare `CREATE TABLE users`, `V8` with a
bare `ALTER TABLE posts ADD COLUMN media_urls`. Had the baseline been set to 1, as the
first attempt did, Flyway would have run `V2`–`V11` against a schema that already contains
all of it and failed on the first statement, part-way through.

They also collided outright: adding a `V1__baseline.sql` in `hustleup-common` produced

```
Found more than one migration with version 1
-> BOOT-INF/classes/db/migration/V1__init_schema.sql
-> hustleup-common.jar!/db/migration/V1__baseline.sql
```

which is how their existence was discovered at all.

## If you ever need a real V1

Standing up a genuinely empty database is still the open gap: baselining skips straight
past these, so nothing creates the base tables. The reliable way to produce one is to dump
the live schema rather than trust anything in this folder:

```
mysqldump --no-data --skip-add-drop-table railway > V1__init_schema.sql
```

Renumbering that below the current baseline would need care — it is a change to how every
environment bootstraps, not just a new file.
