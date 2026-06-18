import { spawn } from 'node:child_process';
import path from 'node:path';

type CompileCOptions = {
  compiler?: string;
  outputPath: string;
};

export function getDefaultBinaryOutputPath(inputPath: string): string {
  const parsedPath = path.parse(path.resolve(inputPath));

  return path.join(parsedPath.dir, parsedPath.name);
}

export function getDefaultCOutputPath(inputPath: string): string {
  const parsedPath = path.parse(path.resolve(inputPath));

  return path.join(parsedPath.dir, `${parsedPath.name}.c`);
}

export class CCompilerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CCompilerError';
  }
}

export class CCompiler {
  public async compile(sourceCode: string, options: CompileCOptions): Promise<string> {
    const compiler: string = options.compiler ?? (await this.resolveCompiler());

    await this.runCompiler(compiler, sourceCode, options.outputPath);

    return compiler;
  }

  private async isCompilerAvailable(compiler: string): Promise<boolean> {
    return new Promise<boolean>(function resolveCompilerAvailability(resolve): void {
      const childProcess = spawn(compiler, ['--version'], {
        stdio: 'ignore',
      });

      childProcess.on('error', function handleError(error: NodeJS.ErrnoException): void {
        if (error.code === 'ENOENT') {
          resolve(false);
          return;
        }

        resolve(false);
      });

      childProcess.on('exit', function handleExit(code: number | null): void {
        resolve(code === 0);
      });
    });
  }

  private async resolveCompiler(): Promise<string> {
    for (const compiler of ['clang', 'gcc']) {
      if (await this.isCompilerAvailable(compiler)) {
        return compiler;
      }
    }

    throw new CCompilerError('No supported C compiler was found. Install clang or gcc, or pass --compiler.');
  }

  private async runCompiler(compiler: string, sourceCode: string, outputPath: string): Promise<void> {
    await new Promise<void>((resolve, reject): void => {
      const childProcess = spawn(compiler, ['-x', 'c', '-', '-o', outputPath], {
        stdio: ['pipe', 'inherit', 'pipe'],
      });

      let stderrOutput = '';

      childProcess.on('error', function handleError(error: NodeJS.ErrnoException): void {
        if (error.code === 'ENOENT') {
          reject(new CCompilerError(`The C compiler "${compiler}" could not be found.`));
          return;
        }

        reject(error);
      });

      childProcess.stderr.on('data', function handleStderr(data: Buffer): void {
        stderrOutput += data.toString('utf8');
      });

      childProcess.on('exit', function handleExit(code: number | null): void {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new CCompilerError(
            stderrOutput === '' ? `The C compiler "${compiler}" exited with code ${String(code)}.` : stderrOutput.trim()
          )
        );
      });

      childProcess.stdin.end(sourceCode, 'utf8');
    });
  }
}
