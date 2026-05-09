'use strict';

const { Clutter, Meta, Shell, St, GObject, Gio, GLib } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

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
            id: 'TKT-' + now.toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            title: data.title || '', description: data.description || '', status: data.status || 'open',
            priority: data.priority || 'medium', category: data.category || '', assignee: data.assignee || '',
            url: data.url || '', tags: [], createdAt: now, updatedAt: now,
        };
        list.push(t);
        return this.save(list) ? t : null;
    },
    remove(id) {
        return this.save(this.load().filter(t => t.id !== id));
    },
};

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

function filterTickets(list, q) {
    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter(t => [t.title, t.id, t.description, t.category, t.assignee].filter(Boolean).join(' ').toLowerCase().includes(ql));
}

// ─── Ticket Row Widget ─────────────────────────────────────────────────

function createTicketRow(ticket, onDelete) {
    const row = new St.BoxLayout({ vertical: true, style_class: 'ticket-row', reactive: true, track_hover: true });

    const line1 = new St.BoxLayout({ vertical: false });
    const idLbl = new St.Label({ text: ticket.id, style_class: 'ticket-id', y_align: Clutter.ActorAlign.CENTER });
    line1.add_child(idLbl);
    line1.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

    const pLbl = new St.Label({ text: ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1), style_class: 'ticket-badge priority-' + ticket.priority, y_align: Clutter.ActorAlign.CENTER });
    line1.add_child(pLbl);
    const sLbl = new St.Label({ text: ticket.status.replace('_', ' '), style_class: 'ticket-badge status-' + ticket.status, y_align: Clutter.ActorAlign.CENTER });
    line1.add_child(sLbl);

    const titleLbl = new St.Label({ text: ticket.title || '', style_class: 'ticket-title' });

    const line2 = new St.BoxLayout({ vertical: false });
    const timeLbl = new St.Label({ text: timeAgo(ticket.updatedAt), style_class: 'ticket-time', y_align: Clutter.ActorAlign.CENTER });
    line2.add_child(timeLbl);
    line2.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));

    const delBtn = new St.Button({ style_class: 'delete-button', child: new St.Icon({ icon_name: 'edit-delete-symbolic', icon_size: 12 }), reactive: true, y_align: Clutter.ActorAlign.CENTER });
    delBtn.connect('clicked', () => { if (onDelete) onDelete(ticket); });
    line2.add_child(delBtn);

    row.add_child(line1);
    row.add_child(titleLbl);
    row.add_child(line2);
    return row;
}

// ─── Main Extension ─────────────────────────────────────────────────────

