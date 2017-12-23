/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @providesModule RelayTransformUtils
 * @format
 */

'use strict';

import type {Fragment, LinkedField} from 'graphql-compiler';

function getUnaliasedSelectionIndex(
  node: Fragment | LinkedField,
  fieldName: string,
): number {
  return node.selections.findIndex(
    selection =>
      selection.kind === 'ScalarField' &&
      selection.alias == null &&
      selection.name === fieldName,
  );
}

function hasUnaliasedSelection(field: LinkedField, fieldName: string): boolean {
  return getUnaliasedSelectionIndex(field, fieldName) !== -1;
}

module.exports = {getUnaliasedSelectionIndex, hasUnaliasedSelection};
