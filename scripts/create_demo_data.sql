-- Demo Data Script
-- Purpose: Create comprehensive demo data for screenshots
-- User: congdongvang.com / Cộng Đồng Vàng
-- Date: 2026-04-01

-- ============================================================================
-- STEP 0: CREATE / UPSERT DEMO USER
-- ============================================================================

BEGIN;

-- Insert user if username doesn't exist; capture the ID into a temp table
-- so all subsequent steps reference it dynamically (no hardcoded user_id).
-- Password hash: bcrypt cost 12 of "Congdongvang.1"
INSERT INTO "user" (name, username, password_hash, auth_provider, preferred_currency, preferred_language, created_at, updated_at)
VALUES (
    'Cộng Đồng Vàng',
    'congdongvang.com',
    '$2a$12$oeQABzWqKSc0Ho1Rn4gUJOt.bDE6GAfV40bR2G3/YYaEON.MfQd7e',
    'password',
    'VND',
    'vi',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
    SET name          = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        updated_at    = NOW();

-- Capture user ID for use in all subsequent steps
CREATE TEMP TABLE _demo_user AS
SELECT id AS uid FROM "user" WHERE username = 'congdongvang.com';

COMMIT;

-- ============================================================================
-- STEP 1: DELETE EXISTING DATA (in order to respect foreign keys)
-- ============================================================================

BEGIN;

-- Delete category keywords first
DELETE FROM category_keyword
WHERE
    category_id IN (
        SELECT id
        FROM category
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete merchant category rules
DELETE FROM merchant_category_rule
WHERE
    category_id IN (
        SELECT id
        FROM category
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete import batches
DELETE FROM import_batch
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete investment transactions first
DELETE FROM investment_transaction
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete investment lots
DELETE FROM investment_lot
WHERE
    investment_id IN (
        SELECT id
        FROM investment
        WHERE
            wallet_id IN (
                SELECT id
                FROM wallet
                WHERE
                    user_id = (SELECT uid FROM _demo_user)
            )
    );

-- Delete investments
DELETE FROM investment
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete transactions
DELETE FROM transaction
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete budget items
DELETE FROM budget_item
WHERE
    budget_id IN (
        SELECT id
        FROM budget
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    );

-- Delete budgets
DELETE FROM budget WHERE user_id = (SELECT uid FROM _demo_user);

-- Delete categories
DELETE FROM category WHERE user_id = (SELECT uid FROM _demo_user);

-- Delete portfolio history
DELETE FROM portfolio_history WHERE user_id = (SELECT uid FROM _demo_user);

-- Delete community data
DELETE FROM post_like   WHERE user_id = (SELECT uid FROM _demo_user);
DELETE FROM post_hashtag WHERE post_id IN (SELECT id FROM post WHERE user_id = (SELECT uid FROM _demo_user));
DELETE FROM comment     WHERE user_id = (SELECT uid FROM _demo_user);
DELETE FROM post        WHERE user_id = (SELECT uid FROM _demo_user);

-- Delete gold/silver sentiment data
DELETE FROM gold_vote_comment WHERE user_id = (SELECT uid FROM _demo_user);
DELETE FROM gold_vote         WHERE user_id = (SELECT uid FROM _demo_user);

-- Delete wallets
DELETE FROM wallet WHERE user_id = (SELECT uid FROM _demo_user);

COMMIT;

-- ============================================================================
-- STEP 2: CREATE DEMO CATEGORIES
-- ============================================================================

BEGIN;

-- Income Categories (type=1)
INSERT INTO category (user_id, name, type, created_at, updated_at)
SELECT uid, name, type, NOW(), NOW()
FROM _demo_user
CROSS JOIN (VALUES
    ('Lương',          1),
    ('Freelance',      1),
    ('Thu nhập đầu tư',1),
    ('Thu nhập khác',  1)
) AS c(name, type);

-- Expense Categories (type=2)
INSERT INTO category (user_id, name, type, created_at, updated_at)
SELECT uid, name, type, NOW(), NOW()
FROM _demo_user
CROSS JOIN (VALUES
    ('Ăn uống',  2),
    ('Di chuyển',2),
    ('Mua sắm',  2),
    ('Giải trí', 2),
    ('Y tế',     2),
    ('Giáo dục', 2),
    ('Hóa đơn',  2),
    ('Nhà ở',    2),
    ('Bảo hiểm', 2),
    ('Đầu tư',   2)
) AS c(name, type);

COMMIT;

-- ============================================================================
-- STEP 3: CREATE DEMO WALLETS
-- ============================================================================

BEGIN;

INSERT INTO wallet (user_id, wallet_name, balance, currency, type, created_at, updated_at)
SELECT uid, wallet_name, balance, 'VND', type, NOW(), NOW()
FROM _demo_user
CROSS JOIN (VALUES
    ('Tiền mặt',        12500000,   0), -- 12,500,000 VND cash on hand
    ('Techcombank',    285000000,   0), -- 285,000,000 VND
    ('Vietcombank',    156000000,   0), -- 156,000,000 VND
    ('Danh mục đầu tư',1419000000, 1)  -- 1,419,000,000 VND (INVESTMENT wallet)
) AS w(wallet_name, balance, type);

COMMIT;

-- ============================================================================
-- STEP 4: CREATE DEMO TRANSACTIONS
-- ============================================================================

BEGIN;

-- Generate 12 months of transactions in 2026 (Jan 2026 - Dec 2026)
-- This creates a realistic pattern of income and expenses


WITH wallet_ids AS (
    SELECT id, wallet_name FROM wallet WHERE user_id = (SELECT uid FROM _demo_user)
),
category_ids AS (
    SELECT id, name FROM category WHERE user_id = (SELECT uid FROM _demo_user)
),
-- Base date: Start of 2026 (January 1, 2026)
base_date AS (
    SELECT DATE '2026-01-01' as start_date
),
-- Generate monthly salaries for 12 months (Jan - Dec 2026)
monthly_salaries AS (
    SELECT
        generate_series(0, 11) as month_offset,
        2000000 as amount,
        'Lương tháng ' || TO_CHAR((SELECT start_date FROM base_date) + (generate_series(0, 11) || ' months')::INTERVAL, 'MM/YYYY') as note
),
-- Generate monthly bills for 12 months (Jan - Dec 2026)
monthly_bills AS (
    SELECT * FROM (VALUES
        (0, -100000, 'Tiền điện tháng 1'),   -- Jan
        (0, -80000, 'Tiền nước tháng 1'),
        (0, -50000, 'Internet tháng 1'),
        (1, -95000, 'Tiền điện tháng 2'),    -- Feb
        (1, -75000, 'Tiền nước tháng 2'),
        (1, -50000, 'Internet tháng 2'),
        (2, -105000, 'Tiền điện tháng 3'),   -- Mar
        (2, -80000, 'Tiền nước tháng 3'),
        (2, -50000, 'Internet tháng 3'),
        (3, -98000, 'Tiền điện tháng 4'),    -- Apr
        (3, -78000, 'Tiền nước tháng 4'),
        (3, -50000, 'Internet tháng 4'),
        (4, -110000, 'Tiền điện tháng 5'),   -- May
        (4, -82000, 'Tiền nước tháng 5'),
        (4, -50000, 'Internet tháng 5'),
        (5, -95000, 'Tiền điện tháng 6'),    -- Jun
        (5, -75000, 'Tiền nước tháng 6'),
        (5, -50000, 'Internet tháng 6'),
        (6, -100000, 'Tiền điện tháng 7'),   -- Jul
        (6, -80000, 'Tiền nước tháng 7'),
        (6, -50000, 'Internet tháng 7'),
        (7, -105000, 'Tiền điện tháng 8'),   -- Aug
        (7, -82000, 'Tiền nước tháng 8'),
        (7, -50000, 'Internet tháng 8'),
        (8, -98000, 'Tiền điện tháng 9'),    -- Sep
        (8, -78000, 'Tiền nước tháng 9'),
        (8, -50000, 'Internet tháng 9'),
        (9, -102000, 'Tiền điện tháng 10'),  -- Oct
        (9, -80000, 'Tiền nước tháng 10'),
        (9, -50000, 'Internet tháng 10'),
        (10, -95000, 'Tiền điện tháng 11'),  -- Nov
        (10, -75000, 'Tiền nước tháng 11'),
        (10, -50000, 'Internet tháng 11'),
        (11, -100000, 'Tiền điện tháng 12'), -- Dec
        (11, -80000, 'Tiền nước tháng 12'),
        (11, -50000, 'Internet tháng 12')
    ) as t(month_offset, amount, note)
)
INSERT INTO transaction (wallet_id, category_id, amount, currency, date, note, created_at, updated_at)
SELECT
    w.id,
    c.id,
    t.amount,
    'VND',
    t.transaction_date,
    t.note,
    NOW(),
    NOW()
FROM wallet_ids w
CROSS JOIN category_ids c
CROSS JOIN base_date bd
CROSS JOIN (
    -- Monthly Salaries (12 months: Jan - Dec 2026)
    SELECT 'Techcombank' as wallet_name, 'Lương' as category_name, ms.amount, ms.note,
           (SELECT start_date FROM base_date) + (ms.month_offset || ' months')::INTERVAL + INTERVAL '5 days' as transaction_date
    FROM monthly_salaries ms

    UNION ALL

-- Monthly Bills (12 months: Jan - Dec 2026)
SELECT 'Techcombank', 'Hóa đơn', mb.amount, mb.note, (
        SELECT start_date
        FROM base_date
    ) + (mb.month_offset || ' months')::INTERVAL + INTERVAL '10 days'
FROM monthly_bills mb
UNION ALL

-- Monthly Rent (12 months: Jan - Dec 2026)
SELECT 'Techcombank', 'Nhà ở', -500000, 'Tiền nhà tháng ' || (month_num + 1)::text, (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '1 day'
FROM generate_series(0, 11) month_num
UNION ALL

-- Monthly Subscriptions Netflix (12 months)
SELECT 'Techcombank', 'Giải trí', -100000, 'Netflix tháng ' || (month_num + 1)::text, (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '12 days'
FROM generate_series(0, 11) month_num
UNION ALL

-- Monthly Subscriptions Spotify (12 months)
SELECT 'Techcombank', 'Giải trí', -80000, 'Spotify tháng ' || (month_num + 1)::text, (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '18 days'
FROM generate_series(0, 11) month_num
UNION ALL

-- Freelance income (quarterly - Q1, Q2, Q3, Q4 2026)
SELECT 'Vietcombank', 'Freelance', 1000000, 'Dự án freelance Q' || (quarter_num + 1)::text || '/2026', (
        SELECT start_date
        FROM base_date
    ) + (quarter_num * 3 || ' months')::INTERVAL + INTERVAL '15 days'
FROM generate_series(0, 3) quarter_num
UNION ALL

-- Investment dividends (quarterly 2026)
SELECT 'Vietcombank', 'Thu nhập đầu tư', 30000, 'Cổ tức Q' || (quarter_num + 1)::text || '/2026', (
        SELECT start_date
        FROM base_date
    ) + (quarter_num * 3 || ' months')::INTERVAL + INTERVAL '20 days'
FROM generate_series(0, 3) quarter_num
UNION ALL

-- Weekly food expenses - Coffee (260 transactions: 5 days/week for 52 weeks)
SELECT 'Tiền mặt', 'Ăn uống', -5000, 'Cà phê sáng', (
        SELECT start_date
        FROM base_date
    ) + (
        week_num * 7 + day_num || ' days'
    )::INTERVAL
FROM generate_series(0, 51) week_num, generate_series(0, 4) day_num
UNION ALL

-- Weekly food expenses - Lunch (260 transactions)
SELECT 'Tiền mặt', 'Ăn uống', -15000, 'Ăn trưa', (
        SELECT start_date
        FROM base_date
    ) + (
        week_num * 7 + day_num || ' days'
    )::INTERVAL + INTERVAL '5 hours'
FROM generate_series(0, 51) week_num, generate_series(0, 4) day_num
UNION ALL

-- Weekly food expenses - Dinner (130 transactions: every other week)
SELECT 'Tiền mặt', 'Ăn uống', -20000, 'Ăn tối', (
        SELECT start_date
        FROM base_date
    ) + (
        week_num * 7 + day_num || ' days'
    )::INTERVAL + INTERVAL '12 hours'
FROM generate_series(0, 51) week_num, generate_series(0, 4) day_num
WHERE
    week_num % 2 = 0
UNION ALL

-- Weekly transport (156 transactions: 3x per week for 52 weeks)
SELECT 'Tiền mặt', 'Di chuyển', -3000, 'Grab', (
        SELECT start_date
        FROM base_date
    ) + (
        week_num * 7 + day_num || ' days'
    )::INTERVAL + INTERVAL '8 hours'
FROM generate_series(0, 51) week_num, generate_series(0, 2) day_num
UNION ALL

-- Monthly shopping Shopee (12 months)
SELECT 'Techcombank', 'Mua sắm', -200000, 'Shopee tháng ' || (month_num + 1)::text, (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '8 days'
FROM generate_series(0, 11) month_num
UNION ALL

-- Monthly shopping Lazada (12 months)
SELECT 'Techcombank', 'Mua sắm', -150000, 'Lazada tháng ' || (month_num + 1)::text, (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '16 days'
FROM generate_series(0, 11) month_num
UNION ALL

-- Monthly entertainment - Movies (12 months)
SELECT 'Tiền mặt', 'Giải trí', -25000, 'Xem phim', (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '12 days'
FROM generate_series(0, 11) month_num
UNION ALL

-- Bi-monthly entertainment - Karaoke (6 times in 2026)
SELECT 'Tiền mặt', 'Giải trí', -30000, 'Karaoke', (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '25 days'
FROM generate_series(0, 11) month_num
WHERE
    month_num % 2 = 0
UNION ALL

-- Healthcare quarterly checkups (Q1, Q2, Q3, Q4 2026)
SELECT 'Vietcombank', 'Y tế', -200000, 'Khám sức khỏe Q' || (quarter_num + 1)::text || '/2026', (
        SELECT start_date
        FROM base_date
    ) + (quarter_num * 3 || ' months')::INTERVAL + INTERVAL '30 days'
FROM generate_series(0, 3) quarter_num
UNION ALL

-- Medicine purchases (every 3 months: Jan, Apr, Jul, Oct)
SELECT 'Tiền mặt', 'Y tế', -50000, 'Mua thuốc', (
        SELECT start_date
        FROM base_date
    ) + (month_num || ' months')::INTERVAL + INTERVAL '20 days'
FROM generate_series(0, 11) month_num
WHERE
    month_num % 3 = 0
UNION ALL

-- Education courses (Jan and Jul 2026)
SELECT 'Vietcombank', 'Giáo dục', -500000, 'Khóa học online', (
        SELECT start_date
        FROM base_date
    ) + (semester * 6 || ' months')::INTERVAL + INTERVAL '15 days'
FROM generate_series(0, 1) semester
UNION ALL

-- Insurance (Jan 2026)
SELECT 'Vietcombank', 'Bảo hiểm', -300000, 'Bảo hiểm y tế năm 2026', (
        SELECT start_date
        FROM base_date
    ) + INTERVAL '20 days'
UNION ALL

-- Large purchases spread across 2026
SELECT 'Vietcombank', 'Mua sắm', -300000, 'Mua điện thoại', DATE '2026-03-15'
UNION ALL
SELECT 'Vietcombank', 'Mua sắm', -400000, 'Mua laptop', DATE '2026-09-10'
UNION ALL
SELECT 'Techcombank', 'Mua sắm', -250000, 'Mua giày', DATE '2026-06-20'
UNION ALL

-- Investment purchases throughout 2026


SELECT 'Vietcombank', 'Đầu tư', -500000, 'Mua cổ phiếu VCB', DATE '2026-01-25'

    UNION ALL

    SELECT 'Vietcombank', 'Đầu tư', -450000, 'Mua cổ phiếu VNM', DATE '2026-02-05'

    UNION ALL

    SELECT 'Vietcombank', 'Đầu tư', -600000, 'Mua Bitcoin', DATE '2026-05-10'

    UNION ALL

    SELECT 'Vietcombank', 'Đầu tư', -113000000, 'Mua vàng SJC 1 lượng', DATE '2026-03-15'
) t(wallet_name, category_name, amount, note, transaction_date)
WHERE w.wallet_name = t.wallet_name AND c.name = t.category_name;

COMMIT;

-- ============================================================================
-- STEP 5: CREATE DEMO BUDGETS
-- ============================================================================

BEGIN;

-- Create budget for February 2026
WITH
    new_budget AS (
        INSERT INTO
            budget (
                user_id,
                name,
                total,
                currency,
                created_at,
                updated_at
            )
        SELECT uid, 'Ngân sách tháng 2/2026', 3000000, 'VND', NOW(), NOW()
        FROM _demo_user
        RETURNING
            id
    )
INSERT INTO
    budget_item (
        budget_id,
        name,
        total,
        currency,
        checked,
        created_at,
        updated_at
    )
SELECT b.id, t.name, t.amount, 'VND', t.is_checked, NOW(), NOW()
FROM new_budget b
    CROSS JOIN (
        VALUES ('Ăn uống', 800000, true), ('Di chuyển', 300000, true), ('Mua sắm', 500000, false), ('Giải trí', 200000, false), ('Hóa đơn', 400000, true), ('Y tế', 300000, false), ('Nhà ở', 500000, false)
    ) t (name, amount, is_checked);

COMMIT;

-- ============================================================================
-- STEP 6: CREATE DEMO INVESTMENTS
-- ============================================================================
-- Gold VND (type=8): quantity in grams×10000, price in raw VND per gram
--   1 lượng = 37.5g → quantity per lượng = 375,000
--   avg_cost = price_per_luong / 37.5  (e.g. 108,000,000 / 37.5 = 2,880,000)
--   total_cost = grams × avg_cost_per_gram
--   current_price = current market price per gram (raw VND)
--   current_value = (quantity/10000) × current_price  [computed by GORM hook]
--
-- Holdings (realistic April 2026 SJC market ~108–110M/lượng):
--   SJC          : 3 lượng (112.5g)  bought Jan @ 103M  → avg 2,746,667/g  total 309,000,000
--   Nhẫn SJC 9999: 5 lượng (187.5g) bought Feb @ 98M   → avg 2,613,333/g  total 489,750,000
--   Nhẫn Doji 9999: 2 lượng (75g)   bought Mar @ 96M   → avg 2,560,000/g  total 192,000,000
--   BTMC SJC     : 1 lượng (37.5g)  bought Dec @ 88M   → avg 2,346,667/g  total 87,999,750 ≈ 88,000,000
--   PNJ          : 4 lượng (150g)   bought Oct @ 85M   → avg 2,266,667/g  total 340,000,050 ≈ 340,000,000
-- Current prices (Apr 2026): SJC 110M, Nhẫn 9999 108M, Doji 108M, BTMC 110M, PNJ 108M
--
-- Silver VND (type=10): quantity in grams×10000, price in raw VND per gram
--   1 lượng = 37.5g → quantity per lượng = 375,000
--   price per gram = luong_price / 37.5
--   (Apr 2026 market: ~2,800,000 VND/lượng → ~74,667 VND/gram)
--
-- Silver holdings:
--   Phú Quý thỏi 1L  : 10 lượng (375g)  bought @ 2,200,000/L → avg 58,667/g  total 22,000,000
--   DOJI 99.9 1L      :  5 lượng (187.5g) bought @ 2,400,000/L → avg 64,000/g  total 12,000,000
--   Ancarat Ngân Long : 20 lượng (750g)  bought @ 2,100,000/L → avg 56,000/g  total 42,000,000
-- Current prices (Apr 2026): Phú Quý 2,795,000/L=74,533/g, DOJI 2,805,000/L=74,800/g, Ancarat 2,794,000/L=74,507/g
-- ============================================================================

BEGIN;

WITH investment_wallet AS (
    SELECT id FROM wallet WHERE user_id = (SELECT uid FROM _demo_user) AND wallet_name = 'Danh mục đầu tư'
)
INSERT INTO investment (
    user_id, wallet_id, symbol, name, type, quantity, average_cost, total_cost, currency,
    is_custom, current_price, current_value, unrealized_pnl, unrealized_pnl_percent, purchase_unit, created_at, updated_at
)
SELECT
    (SELECT uid FROM _demo_user),
    w.id,
    t.symbol,
    t.name,
    t.type,
    t.quantity,
    t.average_cost,
    t.total_cost,
    t.currency,
    t.is_custom,
    t.current_price,
    -- current_value = (quantity / 10000) * current_price
    (t.quantity / 10000.0 * t.current_price)::bigint,
    -- unrealized_pnl = current_value - total_cost
    (t.quantity / 10000.0 * t.current_price)::bigint - t.total_cost,
    -- unrealized_pnl_percent
    ((t.quantity / 10000.0 * t.current_price - t.total_cost) / t.total_cost::float * 100),
    t.purchase_unit,
    NOW(),
    NOW()
FROM investment_wallet w
CROSS JOIN (VALUES
    -- symbol, name, type, quantity(g×10000), avg_cost(VND/g), total_cost, currency, is_custom, current_price(VND/g), purchase_unit
    -- SJC: 3 lượng=112.5g  bought @103M/lượng now 110M/lượng
    ('SJC',           'Vàng SJC',       8, 1125000, 2746667, 309000000, 'VND', false, 2933333, 'gram'),
    -- Nhẫn SJC 9999: 5 lượng=187.5g bought @98M now 108M
    ('Vàng nhẫn SJC', 'Nhẫn SJC 9999',  8, 1875000, 2613333, 490000000, 'VND', false, 2880000, 'gram'),
    -- Nhẫn Doji 9999: 2 lượng=75g bought @96M now 108M
    ('Doji_24K',       'Nhẫn Doji 9999', 8,  750000, 2560000, 192000000, 'VND', false, 2880000, 'gram'),
    -- BTMC SJC: 1 lượng=37.5g bought @88M now 110M
    ('BTMC',           'SJC BTMC',       8,  375000, 2346667,  88000000, 'VND', false, 2933333, 'gram'),
    -- PNJ: 4 lượng=150g bought @85M now 108M
    ('PNJ HCM',        'Vàng PNJ',       8, 1500000, 2266667, 340000000, 'VND', false, 2880000, 'gram'),

    -- Silver VND (type=10) ---------------------------------------------------
    -- Phú Quý thỏi 1L: 10 lượng=375g bought @2,200,000/L now 2,795,000/L
    -- avg_cost = 2,200,000 / 37.5 = 58,667/g  total = 375 * 58,667 = 22,000,125 ≈ 22,000,000
    -- current_price = 2,795,000 / 37.5 = 74,533/g
    ('PH_QU_THI_1L',        'Bạc Phú Quý thỏi 1L',   10, 3750000, 58667,  22000000, 'VND', false, 74533, 'gram'),

    -- DOJI 99.9 1L: 5 lượng=187.5g bought @2,400,000/L now 2,805,000/L
    -- avg_cost = 2,400,000 / 37.5 = 64,000/g  total = 187.5 * 64,000 = 12,000,000
    -- current_price = 2,805,000 / 37.5 = 74,800/g
    ('DOJI_99.9_1L',        'Bạc DOJI 99.9 1L',       10, 1875000, 64000,  12000000, 'VND', false, 74800, 'gram'),

    -- Ancarat Ngân Long 1L: 20 lượng=750g bought @2,100,000/L now 2,794,000/L
    -- avg_cost = 2,100,000 / 37.5 = 56,000/g  total = 750 * 56,000 = 42,000,000
    -- current_price = 2,794,000 / 37.5 = 74,507/g
    ('ANCARAT_NGN_LONG_1L', 'Bạc Ancarat Ngân Long 1L', 10, 7500000, 56000, 42000000, 'VND', false, 74507, 'gram')
) t(symbol, name, type, quantity, average_cost, total_cost, currency, is_custom, current_price, purchase_unit);

COMMIT;

-- ============================================================================
-- STEP 7: CREATE INVESTMENT TRANSACTIONS AND LOTS
-- ============================================================================

BEGIN;

CREATE TEMP TABLE temp_gold_ids AS
SELECT i.id, i.symbol, w.id AS wallet_id
FROM investment i
JOIN wallet w ON i.wallet_id = w.id
WHERE w.user_id = (SELECT uid FROM _demo_user) AND w.wallet_name = 'Danh mục đầu tư'
  AND i.type = 8; -- GOLD_VND only

-- -----------------------------------------------------------------------
-- SJC: 3 transactions — bought in 3 batches across 2025
--   Lot 1: 1 lượng (37.5g) @ 90M  → 2025-10-05
--   Lot 2: 1 lượng (37.5g) @ 106M → 2026-01-10
--   Lot 3: 1 lượng (37.5g) @ 113M → 2026-03-15
-- -----------------------------------------------------------------------
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,      -- BUY
    375000, -- 37.5g × 10000
    2400000, -- 90,000,000 / 37.5
    90000000,
    'VND', DATE '2025-10-05', 375000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'SJC';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    375000,
    2826667, -- 106,000,000 / 37.5
    106000000,
    'VND', DATE '2026-01-10', 375000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'SJC';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    375000,
    3013333, -- 113,000,000 / 37.5
    113000000,
    'VND', DATE '2026-03-15', 375000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'SJC';

-- -----------------------------------------------------------------------
-- Nhẫn SJC 9999: 2 transactions
--   Lot 1: 3 lượng (112.5g) @ 96M  → 2025-11-20
--   Lot 2: 2 lượng (75g)    @ 101M → 2026-02-08
-- -----------------------------------------------------------------------
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    1125000, -- 112.5g × 10000
    2560000, -- 96,000,000 / 37.5
    288000000,
    'VND', DATE '2025-11-20', 1125000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'Vàng nhẫn SJC';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    750000, -- 75g × 10000
    2693333, -- 101,000,000 / 37.5
    202000000,
    'VND', DATE '2026-02-08', 750000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'Vàng nhẫn SJC';

-- -----------------------------------------------------------------------
-- Nhẫn Doji 9999: 1 transaction
--   Lot 1: 2 lượng (75g) @ 96M → 2026-03-01
-- -----------------------------------------------------------------------
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    750000,
    2560000, -- 96,000,000 / 37.5
    192000000,
    'VND', DATE '2026-03-01', 750000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'Doji_24K';

-- -----------------------------------------------------------------------
-- BTMC SJC: 1 transaction
--   Lot 1: 1 lượng (37.5g) @ 88M → 2025-12-12
-- -----------------------------------------------------------------------
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    375000,
    2346667, -- 88,000,000 / 37.5
    88000000,
    'VND', DATE '2025-12-12', 375000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'BTMC';

-- -----------------------------------------------------------------------
-- PNJ: 2 transactions
--   Lot 1: 2 lượng (75g)  @ 84M → 2025-09-18
--   Lot 2: 2 lượng (75g)  @ 86M → 2025-12-28
-- -----------------------------------------------------------------------
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    750000,
    2240000, -- 84,000,000 / 37.5
    168000000,
    'VND', DATE '2025-09-18', 750000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'PNJ HCM';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id,
    0,
    750000,
    2293333, -- 86,000,000 / 37.5
    172000000,
    'VND', DATE '2025-12-28', 750000, NOW(), NOW()
FROM temp_gold_ids i WHERE i.symbol = 'PNJ HCM';

-- ============================================================================
-- INVESTMENT LOTS (FIFO tracking — one lot per transaction batch)
-- ============================================================================

-- SJC lots
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 375000, 2400000, DATE '2025-10-05', 375000, 90000000,  'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'SJC';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 375000, 2826667, DATE '2026-01-10', 375000, 106000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'SJC';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 375000, 3013333, DATE '2026-03-15', 375000, 113000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'SJC';

-- Nhẫn SJC 9999 lots
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 1125000, 2560000, DATE '2025-11-20', 1125000, 288000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'Vàng nhẫn SJC';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 750000,  2693333, DATE '2026-02-08', 750000,  202000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'Vàng nhẫn SJC';

-- Nhẫn Doji lot
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 750000, 2560000, DATE '2026-03-01', 750000, 192000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'Doji_24K';

-- BTMC lot
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 375000, 2346667, DATE '2025-12-12', 375000, 88000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'BTMC';

-- PNJ lots
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 750000, 2240000, DATE '2025-09-18', 750000, 168000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'PNJ HCM';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 750000, 2293333, DATE '2025-12-28', 750000, 172000000, 'VND', NOW(), NOW() FROM temp_gold_ids i WHERE i.symbol = 'PNJ HCM';

DROP TABLE temp_gold_ids;

-- ============================================================================
-- SILVER TRANSACTIONS AND LOTS
-- ============================================================================

CREATE TEMP TABLE temp_silver_ids AS
SELECT i.id, i.symbol, w.id AS wallet_id
FROM investment i
JOIN wallet w ON i.wallet_id = w.id
WHERE w.user_id = (SELECT uid FROM _demo_user)
  AND i.type = 10; -- SILVER_VND

-- Phú Quý thỏi 1L: 2 buy lots
-- Lot 1: 5 lượng (187.5g) @ 2,000,000/L → 53,333/g  → 2025-08-10
-- Lot 2: 5 lượng (187.5g) @ 2,400,000/L → 64,000/g  → 2026-01-15
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id, 0, 1875000, 53333, 10000000, 'VND', DATE '2025-08-10', 1875000, NOW(), NOW()
FROM temp_silver_ids i WHERE i.symbol = 'PH_QU_THI_1L';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id, 0, 1875000, 64000, 12000000, 'VND', DATE '2026-01-15', 1875000, NOW(), NOW()
FROM temp_silver_ids i WHERE i.symbol = 'PH_QU_THI_1L';

-- DOJI 99.9 1L: 1 buy lot
-- 5 lượng (187.5g) @ 2,400,000/L → 64,000/g → 2025-11-05
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id, 0, 1875000, 64000, 12000000, 'VND', DATE '2025-11-05', 1875000, NOW(), NOW()
FROM temp_silver_ids i WHERE i.symbol = 'DOJI_99.9_1L';

-- Ancarat Ngân Long 1L: 2 buy lots
-- Lot 1: 10 lượng (375g) @ 2,050,000/L → 54,667/g → 2025-07-20
-- Lot 2: 10 lượng (375g) @ 2,150,000/L → 57,333/g → 2025-12-01
INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id, 0, 3750000, 54667, 20500000, 'VND', DATE '2025-07-20', 3750000, NOW(), NOW()
FROM temp_silver_ids i WHERE i.symbol = 'ANCARAT_NGN_LONG_1L';

INSERT INTO investment_transaction (investment_id, user_id, wallet_id, type, quantity, price, cost, currency, transaction_date, remaining_quantity, created_at, updated_at)
SELECT i.id, (SELECT uid FROM _demo_user), i.wallet_id, 0, 3750000, 57333, 21500000, 'VND', DATE '2025-12-01', 3750000, NOW(), NOW()
FROM temp_silver_ids i WHERE i.symbol = 'ANCARAT_NGN_LONG_1L';

-- Silver FIFO lots
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 1875000, 53333, DATE '2025-08-10', 1875000, 10000000, 'VND', NOW(), NOW() FROM temp_silver_ids i WHERE i.symbol = 'PH_QU_THI_1L';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 1875000, 64000, DATE '2026-01-15', 1875000, 12000000, 'VND', NOW(), NOW() FROM temp_silver_ids i WHERE i.symbol = 'PH_QU_THI_1L';

INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 1875000, 64000, DATE '2025-11-05', 1875000, 12000000, 'VND', NOW(), NOW() FROM temp_silver_ids i WHERE i.symbol = 'DOJI_99.9_1L';

INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 3750000, 54667, DATE '2025-07-20', 3750000, 20500000, 'VND', NOW(), NOW() FROM temp_silver_ids i WHERE i.symbol = 'ANCARAT_NGN_LONG_1L';
INSERT INTO investment_lot (investment_id, quantity, average_cost, purchased_at, remaining_quantity, total_cost, currency, created_at, updated_at)
SELECT i.id, 3750000, 57333, DATE '2025-12-01', 3750000, 21500000, 'VND', NOW(), NOW() FROM temp_silver_ids i WHERE i.symbol = 'ANCARAT_NGN_LONG_1L';

DROP TABLE temp_silver_ids;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check created data
SELECT 'Categories' as table_name, COUNT(*) as count
FROM category
WHERE
    user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Wallets', COUNT(*)
FROM wallet
WHERE
    user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Transactions', COUNT(*)
FROM transaction
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    )
UNION ALL
SELECT 'Budgets', COUNT(*)
FROM budget
WHERE
    user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Budget Items', COUNT(*)
FROM budget_item
WHERE
    budget_id IN (
        SELECT id
        FROM budget
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    )
UNION ALL
SELECT 'Investments', COUNT(*)
FROM investment
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    )
UNION ALL
SELECT 'Investment Transactions', COUNT(*)
FROM investment_transaction
WHERE
    wallet_id IN (
        SELECT id
        FROM wallet
        WHERE
            user_id = (SELECT uid FROM _demo_user)
    )
UNION ALL
SELECT 'Investment Lots', COUNT(*)
FROM investment_lot
WHERE
    investment_id IN (
        SELECT id
        FROM investment
        WHERE
            wallet_id IN (
                SELECT id
                FROM wallet
                WHERE
                    user_id = (SELECT uid FROM _demo_user)
            )
    );

-- Summary of wallets and balances
SELECT
    wallet_name,
    balance / 100.0 as balance_vnd,
    CASE type
        WHEN 0 THEN 'BASIC'
        WHEN 1 THEN 'INVESTMENT'
    END as wallet_type
FROM wallet
WHERE
    user_id = (SELECT uid FROM _demo_user)
ORDER BY id;

-- Summary of investments
SELECT
    i.symbol,
    i.name,
    i.quantity / 10000.0 as quantity,
    i.average_cost / 100.0 as avg_cost_vnd,
    i.total_cost / 100.0 as total_cost_vnd,
    CASE i.type
        WHEN 1  THEN 'CRYPTOCURRENCY'
        WHEN 2  THEN 'STOCK'
        WHEN 3  THEN 'ETF'
        WHEN 4  THEN 'MUTUAL_FUND'
        WHEN 8  THEN 'GOLD_VND'
        WHEN 9  THEN 'GOLD_USD'
        WHEN 10 THEN 'SILVER_VND'
        WHEN 11 THEN 'SILVER_USD'
        ELSE 'OTHER'
    END as investment_type
FROM investment i
    JOIN wallet w ON i.wallet_id = w.id
WHERE
    w.user_id = (SELECT uid FROM _demo_user)
ORDER BY i.id;

-- ============================================================================
-- STEP 9: CREATE PORTFOLIO HISTORY (90 days — for PNL chart)
-- ============================================================================
-- Strategy: generate 1 row per day for the investment wallet.
-- Total cost stays constant (we only bought, no sells).
-- total_cost = gold 1,419,000,000 + silver 76,000,000 = 1,495,000,000 VND
--
-- Gold price trend (VND/lượng): started ~88M in Jan, rose to ~110M by Apr 2026
-- Silver price trend (VND/lượng): started ~2,100,000 in Jan, rose to ~2,800,000 by Apr
-- We model both as smooth upward curves with realistic daily noise.
-- total_value per day = Σ (qty_grams / 37.5 * lượng_price_that_day) for each holding
--
-- Simplified daily value = interpolated between anchor points + small noise term.
-- Anchors (total portfolio market value):
-- By Jan 1 already holding PNJ(2L), Ancarat(1lot), Phú Quý(1lot), BTMC, Nhẫn SJC(3L)
-- → ~780M cost, gold up ~8% → ~840M value already in profit
--   2026-01-01:  840,000,000  (portfolio already in profit, 7.7% gain)
--   2026-01-15:  980,000,000  (after SJC lot 2 + Phú Quý lot 2 added)
--   2026-02-08: 1,150,000,000 (after Nhẫn SJC lot 2 added)
--   2026-03-01: 1,320,000,000 (after Doji gold added)
--   2026-03-15: 1,450,000,000 (after final SJC lot)
--   2026-04-01: 1,628,855,076 (current, all positions × current prices)
-- ============================================================================

BEGIN;

INSERT INTO portfolio_history (user_id, wallet_id, total_value, total_cost, total_pnl, currency, timestamp, created_at, updated_at)
WITH
-- Investment wallet id
inv_wallet AS (
    SELECT w.id AS wid
    FROM wallet w
    WHERE w.user_id = (SELECT uid FROM _demo_user)
      AND w.wallet_name = 'Danh mục đầu tư'
),
-- Generate one row per day for last 90 days (~ Jan 1 → Apr 1 2026)
days AS (
    SELECT generate_series(0, 89) AS d
),
-- Piecewise-linear interpolation + deterministic noise
-- Anchor total_values at key dates (day 0 = 2026-01-01)
anchors(day_offset, value) AS (
    VALUES
        (0,   840000000),    -- 2026-01-01
        (14,  980000000),    -- 2026-01-15
        (38,  1150000000),   -- 2026-02-08
        (59,  1320000000),   -- 2026-03-01
        (73,  1450000000),   -- 2026-03-15
        (90,  1628855076)    -- 2026-04-01 (current)
),
-- Map each generated day to calendar date (origin = 2025-10-03, so day 0 = that date,
-- and day 89 = 2026-01-01 ... actually let's use origin = 2025-12-31 so day 89 = 2026-03-30)
-- Simpler: day 0 = 2026-01-01, generate 90 days forward to 2026-04-01
dated AS (
    SELECT
        d,
        DATE '2026-01-01' + d * INTERVAL '1 day' AS ts
    FROM days
),
-- Interpolate value between the two nearest anchors
interpolated AS (
    SELECT
        d.d,
        d.ts,
        (
            SELECT
                a1.value + (a2.value - a1.value)::float
                    * (d.d - a1.day_offset)::float
                    / NULLIF((a2.day_offset - a1.day_offset)::float, 0)
            FROM anchors a1
            JOIN anchors a2 ON a2.day_offset = (
                SELECT MIN(day_offset) FROM anchors WHERE day_offset > a1.day_offset
            )
            WHERE a1.day_offset <= d.d
              AND a2.day_offset >  d.d
            ORDER BY a1.day_offset DESC
            LIMIT 1
        ) AS base_value
    FROM dated d
),
-- Add deterministic daily noise (±0.4% using sine wave to look natural)
with_noise AS (
    SELECT
        d,
        ts,
        COALESCE(base_value, 1628855076) AS base_value,
        COALESCE(base_value, 1628855076)
            * (1 + 0.004 * SIN(d * 2.3)) AS noisy_value
    FROM interpolated
)
-- Cumulative cost: grows as each lot is purchased (day offsets from 2026-01-01)
-- day  0 (Jan 01): existing lots = PNJ 2L + Ancarat + Phú Quý lot1 + BTMC + Nhẫn SJC 3L + SJC lot1 = ~780M
-- day 10 (Jan 10): + SJC lot2 106M → 886M
-- day 14 (Jan 15): + Phú Quý lot2 12M → 898M
-- day 38 (Feb 08): + Nhẫn SJC lot2 202M → 1100M
-- day 59 (Mar 01): + Doji gold 192M + DOJI silver 12M → 1304M
-- day 73 (Mar 15): + SJC lot3 113M + PNJ lot2 172M = 285M → 1495M (final)
SELECT
    (SELECT uid FROM _demo_user),
    (SELECT wid FROM inv_wallet),
    noisy_value::bigint AS total_value,
    CASE
        WHEN d <  10 THEN  780000000
        WHEN d <  14 THEN  886000000
        WHEN d <  38 THEN  898000000
        WHEN d <  59 THEN 1100000000
        WHEN d <  73 THEN 1304000000
        ELSE               1495000000
    END AS total_cost,
    (noisy_value - CASE
        WHEN d <  10 THEN  780000000
        WHEN d <  14 THEN  886000000
        WHEN d <  38 THEN  898000000
        WHEN d <  59 THEN 1100000000
        WHEN d <  73 THEN 1304000000
        ELSE               1495000000
    END)::bigint AS total_pnl,
    'VND',
    ts + INTERVAL '17 hours',
    NOW(),
    NOW()
FROM with_noise
WHERE base_value IS NOT NULL
ORDER BY ts;

COMMIT;

SELECT 'Portfolio History', COUNT(*) FROM portfolio_history WHERE user_id = (SELECT uid FROM _demo_user);

-- ============================================================================
-- STEP 10: CREATE COMMUNITY POSTS & COMMENTS
-- ============================================================================
-- Posts from the demo user covering gold/silver investment topics.
-- We also add post_hashtag rows and a few post_like + comment rows.
-- Note: like_count / comment_count are denormalized counters updated below.

BEGIN;

-- -----------------------------------------------------------------------
-- Posts
-- -----------------------------------------------------------------------
INSERT INTO post (user_id, content, image_url, like_count, comment_count, share_count, created_at, updated_at)
SELECT uid, content, '', likes, cmt_cnt, shares, created_at, NOW()
FROM _demo_user
CROSS JOIN (VALUES
    (
        '📈 Vàng SJC hôm nay tiếp tục tăng mạnh lên ~110 triệu/lượng. Mình đã tích lũy được 3 lượng từ hồi tháng 10 năm ngoái, hiện lãi hơn 40%. Anh em ai đang nắm giữ vàng SJC không? Theo mình, xu hướng ngắn hạn vẫn còn tăng nhẹ do Fed chưa có tín hiệu cắt giảm lãi suất.',
        42, 6, 3,
        NOW() - INTERVAL '2 hours'
    ),
    (
        '🪙 Nhẫn vàng 9999 đang là lựa chọn hấp dẫn hơn SJC vì chênh lệch mua-bán thấp hơn. Mình vừa bổ sung thêm 2 lượng Nhẫn SJC hồi tháng 2 @ 98 triệu. Giờ giá ~107 triệu rồi 😊 Ai có kinh nghiệm mua nhẫn 9999 chia sẻ nào!',
        67, 5, 5,
        NOW() - INTERVAL '5 hours'
    ),
    (
        '🥈 Bạc đang được chú ý nhiều hơn trong danh mục đầu tư của mình. Tỷ lệ Vàng/Bạc (Gold-Silver ratio) hiện ~80 — lịch sử cho thấy khi ratio > 80 thì bạc thường outperform về sau. Mình đang giữ 10 lượng bạc Phú Quý và 5 lượng Doji 99.9.',
        28, 5, 2,
        NOW() - INTERVAL '1 day'
    ),
    (
        '💰 Chiến lược DCA (Dollar Cost Averaging) với vàng thực sự hiệu quả. Mình mua đều đặn mỗi tháng 1 lượng kể từ tháng 7/2025, giá trung bình chỉ ~95 triệu/lượng, trong khi giá thị trường hiện là ~110 triệu. Lãi 15.8% chỉ sau ~9 tháng!',
        95, 23, 11,
        NOW() - INTERVAL '2 days'
    ),
    (
        '📊 Review danh mục đầu tư Q1/2026 của mình:\n✅ Vàng SJC: +25.3%\n✅ Nhẫn 9999: +20.1%\n✅ Bạc vật chất: +18.5%\n✅ Cổ phiếu VCB: +12.4%\n\nTổng danh mục tăng ~21% so với đầu năm. Cảm ơn cộng đồng đã chia sẻ nhiều insights hay 🙏',
        134, 31, 18,
        NOW() - INTERVAL '3 days'
    ),
    (
        '❓ Hỏi anh em: nên mua BTMC hay PNJ cho kênh tích lũy dài hạn? Mình đang phân vân vì BTMC có phí thấp hơn nhưng PNJ có thanh khoản tốt hơn ở TPHCM. Mọi người có kinh nghiệm gì không?',
        19, 14, 2,
        NOW() - INTERVAL '4 days'
    )
) AS p(content, likes, cmt_cnt, shares, created_at);

-- -----------------------------------------------------------------------
-- Hashtags (attach to posts by content snippet match)
-- -----------------------------------------------------------------------
INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('vàng'), ('đầutư')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.content LIKE '%SJC%'
  AND p.like_count = 42;

INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('nhẫnvàng'), ('9999'), ('đầutư')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 67;

INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('bạc'), ('goldsilverpatio'), ('đầutư')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 28;

INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('DCA'), ('vàng'), ('tíchlũy')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 95;

INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('review'), ('danh mục'), ('Q12026')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 134;

INSERT INTO post_hashtag (post_id, hashtag, created_at)
SELECT p.id, h.tag, p.created_at
FROM post p
CROSS JOIN (VALUES ('BTMC'), ('PNJ'), ('vàng')) AS h(tag)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 19;

-- -----------------------------------------------------------------------
-- Comments (on the highest-engagement DCA post and Q1 review post)
-- -----------------------------------------------------------------------
-- Comments on SJC post (like_count = 42)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Mình cũng đang giữ SJC, tình hình địa chính trị căng thẳng nên vàng vẫn là kênh trú ẩn tốt nhất!', 1, INTERVAL '20 minutes'),
    ('SJC chênh lệch mua-bán còn cao quá, anh em cân nhắc thêm nhẫn 9999 cho dễ thanh khoản.', 2, INTERVAL '45 minutes'),
    ('Fed chưa cắt lãi suất thì vàng còn tăng. Mình target 115M cuối Q2.', 0, INTERVAL '1 hour 10 minutes'),
    ('Cho hỏi bạn mua ở đâu? SJC hay qua ngân hàng?', 1, INTERVAL '1 hour 30 minutes'),
    ('Cảm ơn bạn đã chia sẻ! Mình mới vào thị trường vàng, đang tìm hiểu SJC vs nhẫn.', 0, INTERVAL '2 hours'),
    ('Tin tức Fed tuần này sẽ quyết định hướng đi của vàng. Mọi người chú ý theo dõi nhé.', 0, INTERVAL '2 hours 30 minutes')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 42;

-- Comments on nhẫn vàng post (like_count = 67)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Nhẫn 9999 thanh khoản tốt hơn SJC nhiều, mình cũng đang ưu tiên nhẫn cho danh mục mới.', 3, INTERVAL '30 minutes'),
    ('Bạn mua nhẫn SJC hay DOJI? Theo mình DOJI có uy tín và giá cạnh tranh hơn một chút.', 2, INTERVAL '1 hour'),
    ('Chênh lệch mua-bán nhẫn hiện ~1-1.5 triệu, khá ổn so với SJC chênh 3-4 triệu.', 1, INTERVAL '1 hour 45 minutes'),
    ('Mình giữ mix cả SJC lẫn nhẫn 9999 để phân tán. SJC cho dài hạn, nhẫn cho linh hoạt.', 0, INTERVAL '2 hours 20 minutes'),
    ('Hỏi nhỏ: nhẫn 9999 của PNJ có được công nhận như SJC không bạn?', 1, INTERVAL '3 hours')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 67;

-- Comments on silver ratio post (like_count = 28)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Ratio vàng/bạc ~80 thực sự là tín hiệu tốt cho bạc. Mình đang dần tăng tỷ trọng bạc từ 5% lên 15%.', 2, INTERVAL '1 hour'),
    ('Nhu cầu bạc từ ngành pin mặt trời và xe điện đang tăng rất mạnh, fundamental rất tốt.', 1, INTERVAL '2 hours'),
    ('Mua bạc vật chất thì nên mua thỏi hay xu bạc? Loại nào dễ bán lại hơn bạn ơi?', 3, INTERVAL '3 hours'),
    ('Bạc 99.9 thanh khoản kém hơn vàng nhiều, anh em lưu ý spread khi mua-bán nhé.', 0, INTERVAL '4 hours'),
    ('Cảm ơn phân tích hay! Mình chưa nghĩ đến ratio này bao giờ, sẽ theo dõi thêm.', 0, INTERVAL '5 hours')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 28;

-- Comments on DCA post (like_count = 95)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Chiến lược DCA với vàng rất hay! Mình cũng đang làm tương tự nhưng mua mỗi quý thay vì mỗi tháng.', 2, INTERVAL '1 hour'),
    ('Mua SJC hay nhẫn 9999 bạn ơi? Mình nghe nói nhẫn 9999 linh hoạt hơn?', 3, INTERVAL '2 hours'),
    ('Cảm ơn bạn đã chia sẻ! Mình mới bắt đầu đầu tư vàng, có thể hỏi thêm về cách chọn điểm mua không?', 1, INTERVAL '4 hours'),
    ('Với lãi suất Fed còn cao, vàng vẫn là kênh trú ẩn tốt. +1 cho chiến lược của bạn!', 0, INTERVAL '5 hours')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 95;

-- Comments on Q1 review post (like_count = 134)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Kết quả Q1 ấn tượng quá! Bạn có thể chia sẻ tỷ trọng phân bổ không? Bao nhiêu % vàng, bao nhiêu % cổ phiếu?', 4, INTERVAL '30 minutes'),
    ('VCB +12.4% cũng rất ổn rồi. Mình đang cân nhắc thêm VCB vào danh mục dài hạn.', 1, INTERVAL '1 hour'),
    ('Bạc 18.5% — mình cũng ngạc nhiên với bạc vật chất. Có vẻ thị trường đang dần chú ý đến bạc hơn rồi.', 2, INTERVAL '2 hours'),
    ('Tuyệt vời! Cảm ơn bạn đã minh bạch chia sẻ hiệu suất. Mọi người thường chỉ khoe lãi chứ không nói rõ số liệu 😄', 0, INTERVAL '3 hours'),
    ('Danh mục đa dạng rất tốt. Bạn có dùng app nào để theo dõi portfolio không?', 5, INTERVAL '4 hours')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 134;

-- Comments on BTMC vs PNJ post (like_count = 19)
INSERT INTO comment (post_id, user_id, content, reply_count, created_at, updated_at)
SELECT p.id, (SELECT uid FROM _demo_user), c.content, c.replies, p.created_at + c.offset_interval, NOW()
FROM post p
CROSS JOIN (VALUES
    ('Mình ở HCM chọn PNJ vì cửa hàng nhiều, dễ bán lại. BTMC thì phí mua rẻ hơn một chút.', 2, INTERVAL '1 hour'),
    ('Nếu dài hạn thì BTMC ok vì chi phí thấp. Nhưng nếu cần thanh khoản nhanh thì PNJ tốt hơn.', 1, INTERVAL '2 hours'),
    ('Mình đang giữ cả hai để phân tán rủi ro 😄', 0, INTERVAL '3 hours')
) AS c(content, replies, offset_interval)
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count = 19;

-- -----------------------------------------------------------------------
-- Post likes (demo user likes their own popular posts — realistic for demo)
-- -----------------------------------------------------------------------
INSERT INTO post_like (user_id, post_id, created_at)
SELECT (SELECT uid FROM _demo_user), p.id, NOW()
FROM post p
WHERE p.user_id = (SELECT uid FROM _demo_user)
  AND p.like_count IN (95, 134);

COMMIT;

-- ============================================================================
-- STEP 11: GOLD & SILVER SENTIMENT VOTES + COMMENTS
-- ============================================================================
-- Simulate today's sentiment: ~65% bullish gold, ~60% bullish silver.
-- We insert the demo user's vote + comment, plus a set of anonymous votes
-- to build a realistic percentage distribution.

BEGIN;

-- Demo user votes BULLISH on gold today
INSERT INTO gold_vote (user_id, anonymous_id, vote_date, direction, category, created_at, updated_at)
SELECT uid, NULL, CURRENT_DATE, 1, 0, NOW(), NOW()
FROM _demo_user
ON CONFLICT DO NOTHING;

-- Demo user votes BULLISH on silver today
INSERT INTO gold_vote (user_id, anonymous_id, vote_date, direction, category, created_at, updated_at)
SELECT uid, NULL, CURRENT_DATE, 1, 1, NOW(), NOW()
FROM _demo_user
ON CONFLICT DO NOTHING;

-- Anonymous votes for gold (direction 1=BULLISH, 2=BEARISH)
-- 13 bullish + 7 bearish = 20 anon votes → total with demo user: 14 bull / 7 bear = 67% bullish
INSERT INTO gold_vote (user_id, anonymous_id, vote_date, direction, category, created_at, updated_at)
SELECT NULL, gen.anon_id, CURRENT_DATE, gen.dir, 0, NOW() - gen.ago, NOW()
FROM (VALUES
    ('anon-gold-001', 1, INTERVAL '10 minutes'),
    ('anon-gold-002', 1, INTERVAL '15 minutes'),
    ('anon-gold-003', 1, INTERVAL '20 minutes'),
    ('anon-gold-004', 1, INTERVAL '25 minutes'),
    ('anon-gold-005', 2, INTERVAL '30 minutes'),
    ('anon-gold-006', 1, INTERVAL '35 minutes'),
    ('anon-gold-007', 1, INTERVAL '40 minutes'),
    ('anon-gold-008', 2, INTERVAL '45 minutes'),
    ('anon-gold-009', 1, INTERVAL '50 minutes'),
    ('anon-gold-010', 2, INTERVAL '55 minutes'),
    ('anon-gold-011', 1, INTERVAL '60 minutes'),
    ('anon-gold-012', 2, INTERVAL '65 minutes'),
    ('anon-gold-013', 1, INTERVAL '70 minutes'),
    ('anon-gold-014', 2, INTERVAL '75 minutes'),
    ('anon-gold-015', 1, INTERVAL '80 minutes'),
    ('anon-gold-016', 1, INTERVAL '85 minutes'),
    ('anon-gold-017', 2, INTERVAL '90 minutes'),
    ('anon-gold-018', 1, INTERVAL '95 minutes'),
    ('anon-gold-019', 1, INTERVAL '100 minutes'),
    ('anon-gold-020', 2, INTERVAL '105 minutes')
) AS gen(anon_id, dir, ago)
ON CONFLICT DO NOTHING;

-- Anonymous votes for silver (direction 1=BULLISH, 2=BEARISH)
-- 11 bullish + 7 bearish = 18 anon votes → total with demo user: 12 bull / 7 bear = 63% bullish
INSERT INTO gold_vote (user_id, anonymous_id, vote_date, direction, category, created_at, updated_at)
SELECT NULL, gen.anon_id, CURRENT_DATE, gen.dir, 1, NOW() - gen.ago, NOW()
FROM (VALUES
    ('anon-silver-001', 1, INTERVAL '12 minutes'),
    ('anon-silver-002', 1, INTERVAL '18 minutes'),
    ('anon-silver-003', 2, INTERVAL '22 minutes'),
    ('anon-silver-004', 1, INTERVAL '28 minutes'),
    ('anon-silver-005', 2, INTERVAL '33 minutes'),
    ('anon-silver-006', 1, INTERVAL '38 minutes'),
    ('anon-silver-007', 1, INTERVAL '43 minutes'),
    ('anon-silver-008', 2, INTERVAL '48 minutes'),
    ('anon-silver-009', 1, INTERVAL '53 minutes'),
    ('anon-silver-010', 2, INTERVAL '58 minutes'),
    ('anon-silver-011', 1, INTERVAL '63 minutes'),
    ('anon-silver-012', 2, INTERVAL '68 minutes'),
    ('anon-silver-013', 1, INTERVAL '73 minutes'),
    ('anon-silver-014', 2, INTERVAL '78 minutes'),
    ('anon-silver-015', 1, INTERVAL '83 minutes'),
    ('anon-silver-016', 2, INTERVAL '88 minutes'),
    ('anon-silver-017', 1, INTERVAL '93 minutes'),
    ('anon-silver-018', 1, INTERVAL '98 minutes')
) AS gen(anon_id, dir, ago)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------
-- Sentiment comments (gold & silver) — from the demo user
-- -----------------------------------------------------------------------
INSERT INTO gold_vote_comment (user_id, vote_date, content, category, created_at)
SELECT uid, CURRENT_DATE, content, cat, NOW() - ago
FROM _demo_user
CROSS JOIN (VALUES
    -- Gold comments (category = 0)
    ('Fed vẫn chưa có dấu hiệu cắt lãi suất, dòng tiền tiếp tục chảy vào vàng. Kỳ vọng SJC sẽ chạm 115 triệu trong Q2/2026.', 0, INTERVAL '5 minutes'),
    ('Căng thẳng địa chính trị ở Trung Đông và tình hình USD yếu đang hỗ trợ vàng tốt. Mình BULLISH ngắn hạn nhưng cẩn thận nếu Fed bất ngờ tăng lãi.', 0, INTERVAL '30 minutes'),
    -- Silver comments (category = 1)
    ('Bạc đang được hưởng lợi kép: cả nhu cầu công nghiệp (pin mặt trời) lẫn dòng tiền trú ẩn. Ratio vàng/bạc ~80 là dấu hiệu bạc đang undervalue.', 1, INTERVAL '8 minutes'),
    ('Với xu hướng năng lượng xanh đang tăng tốc, nhu cầu bạc cho tấm pin mặt trời sẽ còn tăng mạnh trong 2–3 năm tới.', 1, INTERVAL '45 minutes')
) AS c(content, cat, ago);

COMMIT;

-- ============================================================================
-- VERIFICATION: COMMUNITY & SENTIMENT
-- ============================================================================

SELECT 'Posts'             AS table_name, COUNT(*) AS count FROM post         WHERE user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Post Hashtags',    COUNT(*) FROM post_hashtag WHERE post_id IN (SELECT id FROM post WHERE user_id = (SELECT uid FROM _demo_user))
UNION ALL
SELECT 'Comments',         COUNT(*) FROM comment      WHERE user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Post Likes',       COUNT(*) FROM post_like    WHERE user_id = (SELECT uid FROM _demo_user)
UNION ALL
SELECT 'Gold Votes (gold)',   COUNT(*) FROM gold_vote WHERE category = 0 AND vote_date = CURRENT_DATE
UNION ALL
SELECT 'Gold Votes (silver)', COUNT(*) FROM gold_vote WHERE category = 1 AND vote_date = CURRENT_DATE
UNION ALL
SELECT 'Sentiment Comments',  COUNT(*) FROM gold_vote_comment WHERE user_id = (SELECT uid FROM _demo_user);