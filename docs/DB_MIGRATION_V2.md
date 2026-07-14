# IndexedDB migration: version 2

Dexterpreter version 2 of the local database separates project-list metadata from full project records.

## Why

The previous `listProjects()` implementation called `getAll()` on the `projects` store. Each record contains the original audio blob, transcript words, translation, and waveform peaks. Although the function removed those fields before returning, IndexedDB had already loaded them into memory.

## Schema

- `projects`: complete local project records.
- `projectMeta`: lightweight records containing only `id`, `name`, `createdAt`, `updatedAt`, `model`, and `durationSec`.
- Both stores use the project ID as their key.
- Both stores have an `updatedAt` index.

## Migration

Opening a version 1 database at version 2 creates `projectMeta` and copies metadata from every existing project during the IndexedDB upgrade transaction. Audio, transcripts, translations, and peaks remain only in `projects`.

Future project writes and deletions update both stores in one transaction so the library cannot intentionally commit mismatched metadata.
