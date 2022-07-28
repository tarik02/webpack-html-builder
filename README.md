# webpack-html-builder

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
