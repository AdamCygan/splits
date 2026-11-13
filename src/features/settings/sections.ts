import {
  CalendarRange,
  Clock3,
  CreditCard,
  Flag,
  LayoutGrid,
  Layers,
  ListChecks,
  Ruler,
  ScrollText,
  UserRound,
  Zap,
} from 'lucide-react'

/** Sekcje panelu ustawień — kolejność w menu i trasy. */
export const settingsSections = [
  { to: '/app/settings', key: 'overview', icon: LayoutGrid, exact: true },
  { to: '/app/settings/workday', key: 'workday', icon: Clock3, exact: false },
  {
    to: '/app/settings/sprints',
    key: 'sprints',
    icon: CalendarRange,
    exact: false,
  },
  {
    to: '/app/settings/story-points',
    key: 'storyPoints',
    icon: Ruler,
    exact: false,
  },
  {
    to: '/app/settings/work-types',
    key: 'workTypes',
    icon: Layers,
    exact: false,
  },
  {
    to: '/app/settings/statuses',
    key: 'statuses',
    icon: ListChecks,
    exact: false,
  },
  { to: '/app/settings/projects', key: 'projects', icon: Flag, exact: false },
  { to: '/app/settings/templates', key: 'templates', icon: Zap, exact: false },
  {
    to: '/app/settings/summaries',
    key: 'summaries',
    icon: ScrollText,
    exact: false,
  },
  {
    to: '/app/settings/account',
    key: 'account',
    icon: UserRound,
    exact: false,
  },
  { to: '/app/settings/plan', key: 'plan', icon: CreditCard, exact: false },
] as const
