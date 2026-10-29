"use client";
import { useParticipant } from "./ParticipantProvider";
export function NameSelector() {
  const { participant } = useParticipant();
  return <div className="name-selector"><span className="name-current">{participant.display_name}</span></div>;
}
