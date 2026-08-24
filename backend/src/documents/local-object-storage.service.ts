import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

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
      this.s3 = new S3Client({
        region: config.getOrThrow<string>("S3_REGION"),
        endpoint: config.get<string>("S3_ENDPOINT") || undefined,
        forcePathStyle: config.get<boolean>("S3_FORCE_PATH_STYLE", false),
        credentials: {
          accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY_ID"),
          secretAccessKey: config.getOrThrow<string>("S3_SECRET_ACCESS_KEY"),
        },
      });
    }
    if (this.driver === "azure") {
      const service = BlobServiceClient.fromConnectionString(
        config.getOrThrow<string>("AZURE_STORAGE_CONNECTION_STRING"),
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
      await this.azure.createIfNotExists();
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
