#!/bin/bash
# Install script for Ticket Manager GNOME Extension

set -e

EXTENSION_NAME="ticket-manager@support.tech"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"

echo "Installing Ticket Manager GNOME Extension..."

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy all files
cp -r . "$INSTALL_DIR/"

# Make sure icon is accessible
chmod 644 "$INSTALL_DIR/icons/ticket-symbolic.svg"

echo "Extension copied to: $INSTALL_DIR"

# Enable the extension
echo "Enabling extension..."
gnome-extensions enable "$EXTENSION_NAME" 2>/dev/null || echo "Note: Run 'gnome-extensions enable $EXTENSION_NAME' manually if needed"

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Press Alt+F2, type 'r', and press Enter to reload GNOME Shell"
echo "2. Or log out and log back in"
echo "3. Look for the ticket icon in the top-right panel"
echo ""
echo "To view logs: journalctl -f -o cat /usr/bin/gnome-shell | grep 'Ticket Manager'"