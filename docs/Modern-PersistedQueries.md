---
id: persisted-queries
title: Persisted Queries
---

The relay compiler supports persisted queries which is useful because:

* the client graphql query becomes just an md5 hash which is usually shorter than the real 
query string. This saves upload bytes from the client to the server.

* the server can now whitelist queries which improves security by restricting the operations 
that can be run from the client.

## Usage on the client

### The `--persist` flag
In your `npm` script in `package.json`, run the relay compiler using the `--persist` flag:

```js
"scripts": {
  "relay": "relay-compiler --src ./src --schema ./schema.graphql --persist"
}
```

The `--persist` flag does 3 things:

1. It converts all query and mutation operation texts to unique ids using md5 hashing.

For example without `--persist`, a generated `ConcreteRequest` might look like below:

```js
const node/*: ConcreteRequest*/ = (function(){
//... excluded for brevity
return {
  "kind": "Request",
  "operationKind": "query",
  "name": "TodoItemRefetchQuery",
  "id": null, // NOTE: id is null
  "text": "query TodoItemRefetchQuery(\n  $itemID: ID!\n) {\n  node(id: $itemID) {\n    ...TodoItem_item_2FOrhs\n  }\n}\n\nfragment TodoItem_item_2FOrhs on Todo {\n    text\n    isComplete\n}\n",
  //... excluded for brevity
};
})();
```

With `--persist` this becomes:

```js
const node/*: ConcreteRequest*/ = (function(){
//... excluded for brevity
return {
  "kind": "Request",
  "operationKind": "query",
  "name": "TodoItemRefetchQuery",
  "id": "3be4abb81fa595e25eb725b2c6a87508", // NOTE: id is now an md5 hash of the query text
  "text": null, // NOTE: text is null now
  //... excluded for brevity
};
})();
```

2. It generates a matching `.graphql.json` file containing a map of the id and the operation text in the same `__generated__` 
directory as the `.graphql.js` file. In the example above, the `__generated__` directory will have these files:

* `./__generated__/TodoItemRefetchQuery.graphql.js`
* `./__generated__/TodoItemRefetchQuery.graphql.json`

The `.graphql.json` file looks something like this:

```json
{
  "3be4abb81fa595e25eb725b2c6a87508": "query TodoItemRefetchQuery(\n  $itemID: ID!\n) {\n  node(id: $itemID) {\n    ...TodoItem_item_2FOrhs\n  }\n}\n\nfragment TodoItem_item_2FOrhs on Todo {\n    text\n    isComplete\n}\n"
}
```

3. It also generates a complete query map file at `[your_src_dir]/queryMap.graphql.json`. This file contains all the query ids 
and their operation texts.

### Network layer changes
You'll need to modify your network layer fetch implementation to pass a queryId parameter in the POST body instead of a query parameter:

```js
function fetchQuery(operation, variables,) {
  return fetch('/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      queryId: operation.id, // NOTE: pass md5 hash to the server
      // query: operation.text, // this is now obsolete because text is null 
      variables,
    }),
  }).then(response => {
    return response.json();
  });
}
```

## Usage on the server
On the server, you'll need to map the query id in the POST body to the real operation text. You can utilise the complete 
`queryMap.graphql.json` file to do this so you'll need a copy of it on your server. 

For universal applications where the client and server code are in one project, this is not an issue since you can place 
the query map file in a common location accessible to both the client and the server.

For applications where the client and server projects are separate, you can solve this by having an additional npm run script
to push the query map file to a location accessible by your server:

```js
"scripts": {
  "push-queries": "node ./pushQueries.js",
  "relay": "relay-compiler --src ./src --schema ./schema.graphql --persist && npm run push-queries"
}
```

Some possibilities of what you can do in `./pushQueries.js`:

* `git push` to your server repo

* save the query maps to a database


### Simple server example
Once your server has access to the query map, you can perform the mapping. The solution varies depending on the server and
database technologies you use, so we'll just cover the most common and basic example here.
 
If you use `express-graphql` and have access to the query map file, you can import the `queryMap.graphql.json` file directly and
perform the matching using the `matchQueryMiddleware` from [relay-compiler-plus](https://github.com/yusinto/relay-compiler-plus).
 
```js
import Express from 'express';
import expressGraphl from 'express-graphql';
import {matchQueryMiddleware} from 'relay-compiler-plus';
import queryMapJson from './queryMap.graphql.json';

const app = Express();

app.use('/graphql',
  matchQueryMiddleware(queryMapJson),
  expressGraphl({schema}));
```

## Using `--persist` and `--watch`
It is possible to continuously generate the query map files by using the `--persist` and `--watch` options simultaneously. 
This only makes sense for universal applications i.e. if your client and server code are in a single project 
and you run them both together on localhost during development. Furthermore, in order for the server to pick up changes 
to the `queryMap.graphql.json`, you'll need to have server side hot-reloading set up. The details on how to set this up
is out of the scope of this document.  
