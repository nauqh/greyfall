import { redirect } from "next/navigation";

// The game begins where a new captain comes ashore; the map of the Reach is opened from a bonfire, over the area (TravelMap).
export default function AtlasPage() {
  redirect("/atlas/landing");
}
