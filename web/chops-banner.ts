/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import {getGerritHost} from './common';
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
  private readonly chopsAnnouncementsPlatform: string;

  private readonly client: ChopsDashClient;

  private readonly closeBtn: HTMLElement;

  private readonly message: HTMLElement;

  private shownAnnouncements: LiveAnnouncement[] = [];

  constructor(host: string, element: HTMLElement) {
    const gerritHost = getGerritHost(host);
    if (gerritHost === 'chromium') {
      this.chopsAnnouncementsPlatform = 'chromium-review';
    } else if (gerritHost === 'chrome-internal') {
      this.chopsAnnouncementsPlatform = 'chrome-internal-review';
    } else {
      throw new Error('Host not supported.');
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
    for (const ann of this.shownAnnouncements) {
      setClosedBannerCookie(ann.id);
    }
    this.shownAnnouncements = [];
    this.closeBtn.style.visibility = 'hidden';
  }
}
