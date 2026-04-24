import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { hasFirebaseConfig, storage } from '../firebase-init.js';

function safeFileName(name = 'file') {
  return String(name || 'file')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

function makePath(folder, entityId, file) {
  const stamp = Date.now();
  const fileName = safeFileName(file?.name || 'image');
  return `${folder}/${entityId}/${stamp}-${fileName}`;
}

async function uploadImage(path, file) {
  if (!file) return null;
  if (!hasFirebaseConfig || !storage) {
    return {
      downloadURL: URL.createObjectURL(file),
      storagePath: path,
      contentType: file.type || 'image/jpeg'
    };
  }

  const storageRef = ref(storage, path);
  const metadata = {
    contentType: file.type || 'image/jpeg',
    cacheControl: 'public,max-age=3600'
  };
  const task = uploadBytesResumable(storageRef, file, metadata);
  await new Promise((resolve, reject) => {
    task.on('state_changed', undefined, reject, resolve);
  });
  const downloadURL = await getDownloadURL(task.snapshot.ref);
  return {
    downloadURL,
    storagePath: path,
    contentType: file.type || 'image/jpeg'
  };
}

export async function uploadProfileImage(userId, file) {
  if (!userId) throw new Error('Missing user id for profile upload.');
  return uploadImage(makePath('profiles', userId, file), file);
}

export async function uploadRewardImage(rewardId, file) {
  if (!rewardId) throw new Error('Missing reward id for reward image upload.');
  return uploadImage(makePath('rewards', rewardId, file), file);
}

export async function uploadBannerImage(bannerId, file) {
  if (!bannerId) throw new Error('Missing banner id for banner image upload.');
  return uploadImage(makePath('content_banners', bannerId, file), file);
}

export async function deleteStoragePath(storagePath) {
  if (!storagePath) return { ok: true };
  if (!hasFirebaseConfig || !storage) return { ok: true };
  await deleteObject(ref(storage, storagePath)).catch((error) => {
    if (error?.code === 'storage/object-not-found') return null;
    throw error;
  });
  return { ok: true };
}
