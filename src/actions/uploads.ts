"use server";

import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/actions/workspaces";
import { requireEventAccess, EVENT_ADMINS } from "@/actions/_rbac";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Image storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function validatedImage(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES || !ALLOWED_TYPES.has(file.type)) throw new Error("Upload a JPEG, PNG, or WebP image no larger than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("The uploaded file is not a valid image.");
  return { file, bytes };
}

async function uploadPublicImage(bucket: string, path: string, formData: FormData) {
  const { file, bytes } = await validatedImage(formData);
  const client = storageAdmin();
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType: file.type, cacheControl: "3600", upsert: true });
  if (error) throw new Error("The image could not be stored. Please try again.");
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadProfileAvatarAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to upload an avatar.");
  return uploadPublicImage("avatars", `${user.id}/avatar.jpg`, formData);
}

export async function uploadEventBrandingAssetAction(eventId: string, kind: "logo" | "banner" | "og", formData: FormData) {
  await requireEventAccess(eventId, EVENT_ADMINS, "manage_branding");
  return uploadPublicImage("event-branding", `${eventId}/${kind}.jpg`, formData);
}
