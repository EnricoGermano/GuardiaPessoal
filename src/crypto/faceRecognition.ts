import { NativeModules } from 'react-native';

export type FaceAnalysisStatus =
  | 'ok'
  | 'no_face'
  | 'multiple_faces'
  | 'bad_angle'
  | 'eyes_closed'
  | 'too_far'
  | 'error';

export interface FaceAnalysisResult {
  status: FaceAnalysisStatus;
  message?: string;
  embedding?: number[];
  leftEyeOpen?: number;
  rightEyeOpen?: number;
  smiling?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
}

interface NativeFaceRecognitionModule {
  analyzeFace(imageUri: string): Promise<FaceAnalysisResult>;
}

const NativeFaceRecognition: NativeFaceRecognitionModule | undefined =
  NativeModules.FaceRecognition;

export const FACE_MATCH_THRESHOLD = 0.62;

export function isNativeFaceModuleAvailable(): boolean {
  return !!NativeFaceRecognition && typeof NativeFaceRecognition.analyzeFace === 'function';
}

export async function analyzeFaceImage(imageUri: string): Promise<FaceAnalysisResult> {
  if (!NativeFaceRecognition || typeof NativeFaceRecognition.analyzeFace !== 'function') {
    return {
      status: 'error',
      message: 'Módulo nativo de reconhecimento facial indisponível.',
    };
  }
  return NativeFaceRecognition.analyzeFace(imageUri);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 1e-12) return -1;
  return dot / denom;
}

export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  const avg = new Array<number>(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
    sumSq += avg[i] * avg[i];
  }
  const norm = Math.sqrt(Math.max(sumSq, 1e-12));
  for (let i = 0; i < dim; i++) {
    avg[i] /= norm;
  }
  return avg;
}

export function verifyFaceEmbedding(
  liveEmbedding: number[],
  enrolledTemplates: number[][],
  threshold = FACE_MATCH_THRESHOLD
): { matched: boolean; bestScore: number } {
  if (!enrolledTemplates || enrolledTemplates.length === 0) {
    return { matched: false, bestScore: -1 };
  }

  let bestScore = -1;
  for (const tpl of enrolledTemplates) {
    const score = cosineSimilarity(liveEmbedding, tpl);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  if (enrolledTemplates.length > 1) {
    const centroid = averageEmbeddings(enrolledTemplates);
    const centroidScore = cosineSimilarity(liveEmbedding, centroid);
    if (centroidScore > bestScore) {
      bestScore = centroidScore;
    }
  }

  return {
    matched: bestScore >= threshold,
    bestScore,
  };
}
