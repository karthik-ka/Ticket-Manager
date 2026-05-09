# Ticket Manager - GNOME Shell Extension

A native GNOME productivity extension for Linux support technicians that behaves similarly to a modern clipboard manager popup and is optimized for fast multi-ticket workflows.

## Features

- **Quick Panel Access**: Click the ticket icon in the top panel to open the ticket manager popup
- **Ticket Management**: Create, edit, and delete support tickets
- **Search**: Filter tickets by title, description, ID, category, or assignee
- **Status Tracking**: Track ticket status (Open, In Progress, Pending, Resolved, Closed)
- **Priority Levels**: Set priority (Low, Medium, High, Urgent)
- **URL Support**: Open external ticket URLs directly from the popup
- **Modern UI**: Clipboard manager-style popup with smooth interactions

## Requirements

- GNOME Shell 45+
- GTK 4
- JavaScript (GJS)

## Installation

### 1. Copy Extension to Local Directory

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech
cp -r . ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/
```

Or use the install script:

```bash
./install.sh
```

### 2. Enable the Extension

#### Method A: Using GNOME Extensions App
1. Open "Extensions" app
2. Find "Ticket Manager" in the list
3. Toggle it ON

#### Method B: Using gnome-extensions Command
```bash
gnome-extensions enable ticket-manager@support.tech
```

### 3. Reload GNOME Shell

Press `Alt+F2`, type `r`, and press Enter to restart GNOME Shell.

Alternatively, log out and log back in.

## Usage

### Opening Ticket Manager
- **Left Click** on the ticket icon in the top-right panel to open the popup
- **Right Click** for quick actions menu

### Adding a Ticket
1. Click the ticket icon to open the popup
2. Click the **+ Add Ticket** button
3. Fill in the ticket details (title, description, status, priority, etc.)
4. Click **Create**

### Viewing a Ticket
- Click on any ticket row to open its URL (if set)
- Click the **Open URL** button if available

### Searching Tickets
- Type in the search bar to filter tickets
- Press `Ctrl+F` to focus the search bar
- Search matches: title, description, ID, category, assignee

### Deleting a Ticket
- Hover over a ticket and click the trash icon
- Confirm the deletion in the dialog

### Keyboard Shortcuts
- `Esc`: Close popup
- `Ctrl+F`: Focus search
- `Enter`: Open selected ticket

## Troubleshooting

### Extension Not Appearing

1. Check if the extension is enabled:
   ```bash
   gnome-extensions list | grep ticket
   ```

2. Check for errors:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell | grep -i "ticket"
   ```

3. Check extension log:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell | grep "Ticket Manager"
   ```

### Extension Crashes

If the extension causes GNOME Shell to crash:

1. Boot into recovery mode
2. Remove the extension:
   ```bash
   rm -rf ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech
   ```
3. Reboot normally

### Icon Not Showing

Ensure the icon file exists:
```bash
ls -la ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/icons/
```

### Tickets Not Saving

Check storage permissions:
```bash
ls -la ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/
chmod 755 ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/
```

## Debugging

### View Extension Logs
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

This shows all GNOME Shell logs in real-time. Look for:
- `[Ticket Manager]`
- Errors related to `ticket-manager`

### Enable Debug Mode
Edit `extension.js` and change the log level in relevant sections to see more detailed output.

### Check Storage File
```bash
cat ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/tickets.json
```

## Project Structure

```
ticket-manager@support.tech/
├── extension.js          # Main entry point
├── metadata.json        # Extension metadata
├── stylesheet.css       # GTK styles
├── prefs.js             # Preferences panel
├── utils/
│   ├── constants.js    # Application constants
│   ├── storage.js      # JSON persistence
│   ├── validators.js   # Input validation
│   └── helpers.js      # Utility functions
├── ui/
│   ├── popupMenu.js    # Main popup UI
│   ├── searchBar.js    # Search component
│   ├── ticketRow.js    # Ticket display row
│   └── statusBadge.js  # Status/priority badges
├── dialogs/
│   ├── addTicketDialog.js  # Add/edit ticket dialog
│   └── confirmDialog.js     # Confirmation dialogs
└── icons/
    └── ticket-symbolic.svg  # Panel icon
```

## Uninstall

```bash
# Disable the extension
gnome-extensions disable ticket-manager@support.tech

# Remove the extension
rm -rf ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech

# Restart GNOME Shell (Alt+F2 -> r)
```

## License

MIT License

## Author

Linux Support Team

## Version

1.0.0