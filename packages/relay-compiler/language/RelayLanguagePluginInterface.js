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

import type {IRTransform, Root, Fragment} from 'graphql-compiler';
import type {FormatModule} from '../codegen/writeRelayGeneratedFile';

export type TypeGenerator = {
  transforms: Array<IRTransform>,
  // For now this is an opaque set of options communicated from the bin to the plugin.
  generate: (node: Root | Fragment, options: any) => string,
};

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

export type PluginInterface = {
  inputExtensions: string[],
  outputExtension: string,
  typeGenerator: TypeGenerator,
  formatModule: FormatModule,
  findGraphQLTags: GraphQLTagFinder,
};
