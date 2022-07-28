import * as Express from 'express';
import { createClientScript } from '.';
import { PathMapper } from '../path/PathMapper';
import { DevTemplatesManager } from '../templates/DevTemplatesManager';

export class EntryMiddleware {
  constructor(
    protected readonly prefix: string,
    protected readonly templates: DevTemplatesManager,
    protected readonly pathMapper: PathMapper,
  ) {
  }

  handler = (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
    const isIndex = req.path === '/';
    const templateName = isIndex ? 'index' : this.pathMapper.outputToName(req.path.replace(/^\//, ''));
    if (templateName === undefined) {
      return next();
    }

    this.templates.subscribe(templateName)
      .then(([template, unsubscribe]) => {
        if (res.closed) {
          unsubscribe();
          return;
        }

        res.on('close', () => {
          unsubscribe();
        });

        if (template !== undefined) {
          if (isIndex && req.originalUrl !== '/' && !req.originalUrl.endsWith('/')) {
            res.redirect(req.originalUrl + '/');
          } else {
            res.send(`${ template.content }${ createClientScript({ template: templateName }) }`);
          }
        } else if (isIndex) {
          next();
        } else {
          res.status(404).send();
        }
      })
      .catch(error => {
        res.status(500).send(error.toString());
      });
  }
}
