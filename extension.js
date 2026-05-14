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

const WIDTH_RANGE = { min: 250, max: 900, step: 1 };
const HEIGHT_RANGE = { min: 200, max: 900, step: 1 };
const FONT_SIZE_RANGE = { min: 9, max: 24, step: 1 };

// ─── Settings Storage ────────────────────────────────────────────────────

var AppSettings = {
    _path: null,
    defaults: {
        width: '400',
        height: '320',
        fontSize: '13',
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

            const exportBtn = new St.Button({ label: 'Export', style_class: 'export-btn', reactive: true });
            exportBtn.connect('clicked', () => this._exportTickets());
            footer.add_child(exportBtn);

            footer.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

            const addBtn = new St.Button({ label: '+ Add', style_class: 'add-btn', reactive: true });
            addBtn.connect('clicked', () => this._showAddForm());
            footer.add_child(addBtn);

            this._innerContainer.add_actor(footer);

            // Apply saved width
            const savedWidth = parseInt(AppSettings.get('width'), 10);
            if (!isNaN(savedWidth)) this.menu.actor.set_width(Math.max(WIDTH_RANGE.min, Math.min(WIDTH_RANGE.max, savedWidth)));

            const savedHeight = parseInt(AppSettings.get('height'), 10);
            if (!isNaN(savedHeight)) this._scrollView.set_style('height: ' + Math.max(HEIGHT_RANGE.min, Math.min(HEIGHT_RANGE.max, savedHeight)) + 'px');

            this._applyFontScale();

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

        _exportTickets() {
            const tickets = storage.load();
            const lines = [];
            for (const t of tickets) {
                lines.push('#' + (t.id || ''));
                lines.push(t.url || '');
                lines.push('');
            }
            const content = lines.join('\n');

            const tmpDir = GLib.get_tmp_dir();
            const timestamp = Date.now();
            const filePath = GLib.build_filenamev([tmpDir, 'tickets-export-' + timestamp + '.txt']);
            try {
                GLib.file_set_contents(filePath, new TextEncoder().encode(content));
                const file = Gio.file_new_for_path(filePath);
                Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
            } catch (e) {
                log('[TM] Failed to export tickets: ' + e.message);
            }
        }

        _confirmDeleteAll() {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'ticket-dialog',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: false,
                shouldFadeOut: false,
            });
            const fPx = parseInt(AppSettings.get('fontSize'), 10) || 13;
            dialog.contentLayout.set_style('font-size: ' + Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, fPx)) + 'px');
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

            const fPx = parseInt(AppSettings.get('fontSize'), 10) || 13;
            dialog.contentLayout.set_style('font-size: ' + Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, fPx)) + 'px');

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

            let currentWidth = parseInt(AppSettings.get('width'), 10);
            if (isNaN(currentWidth)) currentWidth = 400;
            let currentHeight = parseInt(AppSettings.get('height'), 10);
            if (isNaN(currentHeight)) currentHeight = 320;
            let currentFontSize = parseInt(AppSettings.get('fontSize'), 10);
            if (isNaN(currentFontSize)) currentFontSize = 13;

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

            // ── Width ──
            box.add_child(new St.Label({ text: 'Window Width', style_class: 'settings-section-title' }));
            const widthRow = new St.BoxLayout({ vertical: false, style_class: 'setting-control-row' });
            const wDec = new St.Button({ label: '\u2212', style_class: 'settings-step-btn', reactive: true });
            const wEntry = new St.Entry({
                text: currentWidth + 'px',
                style_class: 'setting-value-entry',
                can_focus: true,
            });
            const wInc = new St.Button({ label: '+', style_class: 'settings-step-btn', reactive: true });
            const applyWidth = (val) => {
                currentWidth = Math.max(WIDTH_RANGE.min, Math.min(WIDTH_RANGE.max, val));
                wEntry.set_text(currentWidth + 'px');
                this.menu.actor.set_width(currentWidth);
                AppSettings.set('width', currentWidth.toString());
            };
            wDec.connect('clicked', () => applyWidth(currentWidth - 1));
            wInc.connect('clicked', () => applyWidth(currentWidth + 1));
            wEntry.clutter_text.connect('activate', () => {
                const val = parseInt(wEntry.get_text(), 10);
                if (!isNaN(val)) applyWidth(val);
                else wEntry.set_text(currentWidth + 'px');
            });
            widthRow.add_child(wDec);
            widthRow.add_child(wEntry);
            widthRow.add_child(wInc);
            box.add_child(widthRow);

            // ── Height ──
            box.add_child(new St.Label({ text: 'Window Height', style_class: 'settings-section-title' }));
            const heightRow = new St.BoxLayout({ vertical: false, style_class: 'setting-control-row' });
            const hDec = new St.Button({ label: '\u2212', style_class: 'settings-step-btn', reactive: true });
            const hEntry = new St.Entry({
                text: currentHeight + 'px',
                style_class: 'setting-value-entry',
                can_focus: true,
            });
            const hInc = new St.Button({ label: '+', style_class: 'settings-step-btn', reactive: true });
            const applyHeight = (val) => {
                currentHeight = Math.max(HEIGHT_RANGE.min, Math.min(HEIGHT_RANGE.max, val));
                hEntry.set_text(currentHeight + 'px');
                this._scrollView.set_style('height: ' + currentHeight + 'px');
                AppSettings.set('height', currentHeight.toString());
            };
            hDec.connect('clicked', () => applyHeight(currentHeight - 1));
            hInc.connect('clicked', () => applyHeight(currentHeight + 1));
            hEntry.clutter_text.connect('activate', () => {
                const val = parseInt(hEntry.get_text(), 10);
                if (!isNaN(val)) applyHeight(val);
                else hEntry.set_text(currentHeight + 'px');
            });
            heightRow.add_child(hDec);
            heightRow.add_child(hEntry);
            heightRow.add_child(hInc);
            box.add_child(heightRow);

            // ── Font Size ──
            box.add_child(new St.Label({ text: 'Font Size', style_class: 'settings-section-title' }));
            const fontRow = new St.BoxLayout({ vertical: false, style_class: 'setting-control-row' });
            const fDec = new St.Button({ label: '\u2212', style_class: 'settings-step-btn', reactive: true });
            const fEntry = new St.Entry({
                text: currentFontSize + 'px',
                style_class: 'setting-value-entry',
                can_focus: true,
            });
            const fInc = new St.Button({ label: '+', style_class: 'settings-step-btn', reactive: true });
            const applyFontSize = (val) => {
                currentFontSize = Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, val));
                fEntry.set_text(currentFontSize + 'px');
                AppSettings.set('fontSize', currentFontSize.toString());
                this._applyFontScale();
            };
            fDec.connect('clicked', () => applyFontSize(currentFontSize - 1));
            fInc.connect('clicked', () => applyFontSize(currentFontSize + 1));
            fEntry.clutter_text.connect('activate', () => {
                const val = parseInt(fEntry.get_text(), 10);
                if (!isNaN(val)) applyFontSize(val);
                else fEntry.set_text(currentFontSize + 'px');
            });
            fontRow.add_child(fDec);
            fontRow.add_child(fEntry);
            fontRow.add_child(fInc);
            box.add_child(fontRow);

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

        _applyFontScale() {
            const px = parseInt(AppSettings.get('fontSize'), 10) || 13;
            this._innerContainer.set_style('font-size: ' + Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, px)) + 'px');
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