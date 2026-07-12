import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uploads } from "../schema.js";
import {
  Upload,
  type UploadKind,
  type UploadOwnerType,
  type UploadRole,
} from "../../../domain/entities/Upload.js";
import type {
  AttachUploadInput,
  IUploadRepository,
} from "../../../ports/IUploadRepository.js";

export class UploadRepository implements IUploadRepository {
  public constructor(private readonly db: Database) {}

  public async create(input: AttachUploadInput): Promise<Upload> {
    const [row] = await this.db
      .insert(uploads)
      .values({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        kind: input.kind,
        role: input.role ?? null,
        fileId: input.fileId,
        fileUniqueId: input.fileUniqueId ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        fileSize: input.fileSize ?? null,
        uploadedBy: input.uploadedBy,
        position: input.position ?? 0,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create upload");
    }

    return this.map(row);
  }

  public async findById(id: string): Promise<Upload | null> {
    const [row] = await this.db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
    return row ? this.map(row) : null;
  }

  public async listFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload[]> {
    const rows = await this.db
      .select()
      .from(uploads)
      .where(and(eq(uploads.ownerType, ownerType), eq(uploads.ownerId, ownerId)))
      .orderBy(asc(uploads.position), asc(uploads.createdAt));

    return rows.map((row) => this.map(row));
  }

  public async coverFor(ownerType: UploadOwnerType, ownerId: string): Promise<Upload | null> {
    const [byRole] = await this.db
      .select()
      .from(uploads)
      .where(
        and(
          eq(uploads.ownerType, ownerType),
          eq(uploads.ownerId, ownerId),
          eq(uploads.role, "cover"),
        ),
      )
      .orderBy(asc(uploads.position), asc(uploads.createdAt))
      .limit(1);

    if (byRole) {
      return this.map(byRole);
    }

    const [first] = await this.db
      .select()
      .from(uploads)
      .where(and(eq(uploads.ownerType, ownerType), eq(uploads.ownerId, ownerId)))
      .orderBy(asc(uploads.position), asc(uploads.createdAt))
      .limit(1);

    return first ? this.map(first) : null;
  }

  public async delete(id: string): Promise<void> {
    await this.db.delete(uploads).where(eq(uploads.id, id));
  }

  public async deleteAllFor(ownerType: UploadOwnerType, ownerId: string): Promise<number> {
    const deleted = await this.db
      .delete(uploads)
      .where(and(eq(uploads.ownerType, ownerType), eq(uploads.ownerId, ownerId)))
      .returning({ id: uploads.id });

    return deleted.length;
  }

  public async deleteByRole(
    ownerType: UploadOwnerType,
    ownerId: string,
    role: UploadRole,
  ): Promise<number> {
    const deleted = await this.db
      .delete(uploads)
      .where(
        and(
          eq(uploads.ownerType, ownerType),
          eq(uploads.ownerId, ownerId),
          eq(uploads.role, role),
        ),
      )
      .returning({ id: uploads.id });

    return deleted.length;
  }

  private map(row: typeof uploads.$inferSelect): Upload {
    return new Upload(
      row.id,
      row.ownerType as UploadOwnerType,
      row.ownerId,
      row.kind as UploadKind,
      (row.role as UploadRole | null) ?? null,
      row.fileId,
      row.fileUniqueId,
      row.width,
      row.height,
      row.fileSize,
      row.uploadedBy,
      row.position,
      row.createdAt,
    );
  }
}
