import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { SPOC_ROLES } from "../common/auth/roles";
import { AssignVendorService } from "./services/assign-vendor.service";
import { ReassignVendorService } from "./services/reassign-vendor.service";
import { RequestReuploadService } from "./services/request-reupload.service";
import { SpocVendorMonitorService } from "./services/spoc-vendor-monitor.service";
import { SPOC_VENDOR_ROUTES } from "./vendor-requests.routes";
import {
  AssignVendorDto,
  ReassignVendorDto,
  RequestReuploadDto,
  SpocVendorClientQueryDto,
  SpocVendorDocumentQueryDto,
} from "./vendor-requests.validation";

/**
 * SPOC-RM Vendors page. The only SPOC_RM write paths in the application: assign,
 * re-assign and re-upload after a rejection. Every other SPOC-RM route stays in the
 * GET-only SpocController.
 */
@Controller(SPOC_VENDOR_ROUTES.base)
@RequireRoles(...SPOC_ROLES)
@RequirePermissions(Permission.VendorAssign)
export class SpocVendorsController {
  constructor(
    private readonly monitor: SpocVendorMonitorService,
    private readonly assigner: AssignVendorService,
    private readonly reassigner: ReassignVendorService,
    private readonly reuploads: RequestReuploadService,
  ) {}

  @Get(SPOC_VENDOR_ROUTES.clients)
  clients(
    @CurrentActor() actor: Actor,
    @Query() query: SpocVendorClientQueryDto,
  ) {
    return this.monitor.clients(actor, query);
  }

  @Get(SPOC_VENDOR_ROUTES.clientDocuments)
  documents(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Query() query: SpocVendorDocumentQueryDto,
  ) {
    return this.monitor.documents(actor, clientId, query);
  }

  @Get(SPOC_VENDOR_ROUTES.document)
  detail(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ) {
    return this.monitor.detail(actor, documentId);
  }

  @Get(SPOC_VENDOR_ROUTES.preview)
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async preview(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
  ): Promise<StreamableFile> {
    return (await this.monitor.preview(actor, documentId)).file;
  }

  @Get(SPOC_VENDOR_ROUTES.vendors)
  vendors(@CurrentActor() actor: Actor) {
    return this.monitor.vendors(actor);
  }

  @Post(SPOC_VENDOR_ROUTES.assign)
  assign(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() input: AssignVendorDto,
  ) {
    return this.assigner.assign(actor, documentId, input);
  }

  @Post(SPOC_VENDOR_ROUTES.reassign)
  reassign(
    @CurrentActor() actor: Actor,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() input: ReassignVendorDto,
  ) {
    return this.reassigner.reassign(actor, assignmentId, input);
  }

  @Post(SPOC_VENDOR_ROUTES.reupload)
  requestReupload(
    @CurrentActor() actor: Actor,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() input: RequestReuploadDto,
  ) {
    return this.reuploads.request(actor, documentId, input);
  }
}
