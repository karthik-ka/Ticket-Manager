/**
 * Storage - JSON persistence for tickets
 */

const { GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Storage = class Storage {
    constructor() {
        this._storagePath = null;
        this._ensureDir();
    }

    _ensureDir() {
        const dataDir = GLib.get_user_data_dir();
        const extDir = GLib.build_pathv(dataDir, [Me.uuid]);
        if (!GLib.file_test(extDir, GLib.FileTest.EXISTS)) {
            try { GLib.mkdir_with_parents(extDir, 0o755); } catch (e) { return; }
        }
        this._storagePath = GLib.build_pathv(extDir, ['tickets.json']);
    }

    loadTickets() {
        if (!this._storagePath) this._ensureDir();
        if (!this._storagePath || !GLib.file_test(this._storagePath, GLib.FileTest.EXISTS)) return [];
        try {
            const [ok, data] = GLib.file_get_contents(this._storagePath);
            if (!ok || !data) return [];
            return JSON.parse(new TextDecoder('utf-8').decode(data));
        } catch (e) { return []; }
    }

    saveTickets(tickets) {
        if (!this._storagePath) this._ensureDir();
        if (!this._storagePath) return false;
        try {
            GLib.file_set_contents(this._storagePath, new TextEncoder().encode(JSON.stringify(tickets, null, 2)));
            return true;
        } catch (e) { return false; }
    }

    addTicket(data) {
        const tickets = this.loadTickets();
        const now = Date.now();
        const ticket = {
            id: 'TKT-' + now.toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            title: data.title || 'Untitled',
            description: data.description || '',
            status: data.status || 'open',
            priority: data.priority || 'medium',
            category: data.category || '',
            assignee: data.assignee || '',
            url: data.url || '',
            tags: data.tags || [],
            createdAt: now,
            updatedAt: now,
        };
        tickets.push(ticket);
        return this.saveTickets(tickets) ? ticket : null;
    }

    updateTicket(id, updates) {
        const tickets = this.loadTickets();
        const idx = tickets.findIndex(t => t.id === id);
        if (idx === -1) return false;
        tickets[idx] = Object.assign(tickets[idx], updates, { updatedAt: Date.now() });
        return this.saveTickets(tickets);
    }

    deleteTicket(id) {
        const tickets = this.loadTickets();
        const filtered = tickets.filter(t => t.id !== id);
        if (filtered.length === tickets.length) return false;
        return this.saveTickets(filtered);
    }

    getTicket(id) {
        return this.loadTickets().find(t => t.id === id) || null;
    }

    clearAll() {
        return this.saveTickets([]);
    }
};

var storage = null;
function getStorage() {
    if (!storage) storage = new Storage();
    return storage;
}