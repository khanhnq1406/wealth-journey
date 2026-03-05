# Security Analysis Checklist

Use this checklist during the **brainstorm step** to identify security concerns before writing the spec.

## OWASP Top 10 Relevance

For each item, assess if the new feature introduces or is affected by:

| # | Vulnerability | Relevant? | Notes |
|---|--------------|-----------|-------|
| A01 | Broken Access Control | | Can users access others' data? |
| A02 | Cryptographic Failures | | Are we storing/transmitting sensitive data? |
| A03 | Injection | | Does this accept user input that hits DB/shell/HTML? |
| A04 | Insecure Design | | Are there flaws in the business logic? |
| A05 | Security Misconfiguration | | New configs, endpoints, or defaults? |
| A06 | Vulnerable Components | | New dependencies introduced? |
| A07 | Authentication Failures | | Does this affect login/session/token flows? |
| A08 | Data Integrity Failures | | Can data be tampered with? |
| A09 | Logging Failures | | Are security events properly logged? |
| A10 | SSRF | | Does this make server-side requests based on user input? |

## Financial-Specific Concerns

| Concern | Question | Assessment |
|---------|----------|------------|
| Money manipulation | Can a user send a negative amount? Overflow int64? | |
| Race conditions | Can concurrent requests cause double-spend or duplicate transactions? | |
| Rounding errors | Are monetary calculations using int64 (not float)? | |
| Currency mismatch | Can a user exploit currency conversion logic? | |
| Audit trail | Are all financial operations logged with before/after state? | |
| Idempotency | Can retrying an operation cause unintended duplicates? | |
| Balance consistency | After all operations, do wallet balances remain consistent? | |

## Encryption & Data Protection

| Concern | Question | Assessment |
|---------|----------|------------|
| **TLS in transit** | Are all client-server communications over HTTPS/TLS? No mixed content? | |
| **Database encryption** | Is Supabase configured with encryption at rest? SSL connections enforced? | |
| **Redis encryption** | Is Redis connection using TLS? Are sensitive cache values encrypted? | |
| **Sensitive fields** | Are passwords hashed (bcrypt/argon2)? Are tokens stored securely? | |
| **API keys** | Are all API keys (Yahoo, Supabase, Google) in environment variables, not code? | |
| **File uploads** | Are uploaded bank statements encrypted at rest in Supabase Storage? Access scoped? | |
| **Client-side storage** | Is JWT in localStorage acceptable? (Consider httpOnly cookies for sensitive ops) | |
| **Backup encryption** | Are database backups encrypted? Access restricted? | |

## Compliance & Data Governance

| Concern | Question | Assessment |
|---------|----------|------------|
| **Data retention** | How long is financial data kept? Is there a retention policy? | |
| **Right to deletion** | Can users delete their account and all associated data? Is deletion complete (wallets, transactions, investments, sessions, imports)? | |
| **Data export** | Can users export their financial data? (CSV export exists for transactions) | |
| **Audit logging** | Are financial operations logged with sufficient detail for dispute resolution? | |
| **Data minimization** | Does the feature collect only necessary data? No excessive data gathering? | |
| **Cross-border data** | Where is data stored geographically? (Supabase region) Relevant for users in regulated jurisdictions? | |
| **Third-party data sharing** | Does data flow to third-party APIs? What data? Is it minimized? | |

**Note:** WealthJourney is a personal finance tracker, not a payment processor. Full PCI-DSS compliance is not required, but financial data protection principles still apply. Users trust the application with sensitive financial information.

## Authorization Matrix

For each operation in the feature, define who can do what:

| Operation | Owner | Other User | Unauthenticated | Notes |
|-----------|-------|------------|-----------------|-------|
| Create | | | | |
| Read | | | | |
| Update | | | | |
| Delete | | | | |
| List | | | | |

## Data Classification

| Data Field | Sensitivity | Protection Required |
|------------|------------|-------------------|
| | Public / Internal / Confidential / Restricted | |

## External Dependency Risk Assessment

Assess risks from third-party services and packages this feature depends on.

### Third-Party API Trust Assessment

