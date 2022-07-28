declare module 'html-loader' {
  import { LoaderDefinitionFunction } from 'webpack';

  const loader: LoaderDefinitionFunction;
  export = loader;
}

declare module 'html-to-vdom' {
  import { VNode } from 'virtual-dom';

  type Options = {
    getVNodeKey?: (attributes: Record<string, any>) => string | number | undefined;
  };

  function convert(html: string): VNode;
  function convert(options: Options, html: string): VNode;

  const initialize: (constructors: {
    VNode: VirtualDOM.VNodeConstructor,
    VText: VirtualDOM.VTextConstructor,
  }) => typeof convert;

  export = initialize;
}

declare module 'vdom-to-html' {
  import { VNode, VText } from 'virtual-dom';

  function vdomToHtml(vdom: VNode | VText, parent?: { tagName: 'script' | 'style' }): string;

  export = vdomToHtml;
}

declare module 'vdom-as-json/toJson' {
  import { VNode, VText, VPatch } from 'virtual-dom';

  function vdomToJson(vdom: VNode | VText | VPatch | VPatch[]): any;
  export = vdomToJson;
}

declare module 'vdom-as-json/fromJson' {
  import { VNode, VText, VPatch } from 'virtual-dom';

  function vdomFromJson(json: any): VNode | VText | VPatch | VPatch[];
  export = vdomFromJson;
}
