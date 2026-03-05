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
- **Debugging a flow?** Level 4 (Code) shows class-level relationships for the investment domain.

## Diagram Conventions

- **Blue** — Internal systems/components we own
- **Gray** — External systems we integrate with
- **Green** — Data stores (PostgreSQL, Redis)
- **Orange** — Background/async processes
- Arrows indicate data flow direction with labeled protocols
