# Gold Sentiment Vote & Comments — Implementation Report

## Metadata
- **Feature:** Gold Sentiment Vote & Comments
- **Plan file:** docs/plans/2026-03-13-gold-sentiment-vote-plan.md
- **Spec file:** docs/specs/2026-03-13-gold-sentiment-vote-spec.md
- **Branch:** `feat/gold-sentiment-vote`
- **Started:** 2026-03-13
- **Completed:** 2026-03-14
- **Current state:** completed
- **Total commits:** 9
- **Files changed:** 31 (+4,998 lines)

---

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Create Protobuf Definitions | done | c23adc6 | gold_sentiment.proto with 5 RPCs, VoteDirection enum |
| 2 | Create Database Models & Migration | done | 9176e8e | GoldVote + GoldVoteComment GORM models, migration script |
| 3 | Create Repository Layer | done | eaaf3f1 | Upsert, CountByDate, ListByDate with user preload |
| 4 | Create Service Layer | done | 2acaa5e | Redis cache 30s, Vietnam TZ, 5 comments/day limit, HTML escape |
| 5 | Create Handler & Routes | done | 7fed5b8 | Public GET + protected POST/DELETE, optional auth |
| 6 | Generate Frontend API Hooks | done | c23adc6 | Auto-generated with proto:all in Task 1 |
| 7 | Create GoldSentimentCard Component | done | 4eda7ce | Shared component with landing/home variants, i18n (en/vi) |
| 8 | Integrate into Landing Page | done | bea55ba | Added to mobile + desktop layouts before footer |
| 9 | Integrate into Dashboard Home Page | done | 1fb2be4 | Added after DollarIndexChart in both layouts |
| 10 | Update C4 Architecture Diagrams | done | 88499f2 | Backend + frontend C4 component diagrams updated |
| 11 | Create Runtime Flow Diagrams | done | 88499f2 | 3 sequence diagrams + README.md updated |

---

## Commit Log

```
88499f2 docs(arch): add C4 components and flow diagrams for gold sentiment
1fb2be4 feat(home): add gold sentiment voting card to dashboard home page
bea55ba feat(landing): add gold sentiment voting card to landing page
4eda7ce feat(ui): add GoldSentimentCard component with vote, comments, and auth states
7fed5b8 feat(api): add gold sentiment handler with public + protected routes
2acaa5e feat(service): add GoldSentimentService with vote upsert, comments, Redis caching
eaaf3f1 feat(repo): add GoldVote and GoldVoteComment repositories
9176e8e feat(db): add gold_vote and gold_vote_comment tables
c23adc6 feat(proto): add gold_sentiment.proto for daily vote & comments
```

---

## Files Changed (31 files, +4,998 lines)

### API Layer (Protobuf)
| File | Action | Description |
|------|--------|-------------|
| `api/protobuf/v1/gold_sentiment.proto` | Created | 5 RPCs, VoteDirection enum, 8 message types |

### Backend — Models & Migration
| File | Action | Description |
|------|--------|-------------|
| `src/go-backend/domain/models/gold_vote.go` | Created | GORM model with UNIQUE index on (user_id, vote_date) |
| `src/go-backend/domain/models/gold_vote_comment.go` | Created | GORM model with soft delete, text content field |
| `src/go-backend/cmd/migrate-gold-sentiment/main.go` | Created | AutoMigrate + CHECK constraint on content length (500) |
| `Taskfile.yml` | Modified | Added `backend:migrate-gold-sentiment` task |

### Backend — Repository Layer
| File | Action | Description |
|------|--------|-------------|
| `src/go-backend/domain/repository/gold_vote_repository.go` | Created | Upsert (ON CONFLICT), GetByUserAndDate, CountByDate |
| `src/go-backend/domain/repository/gold_vote_comment_repository.go` | Created | CRUD, ListByDate with Preload("User"), CountByUserAndDate |
| `src/go-backend/domain/repository/interfaces.go` | Modified | Added GoldVoteRepository + GoldVoteCommentRepository interfaces |

### Backend — Service Layer
| File | Action | Description |
|------|--------|-------------|
| `src/go-backend/domain/service/gold_sentiment_service.go` | Created | Core business logic: Redis cache, Vietnam TZ, rate limiting, XSS protection |
| `src/go-backend/domain/service/interfaces.go` | Modified | Added GoldSentimentService interface (5 methods) |
| `src/go-backend/domain/service/services.go` | Modified | Wired service + repos into DI structs |

### Backend — Handler & Routes
| File | Action | Description |
|------|--------|-------------|
| `src/go-backend/handlers/gold_sentiment.go` | Created | 5 handler methods, tryGetUserID for optional auth |
| `src/go-backend/handlers/builder.go` | Modified | Added GoldSentiment to AllHandlers + NewHandlers |
| `src/go-backend/handlers/routes.go` | Modified | Public + protected route groups with rate limiting |
| `src/go-backend/internal/app/providers.go` | Modified | Wired GoldVote + GoldVoteComment repositories |

