"use client";

import { useSyncExternalStore } from "react";
import { isParticipant } from "@/data/participants";

const STORAGE_KEY = "project203_selected_user";
const CHANGE_EVENT = "project203:participant-changed";
let memoryName: string | null = null;
let memoryOnly = false;

function readName() {
  if (memoryOnly) return memoryName;
  try {
    const name = window.localStorage.getItem(STORAGE_KEY);
    return isParticipant(name) ? name : null;
  } catch {
    return memoryName;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function selectParticipant(name: string) {
  if (!isParticipant(name)) return false;
  memoryName = name;
  let saved = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
    memoryOnly = false;
  } catch {
    saved = false;
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return saved;
}

export function useSelectedParticipant() {
  return useSyncExternalStore(subscribe, readName, () => null);
}
