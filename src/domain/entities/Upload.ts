export type UploadOwnerType = "word" | "deck" | "user";
export type UploadKind = "photo" | "document" | "video";
export type UploadRole = "cover" | "gallery" | "association" | "example";

export class Upload {
  public constructor(
    public readonly id: string,
    public readonly ownerType: UploadOwnerType,
    public readonly ownerId: string,
    public readonly kind: UploadKind,
    public readonly role: UploadRole | null,
    public readonly fileId: string,
    public readonly fileUniqueId: string | null,
    public readonly width: number | null,
    public readonly height: number | null,
    public readonly fileSize: number | null,
    public readonly uploadedBy: number,
    public readonly position: number,
    public readonly createdAt: Date,
  ) {}
}
