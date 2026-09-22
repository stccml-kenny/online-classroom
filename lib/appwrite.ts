import { Client, Databases, Storage } from 'appwrite';

const client = new Client();

// 預設端點與專案 ID (確保 Vercel 於建置階段 prerender 時不因環境變數未填而拋出例外)
const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://cloud.appwrite.io/v1';

const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
  'online-classroom';

try {
  if (endpoint && typeof endpoint === 'string' && endpoint.trim()) {
    client.setEndpoint(endpoint.trim());
  }
} catch (e) {
  console.warn('Appwrite setEndpoint skipped:', e);
}

try {
  if (projectId && typeof projectId === 'string' && projectId.trim()) {
    client.setProject(projectId.trim());
  }
} catch (e) {
  console.warn('Appwrite setProject skipped:', e);
}

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'classroom_db';
export const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'classroom_storage';
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };
