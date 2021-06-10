<!doctype html>
<!--
Copyright 2020 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
-->
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, minimum-scale=1, initial-scale=1, user-scalable=yes">

    <title>common test</title>

    <script src="../node_modules/@webcomponents/webcomponentsjs/webcomponents-loader.js"></script>
    <script src="../node_modules/web-component-tester/browser.js"></script>
  </head>
  <body>
    <script type="module">
      import {getTrailer} from '../src/main/resources/static/common.js';
      suite('common-test', () => {
        test('getTrailer', () => {
          const commitMsg = 'Commit message\n' +
                      'Trailer-1: foo\n' +
                      'Trailer-2: bar\n';
          const trailer = getTrailer(commitMsg, 'Trailer');
          assert.equal(trailer, '');

          const trailer1 = getTrailer(commitMsg, 'Trailer-1');
          assert.equal(trailer1, 'Trailer-1: foo\n');

          const trailer2 = getTrailer(commitMsg, 'Trailer-2');
          assert.equal(trailer2, 'Trailer-2: bar\n');
        });

        test('getTrailer CAPS= style tags', () => {
          const commitMsg = 'Commit message\n' +
                      'OLD_STYLE=foo\n' +
                      'OLD_STYLE=bar\n';
          const trailer = getTrailer(commitMsg, 'Old-Style');
          assert.equal(trailer, 'Old-Style: foo\nOld-Style: bar\n');
        });

        test('getTrailer trailer with comma', () => {
          const commitMsg =
              'Commit message\n' +
              'Cq-Include-Trybots: chrome/try:win-chrome,mac-chrome';
          const trailer = getTrailer(commitMsg, 'Cq-Include-Trybots');
          assert.equal(
              trailer,
              'Cq-Include-Trybots: chrome/try:win-chrome,mac-chrome\n');
        });

        test('getTrailer repeated trailers', () => {
          const commitMsg =
              'Commit message\n' +
              'Trailer: a,b\n' +
              'Trailer: c\n';
          const trailer = getTrailer(commitMsg, 'Trailer');
          assert.equal(
              trailer,
              'Trailer: a,b\nTrailer: c\n');
        });
      });
    </script>

  </body>
</html>
