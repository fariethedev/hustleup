# S3 Bucket Setup Guide for hustle-up

## What's needed from you

To enable S3 storage, provide these 3 pieces of info:
1. **AWS Access Key ID** (from IAM user)
2. **AWS Secret Access Key** (from IAM user)
3. **AWS Region** (where you created the bucket, e.g. `us-east-1`)

---

## Step 1 – IAM User (if you haven't already)

1. Go to **AWS Console → IAM → Users → Create user**
2. Attach policy: `AmazonS3FullAccess` (or create a scoped policy below)
3. Create **Access Key** → copy the Key ID and Secret

**Minimal scoped policy** (recommended over full access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::hustle-up/*"
    }
  ]
}
```

---

## Step 2 – Bucket Public Access

In **S3 → hustle-up → Permissions**:

1. **Uncheck** "Block all public access" (needed so users can view uploaded images)
2. Add this **Bucket Policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hustle-up/*"
    }
  ]
}
```

---

## Step 3 – CORS Configuration

In **S3 → hustle-up → Permissions → CORS**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## Step 4 – Set environment variables

Copy `backend/.env.example` to `backend/.env` and fill in your credentials:

```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=hustle-up
```

Then start services with:
```powershell
# PowerShell – set env vars before starting
$env:AWS_ACCESS_KEY_ID="your-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret"
$env:AWS_REGION="us-east-1"
$env:AWS_S3_BUCKET="hustle-up"

# Then start each service as normal
```

---

## How it works

- If `AWS_ACCESS_KEY_ID` is set → files upload to **S3**, URLs like:
  `https://hustle-up.s3.us-east-1.amazonaws.com/uploads/uuid.jpg`
- If not set → falls back to **local storage** as before

No code changes needed to switch — just environment variables.

---

## Larger file handling

AWS S3 supports files up to **5GB** via single PUT (which is what we use).
For files larger than 100MB in production, consider enabling **multipart upload** in the S3 client (the backend currently uses single PUT — sufficient for video/image uploads up to ~100MB from mobile).
