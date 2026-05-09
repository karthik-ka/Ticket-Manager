/**
 * Constants - Application-wide constants
 * Ticket Manager Extension
 */

const TicketStatus = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    PENDING: 'pending',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
};

const TicketPriority = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
};

const StatusLabels = {
    [TicketStatus.OPEN]: 'Open',
    [TicketStatus.IN_PROGRESS]: 'In Progress',
    [TicketStatus.PENDING]: 'Pending',
    [TicketStatus.RESOLVED]: 'Resolved',
    [TicketStatus.CLOSED]: 'Closed',
};

const PriorityLabels = {
    [TicketPriority.LOW]: 'Low',
    [TicketPriority.MEDIUM]: 'Medium',
    [TicketPriority.HIGH]: 'High',
    [TicketPriority.URGENT]: 'Urgent',
};

const StatusColors = {
    [TicketStatus.OPEN]: '#1a5fb4',
    [TicketStatus.IN_PROGRESS]: '#e5a50a',
    [TicketStatus.PENDING]: '#9141ac',
    [TicketStatus.RESOLVED]: '#26a269',
    [TicketStatus.CLOSED]: '#77767b',
};

const PriorityColors = {
    [TicketPriority.LOW]: '#77767b',
    [TicketPriority.MEDIUM]: '#1a5fb4',
    [TicketPriority.HIGH]: '#e5a50a',
    [TicketPriority.URGENT]: '#c01c28',
};