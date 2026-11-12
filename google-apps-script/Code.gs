const TOKEN_PROPERTY = 'LAROCHE_APPS_SCRIPT_TOKEN';
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
    if (!expectedToken || !constantTimeEquals(String(request.token || ''), expectedToken)) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    const message = validateMessage(request.message);
    const options = {};
    if (message.htmlBody) options.htmlBody = message.htmlBody;
    if (message.attachments.length) options.attachments = message.attachments;
    GmailApp.sendEmail(message.to, message.subject, message.textBody || ' ', options);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Email delivery failed: ' + (error && error.name ? error.name : 'Error'));
    return jsonResponse({ ok: false, error: 'email_delivery_failed' });
  }
}

function validateMessage(message) {
  if (!message || typeof message !== 'object'
    || typeof message.to !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)
    || message.to.length > 254
    || typeof message.subject !== 'string'
    || !message.subject.trim()
    || message.subject.length > 200
    || (typeof message.textBody !== 'string' && typeof message.htmlBody !== 'string')
    || (message.textBody && message.textBody.length > 100000)
    || (message.htmlBody && message.htmlBody.length > 100000)) {
    throw new Error('invalid_message');
  }

  const suppliedAttachments = message.attachments || [];
  if (!Array.isArray(suppliedAttachments) || suppliedAttachments.length > MAX_ATTACHMENTS) {
    throw new Error('invalid_attachments');
  }

  let totalBytes = 0;
  const attachments = suppliedAttachments.map(function (attachment) {
    if (!attachment || typeof attachment.name !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$/.test(attachment.name)
      || attachment.mimeType !== 'application/pdf'
      || typeof attachment.base64 !== 'string'
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(attachment.base64)) {
      throw new Error('invalid_attachment');
    }
    const bytes = Utilities.base64Decode(attachment.base64);
    totalBytes += bytes.length;
    if (totalBytes > MAX_ATTACHMENT_BYTES) throw new Error('attachment_too_large');
    return Utilities.newBlob(bytes, attachment.mimeType, attachment.name);
  });

  return {
    to: message.to.trim(),
    subject: message.subject.trim(),
    textBody: message.textBody || '',
    htmlBody: message.htmlBody || '',
    attachments: attachments
  };
}

function constantTimeEquals(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
