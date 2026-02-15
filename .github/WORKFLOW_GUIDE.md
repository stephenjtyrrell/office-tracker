# GitHub Actions Workflow Guide

## Overview

This project uses GitHub Actions to automate CI/CD processes. The workflows are organized into two main pipelines:

1. **CI Pipeline** (`prod-deploy.yml`) - Build & Test
2. **CD Pipeline** (`deploy-on-merge.yml`) - Deployment

## Workflow Architecture

### CI Pipeline: Build & Test (`prod-deploy.yml`)

**Triggers:**
- Push to `main` or `staging` branches
- Push to feature branches: `feat/**`, `fix/**`, `chore/**`, `refactor/**`
- Pull requests to `main` or `staging` branches

**What it does:**
1. Checks out code
2. Sets up Node.js 18.x with npm caching
3. Installs dependencies with `npm ci`
4. Runs full test suite with coverage reporting
5. Uploads coverage to Codecov for tracking

**Status checks:**
- All tests must pass before PR can be merged
- Coverage reports are available on Codecov

### CD Pipeline: Deploy on Merge (`deploy-on-merge.yml`)

**Triggers:**
- Only when a PR is merged to `main` or `staging` branch

**What it does:**
1. Validates that deployment secrets are configured
2. Triggers Render webhook to deploy the application
3. Handles both production (main) and staging deployments

**Key features:**
- Secret validation before deployment
- Proper error handling with `--fail` flag on curl
- Timeout protection with `--max-time 10`
- Clear success/failure logging

## Configuration

### Required Secrets

Add these secrets to your GitHub repository settings:

1. **`RENDER_DEPLOY_HOOK_URL_PROD`**
   - Render webhook for production deployment
   - Get this from Render dashboard

2. **`RENDER_DEPLOY_HOOK_URL_STAGING`**
   - Render webhook for staging deployment
   - Get this from Render dashboard

### How to Add Secrets

1. Go to repository **Settings**
2. Click **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the secret name and value
5. Save

## Improvements Made

### 1. **Consolidated Build Workflows**
   - **Before**: Separate `prod-deploy.yml` and `staging-deploy.yml` with identical code
   - **After**: Single unified `prod-deploy.yml` handles all branches
   - **Benefit**: DRY principle, easier to maintain, single source of truth

### 2. **Enhanced Error Handling**
   - **Before**: `curl` without error handling - silent failures possible
   - **After**: Added `--fail`, `--show-error`, `--max-time 10` flags
   - **Benefit**: Deployments fail fast and clearly, timeout protection

### 3. **Secret Validation**
   - **Before**: No check if secrets were configured - would fail silently
   - **After**: Pre-flight check validates secrets exist before deployment
   - **Benefit**: Clear error messages, prevents confusing curl failures

### 4. **Test Coverage Integration**
   - **Before**: Tests ran but coverage wasn't tracked
   - **After**: Coverage automatically uploaded to Codecov
   - **Benefit**: Can track coverage trends over time, set coverage gates

### 5. **Better Permissions**
   - **Before**: Overly broad or unclear permissions
   - **After**: Explicit permissions per workflow (read, checks, pull-requests, actions)
   - **Benefit**: Better security, follows principle of least privilege

### 6. **Improved Naming**
   - **Before**: Generic "Build Production", "Build Staging"
   - **After**: Clear "CI - Build & Test" and "CD - Deploy on Merge"
   - **Benefit**: Clearer intent, easier to understand pipeline

### 7. **PR Coverage**
   - **Before**: Only ran on pushes to main/staging
   - **After**: Also runs on pull requests
   - **Benefit**: PRs are validated before merge, catches issues early

### 8. **Better Branch Patterns**
   - **Before**: `feat/*`, `fix/*` patterns with single wildcards
   - **After**: `feat/**`, `fix/**` patterns with double wildcards
   - **Benefit**: Supports nested branch names like `feat/user/auth`

## Workflow Status

View workflow status in GitHub:
- Click **Actions** tab
- See all workflow runs with status (✅ pass, ❌ fail)
- Click any run to see detailed logs

## Testing Locally

Before pushing, ensure tests pass locally:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode while developing
npm run test:watch
```

## Deployment Flow

```
┌─────────────────┐
│  Feature Branch │
│   or main/stag  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  CI Pipeline Runs   │
│  - Build            │
│  - Test Coverage    │
└────────┬────────────┘
         │
         ├─ ❌ Tests fail → PR blocked
         │
         ├─ ✅ Tests pass → PR can be merged
         │
         ▼
┌─────────────────────┐
│   PR Merged to      │
│   main/staging      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  CD Pipeline:       │
│  - Validate secrets │
│  - Deploy to Render │
└─────────────────────┘
```

## Troubleshooting

### Deployment Fails with Secret Error

**Problem:** `Error: RENDER_DEPLOY_HOOK_URL_PROD secret not configured`

**Solution:**
1. Go to repository Settings
2. Add the missing secret
3. Retry the deployment

### Tests Fail in GitHub but Pass Locally

**Problem:** Different behavior between local and GitHub

**Causes:**
- Node version mismatch: GitHub uses 18.x
- File permission issues
- Environment variables not set in GitHub

**Solution:**
1. Check Node version locally: `node --version` should be 18.x
2. Clear cache: `npm ci && npm test --coverage`
3. Compare test output carefully

### Deployment Timeout

**Problem:** `Operation timed out`

**Solution:**
1. Check Render service status
2. Check if Render webhook is valid
3. Increase timeout in workflow (currently 10 seconds)

## Best Practices

✅ **Always run tests locally before pushing**
```bash
npm test
```

✅ **Keep feature branches short-lived**
- Merge to main/staging quickly to avoid conflicts

✅ **Use descriptive commit messages**
- Helps identify which changes caused issues

✅ **Monitor workflow runs**
- Check Actions tab after each push
- Fix failures quickly

✅ **Keep secrets secure**
- Never commit secrets
- Rotate Render webhooks periodically

## Security

The workflows include several security measures:

1. **No plaintext secrets** in YAML files
2. **Limited permissions** - only what's needed
3. **Explicit secret validation** before use
4. **No credentials persisted** in checkout step
5. **Read-only checks** where possible

## Future Improvements

Potential enhancements:

1. **Linting**: Add ESLint for code quality checks
2. **Security scanning**: Add Dependabot or Snyk
3. **Performance testing**: Track performance metrics
4. **Database migrations**: Auto-run migrations on deploy
5. **Slack notifications**: Notify team of failures
6. **Release automation**: Auto-create releases on tag
7. **Docker build**: Build and push Docker images
8. **Database backups**: Auto-backup before deployment

## Getting Help

If workflows aren't working:

1. Check GitHub Actions logs (Actions tab)
2. Verify secrets are configured correctly
3. Ensure branch protection rules are appropriate
4. Check Render webhook status
5. Review commit history for recent changes
