#!/bin/bash
# Validate staged puzzle config JSON files before commit
# Blocks commit only on invalid JSON; other checks are warnings.

EXIT_CODE=0

# Find staged JSON files in resources/configs/
STAGED_JSON=$(git diff --cached --name-only --diff-filter=ACM | grep '^resources/configs/.*\.json$')

if [ -n "$STAGED_JSON" ]; then
    echo "🔍 Validating puzzle config JSON files..."
    for file in $STAGED_JSON; do
        if [ -f "$file" ]; then
            if ! python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
                echo "❌ Invalid JSON: $file"
                EXIT_CODE=1
            else
                echo "✅ Valid: $file"
            fi
        fi
    done
fi

# Warn about hardcoded numeric values in puzzle scripts
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '^scripts/levels/.*\.ts$')

if [ -n "$STAGED_TS" ]; then
    echo ""
    echo "🔍 Checking for hardcoded values in puzzle scripts..."
    for file in $STAGED_TS; do
        if [ -f "$file" ]; then
            # Flag lines with bare numeric literals (excluding 0, 1, common constants)
            HARDCODED=$(grep -nE '= [0-9]{2,}' "$file" | grep -v 'const.*CONFIG\|import\|enum\|\/\/' || true)
            if [ -n "$HARDCODED" ]; then
                echo "⚠️  Possible hardcoded values in $file (should be in JSON config):"
                echo "$HARDCODED"
            fi
        fi
    done
fi

exit $EXIT_CODE
