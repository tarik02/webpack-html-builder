import * as Express from 'express';
import { DevTemplatesManager } from '../templates/DevTemplatesManager';

export class EventsMiddleware {
  constructor(protected templates: DevTemplatesManager) {
  }

  handler = (req: Express.Request, res: Express.Response) => {
    const templateName = req.query.template as string;

    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/event-stream;charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // While behind nginx, event stream should not be buffered:
      // http://nginx.org/docs/http/ngx_http_proxy_module.html#proxy_buffering
      'X-Accel-Buffering': 'no',
    };

    const isHttp1 = !(parseInt(req.httpVersion) >= 2);
    if (isHttp1) {
      req.socket.setKeepAlive(true);
      headers.Connection = 'keep-alive';
    }

    res.writeHead(200, headers);
    res.write('\n');

    const heartbeatInterval = setInterval(() => {
      res.write('data: \uD83D\uDC93\n\n');
    }, 10 * 1000);

    const send = (type: string, payload?: any) => res.write(`data: ${ JSON.stringify({ type, payload }) }\n\n`);

    this.templates.subscribe(
      templateName,
      {
        create: () => {
          send('reload');
        },
        patch: patch => {
          send('patch', { patch });
        },
        error: error => {
          send('error', {
            message: error.message,
          });
        },
        remove: () => {
          send('reload');
        }
      },
    )
      .then(([, unsubscribe]) => {
        if (res.closed) {
          unsubscribe();
          return;
        }

        res.on('close', unsubscribe);
      })
      .catch(() => {
        res.send();
      });

    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  }
}
