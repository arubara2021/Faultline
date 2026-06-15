import { IncidentDetail } from "@/components/incident/incident-detail";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentDetail incidentId={id} />;
}
