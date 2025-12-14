const BASE =
  "https://lsmpdqasbvjchyooyuli.supabase.co/storage/v1/object/public/course-media";

export const MEDIA = {
  // ✅ SERVICE HERO VIDEOS (root of bucket)
  hero: {
    branding: `${BASE}/branding-hero-v2.mp4`,
    webux: `${BASE}/ux-hero.mp4`,
    webAppDev: `${BASE}/thrive-hero-v2.mp4`,
    home: `${BASE}/thrive-hero.mp4`, // optional, if homepage uses same
  },

  // ✅ IMAGES (root of bucket)
  portrait: `${BASE}/lauren-portrait.jpg`,
  heroImage: `${BASE}/hero-thrive-desk.jpg`,

  // ✅ “portfolio reel” videos folder (if you still use these anywhere)
  videos: {
    branding: `${BASE}/videos/branding.mp4`,
    content: `${BASE}/videos/content.mp4`,
    uxhero: `${BASE}/videos/uxhero.mp4`,
    webux: `${BASE}/videos/webux.mp4`,
  },
  work: {
    anchorAcademy: `${BASE}/work/anchor-academy-cover.jpg`,
    brewhaus: `${BASE}/work/brewhaus-cover.jpg`,
    burrellGroup: `${BASE}/work/burrell-group-cover.jpg`,
    curlCo: `${BASE}/work/curl-co-cover.jpg`,
    djMastamind: `${BASE}/work/dj-mastamind-cover.jpg`,
    safespace: `${BASE}/work/safespace-cover.jpg`,
    soulcheck: `${BASE}/work/soulcheck-cover.jpg`,
    squeezeShop: `${BASE}/work/squeeze-shop-cover.jpg`,
    stJohn: `${BASE}/work/st-john-cover.jpg`,
    tckt: `${BASE}/work/tckt-cover.jpg`,
    thriveSite: `${BASE}/work/thrive-site-cover.jpg`,
  },
}; 
