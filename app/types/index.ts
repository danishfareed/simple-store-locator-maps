// Shared cross-cutting types. Feature-specific types stay with the feature.

export type { CloudflareEnv, ImportJobMessage } from "../../workers/app";

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ErrorPayload {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}
