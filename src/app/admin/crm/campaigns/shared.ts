// Labels shared by the campaign pages.

export const PIECE_LABEL: Record<string, string> = {
  postcard: 'Postcard',
  flyer: 'Flyer',
  letter: 'Letter',
  door_hanger: 'Door hanger',
  brochure: 'Brochure',
  leave_behind: 'Leave-behind',
  other: 'Other print',
  newsletter: 'Newsletter',
  outreach: 'Outreach email',
  'one-to-one': 'One-to-one emails',
};

export const OUTCOME_LABEL: Record<string, string> = {
  sent: 'Sent',
  responded: 'Got in touch',
  lead: 'Became a lead',
  won: 'Became a client',
  no_response: 'No response',
};

export const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
