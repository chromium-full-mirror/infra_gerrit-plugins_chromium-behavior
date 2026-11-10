/**
 * @license
 * Copyright 2026 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import './test-setup';
import {assert, fixture, html} from '@open-wc/testing';
import sinon from 'sinon';
import {
  DiffLayer,
  GrDiffLine,
  Side,
} from '@gerritcodereview/typescript-api/diff';
import {RestPluginApi} from '@gerritcodereview/typescript-api/rest';
import {AccountDetailInfo} from '@gerritcodereview/typescript-api/rest-api';

import {
  createScreenshotLayer,
  canSeeScreenshots,
  isTranslationScreenshotPreviewHost,
  isTranslationScreenshotFile,
  ReportingEvent,
  screenshotState,
  TranslationScreenshot,
} from './translation-screenshot';

const SHA1_A = '19343abb92b2b947cfd062e5a77d08e14e5df390';
const SHA1_B = '7d04985770eceabd4e1db24236c6421310af7d05';
const PATH = 'chrome/app/settings_strings_grdp/IDS_SETTINGS_SIGNIN.png.sha1';

const url = (sha1: string) =>
  `https://storage.cloud.google.com/chromium-translation-screenshots/${sha1}`;

const $ = (el: HTMLElement, selector: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(selector);

const imageSource = (el: TranslationScreenshot) =>
  el.shadowRoot!.querySelector('img')?.src;

/** Calls the layer like `<gr-diff-row>` does, on a fake text cell. */
function annotate(path: string, text: string) {
  const contentEl = document.createElement('div');
  contentEl.textContent = text;
  annotateCell(createScreenshotLayer(path), contentEl);
  return contentEl;
}

function annotateCell(layer: DiffLayer, contentEl: HTMLElement) {
  // The layer only uses the rendered text.
  const line = {} as GrDiffLine;
  layer.annotate(contentEl, document.createElement('div'), line, Side.RIGHT);
}

function fakeRestApi(account?: Partial<AccountDetailInfo>) {
  return {
    getAccount: sinon.stub().resolves(account as AccountDetailInfo | undefined),
  } as unknown as RestPluginApi & {getAccount: sinon.SinonStub};
}

suite('canSeeScreenshots', () => {
  test('needs the GOOGLER account tag', async () => {
    assert.isFalse(await canSeeScreenshots(undefined));
    assert.isFalse(await canSeeScreenshots(fakeRestApi(undefined)));
    assert.isFalse(await canSeeScreenshots(fakeRestApi({})));
    assert.isFalse(
      await canSeeScreenshots(fakeRestApi({tags: ['SERVICE_USER']}))
    );
    assert.isTrue(await canSeeScreenshots(fakeRestApi({tags: ['GOOGLER']})));
  });
});

test('isTranslationScreenshotFile', () => {
  assert.isTrue(isTranslationScreenshotFile(PATH));
  assert.isTrue(isTranslationScreenshotFile('foo/BAR.PNG.SHA1'));
  assert.isFalse(isTranslationScreenshotFile(PATH.replace('.sha1', '')));
  assert.isFalse(isTranslationScreenshotFile(undefined));
});

suite('isTranslationScreenshotPreviewHost', () => {
  teardown(() => delete window.ENABLED_EXPERIMENTS);

  test('needs a Chromium host and the Mendel experiment', () => {
    assert.isFalse(isTranslationScreenshotPreviewHost('chromium'));
    window.ENABLED_EXPERIMENTS = ['UiFeature__other'];
    assert.isFalse(isTranslationScreenshotPreviewHost('chromium'));
    window.ENABLED_EXPERIMENTS.push('UiFeature__translation_screenshots');
    assert.isTrue(isTranslationScreenshotPreviewHost('chromium'));
    assert.isTrue(isTranslationScreenshotPreviewHost('chrome-internal'));
    assert.isFalse(isTranslationScreenshotPreviewHost('skia'));
    assert.isFalse(isTranslationScreenshotPreviewHost(''));
  });
});

