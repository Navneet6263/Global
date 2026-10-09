import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/api/auth";
import { DepartmentsBoard } from "@/features/operations/departments/DepartmentsBoard";

export const Route = createFileRoute("/operations/departments")({
  head: () => ({ meta: [{ title: "Departments & teams — Sapling Global Operations" }] }),
  component: OperationsDepartments,
});

function OperationsDepartments() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canManage = Boolean(
    session.data?.roles.some((role) => ["OPS_MANAGER", "PLATFORM_ADMIN"].includes(role)),
  );
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Departments & teams</h1>
          <p>Data Entry and verification teams, their Team Leaders and live workload.</p>
        </div>
      </header>
      <DepartmentsBoard canManage={canManage} />
    </>
  );
}
