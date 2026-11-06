export type SavedExplanation = {
  explanation: string;
  continuesNextPage: boolean;
};

export type AudioHistoryDocument = {
  id: string;
  name: string;
  size: number;
  fingerprint: string;
  pageCount: number;
  pdfData: ArrayBuffer;
  explanations: Record<string, SavedExplanation>;
  updatedAt: number;
};

const databaseName = "learning-platform-audio-history";
const storeName = "documents";

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Audio history could not be read."));
  });
}

function openDatabase(studentId: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`${databaseName}-${studentId}`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Audio history could not be opened."));
  });
}

export async function listAudioHistory(studentId: string) {
  const database = await openDatabase(studentId);
  try {
    const documents = await requestResult<AudioHistoryDocument[]>(
      database.transaction(storeName, "readonly").objectStore(storeName).getAll(),
    );
    return documents.sort((left, right) => right.updatedAt - left.updatedAt);
  } finally {
    database.close();
  }
}

export async function saveAudioHistoryDocument(
  studentId: string,
  document: AudioHistoryDocument,
) {
  const database = await openDatabase(studentId);
  try {
    await requestResult(
      database.transaction(storeName, "readwrite").objectStore(storeName).put(document),
    );
  } finally {
    database.close();
  }
}

export async function createAudioFingerprint(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