suite('screenshot layer', () => {
  test('adds the screenshot of the hash under the line', () => {
    const cell = annotate(PATH, ` ${SHA1_A.toUpperCase()} `);
    const screenshots = cell.querySelectorAll('translation-screenshot');
    assert.lengthOf(screenshots, 1);
    assert.equal(screenshots[0].sha1, SHA1_A);
    assert.equal(screenshots[0].path, PATH);
    assert.include(cell.textContent, SHA1_A.toUpperCase());
  });

  test('ignores other files and lines without a hash', () => {
    assert.isNull(
      annotate('README.md', SHA1_A).querySelector('translation-screenshot')
    );
    assert.isNull(
      annotate(PATH, 'not a hash').querySelector('translation-screenshot')
    );
  });

  test('annotates a line only once', () => {
    const cell = annotate(PATH, SHA1_A);
    annotateCell(createScreenshotLayer(PATH), cell);
    assert.lengthOf(cell.querySelectorAll('translation-screenshot'), 1);
  });

  test('checks the account once, for the first screenshot', async () => {
    screenshotState.reset();
    const restApi = fakeRestApi({tags: ['GOOGLER']});
    const reportInteraction = sinon.spy();
    screenshotState.restApi = restApi;
    screenshotState.reporting = {reportInteraction, reportLifeCycle() {}};

    annotate('README.md', SHA1_A);
    assert.isFalse(restApi.getAccount.called);
    annotate(PATH, SHA1_A);
    annotate(PATH, SHA1_B);
    await screenshotState.checkAccess();
    assert.isTrue(restApi.getAccount.calledOnce);
    assert.isTrue(screenshotState.canSeeScreenshots());
    assert.deepEqual(reportInteraction.args, [
      [ReportingEvent.ELIGIBILITY, {canSeeScreenshots: true}],
    ]);
    screenshotState.reset();
  });

  test('retries the access check after a transient failure', async () => {
    screenshotState.reset();
    const restApi = fakeRestApi();
    restApi.getAccount.onFirstCall().rejects(new Error('network error'));
    restApi.getAccount.onSecondCall().resolves({tags: ['GOOGLER']});
    const reportInteraction = sinon.spy();
    screenshotState.restApi = restApi;
    screenshotState.reporting = {reportInteraction, reportLifeCycle() {}};

    annotate(PATH, SHA1_A);
    await screenshotState.checkAccess();
    assert.isFalse(screenshotState.canSeeScreenshots());
    assert.isFalse(reportInteraction.called);

    annotate(PATH, SHA1_B);
    await screenshotState.checkAccess();
    assert.isTrue(restApi.getAccount.calledTwice);
    assert.isTrue(screenshotState.canSeeScreenshots());
    assert.deepEqual(reportInteraction.args, [
      [ReportingEvent.ELIGIBILITY, {canSeeScreenshots: true}],
    ]);
    screenshotState.reset();
  });
});

