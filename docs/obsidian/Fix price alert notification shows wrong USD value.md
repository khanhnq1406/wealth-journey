---
type: bug
status: Not Started
---

## Overview

When a user creates a price alert using USD currency, the notification content displays an incorrect value. The alert is saved correctly, but the value shown in the notification is divided by 100 — for example, an alert set at $50,000 appears as "500.00 USD" in the notification message. This erodes user trust and makes alerts unreliable.

## Details

Occurs when creating a price alert for any asset priced in USD (e.g. BTC).

Steps to reproduce:
1. Create a price alert for BTC with target price $50,000 USD
2. Wait for the alert to trigger, or trigger it manually
3. Observe the notification content

Expected: Notification displays "$50,000.00 USD" (or equivalent formatted value)
Actual: Notification displays "500.00 USD" — the value appears to be divided by 100, suggesting a cents-to-dollars conversion is being incorrectly applied when formatting the notification message.
