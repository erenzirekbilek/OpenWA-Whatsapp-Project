import type { PluginContext } from '../../../core/plugins';

jest.mock('../../../engine/adapters/baileys.adapter', () => ({
  BaileysAdapter: jest.fn().mockImplementation((config: unknown) => ({ config })),
}));

import { BaileysPlugin } from './index';
import { BaileysAdapter } from '../../../engine/adapters/baileys.adapter';

describe('BaileysPlugin.createEngine (opaque config)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads authDir from context.config.baileys and passes neutral per-call fields', () => {
    const plugin = new BaileysPlugin();
    void plugin.onLoad({
      config: { baileys: { authDir: '/data/baileys' } },
      logger: { log: jest.fn() },
    } as unknown as PluginContext);

    plugin.createEngine({ sessionId: 'sess-1', proxyUrl: 'http://p', proxyType: 'http' });

    expect(BaileysAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        authDir: '/data/baileys',
        proxyUrl: 'http://p',
        proxyType: 'http',
      }),
    );
  });

  it('falls back to the default authDir when context has no baileys config', () => {
    const plugin = new BaileysPlugin();
    plugin.createEngine({ sessionId: 'sess-2' });
    expect(BaileysAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-2', authDir: './data/baileys' }),
    );
  });

  it('advertises only the minimal supported feature set', () => {
    expect(new BaileysPlugin().getFeatures()).toEqual(['text-messages', 'typing-indicator']);
  });

  it('reports the baileys library name', () => {
    expect(new BaileysPlugin().getEngineLibrary().name).toBe('@whiskeysockets/baileys');
  });
});
