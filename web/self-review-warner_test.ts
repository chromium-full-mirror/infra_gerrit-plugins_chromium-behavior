/**
 * @license
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

import './test-setup';
import {REVIEW_LABEL} from './common';
import {warnerHook} from './self-review-warner';

suite('self-review-warner test', () => {
  test('warnerHook without votes', () => {
    const el = {
      change: {
        owner: {email: 'foo@bar.com'},
        labels: {[REVIEW_LABEL]: {}},
      },
      getElementsByClassName: () => [],
    };
    // In this test, we expectwarnerHooks not to call methods that don't exist
    // in this dummy `el` object.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnerHook(el as any);
  });

  test('installOnSelfApproval with a service account', () => {
    const stub = sinon.stub();
    const el = {
      change: {
        owner: {email: 'foo@bar.com'},
        labels: {
          [REVIEW_LABEL]: {
            all: [
              {
                email: 'foo@bar.com',
                value: 0,
                tags: ['SERVICE_USER'],
              },
            ],
          },
        },
      },
      getElementsByClassName: () => [],
      getRootNode: () => {
        return {insertBefore: () => {}, childNodes: ['foo']};
      },
      appendChild: stub,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnerHook(el as any);
    sinon.assert.notCalled(stub);

    el.change = {
      owner: {email: 'foo@bar.com'},
      labels: {
        [REVIEW_LABEL]: {
          all: [
            {
              email: 'foo@bar.com',
              value: 0,
              tags: [],
            },
          ],
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnerHook(el as any);
    sinon.assert.calledOnce(stub);
  });
});
