# webpack-html-builder

![Check](https://github.com/Tarik02/webpack-html-builder/actions/workflows/check.yml/badge.svg)
![Publish to NPM](https://github.com/Tarik02/webpack-html-builder/actions/workflows/publish-to-npm.yml/badge.svg)
[![npm version](https://badge.fury.io/js/webpack-html-builder.svg)](https://badge.fury.io/js/webpack-html-builder)

## Installation

```bash
yarn add --dev webpack-html-builder
# or
npm install --save-dev webpack-html-builder
```

## Usage

Add this to your webpack config:
```js
import WebpackHtmlBuilder from 'webpack-html-builder';

  // ...

  plugins: [
    new WebpackHtmlBuilder({
      publicPath: 'layouts',
      context: 'layouts',
    }),
  ],

  // ...
```
