# Step 4: Review

**Input:** Implementation report path from implement step.

**Goal:** Final review of the entire implementation against the spec, with focus on security, cross-cutting concerns, and integration correctness.

### Process

1. **Read the implementation report**
2. **Read the original spec**
3. **Read the plan**
4. **Dispatch review agents in parallel:**

   a. **Full Spec Compliance Review** — Read ALL changed files, verify against every requirement in the spec

   b. **Security Audit** — Use `./security-audit-prompt.md` for comprehensive security review:
   - OWASP Top 10 check (Phase 2)
   - Financial-specific audit: monetary integrity, race conditions, FIFO accounting (Phase 3)
   - Cross-cutting: error handling, logging, configuration (Phase 4)
   - Frontend security: XSS, data handling (Phase 5)
   - Encryption & data protection: TLS, key management (Phase 6)
   - Runtime security readiness: monitoring, anomaly detection, incident response (Phase 7)

   c. **Integration Review** — Verify components work together:
   - Proto → Backend → Frontend data flow
   - Error propagation
   - Loading states
   - Edge cases

   d. **Architecture Diagram Review** — Verify architecture documentation is updated:
   - New components reflected in L3 C4 diagrams
   - New complex domains have L4 code diagrams
   - Existing C4 diagrams updated if backend/frontend structure changed
   - Runtime flow diagrams created/updated for new multi-step business logic
   - Flow diagrams accurately trace through actual service code (not hypothetical)
   - Flow diagrams include error paths and key invariants
   - `docs/architecture/README.md` updated if new flow files were created
   - Mermaid syntax renders correctly

   e. **Dependency Impact Review** (if GitNexus index available) — Use `./impact-reviewer-prompt.md` for automated blast radius verification:
   - Run `gitnexus_detect_changes({scope: "staged"})` to map all affected execution flows
   - Run `gitnexus_impact` on each changed symbol to find d=1/d=2 dependents
   - Cross-reference against tests written — flag untested affected flows
   - Verify no d=1 callers were missed by the implementation

5. **Compile verdict:**
   - **APPROVED** — All reviews pass, ready for production
   - **ISSUES FOUND** — List specific issues with severity and file:line references

### Verdict Format

```markdown
## Review Verdict: [APPROVED / ISSUES FOUND]

### Spec Compliance: [PASS / FAIL]

[Details]

### Security Audit: [PASS / FAIL]

[Details with specific findings]

### Integration Review: [PASS / FAIL]

[Details]

### Architecture Diagrams: [PASS / FAIL]

[C4 + runtime flow diagram updates]

### Dependency Impact: [PASS / FAIL / SKIPPED — no GitNexus index]

[Blast radius analysis, untested affected flows, missed callers]

### Issues (if any)

| #   | Severity | Category | Description | File:Line |
| --- | -------- | -------- | ----------- | --------- |
| 1   | Critical | Security | ...         | ...       |

### Recommendation

[Approve / Fix issues and re-review]
```
