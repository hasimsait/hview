import { describe, expect, it } from 'vitest';
import { packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';
import { decodeBase64, encodeBase64 } from '../../src/services/export/BinaryEncoding';

describe('self-contained compressed HTML', () => {
  it('round-trips Unicode, large blocks, and embedded export code without recursive growth', () => {
    const runtime = `const marker = '/* __PLAN_DATA_PLACEHOLDER__ */';\n` + '/* café 家 🏠 */'.repeat(4000);
    const plan = JSON.stringify({ vendor: { arbitrary: 'ö 家 <script> & $&' }, walls: Array(100).fill({ x: 2.5 }) });
    const html = `<script id="editor-runtime" type="application/x-hview-runtime">${runtime}</script>` +
      `<script id="plan-data" type="application/json">${plan}</script><script id="portable-bootstrap">decoder</script>`;
    const packed = packStandaloneHtml(html);
    expect(packed.length).toBeLessThan(html.length / 4);
    expect(standaloneBlockText(packed, 'editor-runtime')).toBe(runtime);
    expect(JSON.parse(standaloneBlockText(packed, 'plan-data'))).toEqual(JSON.parse(plan));
    expect(packStandaloneHtml(packed)).toBe(packed);
    const updated = packStandaloneHtml(setScriptContent(packed, 'plan-data', '{"edited":true}'));
    expect(standaloneBlockText(updated, 'editor-runtime')).toBe(runtime);
    expect(standaloneBlockText(updated, 'plan-data')).toBe('{"edited":true}');
  });

  it('leaves legacy documents usable when no decoder is included', () => {
    const html = '<script id="plan-data" type="application/json">{"legacy":true}</script>';
    expect(packStandaloneHtml(html)).toBe(html);
  });

  it('encodes binary without argument limits or byte corruption', () => {
    const bytes = Uint8Array.from({ length: 300_001 }, (_, index) => index % 256);
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
  });
});
