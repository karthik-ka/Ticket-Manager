/**
 * Constants - Ticket Manager
 */

const TicketStatus = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    ANSWERED: 'answered',
    COMPLETED: 'completed',
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
    [TicketStatus.ON_HOLD]: 'On Hold',
    [TicketStatus.ANSWERED]: 'Answered',
    [TicketStatus.COMPLETED]: 'Completed',
};

const PriorityLabels = {
    [TicketPriority.LOW]: 'Low',
    [TicketPriority.MEDIUM]: 'Medium',
    [TicketPriority.HIGH]: 'High',
    [TicketPriority.URGENT]: 'Urgent',
};

const StatusColors = {
    [TicketStatus.OPEN]: '#9a9996',
    [TicketStatus.IN_PROGRESS]: '#c01c28',
    [TicketStatus.ON_HOLD]: '#1a5fb4',
    [TicketStatus.ANSWERED]: '#77767b',
    [TicketStatus.COMPLETED]: '#26a269',
};