import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

@Injectable()
export class LocalObjectStorageService {
  private readonly root: string;
  private readonly driver: "local" | "s3" | "azure";
  private readonly bucket: string;
  private readonly s3?: S3Client;
  private readonly azure?: ContainerClient;

  constructor(config: ConfigService) {
    this.driver = config.get<"local" | "s3" | "azure">(
      "OBJECT_STORAGE_DRIVER",
      "local",
    );
    this.bucket = config.get<string>(
      "OBJECT_STORAGE_BUCKET",
      "sapling-global-private",
    );
    this.root = resolve(
      config.get<string>("OBJECT_STORAGE_PATH", ".data/objects"),
    );
    if (this.driver === "s3") {
      const accessKeyId = config.get<string>("S3_ACCESS_KEY_ID");
      const secretAccessKey = config.get<string>("S3_SECRET_ACCESS_KEY");
      this.s3 = new S3Client({
        region: config.getOrThrow<string>("S3_REGION"),
        endpoint: config.get<string>("S3_ENDPOINT") || undefined,
        forcePathStyle: config.get<boolean>("S3_FORCE_PATH_STYLE", false),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined,
      });
    }
    if (this.driver === "azure") {
      const connectionString = config.get<string>(
        "AZURE_STORAGE_CONNECTION_STRING",
      );
      const service = connectionString
        ? BlobServiceClient.fromConnectionString(connectionString)
        : new BlobServiceClient(
            config.getOrThrow<string>("AZURE_STORAGE_ACCOUNT_URL"),
            new DefaultAzureCredential(),
          );
      this.azure = service.getContainerClient(this.bucket);
    }
  }

  async put(key: string, contents: Buffer): Promise<void> {
    this.validateKey(key);
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: contents,
          ServerSideEncryption: "AES256",
          IfNoneMatch: "*",
        }),
      );
      return;
    }
    if (this.azure) {
      await this.azure.getBlockBlobClient(key).uploadData(contents, {
        blobHTTPHeaders: { blobContentType: "application/octet-stream" },
        conditions: { ifNoneMatch: "*" },
      });
      return;
    }
    const target = this.resolveSafe(key);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, contents, { flag: "wx" });
  }

  async get(key: string): Promise<Buffer> {
    this.validateKey(key);
    if (this.s3) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) throw new Error("Stored object has no content");
      return Buffer.from(await response.Body.transformToByteArray());
    }
    if (this.azure) {
      return this.azure.getBlockBlobClient(key).downloadToBuffer();
    }
    return readFile(this.resolveSafe(key));
  }

  /** Authenticated downloads use backpressure instead of buffering the entire original. */
  async openStream(key: string): Promise<Readable> {
    this.validateKey(key);
    if (this.s3) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!(response.Body instanceof Readable))
        throw new Error("Stored object has no readable content");
      return response.Body;
    }
    if (this.azure) {
      const response = await this.azure.getBlockBlobClient(key).download();
      if (!(response.readableStreamBody instanceof Readable))
        throw new Error("Stored object has no readable content");
      return response.readableStreamBody;
    }
    const handle = await open(this.resolveSafe(key), "r");
    return handle.createReadStream({
      autoClose: true,
      highWaterMark: 64 * 1024,
    });
  }

  async auditedStream(
    key: string,
    audit: () => Promise<unknown>,
  ): Promise<Readable> {
    const stream = await this.openStream(key);
    // Keep an early provider failure handled until Nest attaches its pipeline listener.
    let failure: Error | undefined;
    stream.on("error", (error: Error) => {
      failure = error;
    });
    try {
      await audit();
      if (failure) throw failure;
      return stream;
    } catch (error) {
      stream.destroy();
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);
    if (this.s3) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return;
    }
    if (this.azure) {
      await this.azure.getBlockBlobClient(key).deleteIfExists();
      return;
    }
    try {
      await unlink(this.resolveSafe(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async probe(): Promise<void> {
    const key = `_health/${randomUUID()}.bin`;
    const expected = Buffer.from(`sapling-storage-health:${randomUUID()}`);
    try {
      await this.put(key, expected);
      const actual = await this.get(key);
      if (!actual.equals(expected))
        throw new Error("Object storage probe mismatch");
    } finally {
      await this.delete(key);
    }
  }

  private validateKey(key: string) {
    if (
      !key ||
      key.startsWith("/") ||
      key.includes("\\") ||
      key.split("/").includes("..")
    ) {
      throw new Error("Invalid object key");
    }
  }

  private resolveSafe(key: string): string {
    this.validateKey(key);
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error("Invalid object key");
    }
    return target;
  }
}
