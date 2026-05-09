'use strict';

const { Clutter, St, GObject, Gio, GLib, Meta, Shell } = imports.gi;

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

const WIDTH_RANGE = { min: 280, max: 700, step: 20 };

// ─── Settings Storage ────────────────────────────────────────────────────

var AppSettings = {
    _path: null,
    defaults: {
        width: '400',
    },
    _ensure() {
        if (this._path) return;
        const dir = GLib.build_filenamev([GLib.get_user_data_dir(), Me.uuid]);
        GLib.mkdir_with_parents(dir, 0o755);
        this._path = GLib.build_filenamev([dir, 'settings.json']);
    },
    load() {
        this._ensure();
        if (!GLib.file_test(this._path, GLib.FileTest.EXISTS)) return Object.assign({}, this.defaults);
        try {
            const [ok, data] = GLib.file_get_contents(this._path);
            if (!ok) return Object.assign({}, this.defaults);
            return Object.assign({}, this.defaults, JSON.parse(new TextDecoder('utf-8').decode(data)));
        } catch (e) { return Object.assign({}, this.defaults); }
    },
    save(data) {
        this._ensure();
        const merged = Object.assign({}, this.defaults, data);
        try {
            return GLib.file_set_contents(this._path, new TextEncoder().encode(JSON.stringify(merged, null, 2)));
        } catch (e) { return false; }
    },
    get(key) {
        return this.load()[key];
    },
    set(key, value) {
        const s = this.load();
        s[key] = value;
        return this.save(s);
    },
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
        x_align: Clutter.ActorAlign.FILL,
    });

    // Ticket ID — subtle metadata
    const idLabel = new St.Label({
        text: ticket.id || '',
        style_class: 'ticket-id-metadata',
        y_align: Clutter.ActorAlign.START,
    });
    leftBlock.add_child(idLabel);

    // URL — main clickable element (St.Label auto-clips with ellipsis)
    const urlText = ticket.url || '';
    const urlWidget = new St.Label({
        text: urlText,
        style_class: 'ticket-url-main' + (urlText ? ' clickable' : ' no-url'),
        reactive: !!urlText,
        x_expand: true,
        y_align: Clutter.ActorAlign.START,
    });
    if (urlText) {
        urlWidget.connect('button-press-event', () => {
            openUrl(ticket.url);
            return Clutter.EVENT_STOP;
        });
    }
    leftBlock.add_child(urlWidget);

    row.add_child(leftBlock);

    row.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

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

            // Inner container for all UI elements
            this._innerContainer = new St.BoxLayout({ vertical: true });
            this.menu.box.add_actor(this._innerContainer);

            // ── Header ──
            const header = new St.BoxLayout({ vertical: false, style_class: 'popup-header' });
            const title = new St.Label({ text: 'Ticket Manager', style_class: 'popup-title', y_align: Clutter.ActorAlign.CENTER });
            header.add_child(title);
            this._statsLbl = new St.Label({ text: '', style_class: 'popup-stats', y_align: Clutter.ActorAlign.CENTER });
            header.add_child(this._statsLbl);
            header.add_child(new St.Widget({ x_expand: true }));
            const settingsBtn = new St.Button({
                style_class: 'settings-gear',
                child: new St.Icon({ icon_name: 'emblem-system-symbolic', icon_size: 14 }),
                reactive: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            settingsBtn.connect('clicked', () => this._showSettings());
            header.add_child(settingsBtn);
            this._innerContainer.add_actor(header);

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
            this._innerContainer.add_actor(this._searchEntry);

            // ── Scrollable List ──
            const scroll = new St.ScrollView({
                style_class: 'ticket-scrollview',
                clip_to_allocation: true,
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
            });
            this._list = new St.BoxLayout({ vertical: true, style_class: 'ticket-list', x_expand: true, x_align: Clutter.ActorAlign.FILL });
            scroll.add_actor(this._list);
            this._innerContainer.add_actor(scroll);
            this._scrollView = scroll;

            // ── Inline Add Form (hidden by default) ──
            this._addForm = this._createAddForm();
            this._addForm.hide();
            this._innerContainer.add_actor(this._addForm);

            // ── Settings Panel (hidden by default) ──
            this._settingsPanel = this._createSettingsPanel();
            this._settingsPanel.hide();
            this._innerContainer.add_actor(this._settingsPanel);

            // ── Footer ──
            const footer = new St.BoxLayout({ vertical: false, style_class: 'popup-footer' });

            const deleteAllBtn = new St.Button({ label: 'Delete All', style_class: 'delete-all-btn', reactive: true });
            deleteAllBtn.connect('clicked', () => this._confirmDeleteAll());
            footer.add_child(deleteAllBtn);

            footer.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

            const addBtn = new St.Button({ label: '+ Add', style_class: 'add-btn', reactive: true });
            addBtn.connect('clicked', () => this._showAddForm());
            footer.add_child(addBtn);

            this._innerContainer.add_actor(footer);

            // Apply saved width
            const savedWidth = parseInt(AppSettings.get('width'), 10);
            if (!isNaN(savedWidth)) this.menu.actor.set_width(Math.max(WIDTH_RANGE.min, Math.min(WIDTH_RANGE.max, savedWidth)));

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

            let selStatus = ticket.status || 'in_progress';

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

        _createAddForm() {
            const box = new St.BoxLayout({ vertical: true, style_class: 'inline-form' });

            const state = { status: 'in_progress' };

            // Title
            box.add_child(new St.Label({ text: 'Add Ticket', style_class: 'inline-form-title' }));

            // Ticket ID
            box.add_child(new St.Label({ text: 'Ticket ID (optional)', style_class: 'inline-form-label' }));
            const idEntry = new St.Entry({ style_class: 'inline-form-entry', can_focus: true });
            box.add_child(idEntry);

            // URL
            box.add_child(new St.Label({ text: 'URL', style_class: 'inline-form-label' }));
            const urlEntry = new St.Entry({ style_class: 'inline-form-entry', can_focus: true });
            box.add_child(urlEntry);

            // Status
            box.add_child(new St.Label({ text: 'Status', style_class: 'inline-form-label' }));
            const statusBox = new St.BoxLayout({ vertical: false, style_class: 'inline-form-options' });
            const statusBtns = {};
            Object.entries(STATUSES).forEach(([key, st]) => {
                const btn = new St.Button({
                    label: st.label,
                    style_class: 'inline-opt-btn' + (key === state.status ? ' selected' : ''),
                    reactive: true,
                });
                statusBtns[key] = btn;
                btn.connect('clicked', () => {
                    Object.values(statusBtns).forEach(b => b.remove_style_class_name('selected'));
                    btn.add_style_class_name('selected');
                    state.status = key;
                });
                statusBox.add_child(btn);
            });
            box.add_child(statusBox);

            // Buttons row
            const btnRow = new St.BoxLayout({ vertical: false, style_class: 'inline-form-buttons' });
            const cancelBtn = new St.Button({ label: 'Cancel', style_class: 'inline-cancel-btn', reactive: true });
            cancelBtn.connect('clicked', () => this._hideAddForm());
            btnRow.add_child(cancelBtn);
            btnRow.add_child(new St.Widget({ x_expand: true }));
            const createBtn = new St.Button({ label: 'Create', style_class: 'inline-create-btn', reactive: true });
            createBtn.connect('clicked', () => {
                const url = urlEntry.get_text().trim();
                if (!url) return;
                storage.add({
                    id: idEntry.get_text().trim() || undefined,
                    url,
                    status: state.status,
                });
                this._hideAddForm();
                this._loadTickets();
            });
            btnRow.add_child(createBtn);
            box.add_child(btnRow);

            box._idEntry = idEntry;
            box._urlEntry = urlEntry;
            box._state = state;
            box._statusBtns = statusBtns;

            return box;
        }

        _showAddForm() {
            const f = this._addForm;
            f._idEntry.set_text('');
            f._urlEntry.set_text('');
            f._state.status = 'in_progress';
            Object.values(f._statusBtns).forEach(b => b.remove_style_class_name('selected'));
            f._statusBtns['in_progress'].add_style_class_name('selected');
            this._scrollView.hide();
            this._searchEntry.hide();
            f.show();
            f._urlEntry.grab_key_focus();
        }

        _hideAddForm() {
            this._addForm.hide();
            this._searchEntry.show();
            this._scrollView.show();
        }

        // ─── Settings Panel ──────────────────────────────────────────────

        _createSettingsPanel() {
            const box = new St.BoxLayout({ vertical: true, style_class: 'settings-panel' });

            // Current width value
            let currentWidth = parseInt(AppSettings.get('width'), 10);
            if (isNaN(currentWidth)) currentWidth = 400;

            // Back button + title
            const topRow = new St.BoxLayout({ vertical: false });
            const backBtn = new St.Button({
                label: '\u2190  Settings',
                style_class: 'settings-back-btn',
                reactive: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            backBtn.connect('clicked', () => this._hideSettings());
            topRow.add_child(backBtn);
            box.add_child(topRow);

            // ── Width Stepper ──
            box.add_child(new St.Label({ text: 'Window Width', style_class: 'settings-section-title' }));
            const widthRow = new St.BoxLayout({ vertical: false, style_class: 'settings-width-row' });
            const decBtn = new St.Button({ label: '\u2212', style_class: 'settings-step-btn', reactive: true });
            const widthVal = new St.Label({ text: currentWidth + 'px', style_class: 'settings-width-value', x_align: Clutter.ActorAlign.CENTER });
            const incBtn = new St.Button({ label: '+', style_class: 'settings-step-btn', reactive: true });

            decBtn.connect('clicked', () => {
                currentWidth = Math.max(WIDTH_RANGE.min, currentWidth - WIDTH_RANGE.step);
                widthVal.set_text(currentWidth + 'px');
                this.menu.actor.set_width(currentWidth);
                AppSettings.set('width', currentWidth.toString());
            });
            incBtn.connect('clicked', () => {
                currentWidth = Math.min(WIDTH_RANGE.max, currentWidth + WIDTH_RANGE.step);
                widthVal.set_text(currentWidth + 'px');
                this.menu.actor.set_width(currentWidth);
                AppSettings.set('width', currentWidth.toString());
            });

            widthRow.add_child(decBtn);
            widthRow.add_child(new St.Widget({ x_expand: true }));
            widthRow.add_child(widthVal);
            widthRow.add_child(new St.Widget({ x_expand: true }));
            widthRow.add_child(incBtn);
            box.add_child(widthRow);

            // ── Shortcut (read-only) ──
            box.add_child(new St.Label({ text: 'Keyboard Shortcut', style_class: 'settings-section-title' }));
            const shortcutRow = new St.BoxLayout({ vertical: false, style_class: 'settings-shortcut-row' });
            const shortcutLabel = new St.Label({ text: 'Toggle: ', style_class: 'settings-shortcut-label' });
            const shortcutVal = new St.Label({ text: '<Alt>T', style_class: 'settings-shortcut-value' });
            shortcutRow.add_child(shortcutLabel);
            shortcutRow.add_child(shortcutVal);
            box.add_child(shortcutRow);

            // ── Copyright ──
            const copyBox = new St.BoxLayout({ vertical: false, style_class: 'settings-copyright-box' });
            const copyLabel = new St.Label({
                text: '\u00A9 Karthik | github.com/karthik-ka',
                style_class: 'settings-copyright',
            });
            copyBox.add_child(copyLabel);
            box.add_child(copyBox);

            return box;
        }

        _showSettings() {
            this._scrollView.hide();
            this._searchEntry.hide();
            this._addForm.hide();
            this._settingsPanel.show();
            this._settingsPanel.grab_key_focus();
        }

        _hideSettings() {
            this._settingsPanel.hide();
            this._searchEntry.show();
            this._scrollView.show();
        }

        _toggle() {
            if (this.menu.isOpen)
                this.menu.close(global.get_current_time());
            else
                this.menu.open(true);
        }

        _registerShortcut() {
            try {
                const gsettings = ExtensionUtils.getSettings();
                Main.wm.addKeybinding(
                    'toggle-shortcut',
                    gsettings,
                    Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.NORMAL | Shell.ActionMode.SYSTEM_MODAL,
                    () => this._toggle()
                );
            } catch (e) {
                log('[TM] Failed to register shortcut: ' + e);
            }
        }

        _unregisterShortcut() {
            try {
                Main.wm.removeKeybinding('toggle-shortcut');
            } catch (e) {
                log('[TM] Failed to unregister shortcut: ' + e);
            }
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
    indicator._registerShortcut();
    log('[TM] enabled');
}

function disable() {
    log('[TM] disable');
    if (indicator) {
        indicator._unregisterShortcut();
        indicator.destroy();
        indicator = null;
    }
}