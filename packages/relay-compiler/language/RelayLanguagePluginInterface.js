/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @providesModule RelayLanguagePluginInterface
 * @format
 */

'use strict';

// TODO T21875029 ../../relay-runtime/util/RelayConcreteNode
const RelayConcreteNode = require('RelayConcreteNode');

import type {IRTransform, Root, Fragment} from 'graphql-compiler';

export type GraphQLTag = {
  keyName: ?string,
  template: string,
  sourceLocationOffset: {
    /* TODO: Is this also expected to yse 1-based index? */
    line: number,
    /* Should use 1-based index */
    column: number,
  }
};

export type GraphQLTagFinder = (
  text: string,
) => Array<GraphQLTag>;

/**
 * Generate a module for the given document name/text.
 */
export type FormatModule = ({|
  moduleName: string,
  documentType:
    | typeof RelayConcreteNode.FRAGMENT
    | typeof RelayConcreteNode.REQUEST
    | typeof RelayConcreteNode.BATCH_REQUEST
    | null,
  docText: ?string,
  concreteText: string,
  typeText: string,
  hash: ?string,
  devOnlyAssignments: ?string,
  relayRuntimeModule: string,
  sourceHash: string,
|}) => string;

export type TypeGeneratorOptions = {|
  +customScalars: { [type: string]: string },
  +useHaste: boolean,
  +enumsHasteModule: ?string,
  +existingFragmentNames: Set<string>,
  +inputFieldWhiteList: $ReadOnlyArray<string>,
  +relayRuntimeModule: string,
|};

export type TypeGenerator = {
  transforms: Array<IRTransform>,
  generate: (node: Root | Fragment, options: TypeGeneratorOptions) => string,
};

export type PluginInterface = {
  inputExtensions: string[],
  outputExtension: string,
  findGraphQLTags: GraphQLTagFinder,
  formatModule: FormatModule,
  typeGenerator: TypeGenerator,
};
