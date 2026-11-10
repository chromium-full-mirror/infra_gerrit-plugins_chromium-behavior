/**
 * @license
 * Copyright 2026 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * Shows Chromium translation screenshots under the hash line of their
 * `*.png.sha1` files, which only contain the SHA-1 of an image stored in the
 * `chromium-translation-screenshots` bucket.
 *
 * Uses a diff layer, so it works wherever Gerrit renders a diff (diff view
 * and expanded files in the change view) and keeps the diff and its comments.
 * In side-by-side diffs, the old and new screenshots end up next to each other.
 */

import {DiffDetails} from '@gerritcodereview/typescript-api/annotation';
import {DiffLayer} from '@gerritcodereview/typescript-api/diff';
import {PluginApi} from '@gerritcodereview/typescript-api/plugin';
import {ReportingPluginApi} from '@gerritcodereview/typescript-api/reporting';
import {RestPluginApi} from '@gerritcodereview/typescript-api/rest';
import {css, html, LitElement, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

const BUCKET_URL =
  'https://storage.cloud.google.com/chromium-translation-screenshots/';
const SHA1_REGEX = /\b[0-9a-f]{40}\b/i;
const STATE_CHANGED = 'state-changed';

/** Mendel flag guarding the feature, defined at http://shortn/_VZVufUvQ96. */
export const TRANSLATION_SCREENSHOTS_EXPERIMENT =
  'UiFeature__translation_screenshots';

/** Interaction events, reported to Gerrit's UI metrics. */
export const ReportingEvent = {
  /**
   * Once per page, on the first screenshot: whether the user can see
   * screenshots. Details: `{canSeeScreenshots: boolean}`.
   */
  ELIGIBILITY: 'translation-screenshot-eligibility',
  /** An image settled. Details: `{status: LoadStatus}`. */
  LOADED: 'translation-screenshot-loaded',
  /** The user hid or showed the screenshots of a file. */
  TOGGLED: 'translation-screenshot-toggled',
} as const;

/**
 * How an image settled. `load-failed` happens before any image loaded on the
 * page, so it is either a missing sign-in or a deleted screenshot.
 */
export type LoadStatus = 'loaded' | 'not-found' | 'load-failed';

/** `.png.sha1` translation screenshots are a Chromium-only convention. */
const TRANSLATION_SCREENSHOT_HOSTS: readonly string[] = [
  'chromium',
  'chrome-internal',
];

/** Whether to install the preview: on Chromium hosts, behind the flag. */
export function isTranslationScreenshotPreviewHost(
  gerritHost: string
): boolean {
  return (
    TRANSLATION_SCREENSHOT_HOSTS.includes(gerritHost) &&
    !!window.ENABLED_EXPERIMENTS?.includes(TRANSLATION_SCREENSHOTS_EXPERIMENT)
  );
}

export function isTranslationScreenshotFile(path?: string): boolean {
  return !!path && /\.png\.sha1$/i.test(path);
}

/**
 * Whether the signed-in user can see the bucket.
 *
 * The bucket is restricted to Google employees. On GoB, `/accounts/self/detail`
 * (`restApi.getAccount()`, cached from startup) tags accounts with `'GOOGLER'`
 * across all linked Gaia identities, including `@chromium.org` logins linked to
 * a `@google.com` account.
 */
export async function canSeeScreenshots(
  restApi?: RestPluginApi
): Promise<boolean> {
  return (await restApi?.getAccount())?.tags?.includes('GOOGLER') ?? false;
}

/**
 * Page-wide state shared by all screenshots.
 *
 * Screenshots are shown by default; only the paths where they were hidden are
 * tracked.
 *
 * The bucket is private and sends no CORS headers, so a missing object (404)
 * and a missing sign-in (302 to the login page) both just fire `error` on the
 * `<img>`. Once any screenshot loads, we know that the sign-in works, and
 * later failures mean that the screenshot was deleted.
 *
 * Screenshots are only shown to users who can see the bucket (see
 * `canSeeScreenshots`). That is checked lazily, for the first screenshot of
 * the page.
 */
class ScreenshotState extends EventTarget {
  private readonly hiddenPaths = new Set<string>();

  private bucketAccessible = false;

  /** Undefined until checked. */
  private access?: boolean;

  private accessCheck?: Promise<void>;

  /** Set when the plugin is installed. */
  reporting?: ReportingPluginApi;

  /** Set when the plugin is installed. */
  restApi?: RestPluginApi;

  isShown(path: string) {
    return !this.hiddenPaths.has(path);
  }

  setShown(path: string, shown: boolean) {
    if (shown) {
      this.hiddenPaths.delete(path);
    } else {
      this.hiddenPaths.add(path);
    }
    this.notify();
  }

  isBucketAccessible() {
    return this.bucketAccessible;
  }

  markBucketAccessible() {
    if (this.bucketAccessible) return;
    this.bucketAccessible = true;
    this.notify();
  }

  /** Whether the user can see screenshots; false until checked. */
  canSeeScreenshots() {
    return this.access === true;
  }

  /** Checks once per page whether the user can see screenshots. */
  checkAccess(): Promise<void> {
    if (!this.restApi) return Promise.resolve();
    if (this.accessCheck) return this.accessCheck;
    const check = canSeeScreenshots(this.restApi).then(
      result => {
        // Ignore checks started before a reset.
        if (this.accessCheck !== check) return;
        this.access = result;
        this.reporting?.reportInteraction(ReportingEvent.ELIGIBILITY, {
          canSeeScreenshots: result,
        });
        this.notify();
      },
      () => {
        if (this.accessCheck === check) {
          this.accessCheck = undefined;
        }
      }
    );
    this.accessCheck = check;
    return check;
  }

  /** Visible for testing. */
  reset() {
    this.hiddenPaths.clear();
    this.bucketAccessible = false;
    this.access = undefined;
    this.accessCheck = undefined;
    this.reporting = undefined;
    this.restApi = undefined;
    this.notify();
  }

  private notify() {
    this.dispatchEvent(new Event(STATE_CHANGED));
  }
}

export const screenshotState = new ScreenshotState();

/** The screenshot of one side of a `.png.sha1` diff, under its hash line. */
@customElement('translation-screenshot')
export class TranslationScreenshot extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--font-family);
      padding: var(--spacing-xs) 0 var(--spacing-s);
      user-select: none;
      white-space: normal;
    }
    :host([hidden]) {
      display: none;
    }
    gr-button {
      --gr-button-padding: 0;
      font-size: var(--font-size-small);
    }
    gr-icon {
      font-size: 16px;
      margin-right: var(--spacing-xs);
    }
    img {
      border: 1px solid var(--border-color);
      display: block;
      margin-top: var(--spacing-xs);
      max-height: 400px;
      max-width: 100%;
    }
    .message {
      color: var(--deemphasized-text-color);
      font-size: var(--font-size-small);
      margin-top: var(--spacing-xs);
    }
  `;

  @property({type: String})
  sha1 = '';

  @property({type: String})
  path = '';

  @state()
  private failed = false;

  private readonly onChange = () => this.requestUpdate();

  // Keep clicks from bubbling to `<td class="content">` in `gr-diff-row`,
  // which would select the diff line and rewrite the URL hash.
  private readonly stopClickPropagation = (e: Event) => e.stopPropagation();

  /** Retries after the user comes back, e.g. from signing in. */
  private readonly onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (screenshotState.isBucketAccessible()) return;
    this.failed = false;
  };

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.stopClickPropagation);
    screenshotState.addEventListener(STATE_CHANGED, this.onChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  override disconnectedCallback() {
    this.removeEventListener('click', this.stopClickPropagation);
    screenshotState.removeEventListener(STATE_CHANGED, this.onChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    super.disconnectedCallback();
  }

  override willUpdate() {
    // The layer adds the element before the account check resolves.
    this.hidden = !screenshotState.canSeeScreenshots();
  }

  override render() {
    if (this.hidden) return nothing;
    const shown = screenshotState.isShown(this.path);
    const url = BUCKET_URL + this.sha1;
    return html`
      <gr-button link class="toggle" @click=${() => this.toggle(!shown)}>
        <gr-icon icon=${shown ? 'visibility_off' : 'image'}></gr-icon>
        ${shown ? 'Hide screenshot' : 'Show screenshot'}
      </gr-button>
      ${!shown
        ? nothing
        : this.failed
          ? this.renderLoadError(url)
          : html`
              <a href=${url} target="_blank" rel="noopener noreferrer">
                <img
                  src=${url}
                  alt="Translation screenshot ${this.sha1}"
                  loading="lazy"
                  @load=${this.onLoad}
                  @error=${this.onError}
                />
              </a>
            `}
    `;
  }

  private toggle(shown: boolean) {
    screenshotState.setShown(this.path, shown);
    screenshotState.reporting?.reportInteraction(ReportingEvent.TOGGLED, {
      shown,
    });
  }

  private onLoad() {
    screenshotState.markBucketAccessible();
    this.reportLoaded('loaded');
  }

  private onError() {
    this.failed = true;
    this.reportLoaded(
      screenshotState.isBucketAccessible() ? 'not-found' : 'load-failed'
    );
  }

  private reportLoaded(status: LoadStatus) {
    screenshotState.reporting?.reportInteraction(ReportingEvent.LOADED, {
      status,
    });
  }

  private renderLoadError(url: string) {
    if (screenshotState.isBucketAccessible()) {
      return html`
        <div class="message not-found">
          Screenshot not found. It has probably been deleted from the bucket.
        </div>
      `;
    }
    return html`
      <div class="message sign-in">
        Could not load the screenshot. You may need to
        <a href=${url} target="_blank" rel="noopener noreferrer">sign in</a>
        with an account that has access to the
        <code>chromium-translation-screenshots</code> bucket, or the screenshot
        may have been deleted.
      </div>
    `;
  }
}

/** Adds the screenshot under each hash line of `.png.sha1` diffs. */
export function createScreenshotLayer(path?: string): DiffLayer {
  if (!path || !isTranslationScreenshotFile(path)) return {annotate() {}};
  return {
    annotate(contentEl: HTMLElement) {
      if (contentEl.querySelector('translation-screenshot')) return;
      // The public GrDiffLine has no text, so read the rendered text.
      const sha1 = SHA1_REGEX.exec(contentEl.textContent ?? '')?.[0];
      if (!sha1) return;
      void screenshotState.checkAccess();
      const screenshot = document.createElement('translation-screenshot');
      screenshot.sha1 = sha1.toLowerCase();
      screenshot.path = path;
      contentEl.appendChild(screenshot);
    },
  };
}

export function installTranslationScreenshotPreview(plugin: PluginApi) {
  screenshotState.reporting = plugin.reporting();
  screenshotState.restApi = plugin.restApi();
  plugin
    .annotationApi()
    .addDiffLayer((details: DiffDetails) =>
      createScreenshotLayer(details.fileRange?.path ?? details.path)
    );
}

declare global {
  interface Window {
    /** Mendel experiments enabled for the user, set by Gerrit. */
    ENABLED_EXPERIMENTS?: string[];
  }
  interface HTMLElementTagNameMap {
    'translation-screenshot': TranslationScreenshot;
  }
}
