import { Badge } from './Badge';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

const STATUS_CONFIG: Record<string, { variant: BadgeVariant }> = {
  draft: { variant: 'gray' },
  submitted: { variant: 'blue' },
  manager_approved: { variant: 'purple' },
  admin_approved: { variant: 'green' },
  rejected: { variant: 'red' },
  converted_to_po: { variant: 'orange' },
  sent: { variant: 'blue' },
  partially_received: { variant: 'yellow' },
  fully_received: { variant: 'green' },
  invoiced: { variant: 'purple' },
  paid: { variant: 'green' },
  closed: { variant: 'gray' },
  cancelled: { variant: 'red' },
  received: { variant: 'blue' },
  qc_pending: { variant: 'yellow' },
  qc_passed: { variant: 'green' },
  qc_failed: { variant: 'red' },
  stocked: { variant: 'green' },
  pending: { variant: 'yellow' },
  completed: { variant: 'green' },
  open: { variant: 'blue' },
  in_review: { variant: 'yellow' },
  resolved: { variant: 'green' },
  approved: { variant: 'green' },
  counting: { variant: 'blue' },
  pending_approval: { variant: 'yellow' },
};

interface StatusBadgeProps {
  status: string;
  labelOverride?: string;
}

export function StatusBadge({ status, labelOverride }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { variant: 'gray' as BadgeVariant };
  return (
    <Badge variant={config.variant}>
      {labelOverride ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}
