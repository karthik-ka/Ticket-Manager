/**
 * Helpers - Utility functions
 */

var Helpers = {
    formatTimeAgo(ts) {
        if (!ts) return '';
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'Just now';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h ago';
        const d = Math.floor(h / 24);
        if (d < 7) return d + 'd ago';
        return Math.floor(d / 7) + 'w ago';
    },

    truncate(text, len) {
        if (!text) return '';
        if (text.length <= (len || 50)) return text;
        return text.substring(0, (len || 50) - 3) + '...';
    },

    filterTickets(tickets, query) {
        if (!query || !query.trim()) return tickets;
        const q = query.toLowerCase().trim();
        return tickets.filter(t => {
            const fields = [t.title, t.description, t.id, t.category, t.assignee].filter(Boolean).join(' ').toLowerCase();
            return fields.includes(q);
        });
    },

    sortTickets(tickets, by, order) {
        by = by || 'createdAt';
        order = order || 'desc';
        return [...tickets].sort((a, b) => {
            let va = a[by], vb = b[by];
            if (by === 'priority') {
                const p = { urgent: 4, high: 3, medium: 2, low: 1 };
                va = p[va] || 0; vb = p[vb] || 0;
            } else if (by === 'status') {
                const s = { open: 5, in_progress: 4, pending: 3, resolved: 2, closed: 1 };
                va = s[va] || 0; vb = s[vb] || 0;
            } else if (typeof va === 'string') {
                va = va.toLowerCase(); vb = (vb || '').toLowerCase();
            }
            if (va < vb) return order === 'asc' ? -1 : 1;
            if (va > vb) return order === 'asc' ? 1 : -1;
            return 0;
        });
    },

    getTicketStats(tickets) {
        const s = { total: tickets.length, open: 0, inProgress: 0, pending: 0, resolved: 0, closed: 0 };
        tickets.forEach(t => {
            if (t.status === 'open') s.open++;
            else if (t.status === 'in_progress') s.inProgress++;
            else if (t.status === 'pending') s.pending++;
            else if (t.status === 'resolved') s.resolved++;
            else if (t.status === 'closed') s.closed++;
        });
        return s;
    },
};