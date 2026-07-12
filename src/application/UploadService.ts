import type { Upload, UploadOwnerType, UploadRole } from "../domain/entities/Upload.js";
import type { AttachUploadInput, IUploadRepository } from "../ports/IUploadRepository.js";
import { AppError } from "../shared/errors/AppError.js";

export class UploadService {
  public constructor(private readonly uploads: IUploadRepository) {}

  public async attach(input: AttachUploadInput): Promise<Upload> {
    if (!input.fileId.trim()) {
      throw new AppError("Не удалось получить file_id фото.");
    }

    return this.uploads.create({
      ...input,
      role: input.role ?? null,
      fileUniqueId: input.fileUniqueId ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      fileSize: input.fileSize ?? null,
      position: input.position ?? 0,
    });
  }

  /**
   * Для слова держим одну обложку: старую cover заменяем.
   */
  public async attachWordCover(input: Omit<AttachUploadInput, "ownerType" | "role" | "kind">): Promise<Upload> {
    await this.uploads.deleteByRole("word", input.ownerId, "cover");
    return this.attach({
      ...input,
      ownerType: "word",
      kind: "photo",
      role: "cover",
      position: 0,
    });
  }

  public async listFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload[]> {
    return this.uploads.listFor(ownerType, ownerId);
  }

  public async coverFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload | null> {
    return this.uploads.coverFor(ownerType, ownerId);
  }

  public async remove(uploadId: string, uploadedBy: number): Promise<void> {
    const upload = await this.uploads.findById(uploadId);
    if (!upload) {
      throw new AppError("Файл не найден.");
    }
    if (upload.uploadedBy !== uploadedBy) {
      throw new AppError("Нельзя удалить чужой файл.");
    }
    await this.uploads.delete(uploadId);
  }

  public async removeCover(ownerType: UploadOwnerType, ownerId: string, role: UploadRole = "cover"): Promise<void> {
    await this.uploads.deleteByRole(ownerType, ownerId, role);
  }

  public async removeAllFor(ownerType: UploadOwnerType, ownerId: string): Promise<void> {
    await this.uploads.deleteAllFor(ownerType, ownerId);
  }
}
