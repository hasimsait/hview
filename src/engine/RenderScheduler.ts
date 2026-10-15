/** Sleeps between invalidations; schedules continuous frames only during active input. */
export class RenderScheduler {
  private frame: number | null = null;
  private previousTime: number | null = null;
  private disposed = false;
  constructor(private readonly render: (deltaSeconds: number) => void, private readonly active: () => boolean) { }
  readonly invalidate = (): void => {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(time => {
      this.frame = null;
      const delta = this.previousTime === null ? 1 / 60 : Math.min(0.05, (time - this.previousTime) / 1000);
      this.previousTime = time;
      this.render(delta);
      if (this.active()) this.invalidate();
      else this.previousTime = null;
    });
  };
  dispose(): void { this.disposed = true; if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame = null; }
}
