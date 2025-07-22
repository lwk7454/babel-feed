# PostgreSQL DB with Drizzle

## Rules
- Always use Drizzle generators and migrations to update schemas. Never directly send table altering SQL commands to DB. 
- Always keep using the singleton DB instance, never create new DB instances in test.
- All tests rely on preload scripts in (project-root)/bunfig.toml
- For schema management, migration are for test DB only. Dev and Prod use `drizzle-kit push` only. Every test run generates new migration files, so those files are not commited to git
- Be mindful of overheads in multiple file test run. For example we don't want to run migration for every test file, that's why we use preload scripts. It's tricky to keep the migrated DB instance because it's in-memory PGlite and gets destroyed across processes (needs more investigation). 
- Test utilities should not redeclare list of tables or any schema. We should always have single source of definition in DB schema. 