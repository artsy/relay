/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @providesModule RelayGenerateRequisiteFieldsTransform
 * @format
 */

'use strict';

const GraphQLSchemaUtils = require('GraphQLSchemaUtils');
const RelayCompilerContext = require('RelayCompilerContext');

const {
  assertAbstractType,
  assertCompositeType,
  assertLeafType
} = require('graphql');

import type {InlineFragment, LinkedField, Node, Selection} from 'RelayIR';
import type {GraphQLCompositeType, GraphQLLeafType, GraphQLType } from 'graphql';
const {
  canHaveSelections,
  getRawType,
  hasID,
  implementsInterface,
  isAbstractType,
  mayImplement,
} = GraphQLSchemaUtils;

const TYPENAME_KEY = '__typename';
const ID = 'id';
const ID_TYPE = 'ID';
const NODE_TYPE = 'Node';
const STRING_TYPE = 'String';

/**
 * A transform that adds "requisite" fields to all nodes:
 * - Adds an `id` selection on any `LinkedField` of type that implements `Node`
 *   or has an id field but where there is no unaliased `id` selection.
 * - Adds `__typename` on any `LinkedField` of a union/interface type where
 *   there is no unaliased `__typename` selection.
 */
function transform(context: RelayCompilerContext): RelayCompilerContext {
  const documents = context.documents();
  return documents.reduce((ctx: RelayCompilerContext, node) => {
    const transformedNode = transformNode(context, node);
    return ctx.add(transformedNode);
  }, new RelayCompilerContext(context.schema));
}

function transformNode<T: Node>(context: RelayCompilerContext, node: T): T {
  const selections = node.selections.map(selection => {
    if (selection.kind === 'LinkedField') {
      return transformField(context, selection);
    } else if (
      selection.kind === 'InlineFragment' ||
      selection.kind === 'Condition'
    ) {
      return transformNode(context, selection);
    } else {
      return selection;
    }
  });
  return ({
    ...node,
    selections,
  }: $FlowIssue);
}

function transformField(
  context: RelayCompilerContext,
  field: LinkedField,
): LinkedField {
  const transformedNode = transformNode(context, field);
  const {type} = field;
  const generatedSelections = [...transformedNode.selections];
  const idSelections = generateIDSelections(context, field, field.type);
  if (idSelections) {
    generatedSelections.push(...idSelections);
  }
  if (isAbstractType(type) && !hasUnaliasedSelection(field, TYPENAME_KEY)) {
    const stringType = assertLeafType(context.schema.getType(STRING_TYPE));
    generatedSelections.push({
      kind: 'ScalarField',
      alias: (null: ?string),
      args: [],
      directives: [],
      handles: null,
      metadata: null,
      name: TYPENAME_KEY,
      type: stringType,
    });
  }
  const selections = sortSelections(generatedSelections);
  return {
    ...transformedNode,
    selections,
  };
}

/**
 * @internal
 *
 * Returns an array of zero or more selections to fetch `id` depending on the
 * type of the given field:
 * - If the field already has an unaliased `id` field, do nothing
 * - If the field type has an `id` subfield, return an `id` selection
 * - If the field type is abstract, then generate a `... on Node { id }`
 *   fragment if *any* concrete type implements Node. Then generate a
 *   `... on PossibleType { id }` for every concrete type that does *not*
 *   implement `Node`
 * - If the field type implements the Node interface, return a selection of the
 *   one field in the Node interface that is of type `ID`.
 */
function generateIDSelections(
  context: RelayCompilerContext,
  field: LinkedField,
  type: GraphQLType,
): ?Array<Selection> {
  const generatedNodeIdSelections = generateSpecificIDSelections(context, field, type, context.getNodeIDFieldName());
  if (!generatedNodeIdSelections) {
    // The field already has an unaliased selection for the Node ID field.
    return null;
  } else if (generatedNodeIdSelections.length > 0) {
    return generatedNodeIdSelections;
  }

  if (context.getNodeIDFieldName() !== ID) {
    const generatedFallbackIdSelections = generateSpecificIDSelections(context, field, type, ID);
    if (!generatedFallbackIdSelections) {
      // The field already has an unaliased selection for the fallback ID field.
      return null;
    } else if (generatedFallbackIdSelections.length > 0) {
      return generatedFallbackIdSelections;
    }
  }

  const generatedSelections = [];
  const unmodifiedType = assertCompositeType(getRawType(type));
  if (isAbstractType(unmodifiedType)) {
    // Union or interface: concrete types may implement `Node` or have an `id`
    // field
    const idType = assertLeafType(context.schema.getType(ID_TYPE));
    if (mayImplement(context.schema, unmodifiedType, NODE_TYPE)) {
      const nodeType = assertCompositeType(context.schema.getType(NODE_TYPE));
      generatedSelections.push(buildIdFragment(nodeType, idType, context.getNodeIDFieldName()));
    }
    const abstractType = assertAbstractType(unmodifiedType);
    context.schema.getPossibleTypes(abstractType).forEach(possibleType => {
      if (!implementsInterface(possibleType, NODE_TYPE)) {
        if (hasID(context.schema, possibleType, context.getNodeIDFieldName())) {
          generatedSelections.push(buildIdFragment(possibleType, idType, context.getNodeIDFieldName()));
        } else if (hasID(context.schema, possibleType, ID)) {
          generatedSelections.push(buildIdFragment(possibleType, idType, ID));
        }
      }
    });
  }
  return generatedSelections;
}

function generateSpecificIDSelections(
  context: RelayCompilerContext,
  field: LinkedField,
  type: GraphQLType,
  idFieldName: string,
): ?Array<Selection> {
  if (hasUnaliasedSelection(field, idFieldName)) {
    return null;
  }
  const generatedSelections = []
  const unmodifiedType = assertCompositeType(getRawType(type));
  // Object or  Interface type that has `id` field
  if (
    canHaveSelections(unmodifiedType) &&
    hasID(context.schema, unmodifiedType, idFieldName)
  ) {
    const idType = assertLeafType(context.schema.getType(ID_TYPE));
    generatedSelections.push(buildIdSelection(idType, idFieldName));
  }
  return generatedSelections;
}

/**
 * @internal
 */
function buildIdSelection(
  idType: GraphQLLeafType,
  idFieldName: string,
): Selection {
  return {
    kind: 'ScalarField',
    alias: (null: ?string),
    args: [],
    directives: [],
    handles: null,
    metadata: null,
    name: idFieldName,
    type: idType,
  };
}

/**
 * @internal
 */
function buildIdFragment(
  fragmentType: GraphQLCompositeType,
  idType: GraphQLLeafType,
  fieldName: string
): InlineFragment {
  return {
    kind: 'InlineFragment',
    directives: [],
    metadata: null,
    typeCondition: fragmentType,
    selections: [buildIdSelection(idType, fieldName)],
  };
}

/**
 * @internal
 */
function hasUnaliasedSelection(field: LinkedField, fieldName: string): boolean {
  return field.selections.some(
    selection =>
      selection.kind === 'ScalarField' &&
      selection.alias == null &&
      selection.name === fieldName,
  );
}

/**
 * @internal
 *
 * For interoperability with classic systems, sort `__typename` first.
 */
function sortSelections(selections: Array<$FlowIssue>): Array<$FlowIssue> {
  return [...selections].sort((a, b) => {
    return a.kind === 'ScalarField' && a.name === TYPENAME_KEY
      ? -1
      : b.kind === 'ScalarField' && b.name === TYPENAME_KEY ? 1 : 0;
  });
}

module.exports = {transform};
