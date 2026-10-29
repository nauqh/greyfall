// One area's own map, at its own address: a refresh or a shared link lands back in it.

import { MAPPED_AREAS, type AreaId } from "@greyfall/engine";
import { notFound } from "next/navigation";

import { AreaView } from "../views";

export const dynamicParams = false;

export function generateStaticParams() {
  return MAPPED_AREAS.map((area) => ({ area }));
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!MAPPED_AREAS.includes(area as AreaId)) notFound();
  return <AreaView key={area} area={area as AreaId} />;
}
