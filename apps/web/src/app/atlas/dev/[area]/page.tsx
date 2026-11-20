// An area's map in dev mode, behind the dev password (middleware.ts): the same view, the camera free from the start.

import { MAPPED_AREAS, type AreaId } from "@greyfall/engine";
import { notFound } from "next/navigation";

import { AreaView } from "../../views";

export const dynamicParams = false;

export function generateStaticParams() {
  return MAPPED_AREAS.map((area) => ({ area }));
}

export default async function DevAreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!MAPPED_AREAS.includes(area as AreaId)) notFound();
  return <AreaView key={area} area={area as AreaId} devRoute />;
}
