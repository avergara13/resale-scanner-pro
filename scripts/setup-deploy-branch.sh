#!/bin/bash
# setup-deploy-branch.sh
# Run once to create the deploy/production branch and set Railway to watch it.
# After this, every Spark publish automatically triggers the wire-and-deploy Action.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo ""
echo "🚀  Loft OS — Resale Scanner Deploy Branch Setup"
echo "================================================"
echo ""

# 1. Create deploy/production branch from current main
echo "1. Creating deploy/production branch..."
git checkout -b deploy/production 2>/dev/null || git checkout deploy/production
git push origin deploy/production --force
git checkout main
echo "   ✅  deploy/production created and pushed"
echo ""

# 2. Add GitHub Actions secret reminders
echo "2. GitHub Secrets to add at github.com/avergara13/resale-scanner-pro/settings/secrets/actions:"
echo ""
echo "   N8N_DEPLOY_WEBHOOK    → your n8n webhook URL for deploy notifications"
echo "   NOTION_DATABASE_ID    → 7e49058fa8874889b9f6ae5a6c3bf8e7 (Inventory DB)"
echo ""
echo "   Note: GITHUB_TOKEN is automatic — no setup needed."
echo ""

# 3. Railway instructions
echo "3. In Railway dashboard:"
echo "   Settings → Source → Branch → deploy/production"
echo "   Start command: tsx server.ts  (or: npm run build && vite preview)"
echo "   Build command: npm install && npm run build"
echo ""

echo "================================================"
echo "✅  Setup complete!"
echo ""
echo "From now on:"
echo "  Spark publishes → main"
echo "  GitHub Actions fires → applies wiring → pushes to deploy/production"  
echo "  Railway deploys → live app updated"
echo ""
echo "To test the wiring script locally:"
echo "  node scripts/apply-wiring.mjs"
echo ""
