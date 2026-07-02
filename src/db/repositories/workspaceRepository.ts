import { db, DB_SCHEMA_VERSION } from '@/db/schema';
import type { BinaryAsset, BinaryAssetSnapshot, WorkspaceSnapshot } from '@/domain/entities/types';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Falha ao serializar asset binario.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const [, base64] = dataUrl.split(',', 2);

  if (!base64) {
    throw new Error('Asset binario do backup esta invalido.');
  }

  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function serializeAssets(assets: BinaryAsset[]): Promise<BinaryAssetSnapshot[]> {
  return Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      version: asset.version,
      kind: asset.kind,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size,
      blobDataUrl: await blobToDataUrl(asset.blob)
    }))
  );
}

function deserializeAssets(assets: BinaryAssetSnapshot[]): BinaryAsset[] {
  return assets.map((asset) => ({
    id: asset.id,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    version: asset.version,
    kind: asset.kind,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    size: asset.size,
    blob: dataUrlToBlob(asset.blobDataUrl, asset.mimeType)
  }));
}

export async function exportWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [
    profile,
    experiences,
    educations,
    skills,
    jobs,
    analyses,
    resumes,
    answers,
    searchProfiles,
    searchRuns,
    aiProviders,
    searchProviders,
    logs,
    assets
  ] = await Promise.all([
    db.profile.toCollection().first().then((value) => value ?? null),
    db.experiences.toArray(),
    db.educations.toArray(),
    db.skills.toArray(),
    db.jobs.toArray(),
    db.analyses.toArray(),
    db.resumes.toArray(),
    db.answers.toArray(),
    db.searchProfiles.toArray(),
    db.searchRuns.toArray(),
    db.aiProviders.toArray(),
    db.searchProviders.toArray(),
    db.logs.toArray(),
    db.assets.toArray()
  ]);

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    experiences,
    educations,
    skills,
    jobs,
    analyses,
    resumes,
    answers,
    searchProfiles,
    searchRuns,
    aiProviders,
    searchProviders,
    logs,
    assets: await serializeAssets(assets)
  };
}

export async function resetWorkspace(): Promise<void> {
  await Promise.all([
    db.profile.clear(),
    db.experiences.clear(),
    db.educations.clear(),
    db.skills.clear(),
    db.jobs.clear(),
    db.analyses.clear(),
    db.resumes.clear(),
    db.answers.clear(),
    db.searchProfiles.clear(),
    db.searchRuns.clear(),
    db.aiProviders.clear(),
    db.searchProviders.clear(),
    db.logs.clear(),
    db.assets.clear()
  ]);
}

export async function importWorkspaceSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  if (snapshot.schemaVersion > DB_SCHEMA_VERSION) {
    throw new Error(
      `Este backup usa schema ${snapshot.schemaVersion}, mas o app atual suporta ate ${DB_SCHEMA_VERSION}.`
    );
  }

  await resetWorkspace();

  if (snapshot.profile) {
    await db.profile.put(snapshot.profile);
  }

  await Promise.all([
    snapshot.experiences.length ? db.experiences.bulkPut(snapshot.experiences) : Promise.resolve(),
    snapshot.educations.length ? db.educations.bulkPut(snapshot.educations) : Promise.resolve(),
    snapshot.skills.length ? db.skills.bulkPut(snapshot.skills) : Promise.resolve(),
    snapshot.jobs.length ? db.jobs.bulkPut(snapshot.jobs) : Promise.resolve(),
    snapshot.analyses.length ? db.analyses.bulkPut(snapshot.analyses) : Promise.resolve(),
    snapshot.resumes.length ? db.resumes.bulkPut(snapshot.resumes) : Promise.resolve(),
    snapshot.answers.length ? db.answers.bulkPut(snapshot.answers) : Promise.resolve(),
    snapshot.searchProfiles.length ? db.searchProfiles.bulkPut(snapshot.searchProfiles) : Promise.resolve(),
    snapshot.searchRuns.length ? db.searchRuns.bulkPut(snapshot.searchRuns) : Promise.resolve(),
    snapshot.aiProviders.length ? db.aiProviders.bulkPut(snapshot.aiProviders) : Promise.resolve(),
    snapshot.searchProviders.length ? db.searchProviders.bulkPut(snapshot.searchProviders) : Promise.resolve(),
    snapshot.logs.length ? db.logs.bulkPut(snapshot.logs) : Promise.resolve(),
    snapshot.assets.length ? db.assets.bulkPut(deserializeAssets(snapshot.assets)) : Promise.resolve()
  ]);
}
