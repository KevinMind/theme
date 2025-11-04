#!/bin/bash

# Build script for Kevinmind theme
# Usage: ./build.sh [--install] [--release]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
INSTALL=false
RELEASE=false
for arg in "$@"; do
    case $arg in
        --install)
            INSTALL=true
            ;;
        --release)
            RELEASE=true
            ;;
    esac
done

echo -e "${YELLOW}Building Kevinmind theme...${NC}"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install

# Package the theme using the build script
echo -e "${YELLOW}Building theme...${NC}"
echo "Running: pnpm run build"
pnpm run build

# Get the generated .vsix file
VSIX_FILE=$(ls -t kevinmind-*.vsix 2>/dev/null | head -n 1)

if [[ -z "$VSIX_FILE" ]]; then
    echo -e "${RED}Error: No .vsix file was generated${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Theme packaged successfully: ${VSIX_FILE}${NC}"

# Release if --release flag was provided
if [[ "$RELEASE" == true ]]; then
    echo -e "${YELLOW}Creating GitHub release...${NC}"
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
        echo "Install it from https://cli.github.com/"
        exit 1
    fi
    
    # Check if GITHUB_TOKEN is set
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo -e "${RED}Error: GITHUB_TOKEN environment variable is not set${NC}"
        exit 1
    fi
    
    # Get the latest release tag
    LATEST_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null || echo "v0")
    
    # Extract the number from the tag (e.g., v5 -> 5)
    if [[ $LATEST_TAG =~ ^v([0-9]+)$ ]]; then
        LATEST_NUM="${BASH_REMATCH[1]}"
    else
        LATEST_NUM=0
    fi
    
    # Increment the version
    NEW_NUM=$((LATEST_NUM + 1))
    NEW_TAG="v${NEW_NUM}"
    
    echo -e "${YELLOW}Next version will be: ${NEW_TAG}${NC}"
    
    # Create GitHub Release
    gh release create "${NEW_TAG}" \
        --title "Release ${NEW_TAG}" \
        --notes "Automated release of Kevinmind theme" \
        "${VSIX_FILE}"
    
    echo -e "${GREEN}✓ GitHub release created: ${NEW_TAG}${NC}"
    
    # Commit and push packaged file
    echo -e "${YELLOW}Committing packaged file...${NC}"
    git config --global user.name "GitHub Actions" || true
    git config --global user.email "actions@github.com" || true
    
    # Stage the .vsix file
    git add kevinmind-*.vsix || true
    
    # Commit if there are changes
    if ! git diff --cached --quiet; then
        git commit -m "Auto-packaged Kevinmind theme [skip ci]"
        git push origin main
        echo -e "${GREEN}✓ Packaged file committed and pushed${NC}"
    else
        echo -e "${YELLOW}No changes to commit.${NC}"
    fi
fi

# Install if --install flag was provided
if [[ "$INSTALL" == true ]]; then
    echo -e "${YELLOW}Installing theme to Cursor...${NC}"
    
    # Check if cursor CLI is available
    if ! command -v cursor &> /dev/null; then
        echo -e "${RED}Error: cursor CLI is not installed${NC}"
        echo "Make sure Cursor is installed and the CLI is in your PATH"
        exit 1
    fi
    
    # Install the extension
    echo "Running: cursor --install-extension ${VSIX_FILE}"
    cursor --install-extension "${VSIX_FILE}"
    
    echo -e "${GREEN}✓ Theme installed successfully!${NC}"
    echo "Restart Cursor to see the changes"
elif [[ "$RELEASE" == false ]]; then
    echo -e "${YELLOW}To install the theme, run:${NC}"
    echo "  cursor --install-extension ${VSIX_FILE}"
    echo "Or run this script with --install flag:"
    echo "  ./build.sh --install"
fi

