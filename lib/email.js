const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

function validateMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new Error("Message email invalide.");
  }

  const to = typeof message.to === "string" ? message.to.trim() : "";
  const subject =
    typeof message.subject === "string" ? message.subject.trim() : "";
  const textBody = typeof message.textBody === "string" ? message.textBody : "";
  const htmlBody = typeof message.htmlBody === "string" ? message.htmlBody : "";
  if (
    !EMAIL_PATTERN.test(to) ||
    to.length > 254 ||
    !subject ||
    subject.length > 200 ||
    (!textBody && !htmlBody) ||
    textBody.length > 100_000 ||
    htmlBody.length > 100_000
  ) {
    throw new Error("Message email invalide.");
  }

  const attachments =
    message.attachments === undefined ? [] : message.attachments;
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) {
    throw new Error("Pièces jointes email invalides.");
  }

  let totalBytes = 0;
  const normalizedAttachments = attachments.map((attachment) => {
    if (
      !attachment ||
      typeof attachment !== "object" ||
      typeof attachment.name !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$/.test(attachment.name) ||
      typeof attachment.mimeType !== "string" ||
      !["application/pdf"].includes(attachment.mimeType) ||
      typeof attachment.base64 !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        attachment.base64,
      )
    ) {
      throw new Error("Pièce jointe email invalide.");
    }

    const bytes = Buffer.from(attachment.base64, "base64");
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ATTACHMENT_BYTES)
      throw new Error("Pièces jointes email trop volumineuses.");
    return {
      name: attachment.name,
      mimeType: attachment.mimeType,
      base64: attachment.base64,
    };
  });

  return {
    to,
    subject,
    textBody,
    htmlBody,
    attachments: normalizedAttachments,
  };
}

async function sendEmailViaGoogleAppsScript(message) {
  const endpointValue = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN?.trim();
  if (!endpointValue || !token || token.length < 32) {
    throw new Error("Configuration Google Apps Script email indisponible.");
  }

  let endpoint;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("URL Google Apps Script invalide.");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== "script.google.com" ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("URL Google Apps Script invalide.");
  }

  const normalizedMessage = validateMessage(message);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, message: normalizedMessage }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw new Error("Google Apps Script n’a pas confirmé l’envoi email.");
  }
  return { sent: true };
}

module.exports = { sendEmailViaGoogleAppsScript };
