import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thrive Creative Studios",
    short_name: "Thrive",
    description: "Branding, Web, and UX Design Studio",
    start_url: "/",
    display: "standalone",
    background_color: "#3943B7",
    theme_color: "#E50586",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
