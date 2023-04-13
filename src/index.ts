import * as Express from 'express';
import { glob } from 'glob';
import * as Path from 'path';
import * as Webpack from 'webpack';
import { DefaultPathMapper } from './path/DefaultPathMapper';
import { EntryMiddleware } from './middleware/EntryMiddleware';
import { EventsMiddleware } from './middleware/EventsMiddleware';
import { isPathMapper, PathMapper } from './path/PathMapper';
import { injectDevServerMiddlewareSetup } from './quirks/injectDevServerMiddlewareSetup';
import { DevTemplatesManager } from './templates/DevTemplatesManager';
import { executeNestedCompiler } from './quirks/executeNestedCompiler';
import { IndexMiddleware } from './middleware/IndexMiddleware';
import { RedirectMiddleware } from './middleware/RedirectMiddleware';
import { CompilerLock } from './lock';

const PLUGIN_NAME = 'LazyHtmlPlugin';

type Options = {
  publicPath: string;
  context: string;
  inputGlob?: string | undefined;
  forceAll?: boolean | undefined;
  pathMapper?: (
    | undefined
    | Partial<{
      inputLoader: string;
      inputSuffix: string;
      outputSuffix: string;
    }>
    | PathMapper
  );
};

type OptionsNormalized = {
  publicPath: string;
  context: string;
  inputGlob: string;
  forceAll: boolean;
};

class LazyHtmlPlugin {
  protected options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  apply(compiler: Webpack.Compiler): void {
    const options: OptionsNormalized = {
      publicPath: this.options.publicPath.replace(/(^[\\\/]*|[\\\/]*$)/g, ''),
      context: Path.isAbsolute(this.options.context)
        ? this.options.context
        : Path.join(compiler.context, this.options.context),
      inputGlob: this.options.inputGlob ?? '*',
      forceAll: this.options.forceAll ?? false,
    };

    const pathMapper = isPathMapper(this.options.pathMapper) ?
      this.options.pathMapper :
      new DefaultPathMapper(
        this.options.pathMapper?.inputLoader,
        this.options.pathMapper?.inputSuffix ?? '.html',
        this.options.pathMapper?.outputSuffix ?? '.html',
      );

    let devTemplatesManager: DevTemplatesManager | undefined;

    const lock = new CompilerLock();

    injectDevServerMiddlewareSetup(compiler.options, {
      before: (middlewares, devServer) => {
        if (devTemplatesManager === undefined) {
          devTemplatesManager = new DevTemplatesManager(
            lock,
            () => compiler.watching.invalidate()
          );
        }

        middlewares.unshift(
          {
            path: `/${options.publicPath}/webpack-html-builder/__events`,
            middleware: new EventsMiddleware(devTemplatesManager).handler,
          },
          {
            path: `/${options.publicPath}/webpack-html-builder`,
            middleware: Express.static(
              Path.dirname(require.resolve('webpack-html-builder/client/index.js'))
            ),
          },
          {
            path: `/${options.publicPath}`,
            middleware: new EntryMiddleware(options.publicPath, devTemplatesManager, pathMapper).handler,
          },
          {
            path: `/${options.publicPath}`,
            middleware: (new IndexMiddleware(compiler.inputFileSystem as any, options.context, pathMapper)).handler,
          },
        );
        return middlewares;
      },
      after: (middlewares, devServer) => {
        middlewares.push({
          path: '/',
          middleware: new RedirectMiddleware(`/${ options.publicPath }`).handler
        });

        return middlewares;
      },
    });

    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async () => {
      if (!lock.isLocked) {
        lock.lock();
      }
      await devTemplatesManager?.update();
    });

    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, async () => {
      lock.lock();
      await devTemplatesManager?.update();
    });

    compiler.hooks.afterDone.tap(PLUGIN_NAME, async stats => {
      const compilation = stats.compilation;

      if (devTemplatesManager !== undefined) {
        for (const error of compilation.errors) {
          const module = error.module;
          if (!(module instanceof Webpack.NormalModule)) {
            continue;
          }
          if (module.context !== options.context) {
            continue;
          }

          const templateName = pathMapper.inputToName(
            Path.relative(options.context, module.resource)
          );

          if (templateName !== undefined) {
            devTemplatesManager.emitError(templateName, error);
          }
        }
      }

      lock.unlock();
      devTemplatesManager?.flush();
    });

    compiler.hooks.emit.tap(PLUGIN_NAME, compilation => {
      if (devTemplatesManager === undefined) {
        return;
      }

      for (const asset of compilation.getAssets()) {
        if (options.publicPath !== '' && !asset.name.startsWith(options.publicPath + '/')) {
          continue;
        }

        const templateName = pathMapper.outputToName(
          Path.relative(options.publicPath || '/', asset.name)
        );

        if (templateName !== undefined) {
          devTemplatesManager.emitTouch(templateName);
        }
      }
    });

    compiler.hooks.assetEmitted.tapPromise(PLUGIN_NAME, async (file, { content }) => {
      if (devTemplatesManager === undefined) {
        return;
      }

      if (options.publicPath !== '' && !file.startsWith(options.publicPath + '/')) {
        return;
      }

      const templateName = pathMapper.outputToName(
        Path.relative(options.publicPath || '/', file)
      );

      if (templateName !== undefined) {
        devTemplatesManager.emitContent(templateName, content.toString('utf-8'));
      }
    });

    compiler.hooks.make.tapPromise(PLUGIN_NAME, async compilation => {
      let compilationTemplates: string[];

      if (devTemplatesManager !== undefined && !options.forceAll) {
        compilationTemplates = devTemplatesManager.templateNames();
      } else {
        compilationTemplates = (await glob(options.inputGlob, {
          cwd: options.context,
          fs: compiler.inputFileSystem as any,
        }))
          .map(file => pathMapper.inputToName(file))
          .filter((file): file is string => file !== undefined);
      }

      compilation.hooks.processAssets.tap({
        name: PLUGIN_NAME,
        stage: Webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        additionalAssets: true,
      }, () => {
        for (const name of compilationTemplates) {
          compilation.deleteAsset(Path.join(options.publicPath, `${ pathMapper.nameToOutput(name) }.js`));
        }
      });

      await executeNestedCompiler(PLUGIN_NAME, compilation, async childCompiler => {
        for (const name of compilationTemplates) {
          const input = Path.join(options.context, pathMapper.nameToInput(name));
          const exists = await new Promise<boolean>(resolve => {
            childCompiler.inputFileSystem.stat(input, (err, stat) => {
              resolve(!!stat);
            });
          });
          if (!exists) {
            continue;
          }

          const output = Path.join(options.publicPath, pathMapper.nameToOutput(name));
          const publicPath = Path.relative(`./${ Path.dirname(output) }`, '.') + '/';

          (new Webpack.EntryPlugin(
            options.context,
            [
              ['webpack-html-builder/extract-loader', JSON.stringify({
                output,
                publicPath,
              })].join('?'),
              'webpack-html-builder/html-loader',
              `./${ pathMapper.nameToInput(name) }`,
            ].join('!'),
            {
              filename: `${ output }.js`,
              name: output,
            }
          )).apply(childCompiler);
        }
      });
    });

    compiler.hooks.afterCompile.tapPromise(PLUGIN_NAME, async compilation => {
      compilation.contextDependencies.add(options.context);
    });
  }
}

export = LazyHtmlPlugin;
