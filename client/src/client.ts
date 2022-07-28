import { patch } from 'virtual-dom';
import vdomFromJson from 'vdom-as-json/fromJson';

const scriptParams = ((params: URLSearchParams) => ({
  template: params.get('template')!,
}))(
  new URL((document.currentScript! as HTMLScriptElement).src).searchParams
);

const base = new URL('..', (document.currentScript! as HTMLScriptElement).src);
const sourceUrl = new URL('webpack-html-builder/__events', base);
sourceUrl.searchParams.set('template', scriptParams.template);
const source = new window.EventSource(sourceUrl);

type PatchData = {
  head: any;
  body: any;
};

type Message =
| { type: 'reload' }
| { type: 'patch', payload: { patch: PatchData } };

source.addEventListener('open', () => {
  console.log('[webpack-html-builder] Connected');
});

source.addEventListener('message', event => {
  if (event.data === '\uD83D\uDC93') {
    return;
  }

  const message = JSON.parse(event.data) as Message;

  switch (message.type) {
    case 'reload':
      console.log('[webpack-html-builder] Reloading page');
      window.location.reload();
      break;

    case 'patch':
      try {
        patch(document.head, vdomFromJson(message.payload.patch.head));
        patch(document.body, vdomFromJson(message.payload.patch.body));
      } catch (e) {
        console.error(e);
        console.log('[webpack-html-builder] Error while patching dom. Reloading');
        window.location.reload();
      }
      break;
  }
});

source.addEventListener('error', () => {
  console.log('[webpack-html-builder] Disconnected');
});
