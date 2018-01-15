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

import type {File, IRTransform, Root, Fragment} from 'graphql-compiler';
import type {FormatModule} from '../codegen/writeRelayGeneratedFile';

export type TypeGenerator = {
  transforms: Array<IRTransform>,
  // For now this is an opaque set of options communicated from the bin to the plugin.
  generate: (node: Root | Fragment, options: any) => string,
};

export type GraphQLTagFinderOptions = {|
  validateNames: boolean,
|};

export type GraphQLTagFinder = (
  text: string,
  baseDir: string,
  file: File,
  options: GraphQLTagFinderOptions,
) => Array<string>;

export type PluginInterface = {
  inputExtensions: string[],
  outputExtension: string,
  typeGenerator: TypeGenerator,
  formatModule: FormatModule,
  findGraphQLTags: GraphQLTagFinder,
};
