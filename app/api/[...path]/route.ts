import { Readable, Writable } from 'node:stream';
import type { IncomingHttpHeaders } from 'node:http';
import { api } from '../../../lib/shared';

const MAX_BODY_BYTES = 2_000_000;

class CapturedResponse extends Writable {
  statusCode = 200;
  headersSent = false;
  readonly headers = new Headers();
  private readonly chunks: Buffer[] = [];

  writeHead(statusCode: number, headers: Record<string, string | number> = {}) {
    this.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) {
      this.headers.set(name, String(value));
    }
    this.headersSent = true;
    return this;
  }

  setHeader(name: string, value: string | number) {
    this.headers.set(name, String(value));
    return this;
  }

  get body() {
    return Buffer.concat(this.chunks);
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    this.headersSent = true;
    callback();
  }
}

async function readBody(request: Request): Promise<Buffer | Response> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ message: 'Requête trop volumineuse.' }, { status: 413 });
  }

  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return Response.json({ message: 'Requête trop volumineuse.' }, { status: 413 });
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function dispatch(request: Request) {
  const body = await readBody(request);
  if (body instanceof Response) return body;

  const requestHeaders: IncomingHttpHeaders = {};
  request.headers.forEach((value, name) => {
    requestHeaders[name] = value;
  });

  const nodeRequest = Readable.from(body.length ? [body] : []) as Readable & {
    method: string;
    url: string;
    headers: IncomingHttpHeaders;
  };
  const url = new URL(request.url);
  nodeRequest.method = request.method;
  nodeRequest.url = `${url.pathname}${url.search}`;
  nodeRequest.headers = requestHeaders;

  const nodeResponse = new CapturedResponse();
  try {
    await api(nodeRequest, nodeResponse, url);
    await new Promise<void>((resolve, reject) => {
      if (nodeResponse.writableFinished) return resolve();
      nodeResponse.once('finish', resolve);
      nodeResponse.once('error', reject);
    });
  } catch (error) {
    console.error('API handler failure:', error instanceof Error ? error.name : 'UnknownError');
    if (!nodeResponse.headersSent) {
      nodeResponse.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      nodeResponse.end(JSON.stringify({ message: 'Erreur serveur.' }));
      await new Promise<void>((resolve) => nodeResponse.once('finish', resolve));
    }
  }

  const responseBody = [204, 304].includes(nodeResponse.statusCode) ? null : nodeResponse.body;
  return new Response(responseBody, {
    status: nodeResponse.statusCode,
    headers: nodeResponse.headers
  });
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
