import type {
  Upload,
  UploadKind,
  UploadOwnerType,
  UploadRole,
} from "../domain/entities/Upload.js";

export type AttachUploadInput = {
  ownerType: UploadOwnerType;
  ownerId: string;
  kind: UploadKind;
  role?: UploadRole | null;
  fileId: string;
  fileUniqueId?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  uploadedBy: number;
  position?: number;
};

export interface IUploadRepository {
  create(input: AttachUploadInput): Promise<Upload>;
  findById(id: string): Promise<Upload | null>;
  listFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload[]>;
  coverFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload | null>;
  delete(id: string): Promise<void>;
  deleteAllFor(ownerType: UploadOwnerType, ownerId: string): Promise<number>;
  deleteByRole(ownerType: UploadOwnerType, ownerId: string, role: UploadRole): Promise<number>;
}
