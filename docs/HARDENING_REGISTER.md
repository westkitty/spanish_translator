# Dexterpreter Hardening Register

This document converts the July 14, 2026 adversarial repository audit into enforceable work.

## Release status

Dexterpreter 1.0.1 is a release candidate. It is not a validated production release until every blocking gate below has evidence attached.

## Blocking gates

1. **Accuracy** — real Spanish audio fixtures, documented consent/provenance, aggregate WER threshold, translation review, and a gate that fails when fixtures are missing.
2. **Devices** — successful first-run online caching and later airplane-mode operation on representative Android hardware.
3. **Data safety** — explicit audio-retention choice, durable correction storage, confirmed deletion, recoverable storage failures, and documented Android backup behavior.
4. **Build integrity** — CI green, coherent version lineage, signed APK verification, checksums, and model dependency/license inventory.
5. **User experience** — truthful phase/progress reporting, surfaced translation failures, zoom/select accessibility, long-file limits, cache controls, and tested recovery paths.

## Audit recommendation ledger

| ID | Recommendation | Closure path | Status |
|---|---|---|---|
| H-01 | Add real accuracy evidence | Benchmark issue and fixtures | Open |
| H-02 | Make the evaluation gate non-vacuous | Code and CI | In progress |
| H-03 | Test the shipped transcription/translation path | Integration-test issue | Open |
| H-04 | Stop presenting unsigned artifacts as final releases | Docs/release workflow | In progress |
| H-05 | Reconcile version history | Release-lineage issue | Open |
| H-06 | Add GitHub automation | CI workflow | Applied |
| H-07 | Choose and add a repository license | Owner decision issue | Open |
| H-08 | Remove generated debris and stale platform roots | Repository-hygiene issue | Open |
| H-09 | Triage stacked draft pull requests | Repository-hygiene issue | Open |
| H-10 | Decompose App.tsx | Architecture issue | Open |
| H-11 | Correct long-file capability claims | Resource-safety issue | Open |
| H-12 | Reduce whole-file memory duplication | Resource-safety issue | Open |
| H-13 | Add model lifecycle and cache controls | Model/cache issue | Open |
| H-14 | Avoid full re-decode and base64 export paths | Resource-safety issue | Open |
| H-15 | Make project listing metadata-only | Storage issue | Open |
| H-16 | Ask before retaining raw audio | Data-safety issue | Open |
| H-17 | Surface persistence failures | Data-safety issue | Open |
| H-18 | Confirm destructive deletion | Data-safety issue | Open |
| H-19 | Narrow and document privacy claims | Data-safety issue | Open |
| H-20 | Pin model revisions and record licenses | Model/cache issue | Open |
| H-21 | Surface translation failures as failures | UX/inference issue | Open |
| H-22 | Report transcription and translation phases separately | UX/inference issue | Open |
| H-23 | Persist glossary rules and constrain their language scope | UX/inference issue | Open |
| H-24 | Reconcile README, FAQ, roadmap, and implementation claims | Documentation issue | Open |
| H-25 | Restore browser zoom and text selection | Accessibility issue | Open |

## Required evidence per release

- Exact source commit and version.
- CI run proving build, tests, and a non-empty accuracy gate.
- Device matrix with Android version, WebView version, model tier, input duration, first-run result, airplane-mode result, runtime, peak memory where observable, and export result.
- Benchmark fixture manifest with provenance and expected transcript.
- Signed artifact fingerprint and SHA-256 checksum.
- Model identifiers, pinned revisions, approximate cache sizes, and licenses.
- Known limitations and unresolved blocking issues.

## Policy

A release claim is not complete merely because the code path exists. Claims about accuracy, privacy, offline behavior, supported duration, hardware compatibility, signing, and release readiness require attached evidence.