'use strict';

const { Clutter, St, GObject, Gio, GLib } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const ModalDialog = imports.ui.modalDialog;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

// ─── Constants ─────────────────────────────────────────────────────────

const STATUSES = {
    onhold:      { label: 'On Hold',     color: '#3584e4' },
    answered:    { label: 'Answered',    color: '#ffffff' },
    in_progress: { label: 'In Progress', color: '#c01c28' },
    closed:      { label: 'Closed',      color: '#26a269' },
    sales_billing:{label: 'Sales/Billing', color: '#e5a50a' },
};

// ─── Storage ───────────────────────────────────────────────────────────

var Storage = {
    _path: null,
    _ensure() {
        if (this._path) return;
        const dir = GLib.build_filenamev([GLib.get_user_data_dir(), Me.uuid]);
        GLib.mkdir_with_parents(dir, 0o755);
        this._path = GLib.build_filenamev([dir, 'tickets.json']);
    },
    load() {
        this._ensure();
        if (!GLib.file_test(this._path, GLib.FileTest.EXISTS)) return [];
        try {
            const [ok, data] = GLib.file_get_contents(this._path);
            return ok ? JSON.parse(new TextDecoder('utf-8').decode(data)) : [];
        } catch (e) { return []; }
    },
    save(tickets) {
        this._ensure();
        try {
            return GLib.file_set_contents(this._path, new TextEncoder().encode(JSON.stringify(tickets, null, 2)));
        } catch (e) { return false; }
    },
    add(data) {
        const list = this.load();
        const now = Date.now();
        const t = {
            id: data.id || '',
            title: '',
            description: data.description || '',
            status: data.status || 'in_progress',
            priority: data.priority || 'medium',
            category: data.category || '',
            assignee: data.assignee || '',
            url: data.url || '',
            tags: [],
            createdAt: now,
            updatedAt: now,
        };
        list.push(t);
        return this.save(list) ? t : null;
    },
    remove(id) {
        return this.save(this.load().filter(t => t.id !== id));
    },
    removeAll() {
        return this.save([]);
    },
    update(id, changes) {
        const list = this.load();
        const idx = list.findIndex(t => t.id === id);
        if (idx === -1) return false;
        list[idx] = Object.assign(list[idx], changes, { updatedAt: Date.now() });
        return this.save(list);
    },
};

const storage = Storage;

// ─── Helpers ────────────────────────────────────────────────────────────

function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'd';
}

function openUrl(url) {
    if (!url) return;
    try {
        Gio.AppInfo.launch_default_for_uri(url, null);
    } catch (e) {
        log('[TM] Failed to open URL: ' + e.message);
    }
}

// ─── Ticket Row ─────────────────────────────────────────────────────────

