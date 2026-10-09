import type { SecretBoxService } from "../security/secret-box.service";
import type { Prisma } from "../../generated/prisma/client";
import type { EmailTemplate } from "./email-templates";

/**
 * Queue a transactional email in the same transaction as the change that caused it.
 * The outbox worker delivers it through company SMTP (see MailerService).
 */
export function queueEmail(
  tx: Prisma.TransactionClient,
  secretBox: SecretBoxService,
  input: {
    tenantId: bigint;
    aggregateType: string;
    aggregateId: string;
    to: string;
    template: EmailTemplate;
    variables: Record<string, unknown>;
    cc?: string[];
    /** A stored object (objectKey) or small generated content (base64). */
    attachments?: Array<{
      filename: string;
      contentType: string;
      objectKey?: string;
      base64?: string;
    }>;
  },
) {
  return tx.outboxEvent.create({
    data: {
      tenantId: input.tenantId,
      topic: "email.requested",
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payloadJson: JSON.stringify({
        secret: secretBox.seal({
          to: input.to,
          template: input.template,
          variables: input.variables,
          ...(input.cc?.length ? { cc: input.cc } : {}),
          ...(input.attachments?.length
            ? { attachments: input.attachments }
            : {}),
        }),
      }),
    },
  });
}
