import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { DocumentsService } from "../../documents/documents.service";
import { pageResult } from "../../spoc/spoc-scope";
import { VendorRequestsRepository } from "../vendor-requests.repository";
import type { VendorRequestQueryDto } from "../vendor-requests.validation";
import { toVendorDetail, toVendorListItem } from "./vendor-request-view";

/** Every vendor query is keyed on the caller, so another vendor's request is simply not found. */
export function ownRequests(actor: Actor) {
  return { tenantId: actor.tenantId, vendorUserId: actor.userId };
}

/** The Vendor workspace reads: the caller's own requests, detail and file preview. */
@Injectable()
export class VendorInboxService {
  constructor(
    private readonly repository: VendorRequestsRepository,
    private readonly documents: DocumentsService,
  ) {}

  async list(actor: Actor, query: VendorRequestQueryDto) {
    const text = query.search?.trim();
    const { rows, total, counts } = await this.repository.pageOwn(
      ownRequests(actor),
      {
        ...ownRequests(actor),
        ...(query.status ? { status: query.status } : {}),
        ...(text ? { case: { caseNumber: { contains: text } } } : {}),
      },
      query.page,
      query.pageSize,
    );
    const count = (status: string) =>
      counts.find((row) => row.status === status)?._count._all ?? 0;
    return {
      ...pageResult(
        rows.map(toVendorListItem),
        total,
        query.page,
        query.pageSize,
      ),
      counts: {
        pending: count("PENDING"),
        approved: count("APPROVED"),
        rejected: count("REJECTED"),
      },
    };
  }

  async detail(actor: Actor, requestPublicId: string) {
    const row = await this.repository.findOwn({
      ...ownRequests(actor),
      publicId: requestPublicId,
    });
    if (!row) throw new NotFoundException("Request not found");
    const file = await this.repository.assignedFile(
      row.documentId,
      row.documentVersion,
    );
    return toVendorDetail(row, file);
  }

  /** Streams exactly the version that was assigned, never a later upload. */
  async preview(actor: Actor, requestPublicId: string) {
    const row = await this.repository.findOwnForPreview({
      ...ownRequests(actor),
      publicId: requestPublicId,
    });
    if (!row) throw new NotFoundException("Request not found");
    return this.documents.download(actor, row.document.publicId, "preview", {
      caseScope: { tenantId: actor.tenantId },
      version: row.documentVersion,
    });
  }
}
