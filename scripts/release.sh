#!/usr/bin/env sh
set -eu

VERSION_ARG="${1:-}"

if [ -z "$VERSION_ARG" ]; then
  echo "Usage: yarn release <major|minor|patch|x.y.z>"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

case "$VERSION_ARG" in
  major|minor|patch)
    NEW_VERSION=$(npm version "$VERSION_ARG" --no-git-tag-version | tr -d 'v')
    ;;
  *)
    if echo "$VERSION_ARG" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
      NEW_VERSION="$VERSION_ARG"
    else
      echo "Error: version must be major, minor, patch, or a semver (e.g. 3.1.0)"
      exit 1
    fi
    ;;
esac

if [ "$NEW_VERSION" != "$(node -p "require('./package.json').version")" ]; then
  npm version "$NEW_VERSION" --no-git-tag-version > /dev/null
fi

TAG="v$NEW_VERSION"

if git rev-parse "$TAG" > /dev/null 2>&1; then
  echo "Error: tag $TAG already exists."
  exit 1
fi

echo "Generating changelog..."
npx conventional-changelog -p conventionalcommits -i CHANGELOG.md -s

echo "Committing release $TAG..."
git add package.json CHANGELOG.md
git commit -m "chore(release): $TAG"
git tag -a "$TAG" -m "Release $TAG"

echo ""
echo "Release $TAG created successfully."
echo ""
echo "Next steps:"
echo "  git push origin main --follow-tags"
