import { ensureProtocol } from "@calcom/lib/url"; // Import the new centralized utility
import { readFileSync } from "fs";
import Handlebars from "handlebars";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import type { TransportOptions } from "nodemailer";
import nodemailer from "nodemailer";
import path from "path";

import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import { serverConfig } from "@calcom/lib/serverConfig";

const transporter = nodemailer.createTransport<TransportOptions>({
  ...(serverConfig.transport as TransportOptions),
} as TransportOptions);

const sendVerificationRequest = async ({
  identifier,
  url,
}: Pick<SendVerificationRequestParams, "identifier" | "url">) => {
  const emailsDir = path.resolve(
    process.cwd(),
    "..",
    "..",
    "packages/emails",
    "templates"
  );

  // URL Protocol Safety Fixes: Centralized logic to prevent ERR_INVALID_URL crash (#25774)
  const safeWebappUrl = ensureProtocol(WEBAPP_URL); // Ensure WEBAPP_URL has a protocol
  const safeNextAuthUrl = ensureProtocol(
    process.env.NEXTAUTH_URL || safeWebappUrl
  ); // Ensure NEXTAUTH_URL is safe

  const originalUrl = new URL(url);
  // Use the safely constructed NEXTAUTH_URL for the webappUrl constructor
  const webappUrl = new URL(safeNextAuthUrl);

  if (originalUrl.origin !== webappUrl.origin) {
    url = url.replace(originalUrl.origin, webappUrl.origin);
  }
  const emailFile = readFileSync(path.join(emailsDir, "confirm-email.html"), {
    encoding: "utf8",
  });
  const emailTemplate = Handlebars.compile(emailFile);
  // async transporter
  transporter.sendMail({
    from: `${process.env.EMAIL_FROM}` || APP_NAME,
    to: identifier,
    subject: `Your sign-in link for ${APP_NAME}`,
    html: emailTemplate({
      base_url: safeWebappUrl, // Use the safe URL version for the email template
      signin_url: url,
      email: identifier,
    }),
  });
};

export default sendVerificationRequest;
