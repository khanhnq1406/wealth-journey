---
type: bug
status: Done
---

## Overview

The floating action button popup on the settings page shows only the "Add Investment" button while wallet/settings data is still loading. The popup should wait until data fetching is complete before rendering its full action set.

## Details

When the settings page has not finished fetching data, the FAB popup corner shows only the add investment button instead of the full button group.

Expected: The popup waits for the data fetch to complete before rendering all action buttons.
Actual: The popup renders prematurely with an incomplete set of buttons while data is still loading.
