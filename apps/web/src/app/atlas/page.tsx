import { redirect } from "next/navigation";

// The game begins where a nameless survivor wakes at the Landing; the map of the Reach is opened from a bonfire, over the area (TravelMap).
export default function AtlasPage() {
  redirect("/atlas/landing");
}
