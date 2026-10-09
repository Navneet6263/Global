import { createFileRoute } from "@tanstack/react-router";
import { CustomRolesBoard } from "@/features/users/CustomRolesBoard";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles & permissions — Sapling Global" }] }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Roles & permissions</h1>
          <p>Create, edit and delete custom roles built on the system roles.</p>
        </div>
      </header>
      <CustomRolesBoard />
    </>
  );
}
