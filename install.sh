#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UUID="ticket-manager@support.tech"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Ticket Manager extension..."

# Create target directories
mkdir -p "$DEST"
mkdir -p "$DEST/schemas"

# Copy core files
cp "$SCRIPT_DIR/extension.js" "$DEST/"
cp "$SCRIPT_DIR/stylesheet.css" "$DEST/"
cp "$SCRIPT_DIR/metadata.json" "$DEST/"

# Copy and compile schema
if [ -d "$SCRIPT_DIR/schemas" ]; then
    cp "$SCRIPT_DIR/schemas/"*.xml "$DEST/schemas/" 2>/dev/null || true
    cp "$SCRIPT_DIR/schemas/"gschemas.compiled "$DEST/schemas/" 2>/dev/null || true
    glib-compile-schemas "$DEST/schemas/"
else
    echo "Warning: schemas/ directory not found, skipping shortcut keybinding setup"
fi

# Enable the extension
gnome-extensions enable "$UUID" 2>/dev/null || true

echo ""
echo "Installation complete!"
echo ""
echo "Restart GNOME Shell: Alt+F2 -> r -> Enter"
echo "Or log out and back in."
echo ""
echo "Keyboard shortcut: Alt+T to toggle the popup"
