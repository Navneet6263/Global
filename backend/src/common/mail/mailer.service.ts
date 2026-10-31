import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import { renderEmail, type EmailTemplate } from "./email-templates";

/**
 * Which mailbox to send through. SMTP_* comes first; RESET_MAIL_* is the accepted alternative
 * naming, and only applies when SMTP_HOST is not set, so the two sets never mix.
 */
export function smtpSettings(config: Pick<ConfigService, "get">) {
  const host = config.get<string>("SMTP_HOST");
  if (host)
    return {
      host,
      port: config.get<number>("SMTP_PORT", 587),
      secure: config.get<boolean>("SMTP_SECURE", false),
      user: config.get<string>("SMTP_USER"),
      pass:
        config.get<string>("SMTP_PASSWORD") ?? config.get<string>("SMTP_PASS"),
    };
  return {
    host: config.get<string>("RESET_MAIL_HOST"),
    port: config.get<number>("RESET_MAIL_PORT") ?? 587,
    secure: config.get<boolean>("SMTP_SECURE", false),
    user: config.get<string>("RESET_MAIL_USER"),
    pass: config.get<string>("RESET_MAIL_PASS"),
  };
}

/** Company SMTP delivery. Configured only when a mail host is set. */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transport?: Transporter;

  constructor(private readonly config: ConfigService) {}

  configured(): boolean {
    return Boolean(smtpSettings(this.config).host);
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
      from: this.config.get<string>("SMTP_FROM") ?? smtpSettings(this.config).user,
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
    const { host, port, secure, user, pass } = smtpSettings(this.config);
    this.transport = createTransport({
      host,
      port,
      secure,
      ...(user
        ? {
            auth: {
              user,
              // Google app passwords are shown with spaces; SMTP needs them without.
              pass: (pass ?? "").replace(/\s+/g, ""),
            },
          }
        : {}),
      connectionTimeout: 15_000,
      socketTimeout: 20_000,
    });
    return this.transport;
  }
}
