/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {assert} from '@open-wc/testing';

import {getGerritHost, getTrailer} from './common';

suite('common-test', () => {
  test('getGerritHost', () => {
    const hosts = [
      'canary-foo-bar-review.googlesource.com',
      'foo-bar-review.googlesource.com',
      'canary-foo-bar-review.git.corp.google.com',
      'foo-bar-review.git.corp.google.com',
    ];

    for (const host of hosts) {
      assert.equal(getGerritHost(host), 'foo-bar');
    }

    assert.equal(getGerritHost('not-a-valid-host'), '');
  });

  test('getTrailer', () => {
    const commitMsg =
      'Commit message\n' + 'Trailer-1: foo\n' + 'Trailer-2: bar\n';
    const trailer = getTrailer(commitMsg, 'Trailer');
    assert.equal(trailer, '');

    const trailer1 = getTrailer(commitMsg, 'Trailer-1');
    assert.equal(trailer1, 'Trailer-1: foo\n');

    const trailer2 = getTrailer(commitMsg, 'Trailer-2');
    assert.equal(trailer2, 'Trailer-2: bar\n');
  });

  test('getTrailer CAPS= style tags', () => {
    let commitMsg = 'Message\n' + 'Old-Style= foo\n' + 'OLD_STYLE=bar\n';
    assert.equal(
      getTrailer(commitMsg, 'Old-Style', false),
      'OLD_STYLE=foo\nOLD_STYLE=bar\n'
    );

    commitMsg = 'Message\n' + 'BUG= b:123,b:456\n' + 'TEST=CQ passes\n';
    assert.equal(getTrailer(commitMsg, 'Bug', false), 'BUG=b:123,b:456\n');
    assert.equal(getTrailer(commitMsg, 'Test', false), 'TEST=CQ passes\n');
  });

  test('getTrailer CAPS= style tags normalized', () => {
    let commitMsg = 'Message\n' + 'Old-Style= foo\n' + 'OLD_STYLE=bar\n';
    assert.equal(
      getTrailer(commitMsg, 'Old-Style', true),
      'Old-Style: foo\nOld-Style: bar\n'
    );

    commitMsg = 'Message\n' + 'BUG= b:123,b:456\n' + 'TEST=CQ passes\n';
    assert.equal(getTrailer(commitMsg, 'Bug', true), 'Bug: b:123,b:456\n');
    assert.equal(getTrailer(commitMsg, 'Test', true), 'Test: CQ passes\n');
  });

  test('getTrailer trailer with comma', () => {
    const commitMsg =
      'Commit message\n' +
      'Cq-Include-Trybots: chrome/try:win-chrome,mac-chrome';
    const trailer = getTrailer(commitMsg, 'Cq-Include-Trybots');
    assert.equal(
      trailer,
      'Cq-Include-Trybots: chrome/try:win-chrome,mac-chrome\n'
    );
  });

  test('getTrailer repeated trailers', () => {
    const commitMsg = 'Commit message\n' + 'Trailer: a,b\n' + 'Trailer: c\n';
    const trailer = getTrailer(commitMsg, 'Trailer');
    assert.equal(trailer, 'Trailer: a,b\nTrailer: c\n');
  });
});
