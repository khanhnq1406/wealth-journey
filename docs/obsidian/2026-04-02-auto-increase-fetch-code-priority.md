---
type: feature
status: Not Started
---

## Overview

When editing an asset's type code configuration, users need the priority of the newly added fetcher to be automatically incremented so they don't have to manually assign a priority number each time. This reduces friction and prevents accidental duplicate or conflicting priority values.

## Details

When a user adds a new fetch code entry in the edit asset type code form, the priority field should auto-populate with the next available priority value (current highest priority + 1). The user should still be able to manually override the suggested value. The auto-increment should reflect the current list of fetch codes already assigned to that asset display config.
