import * as Path from 'path';
import * as FS from 'fs';
import * as Express from 'express';
import { PathMapper } from '../path/PathMapper';
import { createClientScript } from '.';

export class IndexMiddleware {
  constructor(
    protected readonly fs: typeof FS,
    protected readonly directory: string,
    protected readonly pathMapper: PathMapper,
  ) {
  }

  handler = (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    if (req.url !== '/') {
      return next();
    }

    if (req.originalUrl !== '/' && !req.originalUrl.endsWith('/')) {
      return res.redirect(req.originalUrl + '/');
    }

    const rootDirectory = Path.resolve(
      this.directory,
      '.' + Path.normalize('/' + req.path)
    );

    this.fs.readdir(rootDirectory, (err, files) => {
      if (err) {
        next();
        return;
      }

      const availableTemplates = files
        .map(file => this.pathMapper.inputToName(file))
        .filter((name): name is string => name !== undefined)
        .map(name => ({
          name: name,
          file: this.pathMapper.nameToOutput(name),
        }));

      const props = { availableTemplates };

      res.send(`
<!doctype html>
<html>
<head></head>
<body>
<script>window.__preload = ${JSON.stringify(props)}</script>
${createClientScript({}, 'index')}
</body>
</html>
`);
    });
  }
}
