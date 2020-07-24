// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {ChopsDashClient} from './chops-announcements.js';

const BANNER_STYLES = {
  styleBanner:
      'color: black;' +
      'background: pink;' +
      'text-align: center;' +
      'font-size: 15px;' +
      'white-space: pre-wrap;',
  styleCloseBtn:
      'position: absolute;' +
      'right: 5px;' +
      'top: 1px;' +
      'color: #777;' +
      'cursor: pointer;' +
      'visibility: hidden;',
  styleMessage: 'margin: 0px;',
};

const REFRESH_TIME_MIN = 5;
const MINUTE_INTERVAL = 60 * 1000;

function setClosedBannerCookie(announcementId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.cookie = `announcement${announcementId}=closed; ` +
                    `expires=${tomorrow.toUTCString()};`;
}

function getAnnouncementCookie(announcementId) {
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookiesList = decodedCookie.split(';');
  const prefix = `announcement${announcementId}=`;
  const matchingCookie = cookiesList.find((cookie) => {
    cookie = cookie.trim();
    if (cookie.startsWith(prefix)) {
      return true;
    }
  });
  if (!matchingCookie) {
    return '';
  }
  return matchingCookie.trim();
}

function announcementCookieExists(announcementId) {
  const cookie = getAnnouncementCookie(announcementId);
  return (cookie !== '');
}

export class ChopsBanner {
  constructor(host) {
    switch (host) {
      case 'chromium-review.googlesource.com':
      case 'canary-chromium-review.googlesource.com':
        this.chopsAnnouncementsPlatform = 'chromium-review';
        break;
      case 'chrome-internal-review.googlesource.com':
      case 'canary-chrome-internal-review.googlesource.com':
        this.chopsAnnouncementsPlatform = 'chrome-internal-review';
        break;
      default:
        this.chopsAnnouncementsPlatform = undefined;
    }
  }

  /**
   * Sets up the banner element and begins calls to chopsdash for chops
   * announcements.
   * @param {element} the banner element.
   */
  async register(element) {
    if (!this.chopsAnnouncementsPlatform) {
      return;
    }

    this.shownAnnouncements = [];

    // Set up banner element
    const banner = element.appendChild(document.createElement('div'));
    banner.style = BANNER_STYLES.styleBanner;

    this.message = banner.appendChild(document.createElement('p'));
    this.message.style = BANNER_STYLES.styleMessage;
    this.closeBtn = banner.appendChild(document.createElement('span'));
    this.closeBtn.textContent = 'x';
    this.closeBtn.style = BANNER_STYLES.styleCloseBtn;

    this.closeBtn.addEventListener('click', this.closeBanner);
    // Set up calls to chopsdash to fetch live announcements
    this.client = new ChopsDashClient();

    this.updateBanner();
    setInterval(() => {
      this.updateBanner();
    }, REFRESH_TIME_MIN * MINUTE_INTERVAL);
  }

  async updateBanner() {
    try {
      const resp = await this.client.getLiveAnnouncements(
          this.chopsAnnouncementsPlatform);
      // Only show announcements that weren't part of a banner that got closed.
      const announcements = resp.announcements || [];
      this.shownAnnouncements = announcements.filter((ann) => (
        (!announcementCookieExists(ann.id))));
      const messages = this.shownAnnouncements.map((ann) => ann.messageContent);
      this.message.textContent = messages.join('\r\n');
      this.closeBtn.style.visibility = messages.length ? 'visible' : 'hidden';
    } catch (e) {
      console.log(e);
      this.message.textContent = 'Unable to get outage announcements ' +
                                 'from ChOpsDash.';
      this.closeBtn.style.visibility = 'visible';
    }
  }

  closeBanner() {
    this.message.textContent = '';
    // Add a cookie for announcements in the banner so they don't reappear.
    this.shownAnnouncements.forEach((ann) => setClosedBannerCookie(ann.id));
    this.shownAnnouncements = [];
    this.closeBtn.style.visibility = 'hidden';
  }
}
