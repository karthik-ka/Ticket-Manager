/* Ticket Manager - Preferences for GNOME 42+ */

const { Gtk, GLib } = imports.gi;

function init() {
    log('[Ticket Manager] Prefs init');
}

function buildPrefsWidget() {
    const widget = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 16,
        marginStart: 24,
        marginEnd: 24,
        marginTop: 24,
        marginBottom: 24,
    });

    const title = new Gtk.Label({
        label: '<b>Ticket Manager</b>',
        halign: Gtk.Align.START,
        useMarkup: true,
    });
    widget.append(title);

    const desc = new Gtk.Label({
        label: 'Manage support tickets from the top panel.\nClick the ticket icon to open the popup.',
        halign: Gtk.Align.START,
        wrap: true,
    });
    widget.append(desc);

    const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL });
    widget.append(sep);

    const ver = new Gtk.Label({
        label: 'Version: 1.0.0',
        halign: Gtk.Align.START,
    });
    widget.append(ver);

    const storagePath = GLib.get_user_data_dir() + '/ticket-manager@support.tech/tickets.json';
    const pathLabel = new Gtk.Label({
        label: 'Data: ' + storagePath,
        halign: Gtk.Align.START,
        wrap: true,
    });
    pathLabel.get_style_context().add_class('dim-label');
    widget.append(pathLabel);

    return widget;
}