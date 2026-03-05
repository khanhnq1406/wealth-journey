# Security Audit Prompt Template

Use this template during the **review step** for a comprehensive security audit of the entire implementation.

**Purpose:** Full security audit across all changed files, checking cross-cutting concerns.

```
Task tool (general-purpose):
  description: "Security audit for [feature name]"
  prompt: |
    You are conducting a comprehensive security audit of a new feature
    in the WealthJourney personal finance application.

    ## Feature Summary

    [Brief description of what was implemented]

    ## Spec Reference

    [Path to spec file — read it for security requirements]

    ## All Changed Files

    [Complete list of files created/modified]

    ## Your Job

    This is a FINANCIAL application handling real money. Audit with extreme thoroughness.

    ### Phase 1: Read Everything

    Read ALL changed files completely. Don't skim. Don't trust summaries.

    ### Phase 2: OWASP Top 10 Audit

    For each applicable vulnerability:

    **A01 - Broken Access Control:**
    - Can an authenticated user access another user's resources?
    - Are there endpoints missing auth middleware?
    - Is user ID always extracted from JWT (not request params)?
    - Can URL parameters be manipulated to access other records?

    **A03 - Injection:**
    - Any raw SQL queries? (Should use GORM parameterized)
    - Any user input rendered as HTML without escaping?
    - Any shell commands constructed from user input?
    - Any file paths constructed from user input?

    **A04 - Insecure Design:**
    - Business logic flaws in financial calculations?
    - Missing rate limiting on sensitive operations?
    - Predictable resource identifiers?

    **A07 - Authentication Failures:**
    - Endpoints that should require auth but don't?
    - Token handling issues?
    - Session management problems?

    ### Phase 3: Financial-Specific Audit

    **Monetary Value Integrity:**
    - All monetary values use int64? (grep for float32/float64/parseFloat on money)
    - Currency arithmetic avoids floating point?
    - Proper rounding rules?
    - Int64 overflow checked for large values?

    **Transaction Integrity:**
    - Race conditions on balance updates? (concurrent transfers)
    - Double-spend prevention?
    - Idempotency for financial operations?
    - Consistent balance after all operations?

    **Data Consistency:**
    - Database transactions used for multi-step operations?
    - Rollback on partial failures?
    - Foreign key constraints maintained?

    ### Phase 4: Cross-Cutting Concerns

    **Error Handling:**
    - Do error responses leak internal information?
    - Are database errors wrapped before returning to client?
    - Do frontend error messages expose technical details?

    **Logging:**
    - Are financial operations logged?
    - Do logs contain sensitive data (passwords, tokens)?
    - Is there enough info for audit trail?

    **Configuration:**
    - Any hardcoded secrets?
    - Sensitive values in environment variables?
    - Default configurations secure?

    ### Phase 5: Frontend Security

    **XSS Prevention:**
    - User-generated content properly escaped?
    - dangerouslySetInnerHTML usage?
    - URL parameters reflected without sanitization?

    **Data Handling:**
    - Sensitive data stored in localStorage appropriately?
    - Auth tokens handled securely?
    - No sensitive data in URL parameters?

    ### Phase 6: Encryption & Data Protection

    **Transport Security:**
    - All API calls use HTTPS (no HTTP fallbacks)?
    - No mixed content (HTTP resources loaded on HTTPS pages)?
    - WebSocket connections (if any) use WSS?

    **Storage Security:**
    - Database connections use SSL (Supabase enforces this)?
    - Redis connections use TLS where available?
    - File uploads in Supabase Storage have proper access scoping?
    - No sensitive data in client-side storage without justification?

    **Key Management:**
    - All API keys, secrets, and credentials in environment variables?
    - No secrets committed to version control?
    - Service-to-service authentication uses proper credentials?

    ### Phase 7: Runtime Security Readiness

    **Monitoring & Alerting:**
    - Are financial operations (transactions, transfers, balance changes) logged with sufficient detail?
    - Do logs include: user ID, operation type, amounts, timestamps, IP address?
    - Are authentication events logged (login, logout, failed attempts, session revocation)?
    - Are error rates trackable? (Prometheus metrics exist for market data — verify coverage for new features)

    **Anomaly Detection Patterns:**
    - Does the feature have rate limiting appropriate to its risk level?
    - For financial operations: are there safeguards against unusual patterns?
      - Rapid successive transactions (potential automation abuse)
      - Transactions at unusual times or amounts (potential account compromise)
      - Multiple failed operations in sequence (potential brute force)
    - Are there circuit breakers for external API failures? (Yahoo Finance, vang.today)

    **Incident Response Considerations:**
    - Can suspicious sessions be revoked? (session management exists — verify new features integrate)
    - Can financial operations be audited after the fact? (audit trail completeness)
    - Is there enough log data to reconstruct what happened during an incident?
    - Can affected users be identified if a vulnerability is found?

    **Graceful Degradation:**
    - What happens when external services fail? (cache fallback, error messages)
    - What happens when rate limits are hit? (clear error, not silent failure)
    - What happens when database connections are exhausted? (queue or reject, not hang)

    ## Report Format

    ```markdown
    # Security Audit Report: [Feature Name]

    ## Audit Scope
    [Files reviewed, what was checked]

    ## Findings

    ### Critical (must fix before merge)
    | # | Finding | File:Line | Description | Recommendation |
    |---|---------|-----------|-------------|----------------|

    ### High (should fix before merge)
    | # | Finding | File:Line | Description | Recommendation |

    ### Medium (fix soon)
    | # | Finding | File:Line | Description | Recommendation |

    ### Low (improvement opportunities)
    | # | Finding | File:Line | Description | Recommendation |

    ## Positive Observations
    [Security practices done well]

    ## Verdict: [APPROVED / ISSUES FOUND]
    ```
```
