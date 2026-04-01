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
    ('PNJ HCM',        'Vàng PNJ',       8, 1500000, 2266667, 340000000, 'VND', false, 2880000, 'gram')
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