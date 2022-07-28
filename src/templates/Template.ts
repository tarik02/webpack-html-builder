
import * as htmlToVdom from 'html-to-vdom';
import vdomToHtml = require('vdom-to-html');
import vdomToJson = require('vdom-as-json/toJson');
import { h, diff, VNode, VPatch } from 'virtual-dom';
import isVNode = require('virtual-dom/vnode/is-vnode');
import * as VNodeConstructor from 'virtual-dom/vnode/vnode';
import * as VTextConstructor from 'virtual-dom/vnode/vtext';


export type VirtualDocument = {
  head: VNode;
  body: VNode;
};

export type DocumentData = string;

export type PatchData = {
  head: VPatch[];
  body: VPatch[];
};

export type TemplateListener = (document: DocumentData, patch: PatchData | null) => void;

const parseDocument = (content: string): [DocumentData, VirtualDocument] => {
  const $root = htmlToVdom({
    VNode: VNodeConstructor,
    VText: VTextConstructor,
  })(`<root>${ content }</root>`);

  const $html = (
    $root.children?.find(el => isVNode(el) && el.tagName.toLowerCase() === 'html') ?? $root
  ) as VNode;

  const newDocument = {
    head: (
      $html.children?.find(el => isVNode(el) && el.tagName.toLowerCase() === 'head')
        ?? h('head', [' '])
    ) as VNode,
    body: ($html.children?.find(el => isVNode(el) && el.tagName.toLowerCase() === 'body') ?? (
      $html.children?.find(el => isVNode(el) && el.tagName.toLowerCase() === 'head') ?
        h('body', [' ']) :
        h('body', $html.children)
    )) as VNode,
  };

  const data = `<!doctype html>${ vdomToHtml($html) }`;

  newDocument.head.children = newDocument.head.children.filter(el => !isVNode(el) || el.tagName.toLowerCase() !== 'script');
  newDocument.body.children = newDocument.body.children.filter(el => !isVNode(el) || el.tagName.toLowerCase() !== 'script');

  return [data, newDocument];
};

export class Template {
  protected currentDocument: VirtualDocument;
  protected currentDocumentData: DocumentData;
  protected listeners = new Set<TemplateListener>();

  constructor(content: string) {
    [this.currentDocumentData, this.currentDocument] = parseDocument(content);
  }

  get content() {
    return this.currentDocumentData;
  }

  listen(callback: TemplateListener, initial: boolean = false): () => void {
    this.listeners.add(callback);

    if (initial && this.currentDocumentData !== undefined) {
      Promise.resolve(this.currentDocumentData)
        .then(data => callback(data, null))
        .catch(console.error);
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  apply(content: string): PatchData {
    const oldDocument = this.currentDocument;

    [this.currentDocumentData, this.currentDocument] = parseDocument(content);

    const patch = {
      head: vdomToJson(diff(oldDocument.head, this.currentDocument.head)),
      body: vdomToJson(diff(oldDocument.body, this.currentDocument.body)),
    };

    return patch;
  }
}
