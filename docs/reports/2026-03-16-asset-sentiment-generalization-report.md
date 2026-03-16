# Asset Sentiment Generalization — Implementation Report

## Overview

| Field | Value |
|-------|-------|
| **Feature** | Asset Sentiment Generalization |
| **Branch** | `feat/asset-sentiment-generalization` |
| **Plan** | `docs/plans/2026-03-16-asset-sentiment-generalization-plan.md` |
| **Spec** | `docs/specs/2026-03-16-asset-sentiment-generalization-spec.md` |
| **Status** | Completed (11/11 tasks) |
| **Commits** | 6 |
| **Files changed** | 27 (2,009 insertions, 389 deletions) |

## What Changed

Generalized the gold-only daily sentiment voting/commenting system into an asset-agnostic system supporting **gold and silver**. Users can now independently vote bullish/bearish and post comments on each asset category.

### Summary of Changes

**Database Layer**
- Added `category` column (`smallint`, default 0) to `gold_vote` and `gold_vote_comment` tables
- Recreated partial unique indexes with category: `(category, user_id, vote_date)` and `(category, anonymous_id, vote_date)`
- Added composite indexes for efficient category+date queries
- Backward compatible — existing gold data has `category=0`

**API Layer (Proto)**
- Added `SentimentCategory` enum: `SENTIMENT_CATEGORY_GOLD = 0`, `SENTIMENT_CATEGORY_SILVER = 1`
- Added `category` field to all request/response messages (5 RPCs affected)
- Auto-generated Go types, TypeScript types, and React Query hooks

**Backend (Go)**
- Repository: `category int32` parameter added to `GetByUserAndDate`, `CountByDate`, `GetByAnonymousIDAndDate`, `DeleteByAnonymousIDAndDate`, `ListByDate`, `CountByUserAndDate`
- Service: category threaded through all business logic; Redis cache keys scoped per category (`gold_sentiment:gold:YYYY-MM-DD` vs `gold_sentiment:silver:YYYY-MM-DD`)
- Handler: GET endpoints parse `category` from query string; POST endpoints read category from request body

**Frontend (React/Next.js)**
- `GoldSentimentCard` → `SentimentCard` with `asset?: "gold" | "silver"` prop
- Per-asset theming via `ASSET_THEME` config (gold/silver Tailwind color tokens)
- Per-asset anonymous vote ID scoping in localStorage
- Per-asset i18n namespace: `goldSentiment` / `silverSentiment`
- Removed vote count from summary text and "comments from" date indicator
- `GoldSentimentCard` export preserved as backward-compatible alias

**Pages Updated**
- `/dashboard/prices` — gold SentimentCard in gold tab, silver SentimentCard in silver tab
- `/landing` — both gold and silver SentimentCards (side-by-side on desktop)
- `/dashboard/home` — both gold and silver SentimentCards (side-by-side on desktop)

**Documentation**
- C4 backend/frontend component diagrams updated
- Flow diagrams updated with category parameter in all 3 sequence diagrams (Cast Vote, Get Sentiment, Post Comment)

## Commit History

| Commit | Message |
|--------|---------|
| `cc13826` | feat(sentiment): add category column to gold_vote and gold_vote_comment tables |
| `0989f99` | feat(sentiment): add SentimentCategory enum and category field to proto definitions |
| `77bdb7f` | feat(sentiment): thread category through repository, service, and handler layers |
| `da2a660` | feat(sentiment): generalize SentimentCard with asset prop and silver i18n |
| `3a8cd03` | feat(sentiment): add sentiment cards to prices, landing, and home pages |
| `deaeab1` | docs(architecture): update C4 and flow diagrams for sentiment generalization |

## Files Changed (27)

### Proto & Generated Code
- `api/protobuf/v1/gold_sentiment.proto`
- `src/go-backend/protobuf/v1/gold_sentiment.pb.go`
- `src/go-backend/protobuf/v1/gold_sentiment.pb.gw.go`
- `src/wj-client/gen/protobuf/v1/gold_sentiment.ts`
- `src/wj-client/utils/generated/api.ts`
- `src/wj-client/utils/generated/hooks.ts`

### Backend (Go)
- `src/go-backend/domain/models/gold_vote.go`
- `src/go-backend/domain/models/gold_vote_comment.go`
- `src/go-backend/domain/repository/interfaces.go`
- `src/go-backend/domain/repository/gold_vote_repository.go`
- `src/go-backend/domain/repository/gold_vote_comment_repository.go`
- `src/go-backend/domain/service/interfaces.go`
- `src/go-backend/domain/service/gold_sentiment_service.go`
- `src/go-backend/handlers/gold_sentiment.go`
- `src/go-backend/cmd/migrate-gold-sentiment/main.go`

### Frontend (TypeScript/React)
- `src/wj-client/components/GoldSentimentCard.tsx`
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- `src/wj-client/app/[locale]/landing/page.tsx`
- `src/wj-client/app/[locale]/dashboard/home/page.tsx`
- `src/wj-client/messages/en/ui.json`
- `src/wj-client/messages/vi/ui.json`

### Documentation
- `docs/architecture/c4-component-backend.md`
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-gold-sentiment.md`
- `docs/plans/2026-03-16-asset-sentiment-generalization-plan.md`
- `docs/specs/2026-03-16-asset-sentiment-generalization-spec.md`
- `docs/reports/2026-03-16-asset-sentiment-generalization-progress.md`

## Security Considerations

- **Input validation**: Category validated server-side (must be 0 or 1, defaults to 0)
- **Cache isolation**: Separate Redis keys per category prevent cross-asset data leakage
- **Rate limiting**: 5 comments/day enforced per user per category (not shared across assets)
- **Unique constraints**: DB indexes scoped by category — one vote per user per day per asset
- **XSS prevention**: Existing `html.EscapeString()` applies per category
- **Anonymous ID scoping**: Frontend uses separate localStorage keys per asset

## Testing Notes

- Backend compiles cleanly: `go build ./...`
- Frontend builds cleanly: `npx next build`
- Database migration adds columns with defaults — no data loss for existing gold records
- Manual testing recommended: vote gold, vote silver, verify independent counts and comments

## Fix History

| Date | Fix | Severity | Files |
|------|-----|----------|-------|
| 2026-03-16 | Move gold survey below gold price table+chart, silver survey below silver price table+chart (landing + home pages) | Minor | `landing/page.tsx`, `dashboard/home/page.tsx` |

## Remaining Work (Not in Scope)

- Run database migration on production: `task backend:migrate-gold-sentiment`
- Untracked generated Go files in working tree (gitignored): `gold_sentiment.pb.go`, `gold_sentiment.pb.gw.go`, `gold_sentiment_grpc.pb.go`
- Unrelated unstaged changes: `PNLCard.tsx` (Link import + "Go to Portfolio" → "Update"), `en/ui.json` and `vi/ui.json` (pnlGoToPortfolio text change)
