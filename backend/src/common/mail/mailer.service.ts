import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import { renderEmail, type EmailTemplate } from "./email-templates";

/** Company SMTP delivery. Configured only when SMTP_HOST is set. */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transport?: Transporter;

  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(this.config.get<string>("SMTP_HOST"));
  }

  async sendTemplate(
    to: string,
    template: EmailTemplate,
    variables: Record<string, unknown>,
    extras: {
      cc?: string[];
      attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType: string;
      }>;
    } = {},
  ): Promise<void> {
    const email = renderEmail(template, variables);
    await this.client().sendMail({
      from: this.config.getOrThrow<string>("SMTP_FROM"),
      to,
      ...(extras.cc?.length ? { cc: extras.cc } : {}),
      ...(extras.attachments?.length
        ? { attachments: extras.attachments }
        : {}),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    this.logger.log(`Email "${template}" sent`);
  }

  private client(): Transporter {
    if (this.transport) return this.transport;
    const user = this.config.get<string>("SMTP_USER");
    this.transport = createTransport({
      host: this.config.getOrThrow<string>("SMTP_HOST"),
      port: this.config.get<number>("SMTP_PORT", 587),
      secure: this.config.get<boolean>("SMTP_SECURE", false),
      ...(user
        ? {
            auth: {
              user,
              // Google app passwords are shown with spaces; SMTP needs them without.
              pass: (
                this.config.get<string>("SMTP_PASSWORD") ??
                this.config.get<string>("SMTP_PASS") ??
                ""
              ).replace(/\s+/g, ""),
            },
          }
        : {}),
      connectionTimeout: 15_000,
      socketTimeout: 20_000,
    });
    return this.transport;
  }
}
