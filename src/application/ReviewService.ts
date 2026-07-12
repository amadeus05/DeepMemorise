import type { DueReview } from "../ports/IReviewRepository.js";
import type { IReviewRepository } from "../ports/IReviewRepository.js";
import type { IClock } from "../ports/IClock.js";
import type { ReviewGrade } from "../domain/enums/ReviewGrade.js";
import type { SettingsService } from "./SettingsService.js";
import { formatInterval } from "./scheduling/ISchedulerStrategy.js";
import { AppError } from "../shared/errors/AppError.js";

export type GradeResult = {
  nextDue: DueReview | null;
  totalDue: number;
  gradedIntervalMinutes: number;
  gradedDueAt: Date;
  nextReviewHint: string;
};

export class ReviewService {
  public constructor(
    private readonly reviews: IReviewRepository,
    private readonly settings: SettingsService,
    private readonly clock: IClock,
  ) {}

  public async getDue(userId: string, limit = 10): Promise<DueReview[]> {
    return this.reviews.findDue(userId, this.clock.now(), limit);
  }

  public async countDue(userId: string): Promise<number> {
    return this.reviews.countDue(userId, this.clock.now());
  }

  public async getDueCard(cardId: string, userId: string): Promise<DueReview | null> {
    return this.reviews.findDueById(cardId, userId, this.clock.now());
  }

  public async grade(cardId: string, userId: string, grade: ReviewGrade): Promise<GradeResult> {
    const [card, scheduler] = await Promise.all([
      this.reviews.findById(cardId),
      this.settings.getSchedulerForUser(userId),
    ]);
    if (!card || card.userId !== userId) {
      throw new AppError("Карточка не найдена.");
    }

    const next = scheduler.schedule(
      {
        intervalMinutes: card.intervalMinutes,
        easeFactor: card.easeFactor,
        repetitions: card.repetitions,
        lapses: card.lapses,
      },
      grade,
      this.clock.now(),
    );

    await this.reviews.update(cardId, next);

    const [remaining, totalDue] = await Promise.all([
      this.reviews.findDue(userId, this.clock.now(), 1),
      this.reviews.countDue(userId, this.clock.now()),
    ]);

    return {
      nextDue: remaining[0] ?? null,
      totalDue,
      gradedIntervalMinutes: next.intervalMinutes,
      gradedDueAt: next.dueAt,
      nextReviewHint: `Следующий повтор этого слова: через ${formatInterval(next.intervalMinutes)}`,
    };
  }
}
