# WealthJourney Architecture Documentation

This directory contains the C4 model architecture documentation for the WealthJourney personal finance management system. All diagrams use Mermaid.js and render natively in GitHub.

## C4 Model Levels

| Level | Document | Description |
|-------|----------|-------------|
| 1 | [System Context](c4-context.md) | WealthJourney in its environment — users and external systems |
| 2 | [Containers](c4-container.md) | Major runtime units — SPA, REST API, gRPC, workers, databases |
| 3 | [Backend Components](c4-component-backend.md) | Internal backend structure — handlers, services, repositories |
| 3 | [Frontend Components](c4-component-frontend.md) | Internal frontend structure — features, shared, API layer |
| 4 | [Investment Domain Code](c4-code-investment.md) | Class-level detail of the investment bounded context |

## Dynamic Behavior Diagrams

Runtime flows showing how data moves through the system during feature execution. These complement the C4 static structure diagrams above — C4 shows "what exists", flow diagrams show "what happens when".

| Document | Domain | Diagrams | Key Flows |
|----------|--------|----------|-----------|
| [Auth Flows](flow-auth.md) | Authentication | 3 | OAuth login/register, JWT middleware, session lifecycle |
| [Wallet Flows](flow-wallet.md) | Wallet | 3 | Create with initial balance, fund transfer, delete options |
| [Transaction Flows](flow-transaction.md) | Transaction | 4 | CRUD operations, bank statement import pipeline |
| [Investment Flows](flow-investment.md) | Investment | 6 | FIFO sell, buy with lot merge, dividends, price updates, portfolio summary |
| [Cross-Cutting Flows](flow-cross-cutting.md) | Infrastructure | 4 | FX resolution, API lifecycle, scheduler, currency conversion |
| [i18n Flows](flow-i18n.md) | Internationalization | 2 | First visit locale detection, language switch in settings |
| [Community Flows](flow-community.md) | Community | 12 | Create post, feed generation, like/unlike, follow/unfollow, share post, view profile, following/followers list, image upload, edit comment, reply threads, SSE notification stream, get reply list |
| [Gold Sentiment Flows](flow-gold-sentiment.md) | Gold Sentiment | 3 | Cast vote with upsert, get sentiment with Redis cache, post comment with rate limiting and content sanitization |

## Supporting Documents

| Document | Description |
|----------|-------------|
| [Endpoint Snapshot](endpoint-snapshot.md) | Pre-restructure REST API endpoint inventory (75 endpoints) |

## Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adr-001-manual-di-over-wire.md) | Manual DI Provider Functions over Google Wire | Accepted |
| [ADR-002](adr-002-constructor-injection.md) | Constructor Injection over Late-Binding Set* Methods | Accepted |
| [ADR-003](adr-003-feature-based-frontend.md) | Feature-Based Frontend Module Organization | Accepted |

## Reading Guide

- **New to the project?** Start with Level 1 (System Context) and work down.
- **Adding a feature?** Check Level 3 (Component) diagrams to find where your code belongs.
- **Debugging a flow?** Check the [Dynamic Behavior Diagrams](#dynamic-behavior-diagrams) for runtime sequence and data flow details. Level 4 (Code) shows class-level relationships for the investment domain.
- **Security review?** Check Level 2 and 3 for trust boundaries — every boundary crossing requires security controls.

## Trust Boundaries

Levels 2 and 3 include **trust boundary annotations** showing where untrusted data enters the system and what security controls apply at each crossing:

| Boundary | Description | Key Controls |
|----------|-------------|--------------|
| **Internet/Client** | User browser → Application | TLS, CORS, input validation |
| **Application Tier** | Authenticated request processing | JWT auth, rate limiting, ownership checks |
| **Data Tier** | PostgreSQL + Redis | Connection pooling, SSL, parameterized queries |
| **External APIs** | Yahoo Finance, vang.today, Google OAuth | Response validation, timeouts, cache fallback |

When adding features, identify which trust boundaries your data flows cross and ensure appropriate security controls are in place. See the `secure-feature-pipeline` skill for the full security analysis workflow.

## Diagram Conventions

- **Blue** — Internal systems/components we own
- **Gray** — External systems we integrate with
- **Green** — Data stores (PostgreSQL, Redis)
- **Orange** — Background/async processes
- **Dashed boundaries** — Trust boundaries with security annotations
- Arrows indicate data flow direction with labeled protocols
