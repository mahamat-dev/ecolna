export type Locale = 'fr' | 'en' | 'ar';

export interface PresignResponse {
  fileId: string;
  storageKey: string;
  presigned: { url: string; method: 'POST'; headers: Record<string,string> };
}

export interface FileObject {
  id: string; 
  filename: string; 
  mime: string; 
  sizeBytes: number; 
  status: 'PENDING'|'READY'|'DELETED';
}

export interface NoteTranslation { 
  locale: Locale; 
  title: string; 
  bodyMd?: string | null; 
}

export type AudienceScope = 'ALL'|'ROLE'|'STAGE'|'GRADE_LEVEL'|'CLASS_SECTION'|'SUBJECT'|'STUDENT'|'GUARDIAN';
export type Role = 'ADMIN'|'STAFF'|'TEACHER'|'STUDENT'|'GUARDIAN';

export interface AudienceInput {
  scope: AudienceScope;
  role?: Role;
  stageId?: string;
  gradeLevelId?: string;
  classSectionId?: string;
  subjectId?: string;
  studentProfileId?: string;
  guardianProfileId?: string;
}

export interface CreateNoteInput {
  academicYearId?: string | null;
  termId?: string | null;
  translations: NoteTranslation[];
  attachments: string[]; // fileIds
  audiences: AudienceInput[];
  pinUntil?: string | Date | null;
}

export interface NoteListItem {
  id: string;
  isPublished: boolean;
  publishedAt?: string;
  pinUntil?: string;
  title: string;
  locale: Locale;
}

export interface NoteDetail {
  id: string;
  isPublished: boolean;
  publishedAt?: string;
  pinUntil?: string;
  translation: { locale: Locale; title: string; bodyMd?: string | null } | null;
  attachments: { fileId: string; filename: string; mime: string; sizeBytes: number; url: string }[];
}