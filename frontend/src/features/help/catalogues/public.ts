import { guide, type GuideCatalogue } from "../help-types";

export default {
  clarification: guide(
    "Clarification response",
    "Read the verification team's request and supply the specific information needed.",
    [
      "Confirm this request is for you.",
      "Read the question and any earlier messages.",
      "Send a factual response and wait for saved confirmation.",
    ],
    "A submitted response must still be reviewed. Do not send passwords or unrelated identity information.",
  ),
  report: guide(
    "Report authenticity",
    "Check the published report reference against the issuer's recorded version.",
    [
      "Open the authenticity link provided with the report.",
      "Compare its reported status and version with your document.",
      "Contact the issuer if the reference is invalid or does not match.",
    ],
    "This screen validates the recorded report reference. It does not grant access to another candidate's private documents.",
  ),
  candidate: guide(
    "Candidate document workspace",
    "Provide the documents requested for your verification and see their current status.",
    [
      "Confirm your name and the requesting organisation.",
      "Review required checks and choose the correct document type.",
      "Upload a clear readable file and wait for confirmation before closing the page.",
    ],
    "Never paste identity numbers, passwords, OTPs or the private upload link into Help. A successful upload does not mean the document has been verified.",
    [
      {
        question: "Which files should I upload?",
        answer:
          "Use the document types requested on your case. Follow the displayed PDF/JPEG/PNG and size requirements. Include the full document, readable details and relevant sides/pages. Blank, damaged, encrypted or unrelated files may be rejected.",
      },
      {
        question: "Where do I enter the consent OTP?",
        answer:
          "The consent page has the OTP entry and confirmation control. If your upload page does not show it, open the separate consent invitation provided by the authorised team. Ask them to resend it if missing; do not enter an OTP into a document upload field.",
      },
      {
        question: "Why is my link unavailable?",
        answer:
          "It may be missing its secure token, expired or replaced. Ask the requesting organisation or operations team for a fresh invitation. Do not share another candidate's link.",
      },
    ],
  ),
  consent: guide(
    "Candidate consent",
    "Review the verification request and confirm consent using the supplied OTP.",
    [
      "Check the candidate and requesting organisation.",
      "Read the consent text and enter the current OTP.",
      "Confirm and wait for the accepted result.",
    ],
    "Consent is a separate action from uploading a file. Never approve a request that does not belong to you.",
  ),
} satisfies GuideCatalogue;