var TicketIndicator = GObject.registerClass(
    class TicketIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Ticket Manager', false);

            this._storage = Storage;

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
            this._searchEntry = new St.Entry({ style_class: 'search-entry', hint_text: 'Search tickets...', can_focus: true });
            this._searchEntry.clutter_text.connect('text-changed', () => {
                this._searchQuery = this._searchEntry.get_text();
                this._renderList();
            });
            this.menu.box.add_actor(this._searchEntry);

            // ── Scrollable List ──
            const scroll = new St.ScrollView({ style_class: 'ticket-scrollview' });
            scroll.set_policy(0, 1);
            this._list = new St.BoxLayout({ vertical: true, style_class: 'ticket-list' });
            scroll.add_actor(this._list);
            this.menu.box.add_actor(scroll);

            // ── Footer ──
            const footer = new St.BoxLayout({ vertical: false, style_class: 'popup-footer' });
            const refreshBtn = new St.Button({ label: 'Refresh', style_class: 'footer-btn', reactive: true });
            refreshBtn.connect('clicked', () => this._loadTickets());
            footer.add_child(refreshBtn);
            footer.add_child(new St.Widget({ x_expand: true, y_align: Clutter.ActorAlign.CENTER }));
            const addBtn = new St.Button({ label: '+ Add', style_class: 'add-btn', reactive: true });
            addBtn.connect('clicked', () => this._showAddDialog());
            footer.add_child(addBtn);
            this.menu.box.add_actor(footer);

            this._loadTickets();
        }

        _loadTickets() {
            this._tickets = this._storage.load();
            this._renderList();
        }

        _renderList() {
            this._list.destroy_all_children();
            const filtered = filterTickets(this._tickets, this._searchQuery);
            const stats = { total: this._tickets.length, open: this._tickets.filter(t => t.status === 'open').length };
            this._statsLbl.set_text(stats.total + ' · ' + stats.open + ' open');

            if (filtered.length === 0) {
                this._list.add_child(new St.Label({ text: this._searchQuery ? 'No matches' : 'No tickets', style_class: 'empty-label' }));
                return;
            }

            filtered.slice(0, 50).forEach(t => {
                this._list.add_child(createTicketRow(t, (ticket) => {
                    this._storage.remove(ticket.id);
                    this._loadTickets();
                }));
            });
        }

        _showAddDialog() {
            const dialog = new ModalDialog.ModalDialog({
                styleClass: 'ticket-dialog',
                destroyOnClose: false,
                shellReactive: true,
                shouldFadeIn: false,
                shouldFadeOut: false,
            });

            let selStatus = 'open';
            let selPriority = 'medium';

            const titleEntry = new St.Entry({ style_class: 'dialog-entry', can_focus: true });
            dialog.setInitialKeyFocus(titleEntry.clutter_text);

            const descEntry = new St.Entry({ style_class: 'dialog-entry', can_focus: true });
            const urlEntry = new St.Entry({ style_class: 'dialog-entry', can_focus: true });

            const statusBox = new St.BoxLayout({ vertical: false, style_class: 'dialog-options' });
            [['open', 'Open'], ['in_progress', 'In Progress'], ['pending', 'Pending'], ['resolved', 'Resolved'], ['closed', 'Closed']].forEach(([val, label]) => {
                const btn = new St.Button({ label, style_class: 'opt-btn' + (val === 'open' ? ' selected' : ''), reactive: true });
                btn._val = val;
                btn.connect('clicked', () => { statusBox.get_children().forEach(c => c.remove_style_class_name('selected')); btn.add_style_class_name('selected'); selStatus = val; });
                statusBox.add_child(btn);
            });

            const priorityBox = new St.BoxLayout({ vertical: false, style_class: 'dialog-options' });
            [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']].forEach(([val, label]) => {
                const btn = new St.Button({ label, style_class: 'opt-btn' + (val === 'medium' ? ' selected' : ''), reactive: true });
                btn._val = val;
                btn.connect('clicked', () => { priorityBox.get_children().forEach(c => c.remove_style_class_name('selected')); btn.add_style_class_name('selected'); selPriority = val; });
                priorityBox.add_child(btn);
            });

            const layout = dialog.contentLayout;
            layout.add_child(new St.Label({ text: 'Add Ticket', style_class: 'dialog-title' }));
            layout.add_child(new St.Label({ text: 'Title', style_class: 'dialog-field-label' }));
            layout.add_child(titleEntry);
            layout.add_child(new St.Label({ text: 'Description', style_class: 'dialog-field-label' }));
            layout.add_child(descEntry);
            layout.add_child(new St.Label({ text: 'Status', style_class: 'dialog-field-label' }));
            layout.add_child(statusBox);
            layout.add_child(new St.Label({ text: 'Priority', style_class: 'dialog-field-label' }));
            layout.add_child(priorityBox);
            layout.add_child(new St.Label({ text: 'URL', style_class: 'dialog-field-label' }));
            layout.add_child(urlEntry);

            dialog.addButton({
                label: 'Cancel',
                action: () => { dialog.close(global.get_current_time()); },
                key: Clutter.KEY_Escape,
            });
            dialog.addButton({
                label: 'Create',
                action: () => {
                    const title = titleEntry.get_text().trim();
                    if (!title) return;
                    this._storage.add({ title, description: descEntry.get_text(), status: selStatus, priority: selPriority, url: urlEntry.get_text() });
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