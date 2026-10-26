/**
 * @license
 * Copyright 2026 The Chromium Authors
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {assert, fixture, html} from '@open-wc/testing';
import '../test-setup';
import {
  IconPreviewButton,
  IconPreviewView,
  diffToFiles,
  isIconPreviewHost,
  resetState,
  state,
  updateState,
} from './icon-preview';
import {iconToSvgs} from './vector-icon';

const ICON =
  'CANVAS_DIMENSIONS, 16,\nMOVE_TO, 2, 2,\nLINE_TO, 14, 2,\nLINE_TO, 8, 14,\nCLOSE';

suite('vector-icon', () => {
  test('converts a simple icon', () => {
    assert.deepEqual(iconToSvgs(ICON), {
      svgs: [
        {
          size: 16,
          svg:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" ' +
            'width="16" height="16"><path d="M2 2L14 2L8 14Z" ' +
            'fill="rgba(95,99,104,1)" fill-rule="evenodd" ' +
            'shape-rendering="geometricPrecision"/></svg>',
        },
      ],
    });
  });

  test('one preview per size', () => {
    const r = iconToSvgs(`${ICON}\nCANVAS_DIMENSIONS, 20,\nCIRCLE, 10, 10, 5`);
    assert.deepEqual('error' in r ? r : r.svgs.map(s => s.size), [16, 20]);
  });

  test('rejects invalid input', () => {
    for (const input of [
      '',
      'FOO, 1, 2',
      'MOVE_TO, 1',
      'MOVE_TO, NaN, 1',
      'MOVE_TO, 1, 1,\n</svg><script>alert(1)</script>',
    ]) {
      assert.isTrue('error' in iconToSvgs(input), input);
    }
  });
});

suite('diffToFiles', () => {
  test('rebuilds both sides', () => {
    const files = diffToFiles({
      meta_a: {},
      meta_b: {},
      content: [{ab: ['x']}, {a: ['old'], b: ['new']}, {ab: ['y']}],
    });
    assert.deepEqual(files, {base: 'x\nold\ny', rev: 'x\nnew\ny'});
  });

  test('added file has no base', () => {
    assert.deepEqual(diffToFiles({meta_b: {}, content: [{b: ['new']}]}), {
      base: null,
      rev: 'new',
    });
  });

  test('not available when lines are skipped', () => {
    assert.isUndefined(
      diffToFiles({meta_a: {}, meta_b: {}, content: [{skip: 100}]}),
    );
  });
});

suite('preview button', () => {
  test('only shown for .icon files with contents, toggles', async () => {
    resetState();
    const el = await fixture<IconPreviewButton>(
      html`<chromium-vector-icon-preview-button></chromium-vector-icon-preview-button>`,
    );
    const button = async () => {
      await el.updateComplete;
      return el.shadowRoot!.querySelector<HTMLElement>('gr-button');
    };
    updateState({path: 'foo.cc', files: {base: ICON, rev: ICON}});
    assert.isNull(await button());
    updateState({path: 'foo.icon', files: undefined});
    assert.isNull(await button());
    updateState({files: {base: ICON, rev: ICON}});
    (await button())!.click();
    assert.isTrue(state.show);
  });
});

suite('preview view', () => {
  let el: IconPreviewView;

  setup(async () => {
    resetState();
    el = await fixture<IconPreviewView>(
      html`<chromium-vector-icon-preview-view></chromium-vector-icon-preview-view>`,
    );
  });

  async function show(base: string | null, rev: string | null) {
    updateState({path: 'a.icon', files: {base, rev}, show: true});
    await el.updateComplete;
  }

  const imgs = () => [...el.shadowRoot!.querySelectorAll('img')];

  test('shows both sides as images and hides the text diff', async () => {
    await show(ICON, ICON);
    assert.isTrue(el.hasAttribute('replace-content'));
    assert.equal(imgs().length, 4);
    assert.isTrue(
      imgs().every(i => i.src.startsWith('data:image/svg+xml;base64,')),
    );
  });

  test('added file shows "No file" for the base', async () => {
    await show(null, ICON);
    assert.include(el.shadowRoot!.textContent!, 'No file');
  });

  test('invalid file shows "Preview unavailable"', async () => {
    await show(null, 'FOO, 1');
    assert.include(el.shadowRoot!.textContent!, 'Preview unavailable');
    assert.equal(imgs().length, 0);
  });

  test('toggling back restores the text diff', async () => {
    await show(ICON, ICON);
    updateState({show: false});
    assert.isFalse(el.hasAttribute('replace-content'));
  });
});

test('only installed on Chromium hosts', () => {
  assert.isTrue(isIconPreviewHost('chromium'));
  assert.isTrue(isIconPreviewHost('chrome-internal'));
  assert.isFalse(isIconPreviewHost('skia'));
  assert.isFalse(isIconPreviewHost(''));
});
