/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @providesModule RelayCompilerBin
 * @format
 */

'use strict';

require('babel-polyfill');

const {
  CodegenRunner,
  ConsoleReporter,
  WatchmanClient,
} = require('graphql-compiler');

const RelaySourceModuleParser = require('../core/RelaySourceModuleParser');
const RelayFileWriter = require('../codegen/RelayFileWriter');
const RelayIRTransforms = require('../core/RelayIRTransforms');
const RelayLanguagePluginJavaScript = require('../language/javascript/RelayLanguagePluginJavaScript');

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

const {
  buildASTSchema,
  buildClientSchema,
  parse,
  printSchema,
} = require('graphql');

const {
  commonTransforms,
  codegenTransforms,
  fragmentTransforms,
  printTransforms,
  queryTransforms,
  schemaExtensions,
} = RelayIRTransforms;

import type {GetWriterOptions} from 'graphql-compiler';
import type {GraphQLSchema} from 'graphql';
import type {PluginInterface} from '../language/RelayLanguagePluginInterface';

function buildWatchExpression(options: {
  extensions: Array<string>,
  include: Array<string>,
  exclude: Array<string>,
}) {
  return [
    'allof',
    ['type', 'f'],
    ['anyof', ...options.extensions.map(ext => ['suffix', ext])],
    [
      'anyof',
      ...options.include.map(include => ['match', include, 'wholename']),
    ],
    ...options.exclude.map(exclude => ['not', ['match', exclude, 'wholename']]),
  ];
}

function getFilepathsFromGlob(
  baseDir,
  options: {
    extensions: Array<string>,
    include: Array<string>,
    exclude: Array<string>,
  },
): Array<string> {
  const {extensions, include, exclude} = options;
  const patterns = include.map(inc => `${inc}/*.+(${extensions.join('|')})`);

  const glob = require('fast-glob');
  return glob.sync(patterns, {
    cwd: baseDir,
    bashNative: [],
    onlyFiles: true,
    ignore: exclude,
  });
}

function getLanguagePlugin(options: {language: string}): PluginInterface {
  if (options.language === 'javascript') {
    return RelayLanguagePluginJavaScript();
  } else {
    try {
      // $FlowFixMe
      let languagePlugin = __non_webpack_require__(
        `relay-compiler-language-${options.language}`,
      ); // eslint-disable-line no-undef
      if (languagePlugin.default) {
        languagePlugin = languagePlugin.default;
      }
      if (typeof languagePlugin === 'function') {
        // For now a plugin doesn’t take any arguments, but may do so in the future.
        return languagePlugin();
      }
    } catch (err) {}
  }
  throw new Error(
    `Unable to load language plugin: relay-compiler-language-${
      options.language
    }`,
  );
}

async function run(options: {
  schema: string,
  src: string,
  extensions: Array<string>,
  include: Array<string>,
  exclude: Array<string>,
  verbose: boolean,
  watchman: boolean,
  watch?: ?boolean,
  validate: boolean,
  language: string,
  outputDir?: ?string,
}) {
  const schemaPath = path.resolve(process.cwd(), options.schema);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`--schema path does not exist: ${schemaPath}.`);
  }
  const srcDir = path.resolve(process.cwd(), options.src);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`--source path does not exist: ${srcDir}.`);
  }
  if (options.watch && !options.watchman) {
    throw new Error('Watchman is required to watch for changes.');
  }
  if (options.watch && !hasWatchmanRootFile(srcDir)) {
    throw new Error(
      `
--watch requires that the src directory have a valid watchman "root" file.

Root files can include:
- A .git/ Git folder
- A .hg/ Mercurial folder
- A .watchmanconfig file

Ensure that one such file exists in ${srcDir} or its parents.
    `.trim(),
    );
  }

  const reporter = new ConsoleReporter({verbose: options.verbose});

  const useWatchman = options.watchman && (await WatchmanClient.isAvailable());

  const languagePlugin = getLanguagePlugin(options);

  const extensions = options.extensions || languagePlugin.inputExtensions;

  const sourceModuleParser = RelaySourceModuleParser(
    languagePlugin.findGraphQLTags,
  );

  const parserConfigs = {
    default: {
      baseDir: srcDir,
      getFileFilter: sourceModuleParser.getFileFilter,
      getParser: sourceModuleParser.getParser,
      getSchema: () => getSchema(schemaPath),
      watchmanExpression: useWatchman
        ? buildWatchExpression({...options, extensions})
        : null,
      filepaths: useWatchman
        ? null
        : getFilepathsFromGlob(srcDir, {...options, extensions}),
    },
  };
  const writerConfigs = {
    default: {
      getWriter: getRelayFileWriter(srcDir, languagePlugin, options.outputDir),
      isGeneratedFile: (filePath: string) =>
        filePath.endsWith('.' + languagePlugin.outputExtension) &&
        filePath.includes('__generated__'),
      parser: 'default',
    },
  };
  const codegenRunner = new CodegenRunner({
    reporter,
    parserConfigs,
    writerConfigs,
    onlyValidate: options.validate,
    // TODO: allow passing in a flag or detect?
    sourceControl: null,
  });
  if (!options.validate && !options.watch && options.watchman) {
    // eslint-disable-next-line no-console
    console.log('HINT: pass --watch to keep watching for changes.');
  }
  const result = options.watch
    ? await codegenRunner.watchAll()
    : await codegenRunner.compileAll();

  if (result === 'ERROR') {
    process.exit(100);
  }
  if (options.validate && result !== 'NO_CHANGES') {
    process.exit(101);
  }
}

