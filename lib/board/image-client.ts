"use client";
import type { BoardImage } from "./types";
import { boardRequest } from "./client";
export async function sendBoardImage(postId: string | number, imageId: string, file: File): Promise<BoardImage> {
  try {
    const response = await fetch(`/api/board/posts/${postId}/images`, { method: "POST", body: file, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": file.type, "Idempotency-Key": imageId } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "사진을 저장하지 못했습니다.");
    if (result.id !== imageId) throw new Error("사진 저장 상태를 확인하지 못했습니다.");
    return result;
  } catch (error) {
    // Lost HTTP ACK: inspect the persisted ready image before allowing retry.
    const images = await boardRequest<BoardImage[]>(`/api/board/posts/${postId}/images`).catch(() => []);
    const saved = images.find(image => image.id === imageId);
    if (saved) return saved;
    throw error;
  }
}
