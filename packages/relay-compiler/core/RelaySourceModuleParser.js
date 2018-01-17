/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @providesModule RelaySourceModuleParser
 * @flow
 * @format
 */

'use strict';

const GraphQL = require('graphql');

const fs = require('fs');
const invariant = require('invariant');
const path = require('path');

const RelayCompilerCache = require('../util/RelayCompilerCache');

const {ASTCache, Profiler} = require('graphql-compiler');

import type {GraphQLTagFinder, GraphQLTagFinderOptions} from '../language/RelayLanguagePluginInterface';
import type {File, FileFilter} from 'graphql-compiler';
import type {DocumentNode} from 'graphql';

const parseGraphQL = Profiler.instrument(GraphQL.parse, 'GraphQL.parse');

const FIND_OPTIONS = {
  validateNames: true,
};

module.exports = (tagFinder: GraphQLTagFinder) => {
  const cache = new RelayCompilerCache('RelaySourceModuleParser.memoizedTagFinder', 'v1');

  function memoizedTagFinder(
    text: string,
    baseDir: string,
    file: File,
    options: GraphQLTagFinderOptions,
  ): Array<string> {
    invariant(
      file.exists,
      'RelaySourceModuleParser: Called with non-existent file `%s`',
      file.relPath,
    );
    return cache.getOrCompute(
      file.hash + (options.validateNames ? '1' : '0'),
      () => {
        const absPath = path.join(baseDir, file.relPath);
        return tagFinder(text, absPath, options);
      },
    );
  }

  // Throws an error if parsing the file fails
  function parseFile(baseDir: string, file: File): ?DocumentNode {
    const text = fs.readFileSync(path.join(baseDir, file.relPath), 'utf8');

    invariant(
      text.indexOf('graphql') >= 0,
      'RelaySourceModuleParser: Files should be filtered before passed to the ' +
        'parser, got unfiltered file `%s`.',
      file,
    );

    const astDefinitions = [];
    memoizedTagFinder(text, baseDir, file, FIND_OPTIONS).forEach(
      template => {
        const ast = parseGraphQL(new GraphQL.Source(template, file.relPath));
        invariant(
          ast.definitions.length,
          'RelaySourceModuleParser: Expected GraphQL text to contain at least one ' +
            'definition (fragment, mutation, query, subscription), got `%s`.',
          template,
        );
        astDefinitions.push(...ast.definitions);
      },
    );

    return {
      kind: 'Document',
      definitions: astDefinitions,
    };
  }

  function getParser(baseDir: string): ASTCache {
    return new ASTCache({
      baseDir,
      parse: parseFile,
    });
  }

  function getFileFilter(baseDir: string): FileFilter {
    return (file: File) => {
      const text = fs.readFileSync(path.join(baseDir, file.relPath), 'utf8');
      return text.indexOf('graphql') >= 0;
    };
  }

  return {
    getParser,
    getFileFilter,
  };
};
