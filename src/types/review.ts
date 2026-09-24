import type { ServiceSlug } from '@/lib/serviceSeo';

export type ReviewStatus = 'requested' | 'submitted' | 'approved' | 'hidden';

export interface Review {
  id: string;
  crm_contact_id: string | null;
  crm_deal_id: string | null;
  service_slug: ServiceSlug | null;
  display_name: string | null;
  display_role: string | null;
  rating: number | null;
  body: string | null;
  consent_publish: boolean;
  status: ReviewStatus;
  featured: boolean;
  requested_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Admin list row: the review with who it came from. */
export interface ReviewRow extends Review {
  contact_name: string | null;
  deal_title: string | null;
}

/** What the public site shows. */
export type PublicReview = Pick<Review, 'id' | 'service_slug' | 'display_name' | 'display_role' | 'rating' | 'body' | 'featured' | 'approved_at'>;
