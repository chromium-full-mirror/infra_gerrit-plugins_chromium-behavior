/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

const ANNOUNCEMENT_URL =
  'https://chopsdash.appspot.com/prpc/dashboard.ChopsAnnouncements/SearchAnnouncements';
const HEADERS = {
  accept: 'application/json',
  'content-type': 'application/json',
};

export interface LiveAnnouncement {
  id: string;
  messageContent: string;
}

export interface SearchAnnouncementRequest {
  retired: boolean;
  platformName: string;
}

export interface SearchAnnouncementResponse {
  announcements: LiveAnnouncement[];
}

export class ChopsDashClient {
  // call() expects searchAnnouncementRequest to be an Object equivalent
  // of SearchAnnouncementsRequest in
  // infra/go/src/infra/appengine/dashboard/api/dashboard/dashboard.proto
  async _call(
    searchAnnouncementRequest: SearchAnnouncementRequest
  ): Promise<SearchAnnouncementResponse> {
    const response = await fetch(ANNOUNCEMENT_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(searchAnnouncementRequest),
    });
    if (!response.ok) {
      throw new Error('Error fetching announcements');
    }
    const rawResponseText = await response.text();
    const xssiPrefix = ")]}'";
    if (!rawResponseText.startsWith(xssiPrefix)) {
      throw new Error(
        `Response body does not start with XSSI prefix: ${xssiPrefix}`
      );
    }
    return JSON.parse(rawResponseText.substr(xssiPrefix.length));
  }

  async getLiveAnnouncements(
    platformName: string
  ): Promise<LiveAnnouncement[]> {
    const resp = await this._call({retired: false, platformName});

    return resp.announcements || [];
  }
}
