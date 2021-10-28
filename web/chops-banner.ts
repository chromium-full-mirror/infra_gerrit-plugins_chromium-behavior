/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {ChopsDashClient, LiveAnnouncement} from './chops-announcements';

const REFRESH_TIME_MIN = 5;
const MINUTE_INTERVAL = 60 * 1000;

function setClosedBannerCookie(announcementId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.cookie =
    `announcement${announcementId}=closed; ` +
    `expires=${tomorrow.toUTCString()};`;
}

function getAnnouncementCookie(announcementId: string): string {
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookiesList = decodedCookie.split(';');
  const prefix = `announcement${announcementId}=`;
  const matchingCookie = cookiesList.find(cookie => {
    cookie = cookie.trim();
    return cookie.startsWith(prefix);
  });
  if (!matchingCookie) {
    return '';
  }
  return matchingCookie.trim();
}

function announcementCookieExists(announcementId: string) {
  const cookie = getAnnouncementCookie(announcementId);
  return cookie !== '';
}

export class ChopsBanner {
  private chopsAnnouncementsPlatform: string;

  private shownAnnouncements: LiveAnnouncement[] = [];

  private message: HTMLElement;

  private closeBtn: HTMLElement;

  private client: ChopsDashClient;

  constructor(host: string, element: HTMLElement) {
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
        throw Error('Host not supported.');
    }

    // Set up calls to chopsdash to fetch live announcements
    this.client = new ChopsDashClient();

    // Set up banner element
    const banner = element.appendChild(document.createElement('div'));
    banner.style.color = 'black';
    banner.style.background = 'pink';
    banner.style.textAlign = 'center';
    banner.style.fontSize = '15px';
    banner.style.whiteSpace = 'pre-wrap';

    this.message = banner.appendChild(document.createElement('p'));
    this.message.style.margin = '0px';

    this.closeBtn = banner.appendChild(document.createElement('span'));
    this.closeBtn.textContent = 'X';
    this.closeBtn.style.position = 'absolute';
    this.closeBtn.style.right = '10px';
    this.closeBtn.style.top = '1px';
    this.closeBtn.style.color = '#777';
    this.closeBtn.style.cursor = 'pointer';
    this.closeBtn.style.visibility = 'hidden';

    this.closeBtn.addEventListener('click', () => this.closeBanner());

    this.updateBanner();
    setInterval(() => {
      this.updateBanner();
    }, REFRESH_TIME_MIN * MINUTE_INTERVAL);
  }

  private async updateBanner() {
    try {
      const announcements = await this.client.getLiveAnnouncements(
        this.chopsAnnouncementsPlatform
      );
      // Only show announcements that weren't part of a banner that got closed.
      this.shownAnnouncements = announcements.filter(
        ann => !announcementCookieExists(ann.id)
      );
      const messages = this.shownAnnouncements.map(ann => ann.messageContent);
      this.message.textContent = messages.join('\r\n');
      this.closeBtn.style.visibility = messages.length ? 'visible' : 'hidden';
    } catch (e) {
      console.warn(e);
      this.message.textContent =
        'Unable to get outage announcements from ChOpsDash.';
      this.closeBtn.style.visibility = 'visible';
    }
  }

  private closeBanner() {
    this.message.textContent = '';
    // Add a cookie for announcements in the banner so they don't reappear.
    this.shownAnnouncements.forEach(ann => setClosedBannerCookie(ann.id));
    this.shownAnnouncements = [];
    this.closeBtn.style.visibility = 'hidden';
  }
}
