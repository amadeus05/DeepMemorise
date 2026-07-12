import type { Methodology } from "../../domain/enums/Methodology.js";
import { Methodology as MethodologyEnum } from "../../domain/enums/Methodology.js";
import type { ISchedulerStrategy } from "./ISchedulerStrategy.js";
import { EbbinghausScheduler } from "./EbbinghausScheduler.js";
import { Sm2Scheduler } from "./Sm2Scheduler.js";

export class SchedulerRegistry {
  private readonly strategies: Map<string, ISchedulerStrategy>;

  public constructor(
    strategies: ISchedulerStrategy[] = [new Sm2Scheduler(), new EbbinghausScheduler()],
  ) {
    this.strategies = new Map(strategies.map((strategy) => [strategy.id, strategy]));
  }

  public get(methodology: Methodology): ISchedulerStrategy {
    const strategy = this.strategies.get(methodology);
    if (!strategy) {
      return this.getDefault();
    }
    return strategy;
  }

  public getDefault(): ISchedulerStrategy {
    return this.strategies.get(MethodologyEnum.Sm2) ?? new Sm2Scheduler();
  }

  public list(): ISchedulerStrategy[] {
    return [...this.strategies.values()];
  }
}
