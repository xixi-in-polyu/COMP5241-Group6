// Blob stores are created as either public or private, and a client upload has
// to request the same access mode. Vercel rejects the PUT with "Cannot use
// private access on a public store", which the browser only reports as a CORS
// failure. Default to public; set NEXT_PUBLIC_BLOB_ACCESS=private when the
// store is configured with private access.
export const BLOB_UPLOAD_ACCESS: "public" | "private" =
  process.env.NEXT_PUBLIC_BLOB_ACCESS === "private" ? "private" : "public";
