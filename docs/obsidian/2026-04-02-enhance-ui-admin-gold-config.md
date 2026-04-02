---
type: feature
status: Not Started
---

## Overview

The admin gold config tab has several UI issues that reduce usability and visual consistency. The table always renders in mobile layout regardless of screen size, the tab selection styling is misaligned with the app's color scheme, and the tab label uses English instead of Vietnamese.

## Details

Three specific improvements are needed:

1. The gold config table currently always renders as a MobileTable even on desktop screens. It should switch to the standard desktop table layout when viewed on desktop, matching the behavior of other tables in the admin panel.

2. The tab selection component in the admin gold config area does not follow the application's established dark maroon and gold color pattern. It should be visually aligned with the rest of the app's tab styling.

3. The tab label "Gold Config" (or equivalent English text) should be translated to Vietnamese so it is consistent with the localization standard used elsewhere in the admin panel.
