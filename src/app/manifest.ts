import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyVilla",
    short_name: "MyVilla",
    description: "Book the best villas around you.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#5D5FEF",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
