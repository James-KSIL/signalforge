export interface ProjectEntity {
  id: string;
  name: string;
  pinned?: boolean;
  createdAt: string;
}

export interface ChatThreadBinding {
  chatThreadId: string;
  projectId: string;
  pinnedAt?: string;
}
