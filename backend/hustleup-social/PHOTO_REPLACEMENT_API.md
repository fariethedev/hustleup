# Published post photo replacement

`PUT /api/v1/feed/{postId}/media/{mediaIndex}`

Use the existing bearer token and send `multipart/form-data` with exactly one file
part named `media`. The client crops the image and uploads the resulting file;
there are no crop-coordinate fields. Let the HTTP client set the multipart boundary.

`mediaIndex` is zero-based in the complete `PostDto.media` array, including videos.
Only an existing `IMAGE` slot is replaceable. Legacy posts with only `imageUrl`
have one image at index `0`. Only the stored author can replace a photo, including
on anonymous posts. Reposting another person's post grants no rights to its photos.

The file must have a matching raster image MIME type and extension: JPEG (`jpg` or
`jpeg`), PNG, GIF, WebP, AVIF, HEIC, HEIF, or BMP. SVG and video uploads are rejected.
The existing 500 MiB file and multipart-request ceilings apply.

Success is `200` with the fully decorated, updated `PostDto`. Other media keep
their order and URLs, `imageUrl` follows the first image, and `editedAt` records the
change. Text, identity, timestamps of creation, community/listing links and
engagement are preserved. The feed cache is invalidated.

| Status | Meaning |
| --- | --- |
| 400 | Invalid index, missing/empty/multiple files, unsupported file type, or video target |
| 401 | Authentication required |
| 403 | The caller does not own the post |
| 404 | Post not found |
| 409 | Media changed during upload; reload before retrying |
| 413 | File exceeds the upload limit |

No storage objects are deleted. Storage has no deletion/reference-tracking API;
an old image may be shared by another post or a listing. An upload whose database
update fails may also remain unreferenced until safe orphan cleanup is available.
