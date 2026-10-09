import type { Page } from "@playwright/test";

type Who = "ANON" | "CLIENT" | "OPS" | "ADMIN" | "RM";

/**
 * Browser-only fixture for company self sign-up and onboarding. Synthetic data only; state
 * changes in memory so each action's effect on the next screen can be checked.
 */
export async function onboardingFixture(page: Page, start: Who) {
  const rates: Array<{
    servicePackageId: string;
    name: string;
    unitPrice: number;
    taxRate: number;
    tatHours: number;
    active: boolean;
  }> = [];
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  let who: Who = start;
  const now = Date.now();
  const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  const docs = [
    ["AGREEMENT", "Service agreement (MSA)", true, true],
    ["DPA", "Data processing agreement (DPA)", true, true],
    ["GST_CERTIFICATE", "GST registration certificate", true, false],
    ["PAN", "Company PAN card", true, false],
    ["SIGNATORY_AUTHORITY", "Authorised signatory letter / board resolution", true, false],
    ["CONFIDENTIALITY", "NDA / confidentiality agreement", false, true],
    ["INCORPORATION", "Certificate of incorporation", false, false],
    ["PURCHASE_ORDER", "Purchase order", false, false],
  ] as const;
  const state = {
    status: "ONBOARDING" as "ONBOARDING" | "ACTIVE",
    version: 4,
    submittedAt: null as string | null,
    gstin: "27ABCDE1234F1Z5" as string | null,
    pan: "ABCDE1234F" as string | null,
    billingAddress: "Baner Road, Pune 411045" as string | null,
    files: new Map<
      string,
      { status: string; name: string; reviewNotes: string | null; version: number }
    >([
      [
        "AGREEMENT",
        { status: "APPROVED", name: "MSA-signed.pdf", reviewNotes: "Checked", version: 2 },
      ],
      ["DPA", { status: "PENDING", name: "DPA-signed.pdf", reviewNotes: null, version: 1 }],
      ["GST_CERTIFICATE", { status: "PENDING", name: "GST.pdf", reviewNotes: null, version: 1 }],
      [
        "PAN",
        {
          status: "REJECTED",
          name: "pan-blurry.jpg",
          reviewNotes: "The PAN number is not readable. Upload a clear scan.",
          version: 2,
        },
      ],
    ]),
  };
  const progress = () => {
    const required = docs.filter(([, , required]) => required);
    const states = required.map(([type]) => state.files.get(type)?.status ?? "MISSING");
    const uploaded = states.filter((s) => s === "PENDING" || s === "APPROVED").length;
    const approved = states.filter((s) => s === "APPROVED").length;
    const missing = required
      .filter(([type]) => !["PENDING", "APPROVED"].includes(state.files.get(type)?.status ?? ""))
      .map(([type, label]) =>
        state.files.get(type)?.status === "REJECTED" ? `${label} (re-upload)` : label,
      );
    const done = 1 + uploaded + approved + 1;
    return {
      detailsDone: true,
      documentsUploaded: uploaded,
      documentsApproved: approved,
      documentsRequired: required.length,
      commercialDone: false,
      rmAssigned: true,
      clientDone: missing.length === 0,
      missing,
      done,
      total: 13,
      percent: Math.round((done / 13) * 100),
    };
  };
  const company = (internal: boolean) => ({
    id: "client-acme",
    code: "ACMETE-7F3A",
    legalName: "Acme Technologies Pvt Ltd",
    displayName: "Acme Technologies",
    contactName: "Riya Mehta",
    contactEmail: "riya@acmetech.in",
    contactPhone: "+91 98765 43210",
    status: state.status,
    version: state.version,
    signedUpAt: iso(-50),
    submittedAt: state.submittedAt,
    rm: {
      id: "rm-arjun",
      name: "Arjun Nair",
      email: "arjun@example.invalid",
      phone: "+91 90000 11111",
    },
    rmAssignedAt: iso(-40),
    progress: progress(),
    gstin: state.gstin,
    pan: state.pan,
    billingAddress: state.billingAddress,
    billingTerms: null,
    note: "Please re-upload a clear PAN card scan.",
    packages: [],
    documents: docs.map(([type, label, required, signed]) => {
      const file = state.files.get(type);
      return {
        type,
        label,
        hint: required ? "Required for activation." : "Optional.",
        required,
        signed,
        agreementId: file ? `agr-${type}` : null,
        signedAt: file && signed ? iso(-60) : null,
        state: file ? (file.status === "UPLOADED" ? "PENDING" : file.status) : "MISSING",
        file: file
          ? {
              id: `file-${type}`,
              revision: file.version,
              status: file.status,
              name: file.name,
              mimeType: "application/pdf",
              sizeBytes: 245_000,
              uploadedAt: iso(-30),
              reviewNotes: file.reviewNotes,
              reviewedAt: file.status === "PENDING" ? null : iso(-20),
              version: file.version,
              ...(internal ? { uploadedBy: "Riya Mehta" } : {}),
            }
          : null,
      };
    }),
  });
  const detail = () => ({
    ...company(true),
    flags: { personalEmail: false, possibleDuplicates: ["Acme Tech Solutions"] },
    rates: rates.map((rate) => ({ ...rate })),
    catalog: [
      { id: "pkg-basic", name: "Basic employee check", price: 1200, tatHours: 72 },
      { id: "pkg-pro", name: "Pro (employment + education + address)", price: 2400, tatHours: 120 },
    ],
    timeline: [
      { action: "client.agreement-file.uploaded", at: iso(-30), by: "Riya Mehta" },
      { action: "client.primary-rm-assigned", at: iso(-40), by: "Operations Manager" },
      { action: "client.self-signup", at: iso(-50), by: "Riya Mehta" },
    ],
    // Operations, or the company's assigned RM (Arjun), approves; only Operations sets prices.
    canManage: who === "OPS" || who === "RM",
    canSetPrice: who === "OPS",
    canMessage: who === "OPS" || who === "RM",
  });
  const session = () => {
    if (who === "CLIENT")
      return {
        id: "user-riya",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        clientId: "client-acme",
        clientName: "Acme Technologies",
        clientStatus: state.status,
        displayName: "Riya Mehta",
        email: "riya@acmetech.in",
        roles: ["CLIENT_ADMIN"],
        permissions: [
          "dashboard:read",
          "case:read",
          "case:create",
          "report:read",
          "support:request",
          "notification:read",
        ],
        mustChangePassword: false,
      };
    if (who === "RM")
      return {
        id: "rm-arjun",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Arjun Nair",
        email: "arjun@example.invalid",
        roles: ["SPOC_RM"],
        permissions: ["dashboard:read", "client:read", "case:read", "notification:read"],
        clientScope: [{ id: "client-acme", name: "Acme Technologies" }],
        mustChangePassword: false,
      };
    if (who === "OPS")
      return {
        id: "user-ops",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Operations Manager",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: [
          "dashboard:read",
          "client:read",
          "case:read",
          "case:transition",
          "user:read",
          "notification:read",
        ],
        mustChangePassword: false,
      };
    return {
      id: "user-admin",
      tenantId: "tenant-1",
      tenantName: "Sapling Global",
      displayName: "Platform Admin",
      email: "admin@example.invalid",
      roles: ["PLATFORM_ADMIN"],
      permissions: ["dashboard:read", "client:read", "case:read", "user:read", "notification:read"],
      viewOnly: true,
      mustChangePassword: false,
    };
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    let body: unknown;
    try {
      body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    } catch {
      body = "<binary>";
    }
    requests.push({ method, path, body });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me")
      return who === "ANON" ? reply({ message: "Unauthorized" }, 401) : reply(session());
    if (path === "/onboarding/companies/client-acme/commercial" && method === "PUT") {
      const input = body as { packages: Array<{ servicePackageId: string; active: boolean }> };
      rates.splice(
        0,
        rates.length,
        ...input.packages.map((row) => ({
          servicePackageId: row.servicePackageId,
          name: row.servicePackageId === "pkg-basic" ? "Basic employee check" : "Pro",
          unitPrice: row.servicePackageId === "pkg-basic" ? 1200 : 2400,
          taxRate: 18,
          tatHours: 72,
          active: row.active,
        })),
      );
      state.version += 1;
      return reply(detail());
    }
    if (path === "/client-pricing/client-acme" && method === "GET")
      return reply({
        client: { id: "client-acme", name: "Acme Technologies" },
        canSetAnyDiscount: who === "OPS",
        items: rates
          .filter((rate) => rate.active)
          .map((rate) => ({
            packageId: rate.servicePackageId,
            code: "BASIC",
            name: rate.name,
            listPrice: rate.unitPrice,
            maxRmDiscountPercent: 10,
            yourLimitPercent: who === "OPS" ? 100 : 10,
            discountPercent: 0,
            finalPrice: rate.unitPrice,
            note: null,
            setBy: null,
            updatedAt: null,
          })),
      });
    if (path.startsWith("/client-pricing/client-acme/") && method === "PUT")
      return reply({
        packageId: path.split("/").at(-1),
        discountPercent: (body as { discountPercent: number }).discountPercent,
      });
    if (path === "/auth/refresh") return reply({ message: "Unauthorized" }, 401);
    if (path === "/auth/signup" && method === "POST")
      return reply({
        signupId: "00000000-0000-4000-8000-000000000099",
        email: "ri**@acmetech.in",
        expiresAt: iso(0.2),
        resendAfterSeconds: 45,
      });
    if (path === "/auth/signup/verify" && method === "POST") {
      who = "CLIENT";
      return reply({ authenticated: true, session: session() });
    }
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({ counts: { opsSignups: 3, opsEscalated: 1 }, generatedAt: iso(0) });
    if (path === "/onboarding/me" && method === "GET") return reply(company(false));
    if (path.startsWith("/onboarding/me/documents/") && method === "POST") {
      const type = path.split("/").pop()!;
      state.files.set(type, {
        status: "PENDING",
        name: "pan-clear.pdf",
        reviewNotes: null,
        version: 3,
      });
      state.version += 1;
      return reply({ id: "f-new", revision: 3, company: company(false) });
    }
    if (path === "/onboarding/me/submit" && method === "POST") {
      state.submittedAt = iso(0);
      state.version += 1;
      return reply(company(false));
    }
    if (path === "/onboarding/companies" && method === "GET")
      return reply({
        items: [
          {
            ...company(true),
            flags: { personalEmail: false, possibleDuplicates: ["Acme Tech Solutions"] },
          },
          {
            ...company(true),
            id: "client-zen",
            displayName: "Zen Retail",
            contactName: "Kabir Shah",
            contactEmail: "kabir.shah@gmail.com",
            rm: null,
            submittedAt: null,
            flags: { personalEmail: true, possibleDuplicates: [] },
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        counts: { all: 2, needsRm: 1, submitted: 1, inProgress: 1 },
      });
    if (path === "/onboarding/companies/client-acme" && method === "GET") return reply(detail());
    if (path === "/onboarding/companies/client-acme/activity" && method === "GET") {
      // 12 synthetic events: a signup, uploads and reviews, an RM and a discount.
      const all = [
        ...Array.from({ length: 8 }, (_, index) => ({
          id: `doc-${index}`,
          action: index % 2 ? "client.agreement-file.reviewed" : "client.agreement-file.uploaded",
          kind: "DOCUMENTS",
          at: iso(-1 - index),
          by: index % 2 ? "Operations Manager" : "Riya Mehta",
          byRole: index % 2 ? "Operations Manager" : "Client Admin",
          detail: index % 2 ? "Company PAN card · approved" : "Company PAN card",
          outcome: index % 2 ? "good" : null,
        })),
        {
          id: "disc",
          action: "client-pricing.discount-set",
          kind: "PRICING",
          at: iso(-10),
          by: "Niku",
          byRole: "RM / SPOC",
          detail: "Standard BGV · 10% discount",
          outcome: null,
        },
        {
          id: "rm",
          action: "client.primary-rm-assigned",
          kind: "PEOPLE",
          at: iso(-40),
          by: "Operations Manager",
          byRole: "Operations Manager",
          detail: "Niku",
          outcome: null,
        },
        {
          id: "msg",
          action: "client.onboarding.message",
          kind: "PEOPLE",
          at: iso(-45),
          by: "Niku",
          byRole: "RM / SPOC",
          detail: "Please upload the signed DPA.",
          outcome: null,
        },
        {
          id: "signup",
          action: "client.self-signup",
          kind: "DECISIONS",
          at: iso(-50),
          by: "Riya Mehta",
          byRole: "Client Admin",
          detail: null,
          outcome: null,
        },
      ];
      const kind = url.searchParams.get("kind");
      const rows = kind ? all.filter((row) => row.kind === kind) : all;
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      const size = Number(url.searchParams.get("pageSize") ?? 10);
      return reply({
        items: rows.slice((pageNo - 1) * size, pageNo * size),
        total: rows.length,
        page: pageNo,
        pageSize: size,
      });
    }
    if (path.endsWith("/review") && method === "POST") {
      const type = path.split("/")[5]!.replace("agr-", "");
      const input = body as { status: string; notes: string };
      const file = state.files.get(type)!;
      state.files.set(type, {
        ...file,
        status: input.status,
        reviewNotes: input.notes,
        version: file.version + 1,
      });
      state.version += 1;
      return reply(detail());
    }
    if (path === "/onboarding/companies/client-acme/activate" && method === "POST")
      return reply({ message: "Complete onboarding before activation: billing terms" }, 400);
    return reply({ items: [], total: 0 });
  });
  return { requests, setWho: (next: Who) => (who = next) };
}
