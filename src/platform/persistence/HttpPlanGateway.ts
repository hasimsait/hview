import { withPlanRequestTimeout } from '../../services/plan/PlanRequest';
import { validateDocumentJson } from './JsonDocument';

export class HttpPlanGateway {
  async save(json: string): Promise<void> {
    const result = await withPlanRequestTimeout(async signal => {
      const response = await fetch('/api/save-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, signal });
      if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      return response.json();
    });
    if (result?.success !== true) throw new Error('Server did not acknowledge saving the plan');
  }
  async load(): Promise<string> {
    return withPlanRequestTimeout(async signal => {
      const response = await fetch(`/sample.plan?t=${Date.now()}`, { cache: 'no-cache', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' }, signal });
      if (!response.ok) throw new Error(`Failed to load plan: HTTP ${response.status}`);
      const json = await response.text(); validateDocumentJson(json); return json;
    });
  }
  async reset(): Promise<string> {
    return withPlanRequestTimeout(async signal => {
      const response = await fetch('/api/reset-plan', { method: 'POST', signal });
      if (!response.ok) throw new Error(`Failed to reset plan: ${response.statusText}`);
      const result = await response.json();
      if (result?.success === false) throw new Error('Server rejected the reset');
      if (typeof result?.plan !== 'string') throw new Error('Reset response is missing its plan');
      validateDocumentJson(result.plan); return result.plan;
    });
  }
}