| External Service | Data Exchanged | Trust Level | Failure Impact | Compromise Impact | Mitigations |
|-----------------|----------------|-------------|----------------|-------------------|-------------|
| Yahoo Finance | Market prices, symbol search | Low (public data) | Stale prices shown | Manipulated prices → incorrect PNL | Cache validation, price range checks, rate alerts |
| vang.today | Gold/silver prices | Low (public data) | Stale prices shown | Manipulated prices → incorrect valuations | Price range checks, cross-reference validation |
| Google OAuth | User identity tokens | Medium (auth) | Login unavailable | Account takeover | Token signature verification, nonce validation |
| Supabase Storage | Bank statement files | Medium (user data) | Import unavailable | Data leak of financial statements | Signed URLs, expiration, access scoping |
| Supabase PostgreSQL | All domain data | High (primary store) | Application down | Full data breach | Connection encryption, RLS policies, backup strategy |
| Redis | Sessions, cache | Medium (ephemeral) | Auth degradation | Session hijacking | TLS, password auth, no sensitive data as plain text |

### Package/Dependency Assessment

| Concern | Question | Assessment |
|---------|----------|------------|
| New npm packages | Any new frontend dependencies? Are they maintained? Known vulnerabilities? | |
| New Go modules | Any new backend dependencies? License compatible? Security advisories? | |
| Transitive dependencies | Do new packages pull in risky transitive dependencies? | |
| Supply chain | Are packages pinned to exact versions? Lock files committed? | |

### Failure Mode Analysis

| External Service | Failure Scenario | Application Behavior | User Impact |
|-----------------|------------------|---------------------|-------------|
| Yahoo Finance down | API timeout/5xx | Serve stale cached prices | Prices may be outdated (show cache age) |
| vang.today down | API timeout/5xx | Serve stale cached prices | Gold/silver prices outdated |
| Google OAuth down | Token verification fails | Cannot authenticate | Existing sessions still work; new logins blocked |
| PostgreSQL down | Connection refused | All operations fail | Full outage — show maintenance page |
| Redis down | Connection refused | Auth fallback, no cache | Degraded performance, sessions may be lost |

## Input Validation Requirements

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| | string/int/enum/date | max length, range, pattern | required |

## Data Flow Diagram (DFD) — REQUIRED Before STRIDE

**Draw a DFD before applying STRIDE.** STRIDE applied without data flows is ad-hoc and misses threats at boundary crossings.

### How to Create the DFD

Map every data flow for the feature using this template:

```
[Source] --( data description )--> [Trust Boundary] --( validated data )--> [Destination]
```

**DFD Elements:**

| Element | Symbol | Example |
|---------|--------|---------|
| External entity | Rectangle | User, External API |
| Process | Circle/Rounded | Auth Handler, Wallet Service |
| Data store | Parallel lines | PostgreSQL, Redis |
| Data flow | Arrow with label | "JWT token", "wallet balance (int64)" |
| **Trust boundary** | **Dashed line** | **Internet ↔ App, App ↔ DB, App ↔ External API** |

**DFD Template (fill for your feature):**

```markdown
### Data Flows

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Form input | Yes: Internet → App | REST Handler | Untrusted input |
| 2 | REST Handler | Parsed request | No (same tier) | Service Layer | Validated by handler |
| 3 | Service Layer | Domain model | Yes: App → DB | PostgreSQL | GORM parameterized |
| 4 | External API | Price data | Yes: External → App | Market Data Service | Untrusted response |

### Trust Boundaries in This Feature

| Boundary | Crossed By | Security Control Required |
|----------|-----------|--------------------------|
| Internet → Application | User requests | JWT auth + input validation |
| Application → Database | Queries | Parameterized queries, ownership check |
| Application → External API | Outbound calls | Response validation, timeouts, fallback |
| External API → Application | Inbound data | Type/range validation, sanitize before store |
```

**Apply STRIDE to each trust boundary crossing** (not just to the feature as a whole):

## Threat Modeling (STRIDE per Trust Boundary)

For **each trust boundary crossing** identified in the DFD above, apply STRIDE:

| Data Flow # | Boundary | Threat | Description | Applies? | Mitigation |
|-------------|----------|--------|------------|----------|------------|
| | Internet → App | **S**poofing | Can identity be faked? | | |
| | Internet → App | **T**ampering | Can request data be modified? | | |
| | Internet → App | **R**epudiation | Can actions be denied later? | | |
| | Internet → App | **I**nfo Disclosure | Can error messages leak internals? | | |
| | Internet → App | **D**oS | Can the endpoint be overwhelmed? | | |
| | Internet → App | **E**levation | Can a user gain higher access? | | |
| | App → DB | **T**ampering | Can SQL injection modify data? | | |
| | App → DB | **I**nfo Disclosure | Can queries leak other users' data? | | |
| | App → External | **S**poofing | Can external API response be faked? | | |
| | App → External | **T**ampering | Can price/rate data be manipulated? | | |
| | External → App | **I**nfo Disclosure | Does cached external data leak? | | |
