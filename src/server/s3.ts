import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.S3_ACCOUNT_ID || "";
const BUCKET_NAME = process.env.S3_BUCKET || "facematch-s3";
const S3_PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || "https://s3.g.s4.mega.io";

// Use base S3 endpoint (not bucket-specific) to avoid double-bucket issue
const s3Client = new S3Client({
  endpoint: "https://s3.g.s4.mega.io",
  region: process.env.S3_REGION || "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: false,
});

export async function uploadImage(
  base64Data: string,
  filename: string
): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Content, "base64");

  let contentType = "image/jpeg";
  if (base64Data.startsWith("data:image/png")) {
    contentType = "image/png";
  } else if (base64Data.startsWith("data:image/webp")) {
    contentType = "image/webp";
  }

  const key = `uploads/${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return `${S3_PUBLIC_ENDPOINT}/${ACCOUNT_ID}/${BUCKET_NAME}/${key}`;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

export async function listS3Objects(
  prefix?: string,
  pageSize: number = 1000
): Promise<S3Object[]> {
  const objects: S3Object[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: pageSize,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          objects.push({
            key: obj.Key,
            size: obj.Size || 0,
            lastModified: obj.LastModified,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

export function getS3Url(key: string): string {
  return `${S3_PUBLIC_ENDPOINT}/${ACCOUNT_ID}/${BUCKET_NAME}/${key}`;
}

export { BUCKET_NAME };
