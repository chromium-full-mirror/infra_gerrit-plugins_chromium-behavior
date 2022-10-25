/**
 * @license
 * Copyright 2022 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {CorpWarner, CORP_WARNER_ELEMENT} from './corp-warner';
import {assert} from '@open-wc/testing';

suite('corp-warner test', () => {
  let element: CorpWarner;

  setup(() => {
    element = document.createElement(CORP_WARNER_ELEMENT) as CorpWarner;
    Object.assign(element, {
      isDraft: false,
      comment: {
        message: '',
      },
      message: '',
    });
    document.body.appendChild(element);
  });

  teardown(() => {
    document.body.removeChild(element);
  });

  test('no warning without corp link', async () => {
    // Simulate first page load.
    element.isDraft = true;
    element.message = '';
    element.comment.message = 'see chromium.googlesource.com';
    assert.isUndefined(element.render());

    // Simulate typing.
    element.message = 'see chromium.googlesource.com foo';
    element.comment.message = 'see chromium.googlesource.com foo';
    assert.isUndefined(element.render());
  });

  test('warn with corp link', async () => {
    // Simulate first page load.
    element.isDraft = true;
    element.message = '';
    element.comment.message = 'see chromium.git.corp.google.com';
    assert.isNotNull(element.render());

    // Simulate typing.
    element.message = 'see chromium.git.corp.google.com foo';
    element.comment.message = 'see chromium.git.corp.google.com foo';
    assert.isNotNull(element.render());
  });

  test('no warning on published comment', async () => {
    element.isDraft = false;
    element.message = 'see chromium.git.corp.google.com';
    element.comment.message = 'see chromium.git.corp.google.com';
    assert.isUndefined(element.render());

    element.isDraft = true;
    assert.isNotNull(element.render());
  });
});
