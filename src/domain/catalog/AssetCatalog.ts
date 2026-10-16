import { immutable } from '../model/Immutable';
import type { AssetDefinition,FurnitureBehavior } from './AssetDefinition';
import { ASSET_RECIPES,type AssetRecipeId } from './AssetRecipes';
import { DEFAULT_ASSETS } from './DefaultAssets';

export class AssetCatalog {
  private readonly definitions = new Map<string, AssetDefinition>();
  private readonly aliases = new Map<string, string>();
  private readonly recipes = new Map<string, AssetRecipeId>();
  private readonly behaviors = new Map<string, FurnitureBehavior>();

  constructor(definitions: readonly AssetDefinition[] = DEFAULT_ASSETS) {
    for (const definition of definitions) this.register(definition);
    for (const recipe of ASSET_RECIPES) {
      const candidates: readonly string[] = [recipe.id, ...recipe.aliases];
      let canonical = candidates.find(key => this.definitions.has(key));
      canonical ??= [...this.definitions.values()].find(definition => definition.recipe === recipe.id)?.key;
      if (!canonical) {
        canonical = recipe.id;
        this.register({
          key: canonical, name: canonical.replace(/_/g, ' '), category: 'decor',
          defaultDimensions: { x: 0.6, y: 0.6, z: 0.6 },
          capabilities: recipe.behavior === 'luminaire' ? { lighting: {} } : undefined
        });
      }
      for (const key of candidates) {
        const actual = this.definitions.has(key) ? key : this.aliases.get(key) ?? canonical;
        if (!this.definitions.has(key)) this.aliases.set(key, actual);
        this.recipes.set(actual, recipe.id);
        this.behaviors.set(actual, recipe.behavior);
      }
    }
  }

  register(definition: AssetDefinition): void {
    this.definitions.set(definition.key, immutable(definition));
    if (definition.recipe) {
      this.recipes.set(definition.key, definition.recipe);
      this.behaviors.set(definition.key, ASSET_RECIPES.find(recipe => recipe.id === definition.recipe)?.behavior ?? 'standard');
    }
    for (const alias of definition.aliases ?? []) this.aliases.set(alias.toLowerCase(), definition.key);
  }

  get(key: string): AssetDefinition | undefined { return this.definitions.get(key); }
  all(): readonly AssetDefinition[] { return [...this.definitions.values()]; }
  canonicalKey(key: string): string {
    const clean = key.toLowerCase().trim();
    if (this.definitions.has(clean)) return clean;
    const alias = this.aliases.get(clean); if (alias) return alias;
    // Older imported catalogues used a source prefix plus this stable numeric reference.
    const reference = clean.match(/^[a-z]+_([0-9]+)$/)?.[1];
    const product = `popular_${reference}`;
    return reference && this.definitions.has(product) ? product : clean;
  }

  /** Historical fuzzy names are interpreted only by the legacy import adapter. */
  resolveLegacyName(name: string): string {
    const clean = name.toLowerCase().trim();
    const exact = this.canonicalKey(clean);
    if (this.definitions.has(exact)) return exact;
    return [...this.aliases].sort((a, b) => b[0].length - a[0].length)
      .find(([alias]) => clean.includes(alias))?.[1] ?? clean;
  }

  behavior(key: string): FurnitureBehavior {
    const definition = this.get(this.canonicalKey(key));
    if (definition?.capabilities?.lighting) return 'luminaire';
    return this.behaviors.get(definition?.key ?? key) ?? 'standard';
  }
  recipe(key: string): AssetRecipeId { return this.recipes.get(this.canonicalKey(key)) ?? 'generic_cabinet'; }
}
