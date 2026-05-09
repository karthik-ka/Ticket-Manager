#!/bin/bash
set -e

UUID="ticket-manager@support.tech"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Ticket Manager extension..."

# Create target directory
mkdir -p "$DEST"

# Copy core files
cp extension.js stylesheet.css metadata.json "$DEST/"

# Copy and compile schema
cp -r schemas "$DEST/"
glib-compile-schemas "$DEST/schemas/"

# Enable the extension
gnome-extensions enable "$UUID" 2>/dev/null || true

echo ""
echo "Installation complete!"
echo "Restart GNOME Shell: Alt+F2 -> r -> Enter"
echo "Or log out and back in."
