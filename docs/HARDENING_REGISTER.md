# Dexterpreter Hardening Register

This document converts the July 14, 2026 adversarial repository audit into enforceable work.

## Release status

Dexterpreter 1.0.1 is a release candidate. It is not a validated production release until every blocking gate below has evidence attached.

## Blocking gates

1. Accuracy: real Spanish audio fixtures, documented consent/provenance, aggregate WER threshold, translation review, and a gate that fails when fixtures are missing.
2. Devices: successful first-run online caching and later airplane-mode operation on representative Android hardware.
3. Data safety: explicit audio-retention choice, durable correction storage, confirmed deletion, recoverable storage failures, and documented Android backup behavior.
4. Build integrity: CI green, reproducible version lineage, signed APK verification