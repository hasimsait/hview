import { IPlanManagerService, IPlanPersistenceService } from '@core/types/services';
import { PlanDocument } from '@core/types/plan';
import { isStandalonePlanSource } from './PlanRequest';

export async function restoreInitialPlan(manager: IPlanManagerService, persistence: IPlanPersistenceService): Promise<PlanDocument> {
  const existing = manager.getPlan();
  if (existing) return existing;
  try {
    const json = await persistence.loadPlan();
    // An import or another initialization may have finished while loading.
    const current = manager.getPlan();
    return current || manager.loadPlan(json);
  } catch (err) {
    const current = manager.getPlan();
    if (current) return current;
    // An offline file must never silently become the host's sample plan.
    if (isStandalonePlanSource()) throw err;
    console.warn('[PlanBootstrap] Falling back to the server plan:', err);
    return manager.loadPlanFromUrl(`/sample.plan?t=${Date.now()}`);
  }
}
