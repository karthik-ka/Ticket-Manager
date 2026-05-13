# Ticket Manager - GNOME Shell Extension

A native GNOME Shell extension for support technicians to manage tickets directly from the top panel. Behaves like a clipboard manager popup — fast, keyboard-friendly, and optimized for multi-ticket workflows.

## Features

- **Alt+T Toggle** — keyboard shortcut opens/closes the popup from anywhere
- **Inline Add Form** — click "+ Add" to add a ticket directly in the popup (ID, URL, status selection)
- **5 Statuses** — On Hold, Answered, In Progress, Closed, Sales/Billing with color-coded badges
- **Search Bar** — filter tickets by ID, URL, or description
- **Clickable URLs** — open ticket links directly in your browser
- **Edit / Delete** — pencil icon opens edit dialog, trash icon removes with confirmation
- **Settings Panel** — gear icon opens width stepper (280–700px) + copyright
- **Persistent Storage** — tickets saved to `tickets.json`, settings to `settings.json`

## Requirements

- GNOME Shell 42+
- GJS (GNOME JavaScript)
- `glib-compile-schemas` (from `glib2` tools) — required for installation

### Installing glib2 tools

Debian / Ubuntu:
```bash
sudo apt install libglib2.0-bin
```

Fedora:
```bash
sudo dnf install glib2
```

Arch Linux:
```bash
sudo pacman -S glib2
```

## Installation

```bash
Quick install (from repo root)
./install.sh

# Or manually:

# 1. Create extension directory
mkdir -p ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech

# 2. Copy extension files
cp extension.js stylesheet.css metadata.json \
   ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/

# 3. Copy and compile GSettings schema (required for keyboard shortcut)
cp -r schemas ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/schemas/

# 4. Restart GNOME Shell (Alt+F2 → r → Enter)
```

### Enable

```bash
gnome-extensions enable ticket-manager@support.tech
```

## Usage

### Opening / Closing
- Press **Alt+T** to toggle the popup
- Click the ticket icon (`emblem-documents`) in the top panel

### Adding a Ticket
1. Open the popup
2. Click **+ Add** (replaces the search + list with an inline form)
3. Enter an **ID** (optional) and **URL**
4. Click a **status button** to select it
5. Click **Create** to save

### Searching
- Type in the search bar to filter tickets by ID, URL, or description
- Press **Esc** or click **Cancel** to clear the add form

### Editing a Ticket
- Click the **pencil icon** on any ticket row
- A modal dialog opens where you can change the ID, URL, and status
- Click **Save** to confirm

### Deleting a Ticket
- Click the **trash icon** on any ticket row
- Confirm deletion in the modal dialog

### Adjusting Width
- Click the **gear icon** in the popup header
- Use the **[–]** and **[+]** buttons to adjust the popup width (280–700px)
- Width is saved automatically

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Toggle popup open/closed |
| `Esc` | Close popup / cancel add form |

## Project Structure

```
ticket-manager@support.tech/
├── extension.js       # Main extension (indicator, popup, storage, all inline)
├── stylesheet.css     # St widget styles (status colors, buttons, forms)
├── metadata.json      # Extension metadata (UUID, shell versions, schema ref)
└── schemas/
    ├── org.gnome.shell.extensions.ticket-manager.gschema.xml
    ├── org.gnome.shell.extensions.ticket-manager.gschema.valid
    └── gschemas.compiled
```

## Troubleshooting

### Extension not loading
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "\[TM\]"
```

### Re-enable after crash
```bash
gnome-extensions disable ticket-manager@support.tech
gnome-extensions enable ticket-manager@support.tech
```

### Reset storage
```bash
rm ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/tickets.json
rm ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech/settings.json
```

## Uninstall

```bash
gnome-extensions disable ticket-manager@support.tech
rm -rf ~/.local/share/gnome-shell/extensions/ticket-manager@support.tech
# Restart GNOME Shell (Alt+F2 → r → Enter)
```

## License

MIT

## Author

Karthik | [github.com/karthik-ka](https://github.com/karthik-ka)
