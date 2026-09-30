import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

function fakeDockerSuccess(stdout = 'container-id\n') {
  return () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(stdout));
      child.emit('close', 0);
    });
    return child;
  };
}

function fakeDockerFailure(exitCode = 1, stderr = 'boom') {
  return () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode);
    });
    return child;
  };
}

describe('quickstart network driver', () => {
  beforeEach(() => {
    vi.mocked(childProcess.spawn).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/rpc')) {
          return new Response(JSON.stringify({ result: { status: 'healthy' } }), { status: 200 });
        }
        return new Response('{"error":{"data":{"invalid_field":"addr"}}}', { status: 400 });
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds the correct docker run command, including --protocol-version when given', async () => {
    const { startQuickstart } = await import('./quickstart.js');
    vi.mocked(childProcess.spawn).mockImplementationOnce(fakeDockerSuccess() as never);

    await startQuickstart({ containerName: 'test-net', hostPort: 8000, protocolVersion: 27 });

    const [, args] = vi.mocked(childProcess.spawn).mock.calls[0]!;
    expect(args).toContain('--local');
    expect(args).toContain('--protocol-version');
    expect((args as string[])[(args as string[]).indexOf('--protocol-version') + 1]).toBe('27');
    expect(args).toContain('--limits');
    expect((args as string[])[(args as string[]).indexOf('--limits') + 1]).toBe('testnet');
    expect(args).toContain('8000:8000');
  });

  it('omits --protocol-version when none is given', async () => {
    const { startQuickstart } = await import('./quickstart.js');
    vi.mocked(childProcess.spawn).mockImplementationOnce(fakeDockerSuccess() as never);

    await startQuickstart({ containerName: 'test-net', hostPort: 8000 });

    const [, args] = vi.mocked(childProcess.spawn).mock.calls[0]!;
    expect(args).not.toContain('--protocol-version');
  });

  it('tears the container down if health checks never pass', async () => {
    const { startQuickstart } = await import('./quickstart.js');
    vi.mocked(childProcess.spawn).mockImplementation(fakeDockerSuccess() as never);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not healthy', { status: 500 })));

    await expect(
      startQuickstart({
        containerName: 'test-net',
        hostPort: 8000,
        healthTimeoutMs: 50,
        healthPollIntervalMs: 10,
      })
    ).rejects.toThrow(/never became healthy/);

    const stopCall = vi.mocked(childProcess.spawn).mock.calls.find((call) => call[1]?.includes('stop'));
    expect(stopCall).toBeDefined();
  }, 10_000);

  it('rejects when the docker command itself fails', async () => {
    const { startQuickstart } = await import('./quickstart.js');
    vi.mocked(childProcess.spawn).mockImplementationOnce(fakeDockerFailure(1, 'no such image') as never);

    await expect(startQuickstart({ containerName: 'test-net', hostPort: 8000 })).rejects.toThrow(
      /no such image/
    );
  });
});
