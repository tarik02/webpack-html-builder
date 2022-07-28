import * as QS from 'qs';

export const createClientScript = (params: Record<string, string>, script = 'client') => {
  return `<script src="webpack-html-builder/${ script }.js${QS.stringify(params, {
    addQueryPrefix: true,
  })}"></script>`;
};