function getRelayFileWriter(
  baseDir: string,
  languagePlugin: PluginInterface,
  outputDir?: ?string,
) {
  return ({
    onlyValidate,
    schema,
    documents,
    baseDocuments,
    sourceControl,
    reporter,
  }: GetWriterOptions) =>
    new RelayFileWriter({
      config: {
        baseDir,
        compilerTransforms: {
          commonTransforms,
          codegenTransforms,
          fragmentTransforms,
          printTransforms,
          queryTransforms,
        },
        customScalars: {},
        formatModule: languagePlugin.formatModule,
        inputFieldWhiteListForFlow: [],
        schemaExtensions,
        useHaste: false,
        extension: languagePlugin.outputExtension,
        typeGenerator: languagePlugin.typeGenerator,
        outputDir: outputDir,
      },
      onlyValidate,
      schema,
      baseDocuments,
      documents,
      reporter,
      sourceControl,
    });
}

function getSchema(schemaPath: string): GraphQLSchema {
  try {
    let source = fs.readFileSync(schemaPath, 'utf8');
    if (path.extname(schemaPath) === '.json') {
      source = printSchema(buildClientSchema(JSON.parse(source).data));
    }
    source = `
  directive @include(if: Boolean) on FRAGMENT_SPREAD | FIELD
  directive @skip(if: Boolean) on FRAGMENT_SPREAD | FIELD

  ${source}
  `;
    return buildASTSchema(parse(source), {assumeValid: true});
  } catch (error) {
    throw new Error(
      `
Error loading schema. Expected the schema to be a .graphql or a .json
file, describing your GraphQL server's API. Error detail:

${error.stack}
    `.trim(),
    );
  }
}

// Ensure that a watchman "root" file exists in the given directory
// or a parent so that it can be watched
const WATCHMAN_ROOT_FILES = ['.git', '.hg', '.watchmanconfig'];
function hasWatchmanRootFile(testPath) {
  while (path.dirname(testPath) !== testPath) {
    if (
      WATCHMAN_ROOT_FILES.some(file => {
        return fs.existsSync(path.join(testPath, file));
      })
    ) {
      return true;
    }
    testPath = path.dirname(testPath);
  }
  return false;
}

// Collect args
const argv = yargs
  .usage(
    'Create Relay generated files\n\n' +
      '$0 --schema <path> --src <path> [--watch]',
  )
  .options({
    schema: {
      describe: 'Path to schema.graphql or schema.json',
      demandOption: true,
      type: 'string',
    },
    src: {
      describe: 'Root directory of application code',
      demandOption: true,
      type: 'string',
    },
    include: {
      array: true,
      default: ['**'],
      describe: 'Directories to include under src',
      type: 'string',
    },
    exclude: {
      array: true,
      default: [
        '**/node_modules/**',
        '**/__mocks__/**',
        '**/__tests__/**',
        '**/__generated__/**',
      ],
      describe: 'Directories to ignore under src',
      type: 'string',
    },
    extensions: {
      array: true,
      describe:
        'File extensions to compile (defaults to extensions provided by the language plugin)',
      type: 'string',
    },
    verbose: {
      describe: 'More verbose logging',
      type: 'boolean',
    },
    watchman: {
      describe: 'Use watchman when not in watch mode',
      type: 'boolean',
      default: true,
    },
    watch: {
      describe: 'If specified, watches files and regenerates on changes',
      type: 'boolean',
    },
    validate: {
      describe:
        'Looks for pending changes and exits with non-zero code instead of ' +
        'writing to disk',
      type: 'boolean',
      default: false,
    },
    language: {
      describe:
        'The module name of the language plugin used for input files and artifacts',
      type: 'string',
      default: 'javascript',
    },
    outputDir: {
      describe:
        'An optional directory to output all artifacts to. When enabling this, additional configuration of the babel plugin needs to reflect this.',
      type: 'string',
      default: null,
    },
  })
  .help().argv;

// Run script with args
// $FlowFixMe: Invalid types for yargs. Please fix this when touching this code.
run(argv).catch(error => {
  console.error(String(error.stack || error));
  process.exit(1);
});
