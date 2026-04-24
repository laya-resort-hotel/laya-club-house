# GitHub Actions → Firebase Auto Deploy

## What this adds

This project now includes 2 workflows:

1. `.github/workflows/firebase-deploy.yml`
   - Deploys production resources on push to `main`
   - Deploys:
     - Hosting
     - Functions
     - Firestore Rules
     - Firestore Indexes
     - Storage Rules

2. `.github/workflows/firebase-hosting-preview.yml`
   - Creates Firebase Hosting preview deployments for pull requests
   - Useful for UI review before merge

## Required GitHub Secret

Create this repository secret:

- `FIREBASE_SERVICE_ACCOUNT_LAYA_CLUB_HOUSE`

Value:
- Paste the full JSON of a Firebase/Google service account key with permission to deploy Hosting, Functions, Firestore Rules/Indexes, and Storage Rules.

## Where to create the secret

GitHub repository → Settings → Secrets and variables → Actions → New repository secret

## Recommended service account roles

At minimum, use a deploy-capable service account for this Firebase project.
If you already deploy with Firebase CLI on your machine, you can create a dedicated CI deploy service account for GitHub Actions.

## Notes

- Production deploy runs when code is pushed to `main`
- Manual deploy is also available via `workflow_dispatch`
- PR preview only deploys Hosting preview channels
- Full backend deploy is handled by the production workflow

## First run checklist

1. Add the GitHub secret
2. Push these workflow files to `main`
3. Open the Actions tab in GitHub
4. Run `Deploy Firebase` manually once if needed
5. Confirm that Hosting, Functions, Rules, and Indexes deploy successfully

## Important

If your project later uses a different Firebase project ID, update both workflow files.
