"use client";

// Every public page's frame. Since the Nov 2026 redesign this is the new site
// shell (src/app/_site/Shell.tsx): two pills and the logo up top, the menu of
// coloured panels, the new footer. Pages that haven't been redesigned yet use
// it in `legacy` mode, which keeps their own type inside the new frame;
// redesigned pages render <Shell> directly.

import Shell from "../_site/Shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <Shell legacy>{children}</Shell>;
}