suite('translation-screenshot', () => {
  setup(async () => {
    screenshotState.reset();
    screenshotState.restApi = fakeRestApi({tags: ['GOOGLER']});
    await screenshotState.checkAccess();
  });

  test('stays hidden for users who cannot see screenshots', async () => {
    screenshotState.reset();
    screenshotState.restApi = fakeRestApi({});
    await screenshotState.checkAccess();
    const el = await render(SHA1_A);
    assert.isTrue(el.hidden);
    assert.isNull($(el, 'gr-button.toggle'));
    assert.isUndefined(imageSource(el));
  });

  const render = (sha1: string, path = PATH) =>
    fixture<TranslationScreenshot>(
      html`<translation-screenshot
        .sha1=${sha1}
        .path=${path}
      ></translation-screenshot>`
    );

  async function fireImage(el: TranslationScreenshot, type: 'load' | 'error') {
    el.shadowRoot!.querySelector('img')!.dispatchEvent(new Event(type));
    await el.updateComplete;
  }

  test('shows the screenshot of its hash', async () => {
    const el = await render(SHA1_A);
    assert.equal(imageSource(el), url(SHA1_A));
    assert.include($(el, 'gr-button.toggle')!.textContent, 'Hide screenshot');
  });

  test('stops click propagation to the parent diff cell', async () => {
    const parent = await fixture<HTMLDivElement>(html`
      <div>
        <translation-screenshot
          .sha1=${SHA1_A}
          .path=${PATH}
        ></translation-screenshot>
      </div>
    `);
    const onParentClick = sinon.spy();
    parent.addEventListener('click', onParentClick);
    const el = parent.querySelector('translation-screenshot')!;

    const link = $(el, 'a')!;
    const onLinkClick = sinon.spy((e: Event) => e.preventDefault());
    link.addEventListener('click', onLinkClick);
    $(el, 'img')!.click();
    assert.isTrue(onLinkClick.calledOnce);
    assert.isFalse(onParentClick.called);

    $(el, 'gr-button.toggle')!.click();
    await el.updateComplete;
    assert.isUndefined(imageSource(el));
    assert.isFalse(onParentClick.called);
  });

  test('hides and shows the screenshots of a file together', async () => {
    const before = await render(SHA1_A);
    const after = await render(SHA1_B);
    const other = await render(SHA1_A, 'other.png.sha1');
    $(before, 'gr-button.toggle')!.click();
    await Promise.all([before, after, other].map(el => el.updateComplete));
    assert.isUndefined(imageSource(before));
    assert.isUndefined(imageSource(after));
    assert.include(
      $(after, 'gr-button.toggle')!.textContent,
      'Show screenshot'
    );
    assert.equal(imageSource(other), url(SHA1_A));

    $(after, 'gr-button.toggle')!.click();
    await after.updateComplete;
    assert.equal(imageSource(after), url(SHA1_B));
  });

  test('suggests signing in when no screenshot has loaded yet', async () => {
    const el = await render(SHA1_A);
    await fireImage(el, 'error');
    assert.isUndefined(imageSource(el));
    assert.isNotNull($(el, '.message.sign-in'));
  });

  test('reports deleted screenshots once another one loaded', async () => {
    const loaded = await render(SHA1_A);
    const missing = await render(SHA1_B);
    await fireImage(loaded, 'load');
    await fireImage(missing, 'error');
    assert.isNotNull($(missing, '.message.not-found'));
    assert.isNull($(missing, '.message.sign-in'));
  });

  test('retries when the tab becomes visible, until signed in', async () => {
    const el = await render(SHA1_A);
    await fireImage(el, 'error');
    document.dispatchEvent(new Event('visibilitychange'));
    await el.updateComplete;
    assert.equal(imageSource(el), url(SHA1_A));

    screenshotState.markBucketAccessible();
    await fireImage(el, 'error');
    document.dispatchEvent(new Event('visibilitychange'));
    await el.updateComplete;
    assert.isUndefined(imageSource(el));
  });

  suite('reporting', () => {
    let reportInteraction: sinon.SinonSpy;

    setup(() => {
      reportInteraction = sinon.spy();
      screenshotState.reporting = {reportInteraction, reportLifeCycle() {}};
    });

    test('reports how images settle', async () => {
      const unknown = await render(SHA1_A);
      const loaded = await render(SHA1_A);
      const missing = await render(SHA1_B);
      await fireImage(unknown, 'error');
      await fireImage(loaded, 'load');
      await fireImage(missing, 'error');
      assert.deepEqual(reportInteraction.args, [
        [ReportingEvent.LOADED, {status: 'load-failed'}],
        [ReportingEvent.LOADED, {status: 'loaded'}],
        [ReportingEvent.LOADED, {status: 'not-found'}],
      ]);
    });

    test('reports toggles', async () => {
      const el = await render(SHA1_A);
      $(el, 'gr-button.toggle')!.click();
      await el.updateComplete;
      $(el, 'gr-button.toggle')!.click();
      assert.deepEqual(reportInteraction.args, [
        [ReportingEvent.TOGGLED, {shown: false}],
        [ReportingEvent.TOGGLED, {shown: true}],
      ]);
    });
  });
});
