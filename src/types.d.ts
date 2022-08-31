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

declare module '@tarik02/vdom-to-html' {
  import { VNode, VText } from 'virtual-dom';

  function vdomToHtml(vdom: VNode | VText, parent?: { tagName: 'script' | 'style' }): string;

  export = vdomToHtml;
}

declare module '@tarik02/vdom-serialized-patch/serialize' {
  import { VNode, VText, VPatch } from 'virtual-dom';

  function serialize(vdom: VPatch | VPatch[]): any;
  export = serialize;
}

declare module '@tarik02/vdom-serialized-patch/patch' {
  import { VPatch } from 'virtual-dom';

  function applyPatch(node: Element, patch: any): VPatch | VPatch[];
  export = applyPatch;
}