### Backend — Generated (proto:all)
| File | Action | Description |
|------|--------|-------------|
| `src/go-backend/protobuf/v1/gold_sentiment.pb.go` | Generated | Go protobuf types |
| `src/go-backend/protobuf/v1/gold_sentiment.pb.gw.go` | Generated | gRPC-Gateway reverse proxy |
| `src/go-backend/protobuf/v1/gold_sentiment_grpc.pb.go` | Generated | gRPC service stubs |

### Frontend — Component & i18n
| File | Action | Description |
|------|--------|-------------|
| `src/wj-client/components/GoldSentimentCard.tsx` | Created | Shared component with landing/home variants (425 lines) |
| `src/wj-client/messages/en/ui.json` | Modified | Added 26 English translation keys |
| `src/wj-client/messages/vi/ui.json` | Modified | Added 26 Vietnamese translation keys |

### Frontend — Page Integrations
| File | Action | Description |
|------|--------|-------------|
| `src/wj-client/app/[locale]/landing/page.tsx` | Modified | GoldSentimentCard variant="landing" in mobile + desktop |
| `src/wj-client/app/[locale]/dashboard/home/page.tsx` | Modified | GoldSentimentCard variant="home" in mobile + desktop |

### Frontend — Generated (proto:all)
| File | Action | Description |
|------|--------|-------------|
| `src/wj-client/gen/protobuf/v1/gold_sentiment.ts` | Generated | TypeScript types (VoteDirection, response/request interfaces) |
| `src/wj-client/utils/generated/api.ts` | Modified | Added goldSentiment API client methods |
| `src/wj-client/utils/generated/hooks.ts` | Modified | 5 new React Query hooks + 2 EVENT constants |

### Documentation
| File | Action | Description |
|------|--------|-------------|
| `docs/architecture/c4-component-backend.md` | Modified | Handler, service, 2 repos + relationships |
| `docs/architecture/c4-component-frontend.md` | Modified | GoldSentimentCard component + page relationships |
| `docs/architecture/flow-gold-sentiment.md` | Created | 3 sequence diagrams (cast vote, get sentiment, post comment) |
| `docs/architecture/README.md` | Modified | Added flow-gold-sentiment.md to Dynamic Behavior table |
| `docs/reports/2026-03-13-gold-sentiment-vote-progress.md` | Created | This report |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/public/gold-sentiment` | Optional | Get today's vote counts + user vote (if authenticated) |
| GET | `/api/v1/public/gold-sentiment/comments` | Optional | Paginated comments for today |
| POST | `/api/v1/gold-sentiment/vote` | Required | Cast or update daily vote (bullish/bearish) |
| POST | `/api/v1/gold-sentiment/comments` | Required | Post a comment (max 500 chars, 5/day limit) |
| DELETE | `/api/v1/gold-sentiment/comments/:comment_id` | Required | Delete own comment (ownership verified) |

---

## Security Controls Implemented

| Control | Implementation |
|---------|---------------|
| **Vote deduplication** | UNIQUE constraint on (user_id, vote_date), upsert with ON CONFLICT |
| **Comment rate limiting** | 5 comments/day per user, enforced in service layer |
| **XSS prevention** | `html.EscapeString()` server-side; no `dangerouslySetInnerHTML` on frontend |
| **Input validation** | Direction enum (1 or 2 only), content length (1-500 chars, trimmed) |
| **Authorization** | User ID from JWT only; comment delete verifies ownership |
| **Rate limiting** | IP-based on public routes, user-based on protected routes |
| **Content length** | DB CHECK constraint `char_length(content) <= 500` |
| **Cache invalidation** | Redis cache deleted on every vote to ensure fresh counts |

---

## Architecture Decisions

- **Vietnam TZ (UTC+7):** Vote date calculated using `time.FixedZone("UTC+7", 7*60*60)` truncated to midnight in UTC — ensures all Vietnamese users share the same daily vote thread regardless of server timezone
- **Redis caching (30s TTL):** Vote counts cached to reduce DB load; short TTL balances freshness with performance
- **Optional auth on public GET:** `tryGetUserID` pattern extracts bearer token if present without rejecting unauthenticated requests — enables `userVote` field for logged-in users on landing page
- **Shared component with variant prop:** Single `GoldSentimentCard` component with `variant="landing" | "home"` reduces duplication; landing shows read-only with login CTA, home shows full interaction
- **Protobuf-first:** All types defined in `gold_sentiment.proto`, generated to Go + TypeScript + React Query hooks

---

## Pre-Merge Checklist

- [ ] Run migration: `task backend:migrate-gold-sentiment`
- [ ] Verify backend compiles: `cd src/go-backend && go build ./...`
- [ ] Verify frontend compiles: `cd src/wj-client && npm run build`
- [ ] Test public endpoint: `GET /api/v1/public/gold-sentiment`
- [ ] Test vote endpoint: `POST /api/v1/gold-sentiment/vote` with auth
- [ ] Test comment flow: post, list, delete
- [ ] Test rate limiting: 6th comment should return 429
- [ ] Test landing page variant: shows 1 comment + blurred overlay + login CTA
- [ ] Test home page variant: vote, comment input, delete, load more
- [ ] Create PR to `main`

---

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-14 | Add Vietnamese diacritics (accent marks) to all 25 goldSentiment i18n keys in `vi/ui.json` | Minor | pending |
