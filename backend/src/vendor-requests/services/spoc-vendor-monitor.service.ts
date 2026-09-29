import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { spocScope } from "../../common/auth/access-scope";
import { DocumentsService } from "../../documents/documents.service";
import { pageResult, resolveSpocClients } from "../../spoc/spoc-scope";
import { SpocVendorsRepository } from "../spoc-vendors.repository";
import type {
  SpocVendorClientQueryDto,
  SpocVendorDocumentQueryDto,
} from "../vendor-requests.validation";
import {
  reuploadEntry,
  toClientRollup,
  toDocument,
  toHistory,
  toVersionHistory,
} from "./vendor-document-view";
import { vendorStatusWhere } from "./vendor-rules";

/** SPOC-RM reads for the Vendors page. Every lookup is pinned to the SPOC-RM's assigned clients. */
@Injectable()
export class SpocVendorMonitorService {
  constructor(
    private readonly repository: SpocVendorsRepository,
    private readonly files: DocumentsService,
  ) {}

  async clients(actor: Actor, query: SpocVendorClientQueryDto) {
    const text = query.search?.trim();
    const { rows, total } = await this.repository.pageClients(
      {
        tenantId: actor.tenantId,
        ...resolveSpocClients(actor, query.clientId).clientRow,
        ...(text
          ? {
              OR: [
                { displayName: { contains: text } },
                { code: { contains: text } },
              ],
            }
          : {}),
      },
      query.page,
      query.pageSize,
    );
    const [documents, attempts] = await this.repository.clientActivity(
      actor.tenantId,
      rows.map((client) => client.id),
    );
    return pageResult(
      toClientRollup(rows, documents, attempts),
      total,
      query.page,
      query.pageSize,
    );
  }

  async documents(
    actor: Actor,
    clientPublicId: string,
    query: SpocVendorDocumentQueryDto,
  ) {
    // 403 unless this client is one of the SPOC-RM's assigned clients.
    const { clientRow } = resolveSpocClients(actor, clientPublicId);
    const client = await this.repository.findClient({
      tenantId: actor.tenantId,
      publicId: clientPublicId,
      ...clientRow,
    });
    if (!client) throw new NotFoundException("Client not found");
    const text = query.search?.trim();
    const { rows, total } = await this.repository.pageDocuments(
      {
        tenantId: actor.tenantId,
        currentVersion: { gt: 0 },
        case: {
          tenantId: actor.tenantId,
          clientId: client.id,
          ...(text
            ? {
                OR: [
                  { caseNumber: { contains: text } },
                  { subject: { fullName: { contains: text } } },
                ],
              }
            : {}),
        },
        ...vendorStatusWhere(query.vendorStatus),
      },
      query.page,
      query.pageSize,
    );
    return {
      client: {
        id: client.publicId,
        code: client.code,
        displayName: client.displayName,
        status: client.status,
      },
      ...pageResult(rows.map(toDocument), total, query.page, query.pageSize),
    };
  }

  async detail(actor: Actor, documentPublicId: string) {
    const row = await this.repository.findDocument({
      tenantId: actor.tenantId,
      publicId: documentPublicId,
      currentVersion: { gt: 0 },
      case: spocScope(actor),
    });
    if (!row) throw new NotFoundException("Document not found");
    const [link, versions, requests] = await this.repository.documentTrail(
      actor.tenantId,
      row.case.id,
      documentPublicId,
      new Date(),
    );
    const uploaders = await this.repository.userNames(actor.tenantId, [
      ...new Set(
        versions.flatMap((version) =>
          version.uploadedById === null ? [] : [version.uploadedById],
        ),
      ),
    ]);
    return {
      ...toDocument(row),
      client: {
        id: row.case.client.publicId,
        displayName: row.case.client.displayName,
      },
      history: row.vendorAssignments.map(toHistory),
      candidateLink: link ? { active: true, expiresAt: link.expiresAt } : null,
      versions: toVersionHistory(versions, uploaders),
      reuploadHistory: requests.flatMap((request) => {
        const entry = reuploadEntry(request);
        return entry ? [entry] : [];
      }),
    };
  }

  async vendors(actor: Actor) {
    const rows = await this.repository.activeVendors(actor.tenantId);
    return {
      items: rows.map((row) => ({
        id: row.publicId,
        name: row.displayName,
        pending: row._count.vendorRequests,
      })),
    };
  }

  /** Current CLEAN version, inline only; audited as document.previewed by DocumentsService. */
  preview(actor: Actor, documentPublicId: string) {
    return this.files.download(actor, documentPublicId, "preview", {
      caseScope: spocScope(actor),
    });
  }
}
