import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

function buildStorageClient(): Storage {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    });
  }
  // Fallback: application default credentials (works with gcloud auth)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  return new Storage({ projectId: projectId ?? undefined });
}

export const objectStorageClient = buildStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getStorageBucket(): string {
    const bucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (bucket) return bucket;
    // Derive from service account project_id as fallback
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (sa) {
      const { project_id } = JSON.parse(sa) as { project_id: string };
      return `${project_id}.firebasestorage.app`;
    }
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (projectId) return `${projectId}.firebasestorage.app`;
    throw new Error(
      "Cannot determine Firebase Storage bucket. Set FIREBASE_STORAGE_BUCKET env var."
    );
  }

  getPrivateObjectPrefix(): string {
    // PRIVATE_OBJECT_DIR is now treated as just the GCS key prefix within the bucket.
    // If it looks like a full `/bucket/prefix` path, extract the prefix part.
    const raw = process.env.PRIVATE_OBJECT_DIR || "uploads";
    // Strip leading slash and bucket segment if someone kept the old format.
    if (raw.startsWith("/")) {
      const parts = raw.split("/").filter(Boolean);
      return parts.length > 1 ? parts.slice(1).join("/") : parts[0] ?? "uploads";
    }
    return raw;
  }

  /** @deprecated Use getStorageBucket + getPrivateObjectPrefix instead. */
  getPrivateObjectDir(): string {
    // Keep backward-compat for callers that still parse this as "/bucket/prefix".
    return `/${this.getStorageBucket()}/${this.getPrivateObjectPrefix()}`;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
    const bucketName = this.getStorageBucket();
    const prefix = this.getPrivateObjectPrefix();
    const objectId = randomUUID();
    const objectName = `${prefix}/${objectId}`;

    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });

    // Return the canonical object path directly — no need to round-trip through
    // normalizeObjectEntityPath on a signed URL (which is fragile across bucket name formats).
    return { uploadURL, objectPath: `/objects/${objectId}` };
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (typeof rawPath !== "string") {
      return "";
    }

    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    try {
      const url = new URL(rawPath);
      let rawObjectPath = "";

      if (url.hostname === "storage.googleapis.com") {
        rawObjectPath = url.pathname;
      } else if (url.hostname === "firebasestorage.googleapis.com") {
        // Firebase Storage URLs: /v0/b/BUCKET/o/OBJECT_PATH
        const match = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (match) {
          rawObjectPath = `/${match[1]}/${decodeURIComponent(match[2])}`;
        }
      }

      if (!rawObjectPath) {
        return rawPath;
      }

      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }

      if (rawObjectPath.startsWith(objectEntityDir)) {
        const entityId = rawObjectPath.slice(objectEntityDir.length);
        return `/objects/${entityId}`;
      }

      return rawObjectPath;
    } catch {
      return rawPath;
    }
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: method === "PUT" ? "write" : method === "GET" ? "read" : method === "DELETE" ? "delete" : "read",
    expires: Date.now() + ttlSec * 1000,
  });

  return signedUrl;
}
