/** Static team member list for owner-assignment dropdowns. */
export const TEAM_MEMBERS = [
  { id: 'RK', name: 'Ravi Kumar',     org: 'ZUCI'     },
  { id: 'SM', name: 'Sarah Mitchell', org: 'TruStage' },
  { id: 'PM', name: 'Priya Mehta',    org: 'ZUCI'     },
  { id: 'AS', name: 'Alex Singh',     org: 'ZUCI'     },
] as const;

export type TeamMemberId = (typeof TEAM_MEMBERS)[number]['id'];

/** Dropdown option objects — `value` is the full name stored in DB. */
export const TEAM_MEMBER_OPTIONS = TEAM_MEMBERS.map(m => ({
  value: m.name,
  label: `${m.name} (${m.org})`,
}));