function createTicketRow(ticket, onDelete, onEdit) {
    const row = new St.BoxLayout({
        vertical: false,
        style_class: 'ticket-row',
        reactive: true,
        x_expand: true,
    });

    // Left vertical block: ID (metadata) + URL (main)
    const leftBlock = new St.BoxLayout({
        vertical: true,
        x_expand: true,
    });

    // Ticket ID — subtle metadata
    const idLabel = new St.Label({
        text: ticket.id || '',
        style_class: 'ticket-id-metadata',
        y_align: Clutter.ActorAlign.START,
    });
    leftBlock.add_child(idLabel);

    // URL — main clickable element
    const urlText = ticket.url || '';
    if (ticket.url) {
        const urlBtn = new St.Button({
            label: urlText.length > 45 ? urlText.substring(0, 42) + '...' : urlText,
            style_class: 'ticket-url-main clickable',
            reactive: true,
            y_align: Clutter.ActorAlign.START,
        });
        urlBtn.connect('clicked', () => openUrl(ticket.url));
        leftBlock.add_child(urlBtn);
    } else {
        const urlLabel = new St.Label({
            text: '',
            style_class: 'ticket-url-main no-url',
            y_align: Clutter.ActorAlign.START,
        });
        leftBlock.add_child(urlLabel);
    }

    row.add_child(leftBlock);

    // Status label
    const statusVal = ticket.status || 'in_progress';
    const statusLabel = new St.Label({
        text: STATUSES[statusVal]?.label || 'Open',
        style_class: 'status-label status-' + statusVal,
        y_align: Clutter.ActorAlign.CENTER,
    });
    row.add_child(statusLabel);

    // Edit button
    const editBtn = new St.Button({
        style_class: 'edit-button',
        child: new St.Icon({ icon_name: 'document-edit-symbolic', icon_size: 12 }),
        reactive: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    editBtn.connect('clicked', () => {
        if (onEdit) onEdit(ticket);
    });
    row.add_child(editBtn);

    // Delete button
    const delBtn = new St.Button({
        style_class: 'delete-button',
        child: new St.Icon({ icon_name: 'edit-delete-symbolic', icon_size: 12 }),
        reactive: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    delBtn.connect('clicked', () => {
        if (onDelete) onDelete(ticket);
    });
    row.add_child(delBtn);

    return row;
}

// ─── Main Extension ─────────────────────────────────────────────────────

var TicketIndicator = GObject.registerClass(
    class TicketIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Ticket Manager', false);

            const icon = new St.Icon({ icon_name: 'emblem-documents-symbolic', style_class: 'system-status-icon' });
            this.add_child(icon);

            this._tickets = [];
            this._searchQuery = '';
            this._buildMenu();
        }

        _buildMenu() {
            this.menu.removeAll();

            // ── Header ──
            const header = new St.BoxLayout({ vertical: false, style_class: 'popup-header' });
            const title = new St.Label({ text: 'Ticket Manager', style_class: 'popup-title', y_align: Clutter.ActorAlign.CENTER });
            header.add_child(title);
            this._statsLbl = new St.Label({ text: '', style_class: 'popup-stats', y_align: Clutter.ActorAlign.CENTER });
            header.add_child(this._statsLbl);
            this.menu.box.add_actor(header);

            // ── Search ──
            this._searchEntry = new St.Entry({
                style_class: 'search-entry',
                hint_text: 'Search tickets...',
                can_focus: true,
            });
            this._searchEntry.clutter_text.connect('text-changed', () => {
                this._searchQuery = this._searchEntry.get_text();
                this._renderList();
            });
            this.menu.box.add_actor(this._searchEntry);

            // ── Scrollable List ──
            const scroll = new St.ScrollView({ style_class: 'ticket-scrollview', clip_to_allocation: true });
            scroll.set_policy(0, 1); // NEVER, AUTOMATIC
            this._list = new St.BoxLayout({ vertical: true, style_class: 'ticket-list' });
            scroll.add_actor(this._list);
            this.menu.box.add_actor(scroll);

            // ── Footer ──
            const footer = new St.BoxLayout({ vertical: false, style_class: 'popup-footer' });

            const deleteAllBtn = new St.Button({ label: 'Delete All', style_class: 'delete-all-btn', reactive: true });
            deleteAllBtn.connect('clicked', () => this._confirmDeleteAll());
            footer.add_child(deleteAllBtn);

            footer.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

            const addBtn = new St.Button({ label: '+ Add', style_class: 'add-btn', reactive: true });
            addBtn.connect('clicked', () => this._showAddDialog());
            footer.add_child(addBtn);

            this.menu.box.add_actor(footer);

            this._loadTickets();
        }

        _loadTickets() {
            this._tickets = storage.load();
            this._renderList();
        }

        _renderList() {
            this._list.destroy_all_children();
            const q = this._searchQuery || '';
            const filtered = q
                ? this._tickets.filter(t => [t.id, t.url, t.description].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))
                : this._tickets;

            const stats = { total: this._tickets.length };
            this._statsLbl.set_text(stats.total + ' ticket' + (stats.total !== 1 ? 's' : ''));

            if (filtered.length === 0) {
                this._list.add_child(new St.Label({
                    text: q ? 'No matches' : 'No tickets yet',
                    style_class: 'empty-label',
                }));
                return;
            }

            filtered.slice(0, 100).forEach(t => {
                this._list.add_child(createTicketRow(
                    t,
                    (ticket) => {
                        storage.remove(ticket.id);
                        this._loadTickets();
                    },
                    (ticket) => {
                        this._showEditDialog(ticket);
                    }
                ));
            });
        }

        _confirmDeleteAll() {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'ticket-dialog',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: false,
                shouldFadeOut: false,
            });
            dialog.contentLayout.add_child(new St.Label({
                text: 'Delete all tickets?',
                style_class: 'dialog-title',
            }));
            dialog.contentLayout.add_child(new St.Label({
                text: 'This action cannot be undone.',
                style_class: 'dialog-field-label',
            }));
            dialog.addButton({
                label: 'Cancel',
                action: () => dialog.close(global.get_current_time()),
                key: Clutter.KEY_Escape,
            });
            dialog.addButton({
                label: 'Delete All',
                action: () => {
                    storage.removeAll();
                    dialog.close(global.get_current_time());
                    this._loadTickets();
                },
            });
            dialog.open(global.get_current_time(), false);
            dialog.show();
        }

        _showEditDialog(ticket) {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'ticket-dialog',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: false,
                shouldFadeOut: false,
            });

            let selStatus = ticket.status || 'open';

            const urlEntry = new St.Entry({ text: ticket.url || '', style_class: 'dialog-entry', can_focus: true });
            dialog.setInitialKeyFocus(urlEntry.clutter_text);

            const layout = dialog.contentLayout;
            layout.add_child(new St.Label({ text: 'Edit Ticket', style_class: 'dialog-title' }));

            layout.add_child(new St.Label({ text: 'URL', style_class: 'dialog-field-label' }));
            layout.add_child(urlEntry);

            layout.add_child(new St.Label({ text: 'Status', style_class: 'dialog-field-label' }));
            const statusBox = new St.BoxLayout({ vertical: false, style_class: 'dialog-options' });
            Object.entries(STATUSES).forEach(([key, st]) => {
                const btn = new St.Button({
                    label: st.label,
                    style_class: 'opt-btn' + (key === selStatus ? ' selected' : ''),
                    reactive: true,
                });
                btn._val = key;
                btn.connect('clicked', () => {
                    statusBox.get_children().forEach(c => c.remove_style_class_name('selected'));
                    btn.add_style_class_name('selected');
                    selStatus = key;
                });
                statusBox.add_child(btn);
            });
            layout.add_child(statusBox);

            dialog.addButton({
                label: 'Cancel',
                action: () => dialog.close(global.get_current_time()),
                key: Clutter.KEY_Escape,
            });
            dialog.addButton({
                label: 'Save',
                action: () => {
                    storage.update(ticket.id, {
                        url: urlEntry.get_text().trim(),
                        status: selStatus,
                    });
                    dialog.close(global.get_current_time());
                    this._loadTickets();
                },
            });

            dialog.open(global.get_current_time(), false);
            dialog.show();
        }

        _showAddDialog() {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'ticket-dialog',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: false,
                shouldFadeOut: false,
            });

            let selStatus = 'in_progress';

            const idEntry = new St.Entry({ style_class: 'dialog-entry', can_focus: true });

            const urlEntry = new St.Entry({ style_class: 'dialog-entry', can_focus: true });
            dialog.setInitialKeyFocus(urlEntry.clutter_text);

            const layout = dialog.contentLayout;
            layout.add_child(new St.Label({ text: 'Add Ticket', style_class: 'dialog-title' }));

            layout.add_child(new St.Label({ text: 'Ticket ID (optional)', style_class: 'dialog-field-label' }));
            layout.add_child(idEntry);

            layout.add_child(new St.Label({ text: 'URL', style_class: 'dialog-field-label' }));
            layout.add_child(urlEntry);

            layout.add_child(new St.Label({ text: 'Status', style_class: 'dialog-field-label' }));
            const statusBox = new St.BoxLayout({ vertical: false, style_class: 'dialog-options' });
            Object.entries(STATUSES).forEach(([key, st]) => {
                const btn = new St.Button({
                    label: st.label,
                    style_class: 'opt-btn' + (key === 'in_progress' ? ' selected' : ''),
                    reactive: true,
                });
                btn._val = key;
                btn.connect('clicked', () => {
                    statusBox.get_children().forEach(c => c.remove_style_class_name('selected'));
                    btn.add_style_class_name('selected');
                    selStatus = key;
                });
                statusBox.add_child(btn);
            });
            layout.add_child(statusBox);

            dialog.addButton({
                label: 'Cancel',
                action: () => dialog.close(global.get_current_time()),
                key: Clutter.KEY_Escape,
            });
            dialog.addButton({
                label: 'Create',
                action: () => {
                    storage.add({
                        id: idEntry.get_text().trim() || undefined,
                        url: urlEntry.get_text().trim(),
                        status: selStatus,
                    });
                    dialog.close(global.get_current_time());
                    this._loadTickets();
                },
            });

            dialog.open(global.get_current_time(), false);
            dialog.show();
        }
    }
);

let indicator = null;

function init() {
    log('[TM] init');
}

function enable() {
    log('[TM] enable');
    if (indicator) return;
    indicator = new TicketIndicator();
    Main.panel.addToStatusArea('ticket-manager', indicator, 0, 'right');
    log('[TM] enabled');
}

function disable() {
    log('[TM] disable');
    if (indicator) {
        indicator.destroy();
        indicator = null;
    }
}