// Where a case study comes from: projects.case_study (migration 060, edited in
// admin → Portfolio) wins over the code file in src/app/work/case-studies/.

import { CASE_STUDIES, type CaseStudy } from '@/app/work/caseStudies';
import { supabase } from '@/lib/supabaseServer';
import { normalizeCaseStudy } from '@/lib/caseStudyNormalize';

export { normalizeCaseStudy };

/** The case study for /work/<slug>: the database copy, else the code file. */
export async function loadCaseStudy(slug: string): Promise<CaseStudy | null> {
  try {
    const { data } = await supabase.from('projects').select('case_study').eq('slug', slug).maybeSingle<{ case_study: unknown }>();
    if (data?.case_study) {
      const cs = normalizeCaseStudy(data.case_study, slug);
      if (cs) return cs;
    }
  } catch { /* 060 not applied, or the database is down: use the file */ }
  return CASE_STUDIES[slug] ?? null;
}
