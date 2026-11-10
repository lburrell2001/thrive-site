// Thrive's Google Business Profile "write a review" link. A review on the site
// can't be posted to Google for the client — Google only takes reviews written
// by the reviewer's own Google account — so the site copies their words and
// opens this link for them to paste and post. Offered to everyone, whatever
// they rated: Google doesn't allow asking only happy customers.
export const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || 'https://g.page/r/CVIue6V8HCJuEAI/review';
