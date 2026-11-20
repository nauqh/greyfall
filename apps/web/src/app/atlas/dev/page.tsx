import { redirect } from "next/navigation";

// Dev mode comes in at the Harbour, the hub every road starts from.
export default function DevPage() {
  redirect("/atlas/dev/harbour");
}
