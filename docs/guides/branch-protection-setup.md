# Branch Protection Setup Guide

## Overview

After the CI workflows are merged to `main`, configure branch protection rules in GitHub
to enforce all CI checks as required status checks before merging.

## Required Status Checks

Configure these as **required** status checks for the `main` branch:

### Backend CI (`backend.yml`)
- `Lint`
- `Test`
- `Build`

### Frontend CI (`frontend.yml`)
- `Lint & Test`
- `Build`
- `E2E Tests`

### Security (`security.yml`)
- `Go Vulnerability Check`
- `npm Audit`

## How to Configure

1. Go to **Settings** > **Branches** in your GitHub repository
2. Click **Add branch protection rule** (or edit the existing `main` rule)
3. Set **Branch name pattern** to `main`
4. Enable **Require a pull request before merging**
   - Set **Required approvals** to `1`
5. Enable **Require status checks to pass before merging**
   - Enable **Require branches to be up to date before merging**
   - Search for and add each status check listed above
6. Enable **Do not allow bypassing the above settings**
7. Click **Save changes**

## Recommended Additional Settings

- **Require conversation resolution before merging** — ensures all review comments are addressed
- **Require signed commits** — optional, adds commit authenticity verification
- **Restrict who can push to matching branches** — limit to maintainers only

## Notes

- Status checks only appear in the search dropdown after the workflow has run at least once
- The first PR that adds these workflows will NOT have the checks enforced (they don't exist yet)
- After the first successful CI run on `main`, configure the branch protection rules
- Dependabot PRs are subject to the same branch protection rules
